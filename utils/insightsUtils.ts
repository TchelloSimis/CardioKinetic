/**
 * Insights Utilities
 * 
 * Analytics calculations for the Training Insights Dashboard.
 * Provides personal records, trend analysis, fatigue/readiness insights, and recent activity.
 * 
 * Uses Chronic Fatigue Model (dual-compartment) for fatigue/readiness calculations.
 */

import { Session, ProgramRecord } from '../types';
import { getLocalDateString, addDays, compareDates, isDateInRange, parseLocalDate } from './dateUtils';
import {
    updateMetabolicFreshness,
    updateStructuralHealth,
    calculateReadinessScore as calculateChronicReadiness,
    DEFAULT_PHI_RECOVERY,
    DEFAULT_CAP_METABOLIC,
    DEFAULT_CAP_STRUCTURAL,
    SIGMA_IMPACT,
} from './chronicFatigueModel';
import { estimateCostFromAverage } from './physiologicalCostEngine';

// ============================================================================
// TYPES
// ============================================================================

export interface PersonalRecord {
    type: 'power' | 'duration' | 'work';
    value: number;
    unit: string;
    sessionId: string;
    date: string;
}

export interface TrendData {
    period: 'week' | 'month';
    current: {
        avgPower: number;
        avgDuration: number;
        totalWork: number;  // Wh
        sessionCount: number;
    };
    previous: {
        avgPower: number;
        avgDuration: number;
        totalWork: number;  // Wh
        sessionCount: number;
    };
    changes: {
        power: number;      // percentage change
        duration: number;   // percentage change
        work: number;       // percentage change
        sessions: number;   // absolute change
    };
}

export interface FatigueReadinessInsights {
    currentFatigue: number;
    currentReadiness: number;
    weeklyFatigueAvg: number;
    weeklyReadinessAvg: number;
    fatigueChange: number;      // vs last week
    readinessChange: number;    // vs last week
    trend: 'improving' | 'stable' | 'declining';
    insight: string;            // Human-readable insight message
    recommendation: string;     // Actionable recommendation
}

export interface RecentActivitySummary {
    days: number;
    sessions: { date: string; power: number; duration: number; rpe: number }[];
    avgPower: number;
    avgDuration: number;
    avgRPE: number;
    totalWork: number;  // Wh
    sessionCount: number;
}

// ============================================================================
// PERSONAL RECORDS
// ============================================================================

/**
 * Calculates personal records for power, duration, and total work.
 * Work is returned in Wh (Watt-hours).
 */
export function calculatePersonalRecords(sessions: Session[]): PersonalRecord[] {
    if (sessions.length === 0) return [];

    const records: PersonalRecord[] = [];

    let bestPower = 0;
    let bestDuration = 0;
    let bestWork = 0;
    let powerPR: Session | null = null;
    let durationPR: Session | null = null;
    let workPR: Session | null = null;

    for (const session of sessions) {
        // Work in Wh = W * min / 60
        const work = (session.power || 0) * (session.duration || 0) / 60;

        if ((session.power || 0) > bestPower) {
            bestPower = session.power || 0;
            powerPR = session;
        }
        if ((session.duration || 0) > bestDuration) {
            bestDuration = session.duration || 0;
            durationPR = session;
        }
        if (work > bestWork) {
            bestWork = work;
            workPR = session;
        }
    }

    if (powerPR) {
        records.push({
            type: 'power',
            value: powerPR.power,
            unit: 'W',
            sessionId: powerPR.id,
            date: powerPR.date
        });
    }

    if (durationPR) {
        records.push({
            type: 'duration',
            value: durationPR.duration,
            unit: 'min',
            sessionId: durationPR.id,
            date: durationPR.date
        });
    }

    if (workPR) {
        const work = (workPR.power || 0) * (workPR.duration || 0) / 60;
        records.push({
            type: 'work',
            value: Math.round(work),
            unit: 'Wh',
            sessionId: workPR.id,
            date: workPR.date
        });
    }

    return records;
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

/**
 * Calculates trend data for a given period (week or month).
 * Uses the provided currentDate for date calculations (supports simulated dates).
 * Work is in Wh.
 */
export function calculateTrends(
    sessions: Session[],
    period: 'week' | 'month',
    currentDate: Date = new Date()
): TrendData {
    const periodDays = period === 'week' ? 7 : 30;

    // Use timezone-agnostic date strings
    const currentDateStr = getLocalDateString(currentDate);
    const currentStartStr = addDays(currentDateStr, -periodDays);
    const previousStartStr = addDays(currentStartStr, -periodDays);

    const currentSessions = sessions.filter(s =>
        isDateInRange(s.date, currentStartStr, currentDateStr)
    );

    const previousSessions = sessions.filter(s =>
        s.date >= previousStartStr && s.date < currentStartStr
    );

    const currentMetrics = calculatePeriodMetrics(currentSessions);
    const previousMetrics = calculatePeriodMetrics(previousSessions);

    return {
        period,
        current: currentMetrics,
        previous: previousMetrics,
        changes: {
            power: previousMetrics.avgPower > 0
                ? ((currentMetrics.avgPower - previousMetrics.avgPower) / previousMetrics.avgPower) * 100
                : 0,
            duration: previousMetrics.avgDuration > 0
                ? ((currentMetrics.avgDuration - previousMetrics.avgDuration) / previousMetrics.avgDuration) * 100
                : 0,
            work: previousMetrics.totalWork > 0
                ? ((currentMetrics.totalWork - previousMetrics.totalWork) / previousMetrics.totalWork) * 100
                : 0,
            sessions: currentMetrics.sessionCount - previousMetrics.sessionCount
        }
    };
}

function calculatePeriodMetrics(sessions: Session[]) {
    if (sessions.length === 0) {
        return { avgPower: 0, avgDuration: 0, totalWork: 0, sessionCount: 0 };
    }

    const totalPower = sessions.reduce((sum, s) => sum + (s.power || 0), 0);
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    // Work in Wh = sum of (power * duration / 60) for each session
    const totalWork = sessions.reduce((sum, s) => sum + ((s.power || 0) * (s.duration || 0) / 60), 0);

    return {
        avgPower: Math.round(totalPower / sessions.length),
        avgDuration: Math.round(totalDuration / sessions.length),
        totalWork: Math.round(totalWork),
        sessionCount: sessions.length
    };
}

// ============================================================================
// FATIGUE & READINESS INSIGHTS (Chronic Fatigue Model)
// ============================================================================

// Helper to calculate fatigue score from chronic state
function calculateFatigueFromChronic(sMeta: number, sStruct: number): number {
    const capMeta = DEFAULT_CAP_METABOLIC;
    const capStruct = DEFAULT_CAP_STRUCTURAL;
    const metaRatio = sMeta / capMeta;
    const structRatio = sStruct / capStruct;
    const avgRatio = (metaRatio * 0.6 + structRatio * 0.4);
    return Math.round(Math.min(100, Math.max(0, avgRatio * 100)));
}

/**
 * Calculate fatigue and readiness trend insights using Chronic Fatigue Model.
 * Provides analysis, trend direction, and actionable recommendations.
 */
export function calculateFatigueReadinessInsights(
    sessions: Session[],
    programStartDate: Date,
    currentDate: Date,
    basePower: number = 150
): FatigueReadinessInsights {
    // Default values for no data
    const defaultInsights: FatigueReadinessInsights = {
        currentFatigue: 0,
        currentReadiness: 75,
        weeklyFatigueAvg: 0,
        weeklyReadinessAvg: 75,
        fatigueChange: 0,
        readinessChange: 0,
        trend: 'stable',
        insight: 'Start training to see your fatigue and readiness patterns.',
        recommendation: 'Log a few sessions to unlock personalized insights.'
    };

    if (sessions.length === 0) return defaultInsights;

    // Estimate CP/W' from base power
    const estimatedCP = basePower * 0.85;
    const estimatedWPrime = 15000;

    // Aggregate sessions by day
    const dailyLoadMap = new Map<string, number>();
    for (const session of sessions) {
        const load = estimateCostFromAverage(
            session.power || basePower,
            session.duration || 15,
            estimatedCP,
            estimatedWPrime,
            'interval',
            undefined
        );
        dailyLoadMap.set(session.date, (dailyLoadMap.get(session.date) || 0) + load);
    }

    // Calculate metrics using chronic model
    const oneDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.ceil((currentDate.getTime() - programStartDate.getTime()) / oneDay) + 1;

    if (totalDays <= 0) return defaultInsights;

    let sMeta = 0;
    let sStruct = 0;
    const capMeta = DEFAULT_CAP_METABOLIC;
    const capStruct = DEFAULT_CAP_STRUCTURAL;

    const dailyMetrics: Array<{ fatigueScore: number; readinessScore: number }> = [];

    for (let i = 0; i < totalDays; i++) {
        const day = new Date(programStartDate.getTime() + i * oneDay);
        const dateStr = day.toISOString().split('T')[0];

        const dailyLoad = dailyLoadMap.get(dateStr) || 0;

        // Update chronic model with default recovery
        sMeta = updateMetabolicFreshness(sMeta, dailyLoad, DEFAULT_PHI_RECOVERY, capMeta);
        sStruct = updateStructuralHealth(sStruct, dailyLoad, SIGMA_IMPACT, capStruct);

        const fatigueScore = calculateFatigueFromChronic(sMeta, sStruct);
        const readinessScore = calculateChronicReadiness(sMeta, sStruct, capMeta, capStruct);

        dailyMetrics.push({ fatigueScore, readinessScore });
    }

    if (dailyMetrics.length === 0) return defaultInsights;

    // Current values (today)
    const current = dailyMetrics[dailyMetrics.length - 1];

    // Last 7 days average
    const last7Days = dailyMetrics.slice(-7);
    const weeklyFatigueAvg = Math.round(last7Days.reduce((sum, d) => sum + d.fatigueScore, 0) / last7Days.length);
    const weeklyReadinessAvg = Math.round(last7Days.reduce((sum, d) => sum + d.readinessScore, 0) / last7Days.length);

    // Previous 7 days average (for comparison)
    const prev7Days = dailyMetrics.slice(-14, -7);
    const prevFatigueAvg = prev7Days.length > 0
        ? prev7Days.reduce((sum, d) => sum + d.fatigueScore, 0) / prev7Days.length
        : weeklyFatigueAvg;
    const prevReadinessAvg = prev7Days.length > 0
        ? prev7Days.reduce((sum, d) => sum + d.readinessScore, 0) / prev7Days.length
        : weeklyReadinessAvg;

    const fatigueChange = weeklyFatigueAvg - prevFatigueAvg;
    const readinessChange = weeklyReadinessAvg - prevReadinessAvg;

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining';
    if (readinessChange > 5 && fatigueChange < 5) {
        trend = 'improving';
    } else if (readinessChange < -5 || fatigueChange > 10) {
        trend = 'declining';
    } else {
        trend = 'stable';
    }

    // Generate insights based on current state
    const { insight, recommendation } = generateInsightMessage(
        current.fatigueScore,
        current.readinessScore,
        fatigueChange,
        readinessChange,
        weeklyFatigueAvg,
        weeklyReadinessAvg
    );

    return {
        currentFatigue: current.fatigueScore,
        currentReadiness: current.readinessScore,
        weeklyFatigueAvg,
        weeklyReadinessAvg,
        fatigueChange: Math.round(fatigueChange),
        readinessChange: Math.round(readinessChange),
        trend,
        insight,
        recommendation
    };
}

function generateInsightMessage(
    fatigue: number,
    readiness: number,
    fatigueChange: number,
    readinessChange: number,
    avgFatigue: number,
    avgReadiness: number
): { insight: string; recommendation: string } {
    // High fatigue scenarios
    if (fatigue > 70) {
        return {
            insight: 'Your fatigue levels are elevated. Your body is working hard to adapt.',
            recommendation: 'Consider an easy session or rest day. Your fitness is building!'
        };
    }

    // Very low readiness
    if (readiness < 40) {
        return {
            insight: 'Your readiness is below optimal. Recovery may be lagging behind training.',
            recommendation: 'Prioritize sleep and nutrition. A lighter session would be wise.'
        };
    }

    // Peak readiness
    if (readiness > 80 && fatigue < 30) {
        return {
            insight: 'You\'re in excellent shape! High readiness with managed fatigue.',
            recommendation: 'Great day for a challenging workout or testing your limits.'
        };
    }

    // Falling readiness trend
    if (readinessChange < -10) {
        return {
            insight: 'Your readiness has been declining this week compared to last.',
            recommendation: 'Watch for signs of overreaching. Consider a mini-deload.'
        };
    }

    // Rising fatigue trend
    if (fatigueChange > 10) {
        return {
            insight: 'Fatigue has been accumulating faster than usual this week.',
            recommendation: 'Good training stress! Monitor how you feel in the next few days.'
        };
    }

    // Improving trend
    if (readinessChange > 5 && fatigueChange < 0) {
        return {
            insight: 'Your body is adapting well. Readiness is up while fatigue is down.',
            recommendation: 'Continue current approach. You\'re in a good rhythm.'
        };
    }

    // Steady state
    if (Math.abs(readinessChange) < 5 && Math.abs(fatigueChange) < 5) {
        return {
            insight: 'Your fatigue and readiness are stable and balanced.',
            recommendation: 'Maintain consistency. Your training load is sustainable.'
        };
    }

    // Default balanced state
    return {
        insight: 'Your training metrics are within normal ranges.',
        recommendation: 'Listen to your body and train according to how you feel today.'
    };
}

// ============================================================================
// RECENT ACTIVITY
// ============================================================================

/**
 * Gets summary of recent training activity.
 * Uses the provided currentDate for date calculations (supports simulated dates).
 * Work is in Wh.
 */
export function getRecentActivity(
    sessions: Session[],
    days: number = 7,
    currentDate: Date = new Date()
): RecentActivitySummary {
    // Use timezone-agnostic date strings
    const currentDateStr = getLocalDateString(currentDate);
    const cutoffStr = addDays(currentDateStr, -days);

    const recentSessions = sessions.filter(s =>
        isDateInRange(s.date, cutoffStr, currentDateStr)
    );

    if (recentSessions.length === 0) {
        return {
            days,
            sessions: [],
            avgPower: 0,
            avgDuration: 0,
            avgRPE: 0,
            totalWork: 0,
            sessionCount: 0
        };
    }

    const simplifiedSessions = recentSessions.map(s => ({
        date: s.date,
        power: s.power || 0,
        duration: s.duration || 0,
        rpe: s.rpe || 0
    })).sort((a, b) => compareDates(b.date, a.date)); // Most recent first

    const totalPower = simplifiedSessions.reduce((sum, s) => sum + s.power, 0);
    const totalDuration = simplifiedSessions.reduce((sum, s) => sum + s.duration, 0);
    const totalRPE = simplifiedSessions.reduce((sum, s) => sum + s.rpe, 0);
    // Work in Wh
    const totalWork = simplifiedSessions.reduce((sum, s) => sum + (s.power * s.duration / 60), 0);

    return {
        days,
        sessions: simplifiedSessions,
        avgPower: Math.round(totalPower / simplifiedSessions.length),
        avgDuration: Math.round(totalDuration / simplifiedSessions.length),
        avgRPE: Math.round(totalRPE / simplifiedSessions.length * 10) / 10,
        totalWork: Math.round(totalWork),
        sessionCount: simplifiedSessions.length
    };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats a percentage change with + or - sign.
 */
export function formatChange(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${Math.round(value)}%`;
}

/**
 * Determines the color class based on change value.
 */
export function getChangeColor(value: number, metric: 'power' | 'duration' | 'work'): 'positive' | 'negative' | 'neutral' {
    if (Math.abs(value) < 5) return 'neutral';
    return value > 0 ? 'positive' : 'negative';
}

/**
 * Formats a date for display.
 */
export function formatPRDate(dateStr: string): string {
    // Parse using local date parsing to avoid timezone issues
    const date = parseLocalDate(dateStr);
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}
