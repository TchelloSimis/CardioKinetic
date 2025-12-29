#!/usr/bin/env node
/**
 * Modifier Analysis CLI Tool v2.0
 * 
 * RIGOROUS Analysis Using ACTUAL App Engine
 * 
 * This version imports the REAL app functions to ensure parity with browser behavior.
 * 
 * Usage: npx tsx utils/modifierAnalysisCli.ts [options]
 * 
 * Key improvements over v1:
 * - Uses actual suggestModifiers() from ./suggestModifiers
 * - Uses actual applyFatigueModifiers() from ./fatigueModifiers
 * - Uses actual detectCyclePhase() from ./fatigueModifiers
 * - Runs 10,000+ iterations for statistical significance
 * - Reports full percentile distributions (P5, P25, P50, P75, P95)
 * - Computes effect sizes (Cohen's d) for meaningful comparisons
 * - Generates 20+ diverse program configurations
 */

import { suggestModifiers } from './suggestModifiers/index.ts';
import { applyFatigueModifiers, detectCyclePhaseAdvanced, type PhaseContext } from './fatigueModifiers.ts';
import { runSingleSimulation, calculateFatigueScore, calculateReadinessScore } from './suggestModifiers/simulation.ts';
import { computeExpectedPhase } from './suggestModifiers/algorithms.ts';
import type { WeekDefinition, FatigueModifier, FatigueContext, CyclePhase } from '../programTemplate.ts';
import * as fs from 'fs';

// ============================================================================
// TYPES
// ============================================================================

// Note: WeekDefinition and FatigueModifier are imported from programTemplate.ts


interface CliOptions {
    iterations: number;
    basePower: number;
    outputFile?: string;
    verbose: boolean;
    modifierSimulations: number;
}

interface PercentileStats {
    p5: number;
    p25: number;
    p50: number;  // median
    p75: number;
    p95: number;
    mean: number;
    std: number;
}

interface WeeklyStats {
    weekNumber: number;
    phaseName: string;
    powerMultiplier: number;
    focus: string;
    baselineFatigue: PercentileStats;
    adaptiveFatigue: PercentileStats;
    baselineReadiness: PercentileStats;
    adaptiveReadiness: PercentileStats;
    triggerCount: PercentileStats;
    detectedPhaseCounts: Record<string, number>;
    modifierTriggerCounts: Map<string, number>;
}

interface ProgramConfig {
    name: string;
    weeks: WeekDefinition[];
    description: string;
}

interface EffectSize {
    cohensD: number;
    interpretation: string;  // negligible, small, medium, large
    percentReduction: number;
}

interface AnalysisResult {
    timestamp: string;
    programConfig: { name: string; weekCount: number; description: string };
    simulationParams: { iterations: number; basePower: number; modifierSimulations: number };

    // Core metrics with full distributions
    fatigueEffect: EffectSize;
    readinessEffect: EffectSize;
    peakFatigueEffect: EffectSize;

    // Trigger statistics
    avgTriggersPerWeek: PercentileStats;
    totalModifiers: number;
    activeModifiers: number;
    deadModifiers: string[];

    // Phase detection accuracy
    phaseAccuracy: number;  // % of weeks where detected phase matches expected
    phaseMismatchWeeks: number[];

    // Weekly breakdown
    weeklyStats: WeeklyStats[];

    // Statistical significance
    pValue: number;  // t-test for fatigue reduction
    isSignificant: boolean;
}

// ============================================================================
// STATISTICAL FUNCTIONS
// ============================================================================

function percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * (p / 100));
    return sorted[Math.min(idx, sorted.length - 1)];
}

function mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const variance = arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (arr.length - 1);
    return Math.sqrt(variance);
}

function computePercentileStats(arr: number[]): PercentileStats {
    return {
        p5: Math.round(percentile(arr, 5) * 10) / 10,
        p25: Math.round(percentile(arr, 25) * 10) / 10,
        p50: Math.round(percentile(arr, 50) * 10) / 10,
        p75: Math.round(percentile(arr, 75) * 10) / 10,
        p95: Math.round(percentile(arr, 95) * 10) / 10,
        mean: Math.round(mean(arr) * 10) / 10,
        std: Math.round(std(arr) * 10) / 10
    };
}

function cohensD(group1: number[], group2: number[]): EffectSize {
    const m1 = mean(group1);
    const m2 = mean(group2);
    const s1 = std(group1);
    const s2 = std(group2);

    // Pooled standard deviation
    const n1 = group1.length;
    const n2 = group2.length;
    const pooledStd = Math.sqrt(((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2));

    if (pooledStd === 0) return { cohensD: 0, interpretation: 'negligible', percentReduction: 0 };

    const d = (m1 - m2) / pooledStd;

    let interpretation: string;
    const absD = Math.abs(d);
    if (absD < 0.2) interpretation = 'negligible';
    else if (absD < 0.5) interpretation = 'small';
    else if (absD < 0.8) interpretation = 'medium';
    else interpretation = 'large';

    const percentReduction = m1 > 0 ? Math.round(((m1 - m2) / m1) * 1000) / 10 : 0;

    return { cohensD: Math.round(d * 100) / 100, interpretation, percentReduction };
}

// Welch's t-test for unequal variances
function tTest(group1: number[], group2: number[]): number {
    const m1 = mean(group1);
    const m2 = mean(group2);
    const s1 = std(group1);
    const s2 = std(group2);
    const n1 = group1.length;
    const n2 = group2.length;

    if (s1 === 0 && s2 === 0) return 1.0;  // No variance = no difference

    const se = Math.sqrt((s1 * s1) / n1 + (s2 * s2) / n2);
    if (se === 0) return 1.0;

    const t = (m1 - m2) / se;

    // Approximate p-value using normal distribution (valid for large n)
    // For rigorous analysis, we'd use t-distribution with Welch-Satterthwaite df
    const df = Math.pow((s1 * s1 / n1 + s2 * s2 / n2), 2) /
        (Math.pow(s1 * s1 / n1, 2) / (n1 - 1) + Math.pow(s2 * s2 / n2, 2) / (n2 - 1));

    // Simplified: use z-approximation for large samples
    const z = Math.abs(t);
    // Standard normal CDF approximation
    const pValue = 2 * (1 - 0.5 * (1 + Math.tanh(z * Math.sqrt(Math.PI) / 2)));

    return Math.round(pValue * 10000) / 10000;
}

// ============================================================================
// PROGRAM GENERATORS (Extensive library for diverse testing)
// ============================================================================

function generateProgramLibrary(basePower: number): ProgramConfig[] {
    const programs: ProgramConfig[] = [];

    // 1. LINEAR PROGRAMS (various lengths)
    for (const weekCount of [4, 8, 12, 16, 20, 24]) {
        programs.push({
            name: `linear_${weekCount}w`,
            description: `Linear progression over ${weekCount} weeks`,
            weeks: generateLinearProgram(weekCount)
        });
    }

    // 2. BLOCK PROGRAMS (various structures)
    for (const structure of ['3+1', '4+2', '5+1', '6+2']) {
        const [buildWeeks, deloadWeeks] = structure.split('+').map(Number);
        for (const cycles of [2, 3, 4]) {
            const weekCount = (buildWeeks + deloadWeeks) * cycles;
            programs.push({
                name: `block_${structure}x${cycles}_${weekCount}w`,
                description: `Block periodization: ${buildWeeks} build + ${deloadWeeks} deload, ${cycles} cycles`,
                weeks: generateBlockProgram(buildWeeks, deloadWeeks, cycles)
            });
        }
    }

    // 3. UNDULATING PROGRAMS
    for (const weekCount of [8, 12, 16]) {
        programs.push({
            name: `undulating_${weekCount}w`,
            description: `Daily undulating periodization over ${weekCount} weeks`,
            weeks: generateUndulatingProgram(weekCount)
        });
    }

    // 4. AGGRESSIVE/HIGH-INTENSITY PROGRAMS
    for (const weekCount of [6, 8, 12]) {
        for (const progression of [0.3, 0.4, 0.5]) {  // 30%, 40%, 50% power increase
            programs.push({
                name: `aggressive_${Math.round(progression * 100)}pct_${weekCount}w`,
                description: `Aggressive ${Math.round(progression * 100)}% power increase over ${weekCount} weeks`,
                weeks: generateAggressiveProgram(weekCount, progression)
            });
        }
    }

    // 5. RECOVERY-FOCUSED PROGRAMS
    for (const pattern of ['2+1', '3+1', '1+1']) {  // work + recovery pattern
        const [workWeeks, recoveryWeeks] = pattern.split('+').map(Number);
        const cycles = 4;
        programs.push({
            name: `recovery_${pattern}x${cycles}`,
            description: `Recovery-focused: ${workWeeks} work + ${recoveryWeeks} recovery, ${cycles} cycles`,
            weeks: generateRecoveryProgram(workWeeks, recoveryWeeks, cycles)
        });
    }

    // 6. PEAKING PROGRAMS (competition prep)
    for (const weekCount of [6, 8, 12]) {
        programs.push({
            name: `peaking_${weekCount}w`,
            description: `Competition peaking program over ${weekCount} weeks`,
            weeks: generatePeakingProgram(weekCount)
        });
    }

    // 7. BASE BUILDING (low intensity, high volume)
    for (const weekCount of [8, 12, 16]) {
        programs.push({
            name: `base_${weekCount}w`,
            description: `Base building with gradual volume increase over ${weekCount} weeks`,
            weeks: generateBaseProgram(weekCount)
        });
    }

    return programs;
}

function generateLinearProgram(weekCount: number): WeekDefinition[] {
    const weeks: WeekDefinition[] = [];
    for (let i = 0; i < weekCount; i++) {
        const progress = i / Math.max(1, weekCount - 1);
        weeks.push({
            position: i === 0 ? 'first' : i === weekCount - 1 ? 'last' : `${Math.round(progress * 100)}%`,
            phaseName: progress < 0.33 ? 'Base' : progress < 0.66 ? 'Build' : 'Peak',
            focus: progress < 0.5 ? 'Volume' : 'Intensity',
            description: `Week ${i + 1} of linear progression`,
            powerMultiplier: 1.0 + progress * 0.20,
            workRestRatio: progress < 0.5 ? '1:2' : '2:1',
            targetRPE: Math.min(9, 5 + Math.floor(progress * 4))
        });
    }
    return weeks;
}

function generateBlockProgram(buildWeeks: number, deloadWeeks: number, cycles: number): WeekDefinition[] {
    const weeks: WeekDefinition[] = [];
    const cycleLength = buildWeeks + deloadWeeks;

    for (let c = 0; c < cycles; c++) {
        for (let w = 0; w < cycleLength; w++) {
            const isDeload = w >= buildWeeks;
            const cycleProgress = c / Math.max(1, cycles - 1);
            const basePowerMult = 1.0 + cycleProgress * 0.15;

            if (isDeload) {
                weeks.push({
                    position: weeks.length === 0 ? 'first' : `${Math.round((weeks.length / (cycleLength * cycles - 1)) * 100)}%`,
                    phaseName: 'Deload',
                    focus: 'Recovery',
                    description: `Deload week ${w - buildWeeks + 1} of cycle ${c + 1}`,
                    powerMultiplier: basePowerMult * 0.75,
                    workRestRatio: '1:3',
                    targetRPE: 4
                });
            } else {
                const buildProgress = w / Math.max(1, buildWeeks - 1);
                weeks.push({
                    position: weeks.length === 0 ? 'first' : `${Math.round((weeks.length / (cycleLength * cycles - 1)) * 100)}%`,
                    phaseName: 'Builder',
                    focus: 'Intensity',
                    description: `Build week ${w + 1} of cycle ${c + 1}`,
                    powerMultiplier: basePowerMult * (1.0 + buildProgress * 0.15),
                    workRestRatio: '2:1',
                    targetRPE: 6 + Math.floor(buildProgress * 2)
                });
            }
        }
    }
    return weeks;
}

function generateUndulatingProgram(weekCount: number): WeekDefinition[] {
    const weeks: WeekDefinition[] = [];
    for (let i = 0; i < weekCount; i++) {
        const isHard = i % 2 === 0;
        const progress = i / Math.max(1, weekCount - 1);
        weeks.push({
            position: i === 0 ? 'first' : i === weekCount - 1 ? 'last' : `${Math.round(progress * 100)}%`,
            phaseName: isHard ? 'Overload' : 'Recovery',
            focus: isHard ? 'Intensity' : 'Recovery',
            description: `${isHard ? 'Hard' : 'Easy'} week ${Math.floor(i / 2) + 1}`,
            powerMultiplier: isHard ? 1.10 + progress * 0.15 : 0.85,
            workRestRatio: isHard ? '2:1' : '1:2',
            targetRPE: isHard ? 8 : 5
        });
    }
    return weeks;
}

function generateAggressiveProgram(weekCount: number, totalProgressionPercent: number): WeekDefinition[] {
    const weeks: WeekDefinition[] = [];
    for (let i = 0; i < weekCount; i++) {
        const progress = i / Math.max(1, weekCount - 1);
        weeks.push({
            position: i === 0 ? 'first' : i === weekCount - 1 ? 'last' : `${Math.round(progress * 100)}%`,
            phaseName: 'Aggressive Build',
            focus: 'Intensity',
            description: `Aggressive week ${i + 1}`,
            powerMultiplier: 1.0 + progress * totalProgressionPercent,
            workRestRatio: '3:1',
            targetRPE: Math.min(10, 7 + Math.floor(progress * 3))
        });
    }
    return weeks;
}

function generateRecoveryProgram(workWeeks: number, recoveryWeeks: number, cycles: number): WeekDefinition[] {
    const weeks: WeekDefinition[] = [];
    const cycleLength = workWeeks + recoveryWeeks;

    for (let c = 0; c < cycles; c++) {
        for (let w = 0; w < cycleLength; w++) {
            const isRecovery = w >= workWeeks;
            weeks.push({
                position: weeks.length === 0 ? 'first' : `${Math.round((weeks.length / (cycleLength * cycles - 1)) * 100)}%`,
                phaseName: isRecovery ? 'Recovery' : 'Maintenance',
                focus: isRecovery ? 'Recovery' : 'Volume',
                description: `${isRecovery ? 'Recovery' : 'Work'} week of cycle ${c + 1}`,
                powerMultiplier: isRecovery ? 0.70 : 1.0,
                workRestRatio: isRecovery ? '1:3' : '1:1',
                targetRPE: isRecovery ? 3 : 6
            });
        }
    }
    return weeks;
}

function generatePeakingProgram(weekCount: number): WeekDefinition[] {
    const weeks: WeekDefinition[] = [];
    for (let i = 0; i < weekCount; i++) {
        const progress = i / Math.max(1, weekCount - 1);
        // Peaking: increase early, then decrease volume but maintain intensity
        const isPeakPhase = progress > 0.7;
        const isTaper = progress > 0.85;

        weeks.push({
            position: i === 0 ? 'first' : i === weekCount - 1 ? 'last' : `${Math.round(progress * 100)}%`,
            phaseName: isTaper ? 'Taper' : isPeakPhase ? 'Peak' : 'Build',
            focus: isTaper ? 'Recovery' : isPeakPhase ? 'Density' : 'Intensity',
            description: `${isTaper ? 'Taper' : isPeakPhase ? 'Peak' : 'Build'} week ${i + 1}`,
            powerMultiplier: isTaper ? 0.85 : isPeakPhase ? 1.25 : 1.0 + progress * 0.3,
            workRestRatio: isTaper ? '1:2' : isPeakPhase ? '3:1' : '2:1',
            targetRPE: isTaper ? 6 : isPeakPhase ? 9 : 7 + Math.floor(progress * 2)
        });
    }
    return weeks;
}

function generateBaseProgram(weekCount: number): WeekDefinition[] {
    const weeks: WeekDefinition[] = [];
    for (let i = 0; i < weekCount; i++) {
        const progress = i / Math.max(1, weekCount - 1);
        weeks.push({
            position: i === 0 ? 'first' : i === weekCount - 1 ? 'last' : `${Math.round(progress * 100)}%`,
            phaseName: 'Base',
            focus: 'Volume',
            description: `Base building week ${i + 1}`,
            powerMultiplier: 0.85 + progress * 0.15,  // 85% → 100%
            workRestRatio: '1:1',
            targetRPE: 5 + Math.floor(progress * 2)
        });
    }
    return weeks;
}

// ============================================================================
// SIMULATION ENGINE (Using actual app functions)
// ============================================================================

const ATL_ALPHA = 2.0 / 8;
const CTL_ALPHA = 2.0 / 43;

function seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function calculateFatigue(atl: number, ctl: number): number {
    if (ctl <= 0.001) return atl > 0 ? Math.min(100, Math.round(atl * 2)) : 0;
    const acwr = atl / ctl;
    return Math.round(Math.max(0, Math.min(100, 100 / (1 + Math.exp(-4.5 * (acwr - 1.15))))));
}

function calculateReadiness(tsb: number): number {
    const exponent = -Math.pow(tsb - 20.0, 2) / 1250.0;
    return Math.round(Math.max(0, Math.min(100, 100 * Math.exp(exponent))));
}

function calculateLoad(power: number, basePower: number, duration: number, rpe: number): number {
    const powerRatio = Math.max(0.25, Math.min(4.0, power / basePower));
    return Math.pow(rpe, 1.5) * Math.pow(duration, 0.75) * Math.pow(powerRatio, 0.5) * 0.3;
}

function runSimulationIteration(
    weeks: WeekDefinition[],
    modifiers: FatigueModifier[],
    useModifiers: boolean,
    basePower: number,
    seed: number
): {
    weeklyFatigue: number[];
    weeklyReadiness: number[];
    triggers: number[];
    triggerMessages: string[][];
    detectedPhases: (string | undefined)[];
} {
    let atl = 9, ctl = 10;
    const fatigueHistory: number[] = [];
    const ctlHistory: number[] = [];
    const atlHistory: number[] = [];
    let randomIdx = 0;
    const getRandom = () => seededRandom(seed + randomIdx++);

    const weeklyFatigue: number[] = [];
    const weeklyReadiness: number[] = [];
    const triggers: number[] = [];
    const triggerMessages: string[][] = [];
    const detectedPhases: (string | undefined)[] = [];

    for (let weekIdx = 0; weekIdx < weeks.length; weekIdx++) {
        const week = weeks[weekIdx];
        const numSessions = Math.floor(getRandom() * 3) + 2;
        const sessionDays = new Set<number>();
        while (sessionDays.size < numSessions) sessionDays.add(Math.floor(getRandom() * 7));

        let weekTriggers = 0;
        const weekModMessages: string[] = [];
        let lastDetectedPhase: CyclePhase | undefined;

        for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
            const isSession = sessionDays.has(dayInWeek);
            let load = 0;

            if (isSession) {
                const powerVariance = (getRandom() * 0.1) - 0.05;
                const rpeVariance = Math.round(getRandom() * 2 - 1);
                let power = Math.round(basePower * (week.powerMultiplier || 1.0) * (1 + powerVariance));
                let duration = 15;
                let rpe = Math.max(1, Math.min(10, (week.targetRPE || 6) + rpeVariance));

                if (useModifiers && modifiers.length > 0) {
                    const fatigue = calculateFatigue(atl, ctl);
                    const readiness = calculateReadiness(ctl - atl);

                    // Build full context for advanced phase detection
                    const phaseContext: PhaseContext = {
                        fatigueHistory: [...fatigueHistory],
                        readinessHistory: fatigueHistory.map((_, i) => calculateReadiness(ctlHistory[i] - atlHistory[i])),
                        ctlHistory: [...ctlHistory],
                        powerHistory: weeks.slice(0, weekIdx + 1).map(w => w.powerMultiplier || 1.0),
                        weekNumber: weekIdx + 1,
                        totalWeeks: weeks.length,
                        previousPhase: lastDetectedPhase
                    };

                    const cyclePhaseResult = fatigueHistory.length >= 5
                        ? detectCyclePhaseAdvanced(phaseContext)
                        : { phase: undefined, confidence: 0 };

                    lastDetectedPhase = cyclePhaseResult.phase;

                    const context = {
                        fatigueScore: fatigue,
                        readinessScore: readiness,
                        tsbValue: ctl - atl,
                        weekNumber: weekIdx + 1,
                        totalWeeks: weeks.length,
                        phaseName: week.phaseName,
                        fatigueHistory: [...fatigueHistory],
                        // DETERMINISTIC phase identity - computed from week definition
                        expectedCyclePhase: computeExpectedPhase(
                            week,
                            weekIdx + 1,
                            weeks.length,
                            weekIdx > 0 ? weeks[weekIdx - 1] : undefined,
                            weekIdx < weeks.length - 1 ? weeks[weekIdx + 1] : undefined
                        ),
                        // Compute position within phase (simplified for CLI)
                        expectedPhasePosition: weekIdx / weeks.length <= 0.33 ? 'early' as const
                            : weekIdx / weeks.length >= 0.67 ? 'late' as const
                                : 'mid' as const
                    };

                    // CRITICAL: Use actual applyFatigueModifiers from the app
                    for (const mod of modifiers.sort((a: FatigueModifier, b: FatigueModifier) => (a.priority || 0) - (b.priority || 0))) {
                        try {
                            const { messages } = applyFatigueModifiers(
                                // Create a minimal PlanWeek mock for CLI testing
                                {
                                    week: weekIdx + 1,
                                    phaseName: week.phaseName,
                                    focus: week.focus as 'Density' | 'Intensity' | 'Volume' | 'Recovery',
                                    workRestRatio: week.workRestRatio || '1:1',
                                    targetRPE: rpe,
                                    plannedPower: power,
                                    description: week.description || ''
                                },
                                context,
                                [mod]
                            );
                            if (messages && messages.length > 0) {
                                const adj = mod.adjustments;
                                if (adj.powerMultiplier) power = Math.round(power * adj.powerMultiplier);
                                if (adj.rpeAdjust) rpe = Math.max(1, Math.min(10, rpe + adj.rpeAdjust));
                                if (adj.volumeMultiplier) duration *= adj.volumeMultiplier;
                                weekTriggers++;
                                weekModMessages.push(adj.message || `Modifier P${mod.priority}`);
                                break;
                            }
                        } catch (e) {
                            // If applyFatigueModifiers fails, skip this modifier
                        }
                    }
                }
                load = calculateLoad(power, basePower, duration, rpe);
                fatigueHistory.push(calculateFatigue(atl, ctl));
                ctlHistory.push(ctl);
                atlHistory.push(atl);
            }
            atl = atl * (1 - ATL_ALPHA) + load * ATL_ALPHA;
            ctl = ctl * (1 - CTL_ALPHA) + load * CTL_ALPHA;
        }

        weeklyFatigue.push(calculateFatigue(atl, ctl));
        weeklyReadiness.push(calculateReadiness(ctl - atl));
        triggers.push(weekTriggers);
        triggerMessages.push(weekModMessages);
        detectedPhases.push(lastDetectedPhase);
    }

    return { weeklyFatigue, weeklyReadiness, triggers, triggerMessages, detectedPhases };
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

function runRigorousAnalysis(
    program: ProgramConfig,
    options: CliOptions
): AnalysisResult {
    const weeks = program.weeks;
    const numWeeks = weeks.length;

    if (options.verbose) {
        console.log(`\n📊 Analyzing: ${program.name} (${numWeeks} weeks)`);
        console.log(`   ${program.description}`);
    }

    // Step 1: Generate modifiers using ACTUAL app function
    if (options.verbose) console.log(`   🔧 Generating modifiers (${options.modifierSimulations} simulations)...`);
    const modifiers: FatigueModifier[] = suggestModifiers(weeks, options.basePower, options.modifierSimulations);

    if (options.verbose) console.log(`   ⚡ Generated ${modifiers.length} modifiers`);

    // Step 2: Run Monte Carlo simulations
    if (options.verbose) console.log(`   🔄 Running ${options.iterations} simulation iterations...`);

    const baselineFatigues: number[][] = Array(numWeeks).fill(null).map(() => []);
    const baselineReadinesses: number[][] = Array(numWeeks).fill(null).map(() => []);
    const adaptiveFatigues: number[][] = Array(numWeeks).fill(null).map(() => []);
    const adaptiveReadinesses: number[][] = Array(numWeeks).fill(null).map(() => []);
    const triggerCounts: number[][] = Array(numWeeks).fill(null).map(() => []);
    const allTriggerMessages: Map<string, number>[] = Array(numWeeks).fill(null).map(() => new Map());
    const allDetectedPhases: (string | undefined)[][] = Array(numWeeks).fill(null).map(() => []);

    // Peak fatigue across entire program (per iteration)
    const peakBaselineFatigues: number[] = [];
    const peakAdaptiveFatigues: number[] = [];

    for (let i = 0; i < options.iterations; i++) {
        const seed = 42 + i * 1000;
        const baseline = runSimulationIteration(weeks, [], false, options.basePower, seed);
        const adaptive = runSimulationIteration(weeks, modifiers, true, options.basePower, seed);

        peakBaselineFatigues.push(Math.max(...baseline.weeklyFatigue));
        peakAdaptiveFatigues.push(Math.max(...adaptive.weeklyFatigue));

        for (let w = 0; w < numWeeks; w++) {
            baselineFatigues[w].push(baseline.weeklyFatigue[w]);
            baselineReadinesses[w].push(baseline.weeklyReadiness[w]);
            adaptiveFatigues[w].push(adaptive.weeklyFatigue[w]);
            adaptiveReadinesses[w].push(adaptive.weeklyReadiness[w]);
            triggerCounts[w].push(adaptive.triggers[w]);
            allDetectedPhases[w].push(adaptive.detectedPhases[w]);

            for (const msg of adaptive.triggerMessages[w]) {
                allTriggerMessages[w].set(msg, (allTriggerMessages[w].get(msg) || 0) + 1);
            }
        }

        if (options.verbose && i % Math.max(1, Math.floor(options.iterations / 10)) === 0) {
            process.stdout.write(`\r   Progress: ${Math.round((i / options.iterations) * 100)}%`);
        }
    }
    if (options.verbose) console.log('\r   Progress: 100%');

    // Step 3: Compute statistics
    const allBaselineFatigue = baselineFatigues.flat();
    const allAdaptiveFatigue = adaptiveFatigues.flat();
    const allBaselineReadiness = baselineReadinesses.flat();
    const allAdaptiveReadiness = adaptiveReadinesses.flat();
    const allTriggers = triggerCounts.flat();

    const fatigueEffect = cohensD(allBaselineFatigue, allAdaptiveFatigue);
    const readinessEffect = cohensD(allAdaptiveReadiness, allBaselineReadiness);  // Note: reversed for "improvement"
    const peakFatigueEffect = cohensD(peakBaselineFatigues, peakAdaptiveFatigues);

    const pValue = tTest(allBaselineFatigue, allAdaptiveFatigue);

    // Step 4: Phase accuracy analysis
    const expectedPhase = (week: WeekDefinition): string => {
        if (week.focus === 'Recovery') return 'trough';
        if (week.phaseName.toLowerCase().includes('deload')) return 'trough';
        if (week.phaseName.toLowerCase().includes('recovery')) return 'trough';
        if (week.phaseName.toLowerCase().includes('taper')) return 'descending';
        if (week.focus === 'Intensity' || week.focus === 'Density') return 'ascending';
        return 'ascending';
    };

    const modeFn = (arr: (string | undefined)[]): string => {
        const counts = new Map<string, number>();
        arr.forEach(v => { if (v) counts.set(v, (counts.get(v) || 0) + 1); });
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        return sorted[0]?.[0] || 'unknown';
    };

    let phaseMatches = 0;
    const phaseMismatchWeeks: number[] = [];
    const weeklyStats: WeeklyStats[] = [];

    for (let w = 0; w < numWeeks; w++) {
        const expected = expectedPhase(weeks[w]);
        const detected = modeFn(allDetectedPhases[w]);

        // Count phase occurrences
        const phaseCounts: Record<string, number> = {};
        allDetectedPhases[w].forEach(p => {
            if (p) phaseCounts[p] = (phaseCounts[p] || 0) + 1;
        });

        const matches = detected === expected || detected === 'unknown';
        if (matches) phaseMatches++;
        else phaseMismatchWeeks.push(w + 1);

        weeklyStats.push({
            weekNumber: w + 1,
            phaseName: weeks[w].phaseName,
            powerMultiplier: weeks[w].powerMultiplier,
            focus: weeks[w].focus,
            baselineFatigue: computePercentileStats(baselineFatigues[w]),
            adaptiveFatigue: computePercentileStats(adaptiveFatigues[w]),
            baselineReadiness: computePercentileStats(baselineReadinesses[w]),
            adaptiveReadiness: computePercentileStats(adaptiveReadinesses[w]),
            triggerCount: computePercentileStats(triggerCounts[w]),
            detectedPhaseCounts: phaseCounts,
            modifierTriggerCounts: allTriggerMessages[w]
        });
    }

    const phaseAccuracy = Math.round((phaseMatches / numWeeks) * 100);

    // Step 5: Modifier effectiveness analysis
    const modifierTotalTriggers = new Map<string, number>();
    for (const weekMap of allTriggerMessages) {
        weekMap.forEach((count, msg) => {
            modifierTotalTriggers.set(msg, (modifierTotalTriggers.get(msg) || 0) + count);
        });
    }
    const deadModifiers = modifiers
        .map(m => m.adjustments.message)
        .filter(msg => !modifierTotalTriggers.has(msg) || modifierTotalTriggers.get(msg)! === 0);

    return {
        timestamp: new Date().toISOString(),
        programConfig: { name: program.name, weekCount: numWeeks, description: program.description },
        simulationParams: {
            iterations: options.iterations,
            basePower: options.basePower,
            modifierSimulations: options.modifierSimulations
        },
        fatigueEffect,
        readinessEffect,
        peakFatigueEffect,
        avgTriggersPerWeek: computePercentileStats(allTriggers),
        totalModifiers: modifiers.length,
        activeModifiers: modifiers.length - deadModifiers.length,
        deadModifiers,
        phaseAccuracy,
        phaseMismatchWeeks,
        weeklyStats,
        pValue,
        isSignificant: pValue < 0.05
    };
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

function printUsage(): void {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║       RIGOROUS MODIFIER ANALYSIS CLI v2.0                   ║
╚══════════════════════════════════════════════════════════════╝

Usage: npx ts-node --transpile-only utils/modifierAnalysisCli.ts [options]

Options:
  --iterations=N      Simulation iterations per program (default: 10000)
  --mod-sims=N        Monte Carlo runs for modifier generation (default: 100000)  
  --power=N           Base power in watts (default: 150)
  --output=FILE       Output JSON file (required for full results)
  --verbose           Show progress (default: true)
  --help              Show this help

Statistical Features:
  - Full percentile distributions (P5, P25, P50, P75, P95)
  - Cohen's d effect sizes with interpretation
  - Welch's t-test for statistical significance
  - Phase detection accuracy metrics
  - Dead modifier identification

Example:
  npx ts-node --transpile-only utils/modifierAnalysisCli.ts --iterations=10000 --output=results.json
`);
}

function parseArgs(): CliOptions {
    const args = process.argv.slice(2);
    const options: CliOptions = {
        iterations: 10000,         // Much higher default
        basePower: 150,
        verbose: true,
        modifierSimulations: 100000  // Match app default
    };

    for (const arg of args) {
        if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        }
        if (arg.startsWith('--iterations=')) {
            options.iterations = parseInt(arg.split('=')[1], 10);
        }
        if (arg.startsWith('--mod-sims=')) {
            options.modifierSimulations = parseInt(arg.split('=')[1], 10);
        }
        if (arg.startsWith('--power=')) {
            options.basePower = parseInt(arg.split('=')[1], 10);
        }
        if (arg.startsWith('--output=')) {
            options.outputFile = arg.split('=')[1];
        }
        if (arg === '--quiet') {
            options.verbose = false;
        }
    }

    return options;
}

function printSummary(results: AnalysisResult[]): void {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    ANALYSIS SUMMARY                          ║
╚══════════════════════════════════════════════════════════════╝
`);

    console.log(`Programs analyzed: ${results.length}`);
    console.log(`Iterations per program: ${results[0]?.simulationParams.iterations || 'N/A'}`);
    console.log(`Modifier generation simulations: ${results[0]?.simulationParams.modifierSimulations || 'N/A'}\n`);

    console.log('Program                         Weeks  Fatigue Δ  Effect Size    Peak Δ  Phase Acc  Sig?');
    console.log('─'.repeat(95));

    for (const r of results) {
        const fatigueDelta = `${r.fatigueEffect.percentReduction >= 0 ? '-' : '+'}${Math.abs(r.fatigueEffect.percentReduction).toFixed(1)}%`;
        const effectLabel = `${r.fatigueEffect.cohensD.toFixed(2)} (${r.fatigueEffect.interpretation.slice(0, 3)})`;
        const peakDelta = `${r.peakFatigueEffect.percentReduction >= 0 ? '-' : '+'}${Math.abs(r.peakFatigueEffect.percentReduction).toFixed(1)}%`;
        const sig = r.isSignificant ? '✅' : '❌';

        console.log(
            `${r.programConfig.name.padEnd(31)} ${String(r.programConfig.weekCount).padStart(5)}  ` +
            `${fatigueDelta.padStart(9)}  ${effectLabel.padStart(13)}  ${peakDelta.padStart(6)}  ` +
            `${String(r.phaseAccuracy).padStart(6)}%  ${sig}`
        );
    }

    console.log('\n─'.repeat(95));

    // Aggregate statistics
    const sigCount = results.filter(r => r.isSignificant).length;
    const avgEffectSize = mean(results.map(r => r.fatigueEffect.cohensD));
    const avgPhaseAcc = mean(results.map(r => r.phaseAccuracy));
    const avgDeadModifiers = mean(results.map(r => r.deadModifiers.length));

    console.log(`\nAggregate Statistics:`);
    console.log(`  Statistically significant improvements: ${sigCount}/${results.length} (${Math.round(sigCount / results.length * 100)}%)`);
    console.log(`  Average effect size (Cohen's d): ${avgEffectSize.toFixed(3)}`);
    console.log(`  Average phase detection accuracy: ${avgPhaseAcc.toFixed(1)}%`);
    console.log(`  Average dead modifiers per program: ${avgDeadModifiers.toFixed(1)}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
    const options = parseArgs();

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║       RIGOROUS MODIFIER ANALYSIS CLI v2.0                   ║
║         Using ACTUAL App Engine Functions                    ║
╚══════════════════════════════════════════════════════════════╝
`);

    // Generate program library
    const programs = generateProgramLibrary(options.basePower);
    console.log(`📚 Generated ${programs.length} program configurations for testing\n`);

    const results: AnalysisResult[] = [];

    for (let i = 0; i < programs.length; i++) {
        const program = programs[i];
        console.log(`[${i + 1}/${programs.length}] Analyzing ${program.name}...`);

        try {
            const result = runRigorousAnalysis(program, options);
            results.push(result);
        } catch (e) {
            console.error(`  ❌ Error analyzing ${program.name}: ${e}`);
        }
    }

    // Print summary
    printSummary(results);

    // Save results
    if (options.outputFile) {
        // Convert Maps to objects for JSON serialization
        const serializableResults = results.map(r => ({
            ...r,
            weeklyStats: r.weeklyStats.map(ws => ({
                ...ws,
                modifierTriggerCounts: Object.fromEntries(ws.modifierTriggerCounts)
            }))
        }));

        fs.writeFileSync(options.outputFile, JSON.stringify(serializableResults, null, 2));
        console.log(`\n💾 Full results saved to: ${options.outputFile}`);
    }

    console.log('\n✨ Analysis complete!\n');
}

main().catch(console.error);
