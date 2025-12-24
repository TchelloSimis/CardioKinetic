/**
 * WeekDefinitionsStep - Utility Functions
 * 
 * Extracted helper functions for week and block management
 */

import type { WeekDefinition, TemplateBlock } from '../../../programTemplate';
import type { SessionStyle } from '../../../types';

// ============================================================================
// DEFAULT CREATION HELPERS
// ============================================================================

/**
 * Create a new default week definition
 */
export function createDefaultWeek(
    weekCount: number,
    defaultSessionStyle: SessionStyle
): WeekDefinition {
    const isSteadyState = defaultSessionStyle === 'steady-state';
    const isCustom = defaultSessionStyle === 'custom';
    const isInterval = defaultSessionStyle === 'interval';

    return {
        position: weekCount + 1,
        phaseName: 'New Phase',
        focus: 'Volume',
        description: 'Week description',
        powerMultiplier: 1.0,
        workRestRatio: isSteadyState ? 'steady' : '1:1',
        targetRPE: 6,
        sessionStyle: defaultSessionStyle,
        // For interval sessions: initialize cycles/work/rest
        ...(isInterval ? {
            cycles: 10,
            workDurationSeconds: 30,
            restDurationSeconds: 30,
            durationMinutes: 10 // 10 cycles × (30 + 30) / 60 = 10 min
        } : {}),
        blocks: isCustom ? [{
            type: 'steady-state',
            durationExpression: 5,
            powerExpression: 1.0
        }] : undefined,
    };
}

/**
 * Create a new training block
 */
export function createTrainingBlock(type: 'steady-state' | 'interval'): TemplateBlock {
    return type === 'steady-state'
        ? {
            type: 'steady-state',
            durationExpression: 5,
            powerExpression: 1.0
        }
        : {
            type: 'interval',
            durationExpression: 5,
            powerExpression: 1.0,
            cycles: 5,
            workDurationSeconds: 30,
            restDurationSeconds: 30
        };
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

/**
 * Calculate interval duration from cycles and work/rest times
 */
export function calculateIntervalDuration(
    cycles: number,
    workSeconds: number,
    restSeconds: number
): number {
    return Math.round((cycles * (workSeconds + restSeconds) / 60) * 100) / 100;
}

/**
 * Get block summary for display
 */
export function getBlockSummary(block: TemplateBlock): string {
    if (block.type === 'steady-state') {
        const dur = typeof block.durationExpression === 'number'
            ? block.durationExpression
            : block.durationExpression;
        const pwr = typeof block.powerExpression === 'number'
            ? `${Math.round(block.powerExpression * 100)}%`
            : block.powerExpression;
        return `${dur}min @ ${pwr}`;
    } else {
        const cycles = block.cycles ?? 5;
        const work = block.workDurationSeconds ?? 30;
        const rest = block.restDurationSeconds ?? 30;
        return `${cycles}×(${work}s/${rest}s)`;
    }
}

// ============================================================================
// SESSION STYLE OPTIONS
// ============================================================================

export const SESSION_STYLE_OPTIONS: { value: SessionStyle; label: string }[] = [
    { value: 'interval', label: 'Interval' },
    { value: 'steady-state', label: 'Steady State' },
    { value: 'custom', label: 'Custom' },
];
