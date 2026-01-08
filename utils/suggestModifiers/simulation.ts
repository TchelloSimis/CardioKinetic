/**
 * Suggest Modifiers Module - Simulation Engine
 * 
 * Contains Monte Carlo simulation functions for generating fatigue/readiness data.
 * Uses Chronic Fatigue Model (dual-compartment) for fatigue/readiness calculations.
 */

import { WeekDefinition } from '../../programTemplate';
import {
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
} from './algorithms';
import {
    updateMetabolicFreshness,
    updateStructuralHealth,
    calculateReadinessScore as calculateChronicReadiness,
    applyDetrainingPenalty,
    DEFAULT_CAP_METABOLIC,
    DEFAULT_CAP_STRUCTURAL,
    SIGMA_IMPACT,
} from '../chronicFatigueModel';
import { estimateCostFromAverage } from '../physiologicalCostEngine';

// ============================================================================
// SCORING FUNCTIONS (Chronic Fatigue Model)
// ============================================================================

export function calculateFatigueScore(sMeta: number, sStruct: number): number {
    const capMeta = DEFAULT_CAP_METABOLIC;
    const capStruct = DEFAULT_CAP_STRUCTURAL;
    const metaRatio = sMeta / capMeta;
    const structRatio = sStruct / capStruct;
    const avgRatio = (metaRatio * 0.6 + structRatio * 0.4);
    return Math.round(Math.min(100, Math.max(0, avgRatio * 100)));
}

export function calculateReadinessScore(sMeta: number, sStruct: number): number {
    return calculateChronicReadiness(sMeta, sStruct, DEFAULT_CAP_METABOLIC, DEFAULT_CAP_STRUCTURAL);
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

    // Estimate CP/W' from base power for load calculation
    const estimatedCP = basePower * 0.85;
    const estimatedWPrime = 15000;

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
            const baseDuration = typeof week.durationMinutes === 'number'
                ? week.durationMinutes : DEFAULT_SESSION_DURATION;

            // Apply variability: ±5% power, ±5% duration
            const actualPower = basePower * powerMult * (1.0 + (Math.random() - 0.5) * 0.1);
            const actualDuration = baseDuration * (1.0 + (Math.random() - 0.5) * 0.1);

            // Calculate load using physiological cost engine
            const sessionStyle = week.sessionStyle || 'interval';
            const load = estimateCostFromAverage(
                actualPower,
                actualDuration,
                estimatedCP,
                estimatedWPrime,
                sessionStyle,
                week.workRestRatio
            );

            dailyLoads[dayIdx] += load;
        }
    }

    // Use chronic model compartments instead of EWMA
    const dailyFatigue: number[] = [];
    const dailyReadiness: number[] = [];
    let sMeta = 0;
    let sStruct = 0;
    const capMeta = DEFAULT_CAP_METABOLIC;
    const capStruct = DEFAULT_CAP_STRUCTURAL;

    // Track recent session day indices for harmonic-weighted detraining
    let recentSessionDayIndices: number[] = [];

    for (let i = 0; i < numDays; i++) {
        // Track sessions for detraining (non-zero load = session occurred)
        if (dailyLoads[i] > 0) {
            recentSessionDayIndices.unshift(i); // Add to front (most recent first)
            if (recentSessionDayIndices.length > 5) recentSessionDayIndices.pop();
        }

        // Random recovery efficiency for Monte Carlo variation
        const phiRecovery = 0.7 + Math.random() * 0.6;

        sMeta = updateMetabolicFreshness(sMeta, dailyLoads[i], phiRecovery, capMeta);
        sStruct = updateStructuralHealth(sStruct, dailyLoads[i], SIGMA_IMPACT, capStruct);

        // Calculate base readiness and apply harmonic-weighted detraining penalty
        const daysSinceRecentSessions = recentSessionDayIndices.map(idx => i - idx);
        const baseReadiness = calculateChronicReadiness(sMeta, sStruct, capMeta, capStruct);
        const adjustedReadiness = applyDetrainingPenalty(baseReadiness, daysSinceRecentSessions);

        dailyFatigue.push(calculateFatigueScore(sMeta, sStruct));
        dailyReadiness.push(adjustedReadiness);
    }

    return { dailyFatigue, dailyReadiness };
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

    // Build week analyses
    const weekAnalyses: WeekAnalysis[] = [];
    let currentCycleIndex = 0;

    for (let w = 0; w < numWeeks; w++) {
        if (changePoints.includes(w) && w > 0) {
            currentCycleIndex++;
        }

        const isLocalPeak = peaks.includes(w);
        const isLocalTrough = troughs.includes(w);

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
            cycleIndex: currentCycleIndex,
            isLocalPeak,
            isLocalTrough
        });
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
