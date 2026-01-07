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
    // Compartment-specific values (0-100 percentage of capacity)
    sMetabolicPct: number;      // MET compartment percentage
    sStructuralPct: number;     // MSK compartment percentage
    // Recovery efficiency from questionnaire (φ value)
    recoveryEfficiency: number;
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
        recoveryEfficiency: 1.0
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

    // Get current recovery efficiency (latest questionnaire response)
    const latestQuestionnaire = questionnaireHistory
        .filter(r => r.date <= getLocalDateString(currentDate))
        .sort((a, b) => b.date.localeCompare(a.date))[0];
    const currentRecoveryEfficiency = latestQuestionnaire
        ? calculatePhiFromQuestionnaire(latestQuestionnaire)
        : DEFAULT_PHI_RECOVERY;

    // Generate insights based on current state with MET/MSK and recovery awareness
    const { insight, recommendation } = generateInsightMessage(
        current.fatigueScore,
        current.readinessScore,
        fatigueChange,
        readinessChange,
        sMetabolicPct,
        sStructuralPct,
        currentRecoveryEfficiency
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
        recoveryEfficiency: currentRecoveryEfficiency
    };
}

/**
 * Generate insight text from pre-calculated metrics (from useMetrics).
 * 
 * This ensures the insight text uses the same values displayed on the dashboard,
 * avoiding discrepancies from independent recalculation with different CP estimates.
 * 
 * @param fatigue - Display fatigue value (0-100)
 * @param readiness - Display readiness value (0-100)  
 * @param sMetabolic - Raw metabolic compartment value from chronic model
 * @param sStructural - Raw structural compartment value from chronic model
 * @param fatigueChange - Week-over-week fatigue change
 * @param readinessChange - Week-over-week readiness change
 * @param recoveryEfficiency - Recovery efficiency (φ) from questionnaire (0.5-1.5)
 */
export function generateInsightFromMetrics(
    fatigue: number,
    readiness: number,
    sMetabolic: number,
    sStructural: number,
    fatigueChange: number,
    readinessChange: number,
    recoveryEfficiency: number
): { insight: string; recommendation: string } {
    // Calculate percentages from raw compartment values
    const metaPct = Math.round(sMetabolic / DEFAULT_CAP_METABOLIC * 100);
    const structPct = Math.round(sStructural / DEFAULT_CAP_STRUCTURAL * 100);

    // Use the existing insight generation logic with dashboard-consistent values
    return generateInsightMessage(
        fatigue,
        readiness,
        fatigueChange,
        readinessChange,
        metaPct,
        structPct,
        recoveryEfficiency
    );
}

/**
 * Generate unified insight message with multi-factor case detection.
 * 
 * Considers: fatigue/readiness values, MET/MSK compartment loads, recovery efficiency,
 * and weekly trend changes. Cases are evaluated in priority order to provide the most
 * relevant insight for the athlete's current state.
 * 
 * All insights include the actual values that triggered the analysis for transparency.
 */
function generateInsightMessage(
    fatigue: number,
    readiness: number,
    fatigueChange: number,
    readinessChange: number,
    metaPct: number,
    structPct: number,
    recoveryEfficiency: number
): { insight: string; recommendation: string } {
    // Thresholds calibrated for the chronic fatigue model
    const MET_HIGH = 50;
    const MET_MODERATE = 30;
    const MSK_HIGH = 40;
    const MSK_MODERATE = 25;
    const RECOVERY_IMPAIRED = 0.7;
    const RECOVERY_EXCELLENT = 1.2;

    // Format helpers
    const recPct = Math.round(recoveryEfficiency * 100);
    const fmtChange = (v: number) => v >= 0 ? `+${v}` : `${v}`;

    // ============================================================================
    // PRIORITY 1: Full System Fatigue (both compartments stressed)
    // ============================================================================
    if (metaPct > MET_HIGH && structPct > MSK_HIGH) {
        if (recoveryEfficiency < RECOVERY_IMPAIRED) {
            return {
                insight: `Your metabolic load is at ${metaPct}% and musculoskeletal load at ${structPct}%, with recovery efficiency at only ${recPct}%. This combination of high fatigue across both systems and impaired recovery conditions suggests your body needs a genuine break to consolidate recent training adaptations.`,
                recommendation: 'Take a complete rest day or very light movement only. Prioritize sleep quality, hydration, and nutrition before your next training session.'
            };
        }
        return {
            insight: `Both energy systems are under substantial stress: metabolic load at ${metaPct}% and musculoskeletal load at ${structPct}%. The metabolic fatigue indicates depleted fuel stores, while the structural load reflects accumulated tissue stress from recent volume.`,
            recommendation: 'A recovery day would accelerate adaptation. If you must train, keep intensity and duration minimal to allow both systems to recover in parallel.'
        };
    }

    // ============================================================================
    // PRIORITY 2: Metabolic-Dominant Fatigue (energy depleted, structure OK)
    // ============================================================================
    if (metaPct > MET_HIGH && structPct < MSK_MODERATE) {
        return {
            insight: `Your metabolic system is running at ${metaPct}% load while your musculoskeletal system is only at ${structPct}%. This imbalance suggests your energy reserves are depleted from recent intensity, but your tissues are handling the mechanical stress well.`,
            recommendation: 'Low-intensity aerobic work is ideal today. Zone 2 efforts will promote metabolic recovery without adding structural stress, setting you up for quality training tomorrow.'
        };
    }

    // ============================================================================
    // PRIORITY 3: Structural-Dominant Fatigue (tissue stressed, energy available)
    // ============================================================================
    if (structPct > MSK_HIGH && metaPct < MET_MODERATE) {
        return {
            insight: `Your musculoskeletal system is at ${structPct}% load while metabolic reserves are at only ${metaPct}%. This pattern shows accumulated tissue stress from volume or mechanical load, while your energy systems remain available.`,
            recommendation: 'Consider cross-training or non-impact activities today. Your energy systems can handle work, but your connective tissues and muscles would benefit from reduced mechanical stress.'
        };
    }

    // ============================================================================
    // PRIORITY 4: Impaired Recovery Conditions
    // ============================================================================
    if (recoveryEfficiency < RECOVERY_IMPAIRED) {
        if (fatigue > 35) {
            return {
                insight: `Recovery efficiency is at ${recPct}%, well below the baseline of 100%, while fatigue sits at ${fatigue}%. Your recovery capacity is diminished, likely due to sleep, nutrition, or life stress, limiting how effectively your body can adapt to training.`,
                recommendation: 'Address the limiting factors in your recovery before pushing training. Even light sessions may accumulate more fatigue than usual until recovery conditions improve.'
            };
        }
        return {
            insight: `Your recovery efficiency is at ${recPct}%, indicating suboptimal conditions for adaptation. While current fatigue at ${fatigue}% is manageable, impaired recovery will slow the benefits from any training you do today.`,
            recommendation: 'If recovery factors are within your control, address them before training. Otherwise, keep today\'s session conservative and monitor how you feel tomorrow.'
        };
    }

    // ============================================================================
    // PRIORITY 5: Excellent Recovery Window (supercompensation opportunity)
    // ============================================================================
    if (recoveryEfficiency > RECOVERY_EXCELLENT && fatigue < 25 && readiness > 75) {
        return {
            insight: `Excellent conditions for training: recovery efficiency at ${recPct}%, fatigue low at ${fatigue}%, and readiness high at ${readiness}%. This combination creates an optimal window where quality work will translate efficiently into adaptation.`,
            recommendation: 'This is a good day to challenge yourself. Your body is primed to handle and benefit from a harder session, whether that means higher intensity, longer duration, or both.'
        };
    }

    // ============================================================================
    // PRIORITY 6: Peak Performance State
    // ============================================================================
    if (readiness > 85 && fatigue < 20) {
        const compartmentDetail = metaPct < 15
            ? ` with metabolic load at just ${metaPct}%`
            : ` (MET ${metaPct}%, MSK ${structPct}%)`;
        return {
            insight: `Peak state detected: readiness at ${readiness}% and fatigue at only ${fatigue}%${compartmentDetail}. Your body can both execute demanding work and adapt to it effectively.`,
            recommendation: 'Consider this a green light for challenging work. Test sessions, key workouts, or breakthrough efforts are well-suited for days like this.'
        };
    }

    // ============================================================================
    // PRIORITY 7: Low Readiness Warning (recovery deficit)
    // ============================================================================
    if (readiness < 55) {
        const compartmentDetail = metaPct > 40 || structPct > 35
            ? ` The underlying loads (MET ${metaPct}%, MSK ${structPct}%) suggest accumulated training stress that needs time to dissipate.`
            : '';
        return {
            insight: `Readiness is at ${readiness}%, indicating your body is not in an optimal state for productive training.${compartmentDetail}`,
            recommendation: 'Lighter sessions will be more beneficial than pushing through today. Use this as an opportunity for technique work, mobility, or gentle aerobic movement.'
        };
    }

    // ============================================================================
    // PRIORITY 8: Elevated Fatigue (adaptation in progress)
    // ============================================================================
    if (fatigue > 45) {
        return {
            insight: `Fatigue is elevated at ${fatigue}%, which is a normal part of progressive training. The stress you have accumulated (MET ${metaPct}%, MSK ${structPct}%) is the stimulus your body will adapt to, provided you allow adequate recovery.`,
            recommendation: 'An easy session or rest day would support the adaptation process. If you feel good despite the numbers, a light session is fine, but avoid adding significant new stress.'
        };
    }

    // ============================================================================
    // PRIORITY 9: Moderate Compartment Stress (approaching thresholds)
    // ============================================================================
    if (metaPct > MET_MODERATE && structPct > MSK_MODERATE) {
        return {
            insight: `Both systems are carrying moderate loads: metabolic at ${metaPct}% and musculoskeletal at ${structPct}%. You are not at risk of overtraining, but fatigue is accumulating and will eventually need to be addressed.`,
            recommendation: 'Normal training is fine today, but be attentive to recovery. Consider a lighter day in the next few sessions to prevent fatigue from accumulating further.'
        };
    }

    // ============================================================================
    // PRIORITY 10: Declining Trend (readiness dropping week-over-week)
    // ============================================================================
    if (readinessChange < -5) {
        return {
            insight: `Readiness has declined ${fmtChange(readinessChange)} points compared to last week. This pattern may indicate that training load is outpacing recovery, or that external stressors are affecting your capacity to adapt.`,
            recommendation: 'Watch for early signs of overreaching: persistent fatigue, mood changes, or declining performance. A short deload period may be warranted if this trend continues.'
        };
    }

    // ============================================================================
    // PRIORITY 11: Accumulating Fatigue Trend
    // ============================================================================
    if (fatigueChange > 5) {
        return {
            insight: `Fatigue has increased ${fmtChange(fatigueChange)} points this week compared to last, now at ${fatigue}%. This accumulation is often expected during progressive overload, but sustained increases without recovery can lead to overreaching.`,
            recommendation: 'Monitor your response to training over the next few days. If you continue to feel recovered each morning, the load is manageable. If not, consider backing off.'
        };
    }

    // ============================================================================
    // PRIORITY 12: Positive Adaptation Pattern
    // ============================================================================
    if (readinessChange > 3 && fatigueChange < 0) {
        return {
            insight: `Positive adaptation pattern: readiness is up ${fmtChange(readinessChange)} points while fatigue is down ${Math.abs(fatigueChange)} points compared to last week. Your body is successfully recovering and supercompensating from recent training.`,
            recommendation: 'Continue your current approach. You are in a good rhythm where training stress and recovery are well balanced.'
        };
    }

    // ============================================================================
    // PRIORITY 13: Metabolic Recovery Opportunity
    // ============================================================================
    if (metaPct > MET_MODERATE && structPct < MSK_MODERATE && recoveryEfficiency > 1.0) {
        return {
            insight: `Metabolic load is at ${metaPct}% but recovery efficiency is good at ${recPct}%, which should help restore it quickly. Structural load is low at ${structPct}%, giving you flexibility in what training you can do.`,
            recommendation: 'Aerobic work at conversational intensity would support metabolic recovery today. You have room for some volume if you keep the power output moderate.'
        };
    }

    // ============================================================================
    // PRIORITY 14: Stable and Balanced State
    // ============================================================================
    if (Math.abs(readinessChange) < 3 && Math.abs(fatigueChange) < 3) {
        const loadContext = metaPct > 20 || structPct > 15
            ? `Current loads are modest (MET ${metaPct}%, MSK ${structPct}%) and being managed effectively.`
            : `Both systems are operating near baseline (MET ${metaPct}%, MSK ${structPct}%), giving you considerable training flexibility.`;
        return {
            insight: `Stable week-over-week: readiness ${fmtChange(readinessChange)} and fatigue ${fmtChange(fatigueChange)} points, suggesting a sustainable balance between training and recovery. ${loadContext}`,
            recommendation: 'Maintain your current consistency. This equilibrium is a good foundation for either continued steady training or a deliberate push if your goals require it.'
        };
    }

    // ============================================================================
    // DEFAULT: General Guidance
    // ============================================================================
    return {
        insight: `Current state: readiness ${readiness}%, fatigue ${fatigue}%, metabolic load ${metaPct}%, musculoskeletal load ${structPct}%, recovery efficiency ${recPct}%. All metrics are within expected ranges with no specific concerns or opportunities standing out.`,
        recommendation: 'Train according to how you feel today. Listen to your body and adjust intensity based on your subjective response to the warmup.'
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
