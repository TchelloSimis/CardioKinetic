/**
 * Auto-Adaptive Simulation Engine
 * 
 * Runs Monte Carlo simulations to generate percentile data for auto-adaptive modifiers.
 * Reuses core simulation logic from suggestModifiers/simulation.ts.
 */

import { PlanWeek, ProgramPreset, ProgramRecord } from '../types';
import { WeekDefinition } from '../programTemplate';
import {
    WeekPercentiles,
    SimulationDataSet,
    SimulationProgress,
    TemplateSimulationCache,
} from './autoAdaptiveTypes';
import { runSingleSimulation } from './suggestModifiers/simulation';
import { calculatePercentile } from './suggestModifiers/algorithms';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_ITERATIONS = 100000;
const BATCH_SIZE = 5000;  // Process in batches to avoid blocking

// ============================================================================
// SIMULATION DATA GENERATION
// ============================================================================

/**
 * Generate simulation data for a program at a specific week count.
 * Runs Monte Carlo iterations and calculates percentile thresholds.
 * 
 * Percentiles generated (legacy 2-tier system):
 * - P15/P85: Extreme thresholds (top/bottom 15%)
 * - P30/P70: Standard thresholds (next 15%)
 * 
 * @param weeks - Week definitions for the program
 * @param basePower - Base power in watts
 * @param weekCount - Number of weeks in the program
 * @param iterations - Number of Monte Carlo iterations (default: 100000)
 * @param onProgress - Progress callback (0-1)
 */
export async function generateSimulationData(
    weeks: WeekDefinition[],
    basePower: number,
    weekCount: number,
    iterations: number = DEFAULT_ITERATIONS,
    onProgress?: (progress: number) => void
): Promise<SimulationDataSet> {
    const numWeeks = weeks.length;

    // Collect end-of-week fatigue/readiness for each simulation
    const fatigueData: number[][] = Array.from({ length: numWeeks }, () => []);
    const readinessData: number[][] = Array.from({ length: numWeeks }, () => []);

    // Run simulations in batches to avoid blocking UI
    for (let batchStart = 0; batchStart < iterations; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, iterations);

        for (let sim = batchStart; sim < batchEnd; sim++) {
            const { dailyFatigue, dailyReadiness } = runSingleSimulation(weeks, basePower);

            // Extract end-of-week values
            for (let w = 0; w < numWeeks; w++) {
                const endOfWeekIndex = (w + 1) * 7 - 1;
                fatigueData[w].push(dailyFatigue[endOfWeekIndex]);
                readinessData[w].push(dailyReadiness[endOfWeekIndex]);
            }
        }

        // Report progress and yield to UI
        if (onProgress) {
            onProgress(batchEnd / iterations);
        }
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Calculate percentiles for each week
    const weekPercentiles: WeekPercentiles[] = [];
    for (let w = 0; w < numWeeks; w++) {
        weekPercentiles.push({
            // Fatigue percentiles
            fatigueP15: Math.round(calculatePercentile(fatigueData[w], 15)),
            fatigueP25: Math.round(calculatePercentile(fatigueData[w], 25)),
            fatigueP35: Math.round(calculatePercentile(fatigueData[w], 35)),
            fatigueP65: Math.round(calculatePercentile(fatigueData[w], 65)),
            fatigueP75: Math.round(calculatePercentile(fatigueData[w], 75)),
            fatigueP85: Math.round(calculatePercentile(fatigueData[w], 85)),
            // Readiness percentiles
            readinessP15: Math.round(calculatePercentile(readinessData[w], 15)),
            readinessP25: Math.round(calculatePercentile(readinessData[w], 25)),
            readinessP35: Math.round(calculatePercentile(readinessData[w], 35)),
            readinessP65: Math.round(calculatePercentile(readinessData[w], 65)),
            readinessP75: Math.round(calculatePercentile(readinessData[w], 75)),
            readinessP85: Math.round(calculatePercentile(readinessData[w], 85)),
        });
    }

    return {
        weekCount,
        iterations,
        generatedAt: new Date().toISOString(),
        weekPercentiles,
    };
}

/**
 * Convert PlanWeek[] to WeekDefinition[] for simulation.
 */
export function planWeeksToWeekDefinitions(planWeeks: PlanWeek[]): WeekDefinition[] {
    return planWeeks.map((pw, index) => ({
        position: index + 1,
        phaseName: pw.phaseName,
        focus: pw.focus,
        description: pw.description,
        powerMultiplier: pw.plannedPower > 0 ? pw.plannedPower / 200 : 1.0, // Normalize to multiplier
        workRestRatio: pw.workRestRatio,
        targetRPE: pw.targetRPE,
        sessionStyle: pw.sessionStyle,
        durationMinutes: pw.targetDurationMinutes,
        workDurationSeconds: pw.workDurationSeconds,
        restDurationSeconds: pw.restDurationSeconds,
        cycles: pw.cycles,
        blocks: pw.blocks?.map(b => ({
            type: b.type,
            durationExpression: b.durationMinutes,
            powerExpression: b.powerMultiplier,
            workRestRatio: b.workRestRatio,
            workDurationSeconds: b.workDurationSeconds,
            restDurationSeconds: b.restDurationSeconds,
            cycles: b.cycles,
        })),
    }));
}

/**
 * Generate simulation data for ALL possible week counts of a template.
 * Shows progress with ETA calculations.
 */
export async function generateAllSimulationData(
    preset: ProgramPreset,
    basePower: number,
    onProgress?: (progress: SimulationProgress) => void
): Promise<Record<number, SimulationDataSet>> {
    // Determine all possible week counts
    const minWeeks = preset.minWeeks || 4;
    const maxWeeks = preset.maxWeeks || 24;
    const weekCounts = preset.weekOptions ||
        Array.from({ length: maxWeeks - minWeeks + 1 }, (_, i) => minWeeks + i);

    const allData: Record<number, SimulationDataSet> = {};
    const startTime = Date.now();

    for (let i = 0; i < weekCounts.length; i++) {
        const weekCount = weekCounts[i];
        const planWeeks = preset.generator(basePower, weekCount);
        const weekDefs = planWeeksToWeekDefinitions(planWeeks);

        allData[weekCount] = await generateSimulationData(
            weekDefs,
            basePower,
            weekCount,
            DEFAULT_ITERATIONS,
            (progress) => {
                if (onProgress) {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const completedCounts = i + progress;
                    const rate = elapsed > 0 ? completedCounts / elapsed : 1;
                    const remaining = rate > 0 ? (weekCounts.length - completedCounts) / rate : 0;

                    onProgress({
                        currentWeekCount: weekCount,
                        totalWeekCounts: weekCounts.length,
                        iterationsComplete: Math.floor(progress * DEFAULT_ITERATIONS),
                        totalIterations: DEFAULT_ITERATIONS,
                        estimatedSecondsRemaining: Math.ceil(remaining),
                    });
                }
            }
        );
    }

    return allData;
}

// ============================================================================
// VALIDATION & UTILITY
// ============================================================================

export function hasValidSimulationData(program: ProgramRecord): boolean {
    if (!program.simulationData) {
        return false;
    }

    const data = program.simulationData;
    const expectedWeeks = program.plan?.length || 0;

    // Check week count matches
    if (data.weekCount !== expectedWeeks) {
        return false;
    }

    // Check percentiles exist for all weeks
    if (!data.weekPercentiles || data.weekPercentiles.length !== expectedWeeks) {
        return false;
    }

    // Check all percentile values are valid numbers (check just a subset for speed)
    for (const wp of data.weekPercentiles) {
        if (typeof wp.fatigueP15 !== 'number' || isNaN(wp.fatigueP15)) return false;
        if (typeof wp.fatigueP85 !== 'number' || isNaN(wp.fatigueP85)) return false;
        if (typeof wp.readinessP15 !== 'number' || isNaN(wp.readinessP15)) return false;
        if (typeof wp.readinessP85 !== 'number' || isNaN(wp.readinessP85)) return false;
        // New percentiles may not exist in old cached data - that's OK, they'll be regenerated
    }

    return true;
}

export async function generateMissingSimulationData(
    programs: ProgramRecord[],
    presets: ProgramPreset[],
    onProgress?: (current: number, total: number, programName: string) => void
): Promise<{ updated: number; results: Map<string, SimulationDataSet> }> {
    const results = new Map<string, SimulationDataSet>();
    let updated = 0;

    const programsWithoutData = programs.filter(p => !hasValidSimulationData(p));

    for (let i = 0; i < programsWithoutData.length; i++) {
        const program = programsWithoutData[i];

        if (onProgress) {
            onProgress(i + 1, programsWithoutData.length, program.name);
        }

        const weekCount = program.plan?.length || 0;
        if (weekCount === 0) {
            console.warn('[autoAdaptiveSimulation] SKIPPING: weekCount is 0 for', program.name);
            continue;
        }

        // Try to find the preset to regenerate plan, otherwise use existing plan
        const preset = presets.find(p => p.id === program.presetId);
        let weekDefs;

        if (preset) {
            // Use preset's generator for fresh plan data
            const planWeeks = preset.generator(program.basePower, weekCount);
            weekDefs = planWeeksToWeekDefinitions(planWeeks);
        } else {
            // FALLBACK: Use program's existing plan data directly
            // This handles programs with deleted/missing templates
            if (!program.plan || program.plan.length === 0) {
                console.warn('[autoAdaptiveSimulation] SKIPPING: No plan data for', program.name);
                continue;
            }
            weekDefs = planWeeksToWeekDefinitions(program.plan);
        }

        const simulationData = await generateSimulationData(
            weekDefs,
            program.basePower,
            weekCount,
            DEFAULT_ITERATIONS
        );

        results.set(program.id, simulationData);
        updated++;
    }

    return { updated, results };
}

/**
 * Progress info for regeneration with ETA
 */
export interface RegenerationProgress {
    currentProgram: number;
    totalPrograms: number;
    currentProgramName: string;
    iterationsComplete: number;
    totalIterations: number;
    elapsedSeconds: number;
    estimatedSecondsRemaining: number;
    percentComplete: number;
}

/**
 * Regenerate simulation data for ALL programs (replaces existing data).
 * Shows detailed progress with ETA calculations.
 */
export async function regenerateAllSimulationData(
    programs: ProgramRecord[],
    presets: ProgramPreset[],
    onProgress?: (progress: RegenerationProgress) => void
): Promise<{ updated: number; results: Map<string, SimulationDataSet> }> {
    const results = new Map<string, SimulationDataSet>();
    let updated = 0;
    const startTime = Date.now();

    // Filter to only programs with valid plans
    const validPrograms = programs.filter(p => (p.plan?.length || 0) > 0);
    const totalPrograms = validPrograms.length;

    for (let i = 0; i < validPrograms.length; i++) {
        const program = validPrograms[i];
        const weekCount = program.plan?.length || 0;

        // Try to find the preset to regenerate plan, otherwise use existing plan
        const preset = presets.find(p => p.id === program.presetId);
        let weekDefs;

        if (preset) {
            const planWeeks = preset.generator(program.basePower, weekCount);
            weekDefs = planWeeksToWeekDefinitions(planWeeks);
        } else {
            if (!program.plan || program.plan.length === 0) {
                continue;
            }
            weekDefs = planWeeksToWeekDefinitions(program.plan);
        }

        const simulationData = await generateSimulationData(
            weekDefs,
            program.basePower,
            weekCount,
            DEFAULT_ITERATIONS,
            (iterProgress) => {
                if (onProgress) {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const completedPrograms = i + iterProgress;
                    const rate = elapsed > 0 ? completedPrograms / elapsed : 0.1;
                    const remaining = rate > 0 ? (totalPrograms - completedPrograms) / rate : 0;
                    const percentComplete = ((i + iterProgress) / totalPrograms) * 100;

                    onProgress({
                        currentProgram: i + 1,
                        totalPrograms,
                        currentProgramName: program.name,
                        iterationsComplete: Math.floor(iterProgress * DEFAULT_ITERATIONS),
                        totalIterations: DEFAULT_ITERATIONS,
                        elapsedSeconds: Math.round(elapsed),
                        estimatedSecondsRemaining: Math.ceil(remaining),
                        percentComplete: Math.round(percentComplete * 10) / 10
                    });
                }
            }
        );

        results.set(program.id, simulationData);
        updated++;
    }

    return { updated, results };
}

// ============================================================================
// TEMPLATE CACHE STORAGE
// ============================================================================

const TEMPLATE_CACHE_KEY = 'ck_template_simulation_cache';

/**
 * Load template simulation cache from localStorage.
 */
export function loadTemplateSimulationCache(): Map<string, TemplateSimulationCache> {
    try {
        const stored = localStorage.getItem(TEMPLATE_CACHE_KEY);
        if (!stored) return new Map();

        const parsed = JSON.parse(stored);
        return new Map(Object.entries(parsed));
    } catch (e) {
        console.error('Failed to load template simulation cache:', e);
        return new Map();
    }
}

/**
 * Save template simulation cache to localStorage.
 */
export function saveTemplateSimulationCache(cache: Map<string, TemplateSimulationCache>): void {
    try {
        const obj = Object.fromEntries(cache);
        localStorage.setItem(TEMPLATE_CACHE_KEY, JSON.stringify(obj));
    } catch (e) {
        console.error('Failed to save template simulation cache:', e);
    }
}

/**
 * Progress info for template regeneration with ETA
 */
export interface TemplateRegenerationProgress {
    currentTemplate: number;
    totalTemplates: number;
    currentTemplateName: string;
    currentWeekCount: number;
    totalWeekCounts: number;
    elapsedSeconds: number;
    estimatedSecondsRemaining: number;
    percentComplete: number;
}

/**
 * Regenerate simulation data for ALL templates and ALL possible durations.
 * Stores results in localStorage cache.
 * 
 * @param presets - All available program presets/templates
 * @param basePower - Base power to use for simulations (typically 200)
 * @param onProgress - Progress callback
 */
export async function regenerateAllTemplateSimulations(
    presets: ProgramPreset[],
    basePower: number = 200,
    onProgress?: (progress: TemplateRegenerationProgress) => void
): Promise<{ templatesProcessed: number; totalDurations: number }> {
    const cache = new Map<string, TemplateSimulationCache>();
    const startTime = Date.now();

    // Calculate total work units (templates × week counts)
    let totalWorkUnits = 0;
    const templateWeekCounts = presets.map(preset => {
        const minWeeks = preset.minWeeks || 4;
        const maxWeeks = preset.maxWeeks || 24;
        const weekCounts = preset.weekOptions ||
            Array.from({ length: maxWeeks - minWeeks + 1 }, (_, i) => minWeeks + i);
        totalWorkUnits += weekCounts.length;
        return weekCounts;
    });

    let completedUnits = 0;
    let totalDurations = 0;

    for (let t = 0; t < presets.length; t++) {
        const preset = presets[t];
        const weekCounts = templateWeekCounts[t];
        const dataByWeekCount: Record<number, SimulationDataSet> = {};

        for (let w = 0; w < weekCounts.length; w++) {
            const weekCount = weekCounts[w];
            const planWeeks = preset.generator(basePower, weekCount);
            const weekDefs = planWeeksToWeekDefinitions(planWeeks);

            dataByWeekCount[weekCount] = await generateSimulationData(
                weekDefs,
                basePower,
                weekCount,
                DEFAULT_ITERATIONS,
                (iterProgress) => {
                    if (onProgress) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        const completed = completedUnits + iterProgress;
                        const rate = elapsed > 0 ? completed / elapsed : 0.1;
                        const remaining = rate > 0 ? (totalWorkUnits - completed) / rate : 0;
                        const percentComplete = (completed / totalWorkUnits) * 100;

                        onProgress({
                            currentTemplate: t + 1,
                            totalTemplates: presets.length,
                            currentTemplateName: preset.name,
                            currentWeekCount: weekCount,
                            totalWeekCounts: weekCounts.length,
                            elapsedSeconds: Math.round(elapsed),
                            estimatedSecondsRemaining: Math.ceil(remaining),
                            percentComplete: Math.round(percentComplete * 10) / 10
                        });
                    }
                }
            );

            completedUnits++;
            totalDurations++;
        }

        cache.set(preset.id, {
            templateId: preset.id,
            dataByWeekCount
        });
    }

    // Save to localStorage
    saveTemplateSimulationCache(cache);

    return { templatesProcessed: presets.length, totalDurations };
}

/**
 * Get cached simulation data for a template at a specific week count.
 */
export function getCachedSimulationData(
    templateId: string,
    weekCount: number
): SimulationDataSet | undefined {
    const cache = loadTemplateSimulationCache();
    const templateCache = cache.get(templateId);
    return templateCache?.dataByWeekCount?.[weekCount];
}
