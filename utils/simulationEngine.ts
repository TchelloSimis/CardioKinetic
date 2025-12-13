/**
 * Program Simulation Engine
 * 
 * Runs Monte Carlo simulations of training programs to predict fatigue and
 * readiness distributions over time. Returns percentile bands for visualization.
 * 
 * MATCHES Python monte_carlo_simulation.py parameters:
 * - 2-4 sessions per week (varying)
 * - ±5% power variance
 * - ±0.5 RPE variance (float, not rounded)
 * - No duration variance
 * - CTL initialized to 10.0
 */

import { ProgramPreset, PlanWeek } from '../types';
import { calculateBlockMetricsFromTemplate } from './blockCalculations';

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
// CONSTANTS (matching Python exactly)
// ============================================================================

const ATL_ALPHA = 2 / (7 + 1);   // ~0.25 for 7-day EWMA
const CTL_ALPHA = 2 / (42 + 1);  // ~0.047 for 42-day EWMA
const FATIGUE_MIDPOINT = 1.15;
const FATIGUE_STEEPNESS = 4.5;
const READINESS_OPTIMAL_TSB = 20.0;
const READINESS_WIDTH = 1250.0;
const DEFAULT_DURATION_MINUTES = 15;
const DEFAULT_ITERATIONS = 50000;

// ============================================================================
// SCORE CALCULATIONS (matching Python exactly)
// ============================================================================

/**
 * Calculate fatigue score using ACWR sigmoid (matches Python vectorized_fatigue_score)
 */
function calculateFatigueScore(atl: number, ctl: number): number {
    // Avoid division by zero (Python uses max(ctl, 0.001))
    const ctlSafe = Math.max(ctl, 0.001);
    const acwr = atl / ctlSafe;
    const score = 100.0 / (1.0 + Math.exp(-FATIGUE_STEEPNESS * (acwr - FATIGUE_MIDPOINT)));
    return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Calculate readiness score using TSB Gaussian (matches Python vectorized_readiness_score)
 */
function calculateReadinessScore(tsb: number): number {
    const exponent = -Math.pow(tsb - READINESS_OPTIMAL_TSB, 2) / READINESS_WIDTH;
    const score = 100.0 * Math.exp(exponent);
    return Math.round(Math.max(0, Math.min(100, score)));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate session load (matches Python vectorized_session_load)
 * Load = RPE^1.5 × Duration^0.75 × PowerRatio^0.5 × 0.3
 */
function calculateSessionLoad(
    rpe: number,
    durationMinutes: number,
    powerRatio: number
): number {
    const clampedRatio = Math.max(0.25, Math.min(4.0, powerRatio));
    return Math.pow(rpe, 1.5) * Math.pow(durationMinutes, 0.75) * Math.pow(clampedRatio, 0.5) * 0.3;
}

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
 * Run a single simulation iteration (matches Python run_single_simulation_fast)
 */
function runSingleSimulation(
    plan: PlanWeek[],
    basePower: number,
    weekCount: number
): { fatigueByWeek: number[], readinessByWeek: number[] } {
    // ATL=9, CTL=10 gives TSB≈1 → ~75% starting readiness (neutral state)
    let atl = 9;
    let ctl = 10.0; // Matches Python: initial=10.0

    const fatigueByWeek: number[] = [];
    const readinessByWeek: number[] = [];

    for (let weekIndex = 0; weekIndex < weekCount; weekIndex++) {
        const weekPlan = plan[weekIndex] || plan[plan.length - 1];
        const powerMultiplier = weekPlan.plannedPower / basePower;
        const targetRPE = weekPlan.targetRPE;
        const duration = weekPlan.targetDurationMinutes || DEFAULT_DURATION_MINUTES;

        // Generate random sessions per week: 2, 3, or 4 (matches Python: rng.integers(2, 5))
        const sessionsThisWeek = 2 + Math.floor(Math.random() * 3);

        // Random days within the week (0-6), no replacement
        const allDays = [0, 1, 2, 3, 4, 5, 6];
        const shuffledDays = shuffleArray(allDays);
        const sessionDays = shuffledDays.slice(0, sessionsThisWeek);

        // Generate daily loads (initialize all to 0)
        const dailyLoads = new Array(7).fill(0);

        for (const day of sessionDays) {
            // Power with ±5% variation (matches Python: 1.0 + rng.uniform(-0.05, 0.05))
            const actualPowerMult = powerMultiplier * (1.0 + (Math.random() * 0.1 - 0.05));

            // RPE with ±0.5 variation, clamped 1-10 (matches Python: clip(rpe + uniform(-0.5, 0.5), 1, 10))
            const actualRPE = Math.max(1, Math.min(10, targetRPE + (Math.random() - 0.5)));

            // Calculate load (power ratio is the multiplier itself, like Python)
            const powerRatio = actualPowerMult;
            const load = calculateSessionLoad(actualRPE, duration, powerRatio);

            dailyLoads[day] = load;
        }

        // Update EWMA for each day (matches Python EWMA loop)
        for (const dailyLoad of dailyLoads) {
            atl = atl * (1 - ATL_ALPHA) + dailyLoad * ATL_ALPHA;
            ctl = ctl * (1 - CTL_ALPHA) + dailyLoad * CTL_ALPHA;
        }

        // Calculate end-of-week metrics
        const tsb = ctl - atl;
        fatigueByWeek.push(calculateFatigueScore(atl, ctl));
        readinessByWeek.push(calculateReadinessScore(tsb));
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
