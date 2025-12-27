/**
 * Suggest Modifiers Module - Simulation Engine
 * 
 * Contains Monte Carlo simulation functions for generating fatigue/readiness data.
 */

import { WeekDefinition, CyclePhase } from '../../programTemplate';
import {
    ATL_ALPHA,
    CTL_ALPHA,
    FATIGUE_MIDPOINT,
    FATIGUE_STEEPNESS,
    READINESS_OPTIMAL_TSB,
    READINESS_WIDTH,
    DEFAULT_SESSION_DURATION,
    DEFAULT_SESSIONS_PER_WEEK_MIN,
    DEFAULT_SESSIONS_PER_WEEK_MAX,
    WeekAnalysis,
    TrendAnalysis,
    CycleInfo,
} from './types';
import {
    calculateAdaptiveWindows,
    smoothSignal,
    calculateDerivative,
    calculatePercentile,
    detectChangePoints,
    detectExtrema,
    calculatePhasePositions,
} from './algorithms';

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

export function calculateFatigueScore(atl: number, ctl: number): number {
    if (ctl <= 0.001) return atl > 0 ? Math.min(100, Math.round(atl * 2)) : 0;
    const acwr = atl / ctl;
    const score = 100 / (1 + Math.exp(-FATIGUE_STEEPNESS * (acwr - FATIGUE_MIDPOINT)));
    return Math.round(Math.max(0, Math.min(100, score)));
}

export function calculateReadinessScore(tsb: number): number {
    const exponent = -Math.pow(tsb - READINESS_OPTIMAL_TSB, 2) / READINESS_WIDTH;
    return Math.round(Math.max(0, Math.min(100, 100 * Math.exp(exponent))));
}

// ============================================================================
// SIMULATION CORE
// ============================================================================

export function runSingleSimulation(
    weeks: WeekDefinition[],
    basePower: number
): { dailyFatigue: number[]; dailyReadiness: number[] } {
    const numWeeks = weeks.length;
    const numDays = numWeeks * 7;
    const dailyLoads: number[] = new Array(numDays).fill(0);

    for (let weekIdx = 0; weekIdx < numWeeks; weekIdx++) {
        const week = weeks[weekIdx];
        const weekStart = weekIdx * 7;
        const numSessions = Math.floor(Math.random() *
            (DEFAULT_SESSIONS_PER_WEEK_MAX - DEFAULT_SESSIONS_PER_WEEK_MIN + 1)) +
            DEFAULT_SESSIONS_PER_WEEK_MIN;

        const availableDays = [0, 1, 2, 3, 4, 5, 6];
        for (let s = 0; s < numSessions; s++) {
            if (availableDays.length === 0) break;
            const idx = Math.floor(Math.random() * availableDays.length);
            const day = availableDays[idx];
            availableDays.splice(idx, 1);

            const dayIdx = weekStart + day;
            const powerMult = week.powerMultiplier || 1.0;
            const rpe = week.targetRPE || 6;
            const duration = typeof week.durationMinutes === 'number'
                ? week.durationMinutes : DEFAULT_SESSION_DURATION;

            const actualPower = basePower * powerMult * (1.0 + (Math.random() - 0.5) * 0.1);
            const actualRPE = Math.max(1, Math.min(10, rpe + (Math.random() - 0.5)));

            const powerRatio = actualPower / basePower;
            const clampedRatio = Math.max(0.25, Math.min(4.0, powerRatio));
            const load = Math.pow(actualRPE, 1.5) * Math.pow(duration, 0.75) *
                Math.pow(clampedRatio, 0.5) * 0.3;

            dailyLoads[dayIdx] += load;
        }
    }

    const dailyFatigue: number[] = [];
    const dailyReadiness: number[] = [];
    let atl = 0, ctl = 10;

    for (let i = 0; i < numDays; i++) {
        atl = atl * (1 - ATL_ALPHA) + dailyLoads[i] * ATL_ALPHA;
        ctl = ctl * (1 - CTL_ALPHA) + dailyLoads[i] * CTL_ALPHA;
        dailyFatigue.push(calculateFatigueScore(atl, ctl));
        dailyReadiness.push(calculateReadinessScore(ctl - atl));
    }

    return { dailyFatigue, dailyReadiness };
}

// ============================================================================
// CYCLE PHASE CLASSIFICATION
// ============================================================================

/**
 * Classify week into cycle phase based on:
 * 1. Coach-declared week focus (Recovery = trough, overrides all else)
 * 2. Template power trajectory (power increasing/decreasing)
 * 3. Simulated fatigue trajectory (as tiebreaker)
 */
export function classifyCyclePhase(
    fatigueVelocity: number,
    fatigueAcceleration: number,
    fatigueValue: number,
    powerVelocity: number,
    isLocalPeak: boolean,
    isLocalTrough: boolean,
    weekFocus?: 'Density' | 'Intensity' | 'Volume' | 'Recovery'
): CyclePhase {
    // 1. COACH-DECLARED FOCUS takes highest precedence
    if (weekFocus === 'Recovery') return 'trough';

    if ((weekFocus === 'Intensity' || weekFocus === 'Density') && powerVelocity >= 0) {
        if (powerVelocity < 0.02 && powerVelocity > -0.02 && fatigueValue > 50) {
            return 'peak';
        }
        return 'ascending';
    }

    // Explicit peaks/troughs from fatigue data
    if (isLocalPeak) return 'peak';
    if (isLocalTrough) return 'trough';

    // 2. POWER TRAJECTORY
    if (powerVelocity < -0.02) return 'descending';
    if (powerVelocity > 0.02) return 'ascending';

    // 3. For small power changes, use fatigue analysis as tiebreaker
    if (fatigueValue > 60 && fatigueVelocity > -2 && fatigueVelocity < 3 && fatigueAcceleration < -1) {
        return 'peak';
    }
    if (fatigueVelocity > 3) return 'ascending';
    if (fatigueValue < 35 && fatigueVelocity > -2 && fatigueVelocity < 3 && fatigueAcceleration > 1) {
        return 'trough';
    }
    if (fatigueVelocity < -3) return 'descending';

    // Use fatigue position as tiebreaker
    if (fatigueValue > 55) return fatigueVelocity >= 0 ? 'peak' : 'descending';
    if (fatigueValue < 35) return fatigueVelocity <= 0 ? 'trough' : 'ascending';

    return fatigueVelocity >= 0 ? 'ascending' : 'descending';
}

// ============================================================================
// FULL ANALYSIS PIPELINE
// ============================================================================

export function runFullAnalysis(
    weeks: WeekDefinition[],
    basePower: number,
    numSimulations: number,
    fatigueData: number[][],
    readinessData: number[][]
): TrendAnalysis {
    const numWeeks = weeks.length;

    if (numWeeks === 0) {
        return {
            weekAnalyses: [],
            detectedCycles: [],
            globalTrend: 'stable',
            adaptationScore: 0,
            adaptiveWindows: { local: 2, meso: 3 }
        };
    }

    // Calculate adaptive windows
    const adaptiveWindows = calculateAdaptiveWindows(numWeeks);

    // Calculate percentiles
    const fatigueP15 = fatigueData.map(d => calculatePercentile(d, 15));
    const fatigueP30 = fatigueData.map(d => calculatePercentile(d, 30));
    const fatigueP50 = fatigueData.map(d => calculatePercentile(d, 50));
    const fatigueP70 = fatigueData.map(d => calculatePercentile(d, 70));
    const fatigueP85 = fatigueData.map(d => calculatePercentile(d, 85));
    const readinessP15 = readinessData.map(d => calculatePercentile(d, 15));
    const readinessP30 = readinessData.map(d => calculatePercentile(d, 30));
    const readinessP50 = readinessData.map(d => calculatePercentile(d, 50));
    const readinessP70 = readinessData.map(d => calculatePercentile(d, 70));
    const readinessP85 = readinessData.map(d => calculatePercentile(d, 85));

    // Signal processing with adaptive windows
    const smoothedFatigue = smoothSignal(fatigueP50, adaptiveWindows.local);
    const fatigueVelocity = calculateDerivative(smoothedFatigue);
    const fatigueAcceleration = calculateDerivative(fatigueVelocity);

    // CUSUM with adaptive threshold
    const avgFatigue = fatigueP50.reduce((a, b) => a + b, 0) / numWeeks;
    const cusumThreshold = avgFatigue * 0.25;
    const changePoints = detectChangePoints(smoothedFatigue, cusumThreshold);

    // Detect extrema
    const { peaks, troughs } = detectExtrema(smoothedFatigue);

    // Calculate power trajectory from template
    const powerMultipliers = weeks.map(w => w.powerMultiplier || 1.0);
    const powerVelocity = calculateDerivative(powerMultipliers);

    // Build week analyses
    const weekAnalyses: WeekAnalysis[] = [];
    let currentCycleIndex = 0;

    for (let w = 0; w < numWeeks; w++) {
        if (changePoints.includes(w) && w > 0) {
            currentCycleIndex++;
        }

        const isLocalPeak = peaks.includes(w);
        const isLocalTrough = troughs.includes(w);

        const cyclePhase = classifyCyclePhase(
            fatigueVelocity[w],
            fatigueAcceleration[w],
            fatigueP50[w],
            powerVelocity[w],
            isLocalPeak,
            isLocalTrough,
            weeks[w].focus
        );

        weekAnalyses.push({
            weekNumber: w + 1,
            phaseName: weeks[w].phaseName || '',
            powerMultiplier: weeks[w].powerMultiplier || 1.0,
            fatigueP15: Math.round(fatigueP15[w]),
            fatigueP30: Math.round(fatigueP30[w]),
            fatigueP50: Math.round(fatigueP50[w]),
            fatigueP70: Math.round(fatigueP70[w]),
            fatigueP85: Math.round(fatigueP85[w]),
            readinessP15: Math.round(readinessP15[w]),
            readinessP30: Math.round(readinessP30[w]),
            readinessP50: Math.round(readinessP50[w]),
            readinessP70: Math.round(readinessP70[w]),
            readinessP85: Math.round(readinessP85[w]),
            fatigueVelocity: fatigueVelocity[w],
            fatigueAcceleration: fatigueAcceleration[w],
            cyclePhase,
            cycleIndex: currentCycleIndex,
            isLocalPeak,
            isLocalTrough
        });
    }

    // Enrich week analyses with phase position data
    const positionData = calculatePhasePositions(weekAnalyses);
    for (let w = 0; w < weekAnalyses.length; w++) {
        weekAnalyses[w].phasePosition = positionData[w].phasePosition;
        weekAnalyses[w].positionRatio = positionData[w].positionRatio;
    }

    // Build cycle info
    const detectedCycles: CycleInfo[] = [];
    const cycleIndexes = [...new Set(weekAnalyses.map(w => w.cycleIndex))];

    for (const idx of cycleIndexes) {
        const cycleWeeks = weekAnalyses.filter(w => w.cycleIndex === idx);
        const peakWeek = cycleWeeks.find(w => w.isLocalPeak)?.weekNumber ?? null;
        const troughWeek = cycleWeeks.find(w => w.isLocalTrough)?.weekNumber ?? null;

        detectedCycles.push({
            index: idx,
            startWeek: Math.min(...cycleWeeks.map(w => w.weekNumber)),
            endWeek: Math.max(...cycleWeeks.map(w => w.weekNumber)),
            peakWeek,
            troughWeek,
            avgFatigue: cycleWeeks.reduce((s, w) => s + w.fatigueP50, 0) / cycleWeeks.length,
            avgReadiness: cycleWeeks.reduce((s, w) => s + w.readinessP50, 0) / cycleWeeks.length
        });
    }

    // Global trend analysis
    let globalTrend: 'improving' | 'stable' | 'declining' = 'stable';
    let adaptationScore = 0;

    if (numWeeks >= 4) {
        const thirdLen = Math.max(1, Math.floor(numWeeks / 3));
        const firstThirdFatigue = fatigueP50.slice(0, thirdLen).reduce((a, b) => a + b, 0) / thirdLen;
        const lastThirdFatigue = fatigueP50.slice(-thirdLen).reduce((a, b) => a + b, 0) / thirdLen;
        const firstThirdReadiness = readinessP50.slice(0, thirdLen).reduce((a, b) => a + b, 0) / thirdLen;
        const lastThirdReadiness = readinessP50.slice(-thirdLen).reduce((a, b) => a + b, 0) / thirdLen;

        const fatigueDiff = lastThirdFatigue - firstThirdFatigue;
        const readinessDiff = lastThirdReadiness - firstThirdReadiness;

        if (fatigueDiff < -3) adaptationScore += 0.4;
        if (fatigueDiff > 3) adaptationScore -= 0.4;
        if (readinessDiff > 3) adaptationScore += 0.6;
        if (readinessDiff < -3) adaptationScore -= 0.6;

        if (adaptationScore > 0.3) globalTrend = 'improving';
        if (adaptationScore < -0.3) globalTrend = 'declining';
    }

    return {
        weekAnalyses,
        detectedCycles,
        globalTrend,
        adaptationScore: Math.max(-1, Math.min(1, adaptationScore)),
        adaptiveWindows
    };
}
