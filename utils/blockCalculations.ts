/**
 * Block Calculation Utilities
 * 
 * Functions for calculating metrics (average power, duration, work) from
 * custom session blocks. Used by both ProgramPreview and Analytics charts.
 */

import { SessionBlock } from '../types';
import { TemplateBlock } from '../programTemplate';

export interface BlockMetrics {
    /** Weighted average power in Watts */
    averagePower: number;
    /** Total duration in minutes */
    totalDuration: number;
    /** Total work in Wh */
    totalWork: number;
}

/**
 * Calculates metrics from TemplateBlocks (used in ProgramPreview before plan generation).
 * Template blocks have powerExpression which is a multiplier (e.g., 1.0 = 100% FTP).
 * 
 * @param blocks - Array of template blocks from WeekDefinition
 * @param basePower - Base power (FTP) in Watts
 * @param weekPowerMultiplier - Optional week-level power multiplier (default 1.0)
 * @returns BlockMetrics with averagePower, totalDuration, and totalWork
 */
export function calculateBlockMetricsFromTemplate(
    blocks: TemplateBlock[],
    basePower: number,
    weekPowerMultiplier: number = 1.0
): BlockMetrics {
    if (!blocks || blocks.length === 0) {
        return { averagePower: Math.round(basePower * weekPowerMultiplier), totalDuration: 0, totalWork: 0 };
    }

    let totalWeightedPower = 0;
    let totalDuration = 0;
    let totalWork = 0;

    for (const block of blocks) {
        // Get power multiplier from expression
        const blockPowerMultiplier = typeof block.powerExpression === 'number'
            ? block.powerExpression
            : parseFloat(String(block.powerExpression)) || 1.0;

        // Get block duration in minutes
        let blockDuration: number;
        if (block.type === 'interval' && block.cycles && block.workDurationSeconds && block.restDurationSeconds) {
            // For interval blocks, calculate duration from cycles
            blockDuration = (block.cycles * (block.workDurationSeconds + block.restDurationSeconds)) / 60;
        } else {
            blockDuration = typeof block.durationExpression === 'number'
                ? block.durationExpression
                : parseFloat(String(block.durationExpression)) || 5;
        }

        // Apply both week-level and block-level power multipliers
        const blockPower = basePower * weekPowerMultiplier * blockPowerMultiplier;
        const blockWork = (blockPower * blockDuration) / 60; // Wh

        totalWeightedPower += blockPower * blockDuration;
        totalDuration += blockDuration;
        totalWork += blockWork;
    }

    const averagePower = totalDuration > 0
        ? Math.round(totalWeightedPower / totalDuration)
        : Math.round(basePower * weekPowerMultiplier);

    return {
        averagePower,
        totalDuration: Math.round(totalDuration * 100) / 100,
        totalWork: Math.round(totalWork)
    };
}

/**
 * Calculates metrics from SessionBlocks (used after plan generation for Analytics chart).
 * Session blocks have powerMultiplier which is relative to the session's targetPower.
 * 
 * @param blocks - Array of session blocks from PlanWeek
 * @param sessionTargetPower - The session's target power in Watts
 * @returns BlockMetrics with averagePower, totalDuration, and totalWork
 */
export function calculateBlockMetricsFromSession(
    blocks: SessionBlock[],
    sessionTargetPower: number
): BlockMetrics {
    if (!blocks || blocks.length === 0) {
        return { averagePower: sessionTargetPower, totalDuration: 0, totalWork: 0 };
    }

    let totalWeightedPower = 0;
    let totalDuration = 0;
    let totalWork = 0;

    for (const block of blocks) {
        const blockPower = sessionTargetPower * block.powerMultiplier;
        const blockDuration = block.durationMinutes;
        const blockWork = (blockPower * blockDuration) / 60; // Wh

        totalWeightedPower += blockPower * blockDuration;
        totalDuration += blockDuration;
        totalWork += blockWork;
    }

    const averagePower = totalDuration > 0
        ? Math.round(totalWeightedPower / totalDuration)
        : sessionTargetPower;

    return {
        averagePower,
        totalDuration: Math.round(totalDuration * 100) / 100,
        totalWork: Math.round(totalWork)
    };
}
