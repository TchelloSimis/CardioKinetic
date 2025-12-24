/**
 * Suggest Modifiers Module - Main Entry Point
 * 
 * This is the public API for the modular suggest modifiers system.
 * Exports the main suggestModifiers and suggestModifiersAsync functions.
 */

import { WeekDefinition, FatigueModifier } from '../../programTemplate';
import { runSingleSimulation, runFullAnalysis } from './simulation';
import { generateSmartModifiers } from './generators';

// Re-export types for external use
export type { WeekAnalysis, TrendAnalysis, CycleInfo } from './types';
export { calculateAdaptiveWindows } from './algorithms';

// ============================================================================
// MAIN ENTRY POINTS
// ============================================================================

/**
 * Synchronous modifier suggestion.
 * Runs Monte Carlo simulations and generates smart modifiers.
 */
export function suggestModifiers(
    weeks: WeekDefinition[],
    basePower: number = 200,
    numSimulations: number = 100000
): FatigueModifier[] {
    if (weeks.length === 0) return [];

    const numWeeks = weeks.length;
    const fatigueData: number[][] = Array.from({ length: numWeeks }, () => []);
    const readinessData: number[][] = Array.from({ length: numWeeks }, () => []);

    for (let sim = 0; sim < numSimulations; sim++) {
        const { dailyFatigue, dailyReadiness } = runSingleSimulation(weeks, basePower);
        for (let w = 0; w < numWeeks; w++) {
            fatigueData[w].push(dailyFatigue[(w + 1) * 7 - 1]);
            readinessData[w].push(dailyReadiness[(w + 1) * 7 - 1]);
        }
    }

    const analysis = runFullAnalysis(weeks, basePower, numSimulations, fatigueData, readinessData);
    return generateSmartModifiers(analysis, weeks);
}

/**
 * Asynchronous modifier suggestion with progress callback.
 * Runs Monte Carlo simulations in batches to avoid blocking the main thread.
 */
export async function suggestModifiersAsync(
    weeks: WeekDefinition[],
    basePower: number = 200,
    numSimulations: number = 100000,
    onProgress?: (progress: number) => void
): Promise<FatigueModifier[]> {
    if (weeks.length === 0) return [];

    const numWeeks = weeks.length;
    const BATCH_SIZE = 5000;

    const fatigueData: number[][] = Array.from({ length: numWeeks }, () => []);
    const readinessData: number[][] = Array.from({ length: numWeeks }, () => []);

    for (let batchStart = 0; batchStart < numSimulations; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, numSimulations);

        for (let sim = batchStart; sim < batchEnd; sim++) {
            const { dailyFatigue, dailyReadiness } = runSingleSimulation(weeks, basePower);
            for (let w = 0; w < numWeeks; w++) {
                fatigueData[w].push(dailyFatigue[(w + 1) * 7 - 1]);
                readinessData[w].push(dailyReadiness[(w + 1) * 7 - 1]);
            }
        }

        if (onProgress) onProgress(batchEnd / numSimulations);
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    const analysis = runFullAnalysis(weeks, basePower, numSimulations, fatigueData, readinessData);
    return generateSmartModifiers(analysis, weeks);
}
