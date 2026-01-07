/**
 * Insights Utilities
 * 
 * Analytics calculations for the Training Insights Dashboard.
 * Provides personal records, trend analysis, fatigue/readiness insights, and recent activity.
 * 
 * Uses Chronic Fatigue Model (dual-compartment) for fatigue/readiness calculations.
 */

import { Session, ProgramRecord, QuestionnaireResponse } from '../types';
import { getLocalDateString, addDays, compareDates, isDateInRange, parseLocalDate } from './dateUtils';
import {
    updateMetabolicFreshness,
    updateStructuralHealth,
    calculateReadinessScore as calculateChronicReadiness,
    applyStructuralCorrection,
    applyMetabolicCorrection,
    DEFAULT_PHI_RECOVERY,
    DEFAULT_CAP_METABOLIC,
    DEFAULT_CAP_STRUCTURAL,
    SIGMA_IMPACT,
} from './chronicFatigueModel';
import { applyQuestionnaireAdjustment } from './questionnaireConfig';
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
    // NEW: Compartment-specific values (0-100 percentage of capacity)
    sMetabolicPct: number;      // MET compartment percentage
    sStructuralPct: number;     // MSK compartment percentage
    compartmentInsight: string; // MET/MSK-specific insight
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
 * Calculate recovery efficiency (φ) from questionnaire responses.
 * Maps sleep, nutrition, and stress to a [0.5, 1.5] scalar.
 */
function calculatePhiFromQuestionnaire(response: QuestionnaireResponse): number {
    const { responses } = response;

    // Use actual questionnaire field names - average sleep metrics
    const sleepHours = responses['sleep_hours'] || 3;
    const sleepQuality = responses['sleep_quality'] || 3;
    const sleep = (sleepHours + sleepQuality) / 2;
    const nutrition = responses['nutrition'] || 3;
    const stress = responses['stress'] || 3;

    // Normalize to 0-1 range
    const sleepNorm = (sleep - 1) / 4;
    const nutritionNorm = (nutrition - 1) / 4;
    const stressNorm = (stress - 1) / 4;

    // Calculate phi: 0.5 at worst, 1.5 at best
    const avgFactor = (sleepNorm + nutritionNorm + stressNorm) / 3;
    return Math.max(0.5, Math.min(1.5, 0.5 + avgFactor));
}

/**
 * Calculate fatigue and readiness trend insights using Chronic Fatigue Model.
 * Provides analysis, trend direction, and actionable recommendations.
 * 
 * Now integrates questionnaire data for:
 * - Recovery efficiency (φ) affecting metabolic decay
 * - Bayesian corrections for soreness/energy
 * - Questionnaire adjustments with wellness modifier carryover
 * 
 * @param sessions - Training sessions
 * @param programStartDate - Program start date
 * @param currentDate - Current/simulated date
 * @param basePower - Base power for load estimation
 * @param questionnaireHistory - Historical questionnaire responses for full integration
 */
export function calculateFatigueReadinessInsights(
    sessions: Session[],
    programStartDate: Date,
    currentDate: Date,
    basePower: number = 150,
    questionnaireHistory: QuestionnaireResponse[] = []
): FatigueReadinessInsights {
    // Default values for no data
    const defaultInsights: FatigueReadinessInsights = {
        currentFatigue: 0,
        currentReadiness: 100,
        weeklyFatigueAvg: 0,
        weeklyReadinessAvg: 100,
        fatigueChange: 0,
        readinessChange: 0,
        trend: 'stable',
        insight: 'Start training to see your fatigue and readiness patterns.',
        recommendation: 'Log a few sessions to unlock personalized insights.',
        sMetabolicPct: 0,
        sStructuralPct: 0,
        compartmentInsight: 'Both energy systems are fully recovered.'
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

    // Build questionnaire lookup map
    const questionnaireByDate = new Map<string, QuestionnaireResponse>();
    for (const r of questionnaireHistory) {
        questionnaireByDate.set(r.date, r);
    }

    // Calculate metrics using chronic model
    const oneDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.ceil((currentDate.getTime() - programStartDate.getTime()) / oneDay) + 1;

    if (totalDays <= 0) return defaultInsights;

    let sMeta = 0;
    let sStruct = 0;
    const capMeta = DEFAULT_CAP_METABOLIC;
    const capStruct = DEFAULT_CAP_STRUCTURAL;

    // Wellness carryover modifier - decays questionnaire effects into subsequent days
    // Matches useMetrics.ts and Chart.tsx logic
    let wellnessModifier = 0;
    const wellnessAlpha = 2 / (3 + 1); // 3-day half-life

    const dailyMetrics: Array<{ fatigueScore: number; readinessScore: number; sMeta: number; sStruct: number }> = [];

    for (let i = 0; i < totalDays; i++) {
        const day = new Date(programStartDate.getTime() + i * oneDay);
        const dateStr = day.toISOString().split('T')[0];

        const dailyLoad = dailyLoadMap.get(dateStr) || 0;
        const dayResponse = questionnaireByDate.get(dateStr);

        // Get recovery efficiency from questionnaire (matches useMetrics.ts)
        const phiRecovery = dayResponse
            ? calculatePhiFromQuestionnaire(dayResponse)
            : DEFAULT_PHI_RECOVERY;

        // Update chronic model with φ recovery efficiency
        sMeta = updateMetabolicFreshness(sMeta, dailyLoad, phiRecovery, capMeta);
        sStruct = updateStructuralHealth(sStruct, dailyLoad, SIGMA_IMPACT, capStruct);

        // Apply Bayesian corrections for questionnaire days (matches useMetrics.ts)
        if (dayResponse) {
            const soreness = dayResponse.responses['soreness'];
            const energy = dayResponse.responses['energy'];

            if (soreness && soreness <= 2) {
                const correction = applyStructuralCorrection(
                    { sMetabolic: sMeta, sStructural: sStruct, capMetabolic: capMeta, capStructural: capStruct, lastUpdated: '' },
                    soreness
                );
                sStruct = correction.sStructural;
            }
            if (energy && energy <= 2) {
                const correction = applyMetabolicCorrection(
                    { sMetabolic: sMeta, sStructural: sStruct, capMetabolic: capMeta, capStructural: capStruct, lastUpdated: '' },
                    energy
                );
                sMeta = correction.sMetabolic;
            }
        }

        // Calculate base values
        let readiness = calculateChronicReadiness(sMeta, sStruct, capMeta, capStruct);
        let fatigue = calculateFatigueFromChronic(sMeta, sStruct);

        // Apply questionnaire display adjustments with wellness modifier carryover (matches useMetrics.ts)
        if (dayResponse) {
            // Get recent responses for trend analysis (prior 7 days)
            const recentForDay = questionnaireHistory
                .filter(r => r.date < dateStr)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 7);

            const adjustment = applyQuestionnaireAdjustment(readiness, fatigue, dayResponse, recentForDay);

            // Track wellness modifier for carryover
            const fatigueImpact = adjustment.fatigue - fatigue;
            const readinessImpact = adjustment.readiness - readiness;
            wellnessModifier = wellnessModifier * (1 - wellnessAlpha) +
                ((readinessImpact - fatigueImpact) / 2) * wellnessAlpha;

            readiness = adjustment.readiness;
            fatigue = adjustment.fatigue;
        } else {
            // Decay wellness modifier on non-questionnaire days
            wellnessModifier = wellnessModifier * (1 - wellnessAlpha);

            // Apply carryover if significant
            if (Math.abs(wellnessModifier) > 0.5) {
                readiness = Math.max(0, Math.min(100, Math.round(readiness + wellnessModifier)));
                fatigue = Math.max(0, Math.min(100, Math.round(fatigue - wellnessModifier)));
            }
        }

        dailyMetrics.push({
            fatigueScore: fatigue,
            readinessScore: readiness,
            sMeta,
            sStruct
        });
    }

    if (dailyMetrics.length === 0) return defaultInsights;

    // Current values (today)
    const current = dailyMetrics[dailyMetrics.length - 1];
    const sMetabolicPct = Math.round(current.sMeta / capMeta * 100);
    const sStructuralPct = Math.round(current.sStruct / capStruct * 100);

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

    // Determine trend using RELATIVE thresholds (scaled to typical chronic model values)
    // The chronic model typically produces lower values than legacy EWMA, so thresholds are proportional
    let trend: 'improving' | 'stable' | 'declining';

    // Significant improvement: readiness up and fatigue not rising significantly
    if (readinessChange > 3 && fatigueChange < 3) {
        trend = 'improving';
    }
    // Significant decline: readiness dropping or fatigue rising sharply
    else if (readinessChange < -3 || fatigueChange > 5) {
        trend = 'declining';
    }
    // Everything else is stable
    else {
        trend = 'stable';
    }

    // Generate compartment-specific insight
    const compartmentInsight = generateCompartmentInsight(sMetabolicPct, sStructuralPct);

    // Generate insights based on current state with MET/MSK awareness
    const { insight, recommendation } = generateInsightMessage(
        current.fatigueScore,
        current.readinessScore,
        fatigueChange,
        readinessChange,
        sMetabolicPct,
        sStructuralPct
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
        recommendation,
        sMetabolicPct,
        sStructuralPct,
        compartmentInsight
    };
}

/**
 * Generate compartment-specific insight based on MET and MSK percentages.
 */
function generateCompartmentInsight(metaPct: number, structPct: number): string {
    const metaHigh = metaPct > 50;
    const structHigh = structPct > 40; // MSK has slower decay, so lower threshold

    if (metaHigh && structHigh) {
        return 'Both metabolic and structural systems are fatigued. Full recovery recommended.';
    }
    if (metaHigh && !structHigh) {
        return 'Energy reserves depleted but body integrity is good. Zone 2 or endurance work would be ideal.';
    }
    if (!metaHigh && structHigh) {
        return 'Energy available but musculoskeletal system needs recovery. Active recovery or cross-training recommended.';
    }
    if (metaPct > 30 || structPct > 25) {
        return 'Moderate fatigue in both systems. Normal training with attention to recovery.';
    }
    return 'Both energy systems are fresh. Ready for challenging work!';
}

/**
 * Generate insight message with MET/MSK awareness and relative thresholds.
 * Uses proportional thresholds appropriate for the chronic fatigue model.
 */
function generateInsightMessage(
    fatigue: number,
    readiness: number,
    fatigueChange: number,
    readinessChange: number,
    metaPct: number,
    structPct: number
): { insight: string; recommendation: string } {
    // Thresholds adapted for chronic model's typical value ranges
    // High fatigue: >45% (instead of legacy 70%)
    // Low readiness: <55% (instead of legacy 40%)
    // Peak readiness: >85% with fatigue <20%

    // Dominant compartment fatigue scenarios
    if (metaPct > 50 && structPct < 30) {
        return {
            insight: 'Your metabolic reserves are depleted while structural health is fine.',
            recommendation: 'Low-intensity endurance work is ideal. Avoid glycolytic efforts today.'
        };
    }

    if (structPct > 50 && metaPct < 30) {
        return {
            insight: 'Your musculoskeletal system is fatigued while energy is available.',
            recommendation: 'Cross-training or active recovery. Avoid high-impact or volume work.'
        };
    }

    // High combined fatigue
    if (fatigue > 45) {
        return {
            insight: 'Your fatigue levels are elevated. Your body is adapting to training stress.',
            recommendation: 'Consider an easy session or rest day. Recovery supports fitness gains!'
        };
    }

    // Low readiness
    if (readiness < 55) {
        return {
            insight: 'Your readiness is below optimal. Recovery may be lagging behind training.',
            recommendation: 'Prioritize sleep and nutrition. A lighter session would be wise.'
        };
    }

    // Peak readiness with low fatigue
    if (readiness > 85 && fatigue < 20) {
        return {
            insight: 'You\'re in excellent shape! High readiness with minimal fatigue.',
            recommendation: 'Great day for a challenging workout or testing your limits.'
        };
    }

    // Trend-based insights
    if (readinessChange < -5) {
        return {
            insight: 'Your readiness has been declining this week compared to last.',
            recommendation: 'Watch for signs of overreaching. Consider a mini-deload.'
        };
    }

    if (fatigueChange > 5) {
        return {
            insight: 'Fatigue has been accumulating faster than usual this week.',
            recommendation: 'Good training stress! Monitor how you feel in the next few days.'
        };
    }

    if (readinessChange > 3 && fatigueChange < 0) {
        return {
            insight: 'Your body is adapting well. Readiness is up while fatigue is down.',
            recommendation: 'Continue current approach. You\'re in a good rhythm.'
        };
    }

    // Steady state
    if (Math.abs(readinessChange) < 3 && Math.abs(fatigueChange) < 3) {
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
