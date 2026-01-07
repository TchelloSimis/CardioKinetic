/**
 * Program Simulation Engine
 * 
 * Runs Monte Carlo simulations of training programs to predict fatigue and
 * readiness distributions over time. Returns percentile bands for visualization.
 * 
 * Uses the Chronic Fatigue Model (dual-compartment):
 * - MET (Metabolic Energy Tank): τ ≈ 2 days (fast recovery)
 * - MSK (MusculoSkeletal): τ ≈ 15 days (slow recovery)
 */

import { ProgramPreset, PlanWeek } from '../types';
import { calculateBlockMetricsFromTemplate } from './blockCalculations';
import {
    updateMetabolicFreshness,
    updateStructuralHealth,
    calculateReadinessScore as calculateChronicReadiness,
    DEFAULT_PHI_RECOVERY,
    DEFAULT_CAP_METABOLIC,
    DEFAULT_CAP_STRUCTURAL,
    SIGMA_IMPACT,
} from './chronicFatigueModel';
import { estimateCostFromAverage, REFERENCE_SCALE } from './physiologicalCostEngine';

// ============================================================================
// TYPES
// ============================================================================

/** Percentile bands for a single metric */
export interface PercentileBand {
    min: number;
    p25: number;
    median: number;
    p75: number;
    max: number;
}

/** Weekly simulation data with Monte Carlo percentile bands */
export interface SimulationWeekData {
    week: number;
    plannedPower: number;
    plannedWork: number;
    fatigue: PercentileBand;
    readiness: PercentileBand;
    phase: string;
}

export interface SimulationResult {
    weeks: SimulationWeekData[];
    programName: string;
    basePower: number;
    weekCount: number;
    iterations: number;
}

export interface SimulationParams {
    preset: ProgramPreset;
    basePower: number;
    weekCount: number;
    iterations?: number;       // Monte Carlo iterations (default: 50000)
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_DURATION_MINUTES = 15;
const DEFAULT_ITERATIONS = 50000;

// ============================================================================
// SCORE CALCULATIONS (Chronic Fatigue Model)
// ============================================================================

/**
 * Calculate fatigue score from chronic model compartments
 * Higher MET/MSK = higher fatigue
 */
function calculateFatigueFromChronic(sMeta: number, sStruct: number): number {
    const capMeta = DEFAULT_CAP_METABOLIC;
    const capStruct = DEFAULT_CAP_STRUCTURAL;
    const metaRatio = sMeta / capMeta;
    const structRatio = sStruct / capStruct;
    // Weight metabolic fatigue higher for short-term feel
    const avgRatio = (metaRatio * 0.6 + structRatio * 0.4);
    return Math.round(Math.min(100, Math.max(0, avgRatio * 100)));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArr: number[], p: number): number {
    if (sortedArr.length === 0) return 0;
    const index = (p / 100) * (sortedArr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sortedArr[lower];
    return sortedArr[lower] + (sortedArr[upper] - sortedArr[lower]) * (index - lower);
}

/**
 * Calculate percentile bands from array of values
 */
function calculatePercentileBands(values: number[]): PercentileBand {
    const sorted = [...values].sort((a, b) => a - b);
    return {
        min: sorted[0] ?? 0,
        p25: percentile(sorted, 25),
        median: percentile(sorted, 50),
        p75: percentile(sorted, 75),
        max: sorted[sorted.length - 1] ?? 0
    };
}

/**
 * Shuffle array in place (Fisher-Yates)
 */
function shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Run a single simulation iteration using Chronic Fatigue Model
 * Uses dual-compartment MET/MSK dynamics
 */
function runSingleSimulation(
    plan: PlanWeek[],
    basePower: number,
    weekCount: number
): { fatigueByWeek: number[], readinessByWeek: number[] } {
    // Initialize chronic state at baseline (low fatigue)
    let sMeta = 0;
    let sStruct = 0;
    const capMeta = DEFAULT_CAP_METABOLIC;
    const capStruct = DEFAULT_CAP_STRUCTURAL;

    const fatigueByWeek: number[] = [];
    const readinessByWeek: number[] = [];

    for (let weekIndex = 0; weekIndex < weekCount; weekIndex++) {
        const weekPlan = plan[weekIndex] || plan[plan.length - 1];
        const powerMultiplier = weekPlan.plannedPower / basePower;
        const targetRPE = weekPlan.targetRPE;
        const duration = weekPlan.targetDurationMinutes || DEFAULT_DURATION_MINUTES;

        // Generate random sessions per week: 2, 3, or 4
        const sessionsThisWeek = 2 + Math.floor(Math.random() * 3);

        // Random days within the week (0-6), no replacement
        const allDays = [0, 1, 2, 3, 4, 5, 6];
        const shuffledDays = shuffleArray(allDays);
        const sessionDays = shuffledDays.slice(0, sessionsThisWeek);

        // Generate daily loads (initialize all to 0)
        const dailyLoads = new Array(7).fill(0);

        // Estimate CP/W' from base power for consistent load calculation
        // These match the default estimates used in criticalPowerEngine
        const estimatedCP = basePower * 0.85; // ~85% of FTP is typical CP
        const estimatedWPrime = 15000;        // Default W' in joules

        for (const day of sessionDays) {
            // Power with ±5% variation
            const actualPowerMult = powerMultiplier * (1.0 + (Math.random() * 0.1 - 0.05));
            const actualPower = basePower * actualPowerMult;

            // Calculate load using physiological cost engine (matches chart)
            // Determine session style based on week plan
            const sessionStyle = weekPlan.sessionStyle ||
                (weekPlan.workRestRatio && weekPlan.workRestRatio !== 'steady' ? 'interval' : 'steady-state');

            const load = estimateCostFromAverage(
                actualPower,
                duration,
                estimatedCP,
                estimatedWPrime,
                sessionStyle,
                weekPlan.workRestRatio
            );

            dailyLoads[day] = load;
        }

        // Update chronic model compartments for each day
        for (const dailyLoad of dailyLoads) {
            // Random recovery efficiency (φ) for Monte Carlo variation: 0.7 to 1.3
            const phiRecovery = 0.7 + Math.random() * 0.6;

            // Update compartments using chronic model dynamics
            sMeta = updateMetabolicFreshness(sMeta, dailyLoad, phiRecovery, capMeta);
            sStruct = updateStructuralHealth(sStruct, dailyLoad, SIGMA_IMPACT, capStruct);
        }

        // Calculate end-of-week metrics using chronic model
        const fatigue = calculateFatigueFromChronic(sMeta, sStruct);
        const readiness = calculateChronicReadiness(sMeta, sStruct, capMeta, capStruct);

        fatigueByWeek.push(fatigue);
        readinessByWeek.push(readiness);
    }

    return { fatigueByWeek, readinessByWeek };
}

// ============================================================================
// MAIN SIMULATION FUNCTION
// ============================================================================

/**
 * Run Monte Carlo simulation of a training program
 * Returns weekly data with percentile bands for fatigue and readiness
 */
export function runMonteCarloSimulation(params: SimulationParams): SimulationResult {
    const {
        preset,
        basePower,
        weekCount,
        iterations = DEFAULT_ITERATIONS
    } = params;

    // Generate the training plan from the preset
    const plan: PlanWeek[] = preset.generator(basePower, weekCount);

    // Collect results across all iterations
    const allFatigue: number[][] = Array.from({ length: weekCount }, () => []);
    const allReadiness: number[][] = Array.from({ length: weekCount }, () => []);

    // Run Monte Carlo iterations
    for (let i = 0; i < iterations; i++) {
        const { fatigueByWeek, readinessByWeek } = runSingleSimulation(
            plan,
            basePower,
            weekCount
        );

        for (let w = 0; w < weekCount; w++) {
            allFatigue[w].push(fatigueByWeek[w]);
            allReadiness[w].push(readinessByWeek[w]);
        }
    }

    // Build results with percentile bands
    const weeks: SimulationWeekData[] = [];

    for (let weekIndex = 0; weekIndex < weekCount; weekIndex++) {
        const weekPlan = plan[weekIndex] || plan[plan.length - 1];

        // Calculate planned power and work
        let plannedPower: number;
        let plannedWork: number;

        if (weekPlan.sessionStyle === 'custom' && weekPlan.blocks && weekPlan.blocks.length > 0) {
            const metrics = calculateBlockMetricsFromTemplate(weekPlan.blocks as any, basePower, 1.0);
            plannedPower = metrics.averagePower;
            plannedWork = metrics.totalWork;
        } else {
            plannedPower = weekPlan.plannedPower;
            const duration = weekPlan.targetDurationMinutes || DEFAULT_DURATION_MINUTES;
            plannedWork = Math.round(plannedPower * duration / 60);
        }

        weeks.push({
            week: weekIndex + 1,
            plannedPower,
            plannedWork,
            fatigue: calculatePercentileBands(allFatigue[weekIndex]),
            readiness: calculatePercentileBands(allReadiness[weekIndex]),
            phase: weekPlan.phaseName
        });
    }

    return {
        weeks,
        programName: preset.name,
        basePower,
        weekCount,
        iterations
    };
}

/**
 * Flatten simulation result to chart-friendly format
 * with separate keys for each percentile band
 */
export function flattenForChart(result: SimulationResult): Array<{
    week: number;
    name: string;
    plannedPower: number;
    plannedWork: number;
    phase: string;
    fatigueMin: number;
    fatigueP25: number;
    fatigueMedian: number;
    fatigueP75: number;
    fatigueMax: number;
    readinessMin: number;
    readinessP25: number;
    readinessMedian: number;
    readinessP75: number;
    readinessMax: number;
}> {
    return result.weeks.map(w => ({
        week: w.week,
        name: `W${w.week}`,
        plannedPower: w.plannedPower,
        plannedWork: w.plannedWork,
        phase: w.phase,
        fatigueMin: w.fatigue.min,
        fatigueP25: w.fatigue.p25,
        fatigueMedian: w.fatigue.median,
        fatigueP75: w.fatigue.p75,
        fatigueMax: w.fatigue.max,
        readinessMin: w.readiness.min,
        readinessP25: w.readiness.p25,
        readinessMedian: w.readiness.median,
        readinessP75: w.readiness.p75,
        readinessMax: w.readiness.max
    }));
}
