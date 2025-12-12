/**
 * Plan Generation
 * 
 * Functions for generating complete training plans from program templates.
 */

import { PlanWeek, SessionBlock } from '../types';
import {
    ProgramTemplate,
    WeekDefinition,
    WeekConfig,
    GeneratePlanOptions,
    TemplateBlock,
} from '../programTemplate';
import { interpolateWeeks } from './weekInterpolation';
import { calculateBlockMetricsFromSession } from './blockCalculations';

// ============================================================================
// PLAN GENERATION
// ============================================================================

/**
 * Generates a complete plan from a template
 */
export function generatePlanFromTemplate(options: GeneratePlanOptions): PlanWeek[] {
    const { template, basePower, weekCount } = options;

    // Validate week count against template config
    const validWeekCount = getValidWeekCount(template.weekConfig, weekCount);

    // Interpolate weeks for the target length
    const weekMap = interpolateWeeks(template.weeks, validWeekCount);

    const plan: PlanWeek[] = [];

    for (let week = 1; week <= validWeekCount; week++) {
        const weekDef = weekMap.get(week);
        if (!weekDef) continue;

        // Resolve duration (can be number or percentage string)
        const resolvedDuration = resolveDuration(
            weekDef.durationMinutes,
            template.defaultSessionDurationMinutes
        );

        const planWeek: PlanWeek = {
            week,
            phaseName: weekDef.phaseName,
            focus: weekDef.focus,
            description: weekDef.description,
            plannedPower: Math.round(basePower * weekDef.powerMultiplier),
            targetRPE: weekDef.targetRPE,
            workRestRatio: weekDef.workRestRatio,
            sessionStyle: weekDef.sessionStyle ?? template.defaultSessionStyle,
            targetDurationMinutes: resolvedDuration,
            workDurationSeconds: weekDef.workDurationSeconds,
            restDurationSeconds: weekDef.restDurationSeconds,
        };

        // Add blocks for custom sessions
        if (planWeek.sessionStyle === 'custom' && weekDef.blocks && weekDef.blocks.length > 0) {
            planWeek.blocks = resolveTemplateBlocks(weekDef.blocks, basePower, resolvedDuration);

            // Recalculate plannedPower as weighted average of block powers for accurate Analytics chart
            // Use week-adjusted base power (basePower * weekDef.powerMultiplier)
            const weekAdjustedPower = basePower * weekDef.powerMultiplier;
            const metrics = calculateBlockMetricsFromSession(planWeek.blocks, weekAdjustedPower);
            planWeek.plannedPower = metrics.averagePower;
            planWeek.targetDurationMinutes = metrics.totalDuration;
        }

        plan.push(planWeek);
    }

    return plan;
}

/**
 * Resolves template blocks (with expression support) to session blocks (with concrete values)
 */
function resolveTemplateBlocks(
    templateBlocks: TemplateBlock[],
    basePower: number,
    defaultDurationMinutes: number
): SessionBlock[] {
    const { generateBlockId } = require('../hooks/sessionTimerUtils');

    return templateBlocks.map(block => {
        // Resolve power expression (can be number or string like "power * 0.8")
        let powerMultiplier = 1.0;
        if (typeof block.powerExpression === 'number') {
            powerMultiplier = block.powerExpression;
        } else if (typeof block.powerExpression === 'string') {
            powerMultiplier = resolveExpression(block.powerExpression, basePower);
        }

        // Resolve duration expression (can be number or string like "duration * 0.25")
        let durationMinutes = 5;
        if (typeof block.durationExpression === 'number') {
            durationMinutes = block.durationExpression;
        } else if (typeof block.durationExpression === 'string') {
            durationMinutes = resolveExpression(block.durationExpression, defaultDurationMinutes);
        }

        // For interval blocks with cycles, calculate duration from cycles if not explicitly set
        if (block.type === 'interval' && block.cycles && block.workDurationSeconds && block.restDurationSeconds) {
            durationMinutes = (block.cycles * (block.workDurationSeconds + block.restDurationSeconds)) / 60;
        }

        return {
            id: generateBlockId(),
            type: block.type,
            durationMinutes: Math.round(durationMinutes * 100) / 100, // Keep decimal precision
            powerMultiplier,
            workRestRatio: block.workRestRatio,
            workDurationSeconds: block.workDurationSeconds,
            restDurationSeconds: block.restDurationSeconds,
            cycles: block.cycles,
        };
    });
}

/**
 * Resolves an expression string like "power * 0.8" or "duration * 0.25" to a number
 */
function resolveExpression(expression: string, baseValue: number): number {
    // Simple expression parser for patterns like "power * 0.8" or "duration * 0.25"
    const mulMatch = expression.match(/^(?:power|duration)\s*\*\s*(\d+(?:\.\d+)?)$/);
    if (mulMatch) {
        return baseValue * parseFloat(mulMatch[1]);
    }

    // Percentage format like "80%"
    const percentMatch = expression.match(/^(\d+(?:\.\d+)?)%$/);
    if (percentMatch) {
        return baseValue * (parseFloat(percentMatch[1]) / 100);
    }

    // Just a number
    const numVal = parseFloat(expression);
    if (!isNaN(numVal)) {
        return numVal;
    }

    return baseValue; // Fallback
}

/**
 * Resolves a duration value that can be a number (minutes) or string (percentage like '110%')
 */
function resolveDuration(duration: number | string | undefined, defaultMinutes: number): number {
    if (duration === undefined) {
        return defaultMinutes;
    }
    if (typeof duration === 'number') {
        return duration;
    }
    // Handle percentage string like '110%'
    const percentMatch = String(duration).match(/^(\d+)%$/);
    if (percentMatch) {
        const percentage = parseInt(percentMatch[1], 10) / 100;
        return Math.round(defaultMinutes * percentage);
    }
    // Fallback - try to parse as number
    const parsed = parseFloat(duration);
    return isNaN(parsed) ? defaultMinutes : Math.round(parsed);
}

/**
 * Gets a valid week count given the template configuration
 */
export function getValidWeekCount(config: WeekConfig, requested: number): number {
    if (config.type === 'fixed') {
        return config.fixed ?? 12;
    }

    if (config.range) {
        const { min, max, step } = config.range;
        // Round to nearest valid step
        const clamped = Math.max(min, Math.min(max, requested));
        const stepsFromMin = Math.round((clamped - min) / step);
        return min + stepsFromMin * step;
    }

    return requested;
}

/**
 * Gets all valid week options for a variable-length template
 */
export function getWeekOptions(config: WeekConfig): number[] {
    if (config.type === 'fixed') {
        return [config.fixed ?? 12];
    }

    if (config.range) {
        const { min, max, step } = config.range;
        const options: number[] = [];
        for (let w = min; w <= max; w += step) {
            options.push(w);
        }
        return options;
    }

    return [12];
}
