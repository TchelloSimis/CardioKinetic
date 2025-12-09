/**
 * Template Utilities
 * 
 * Functions for validating, importing, exporting, and generating plans from templates.
 */

import { PlanWeek, ProgramPreset, SessionStyle, ProgressionMode } from '../types';
import {
    ProgramTemplate,
    WeekDefinition,
    WeekConfig,
    FatigueModifier,
    FatigueCondition,
    FatigueContext,
    ValidationResult,
    ValidationError,
    GeneratePlanOptions,
    WeekPosition,
    WeekFocus,
    TemplateBlock,
} from '../programTemplate';
import { calculateBlockMetricsFromSession } from './blockCalculations';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Current template schema version */
export const TEMPLATE_VERSION = '1.0' as const;

/** Fatigue condition thresholds */
export const FATIGUE_THRESHOLDS = {
    low_fatigue: { max: 30 },
    moderate_fatigue: { min: 30, max: 60 },
    high_fatigue: { min: 60, max: 80 },
    very_high_fatigue: { min: 80 },
} as const;

/** Readiness condition thresholds */
export const READINESS_THRESHOLDS = {
    fresh: { min: 65 },
    recovered: { min: 50, max: 65 },
    tired: { min: 35, max: 50 },
    overreached: { max: 35 },
} as const;

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates a program template JSON object
 */
export function validateTemplate(json: unknown): ValidationResult {
    const errors: ValidationError[] = [];

    if (!json || typeof json !== 'object') {
        return { valid: false, errors: [{ field: 'root', message: 'Template must be a valid object' }] };
    }

    const obj = json as Record<string, unknown>;

    // Required fields
    if (obj.templateVersion !== TEMPLATE_VERSION) {
        errors.push({ field: 'templateVersion', message: `Must be "${TEMPLATE_VERSION}"` });
    }

    if (!obj.id || typeof obj.id !== 'string') {
        errors.push({ field: 'id', message: 'Required string field' });
    }

    if (!obj.name || typeof obj.name !== 'string') {
        errors.push({ field: 'name', message: 'Required string field' });
    }

    if (!obj.description || typeof obj.description !== 'string') {
        errors.push({ field: 'description', message: 'Required string field' });
    }

    // Week config validation
    if (!obj.weekConfig || typeof obj.weekConfig !== 'object') {
        errors.push({ field: 'weekConfig', message: 'Required object field' });
    } else {
        const weekConfig = obj.weekConfig as Record<string, unknown>;
        if (weekConfig.type !== 'fixed' && weekConfig.type !== 'variable') {
            errors.push({ field: 'weekConfig.type', message: 'Must be "fixed" or "variable"' });
        }
        if (weekConfig.type === 'fixed' && typeof weekConfig.fixed !== 'number') {
            errors.push({ field: 'weekConfig.fixed', message: 'Required for fixed-length programs' });
        }
        if (weekConfig.type === 'variable') {
            const range = weekConfig.range as Record<string, unknown> | undefined;
            if (!range || typeof range.min !== 'number' || typeof range.max !== 'number' || typeof range.step !== 'number') {
                errors.push({ field: 'weekConfig.range', message: 'Required min, max, step for variable-length programs' });
            } else if (range.min > range.max) {
                errors.push({ field: 'weekConfig.range', message: 'min cannot be greater than max' });
            }
        }
    }

    // Session style - now includes 'custom'
    if (!['interval', 'steady-state', 'custom'].includes(obj.defaultSessionStyle as string)) {
        errors.push({ field: 'defaultSessionStyle', message: 'Must be "interval", "steady-state", or "custom"' });
    }

    // Progression mode
    if (!['power', 'duration', 'double'].includes(obj.progressionMode as string)) {
        errors.push({ field: 'progressionMode', message: 'Must be "power", "duration", or "double"' });
    }

    // Duration
    if (typeof obj.defaultSessionDurationMinutes !== 'number' || obj.defaultSessionDurationMinutes <= 0) {
        errors.push({ field: 'defaultSessionDurationMinutes', message: 'Must be a positive number' });
    }

    // Weeks array
    if (!Array.isArray(obj.weeks) || obj.weeks.length === 0) {
        errors.push({ field: 'weeks', message: 'Must be a non-empty array' });
    } else {
        (obj.weeks as unknown[]).forEach((week, index) => {
            const weekErrors = validateWeekDefinition(week, index);
            errors.push(...weekErrors);
        });
    }

    // Optional: fatigue modifiers
    if (obj.fatigueModifiers !== undefined) {
        if (!Array.isArray(obj.fatigueModifiers)) {
            errors.push({ field: 'fatigueModifiers', message: 'Must be an array if provided' });
        } else {
            (obj.fatigueModifiers as unknown[]).forEach((mod, index) => {
                const modErrors = validateFatigueModifier(mod, index);
                errors.push(...modErrors);
            });
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return { valid: true, errors: [], template: obj as unknown as ProgramTemplate };
}

function validateWeekDefinition(week: unknown, index: number): ValidationError[] {
    const errors: ValidationError[] = [];
    const prefix = `weeks[${index}]`;

    if (!week || typeof week !== 'object') {
        return [{ field: prefix, message: 'Must be an object' }];
    }

    const w = week as Record<string, unknown>;

    // Position validation (supports decimals for arbitrary precision like 33.33%)
    if (w.position === undefined) {
        errors.push({ field: `${prefix}.position`, message: 'Required field' });
    } else if (typeof w.position !== 'number' && !['first', 'last'].includes(w.position as string) &&
        !(typeof w.position === 'string' && /^\d+(?:\.\d+)?%$/.test(w.position))) {
        errors.push({ field: `${prefix}.position`, message: 'Must be a number, "first", "last", or a percentage like "50%" or "33.33%"' });
    }

    if (!w.phaseName || typeof w.phaseName !== 'string') {
        errors.push({ field: `${prefix}.phaseName`, message: 'Required string field' });
    }

    const validFocuses: WeekFocus[] = ['Density', 'Intensity', 'Volume', 'Recovery'];
    if (!validFocuses.includes(w.focus as WeekFocus)) {
        errors.push({ field: `${prefix}.focus`, message: 'Must be Density, Intensity, Volume, or Recovery' });
    }

    if (!w.description || typeof w.description !== 'string') {
        errors.push({ field: `${prefix}.description`, message: 'Required string field' });
    }

    if (typeof w.powerMultiplier !== 'number' || w.powerMultiplier <= 0) {
        errors.push({ field: `${prefix}.powerMultiplier`, message: 'Must be a positive number' });
    }

    if (!w.workRestRatio || typeof w.workRestRatio !== 'string') {
        errors.push({ field: `${prefix}.workRestRatio`, message: 'Required string field (e.g., "1:2")' });
    }

    if (typeof w.targetRPE !== 'number' || w.targetRPE < 1 || w.targetRPE > 10) {
        errors.push({ field: `${prefix}.targetRPE`, message: 'Must be a number between 1 and 10' });
    }

    // Validate blocks for custom sessions
    if (w.sessionStyle === 'custom') {
        if (!w.blocks || !Array.isArray(w.blocks)) {
            errors.push({ field: `${prefix}.blocks`, message: 'Required array for custom session style' });
        } else if (w.blocks.length === 0) {
            errors.push({ field: `${prefix}.blocks`, message: 'Must have at least one block for custom session' });
        } else {
            (w.blocks as unknown[]).forEach((block, blockIndex) => {
                const blockErrors = validateTemplateBlock(block, index, blockIndex);
                errors.push(...blockErrors);
            });
        }
    }

    return errors;
}

/**
 * Validates a template block within a custom session week
 */
function validateTemplateBlock(block: unknown, weekIndex: number, blockIndex: number): ValidationError[] {
    const errors: ValidationError[] = [];
    const prefix = `weeks[${weekIndex}].blocks[${blockIndex}]`;

    if (!block || typeof block !== 'object') {
        return [{ field: prefix, message: 'Must be an object' }];
    }

    const b = block as Record<string, unknown>;

    // Type validation
    if (!['steady-state', 'interval'].includes(b.type as string)) {
        errors.push({ field: `${prefix}.type`, message: 'Must be "steady-state" or "interval"' });
    }

    // Duration expression validation
    if (b.durationExpression === undefined) {
        errors.push({ field: `${prefix}.durationExpression`, message: 'Required field' });
    } else if (typeof b.durationExpression !== 'number' && typeof b.durationExpression !== 'string') {
        errors.push({ field: `${prefix}.durationExpression`, message: 'Must be a number or expression string' });
    }

    // Power expression validation
    if (b.powerExpression === undefined) {
        errors.push({ field: `${prefix}.powerExpression`, message: 'Required field' });
    } else if (typeof b.powerExpression !== 'number' && typeof b.powerExpression !== 'string') {
        errors.push({ field: `${prefix}.powerExpression`, message: 'Must be a number or expression string' });
    }

    // Interval blocks should have work:rest ratio or explicit durations
    if (b.type === 'interval') {
        const hasRatio = typeof b.workRestRatio === 'string';
        const hasExplicitDurations = typeof b.workDurationSeconds === 'number' && typeof b.restDurationSeconds === 'number';

        if (!hasRatio && !hasExplicitDurations) {
            errors.push({
                field: `${prefix}`,
                message: 'Interval blocks require workRestRatio or explicit workDurationSeconds/restDurationSeconds'
            });
        }
    }

    return errors;
}

function validateFatigueModifier(mod: unknown, index: number): ValidationError[] {
    const errors: ValidationError[] = [];
    const prefix = `fatigueModifiers[${index}]`;

    if (!mod || typeof mod !== 'object') {
        return [{ field: prefix, message: 'Must be an object' }];
    }

    const m = mod as Record<string, unknown>;

    const validLegacyConditions = [
        'low_fatigue', 'moderate_fatigue', 'high_fatigue', 'very_high_fatigue',
        'fresh', 'recovered', 'tired', 'overreached'
    ];

    const condition = m.condition;

    // Check if condition is a legacy string
    if (typeof condition === 'string') {
        if (!validLegacyConditions.includes(condition)) {
            errors.push({ field: `${prefix}.condition`, message: `Must be one of: ${validLegacyConditions.join(', ')}` });
        }
    }
    // Check if condition is a FlexibleCondition object
    else if (typeof condition === 'object' && condition !== null) {
        const flexCond = condition as Record<string, unknown>;
        // Must have logic field with 'and' or 'or'
        if (flexCond.logic !== 'and' && flexCond.logic !== 'or') {
            errors.push({ field: `${prefix}.condition.logic`, message: 'Must be "and" or "or"' });
        }
        // Must have at least one of fatigue or readiness
        if (flexCond.fatigue === undefined && flexCond.readiness === undefined) {
            errors.push({ field: `${prefix}.condition`, message: 'Must have at least one of "fatigue" or "readiness" threshold' });
        }
        // Validate threshold format if present (e.g., ">50", "<30", ">=40", "<=60")
        const thresholdPattern = /^(>|<|>=|<=)?\d+$/;
        if (flexCond.fatigue !== undefined && typeof flexCond.fatigue === 'string' && !thresholdPattern.test(flexCond.fatigue)) {
            errors.push({ field: `${prefix}.condition.fatigue`, message: 'Invalid threshold format (e.g., ">50", "<30", ">=40")' });
        }
        if (flexCond.readiness !== undefined && typeof flexCond.readiness === 'string' && !thresholdPattern.test(flexCond.readiness)) {
            errors.push({ field: `${prefix}.condition.readiness`, message: 'Invalid threshold format (e.g., ">50", "<30", ">=40")' });
        }
    }
    // Invalid condition type
    else {
        errors.push({ field: `${prefix}.condition`, message: 'Must be a string condition or an object with fatigue/readiness thresholds' });
    }

    if (!m.adjustments || typeof m.adjustments !== 'object') {
        errors.push({ field: `${prefix}.adjustments`, message: 'Required object field' });
    }

    return errors;
}

// ============================================================================
// WEEK INTERPOLATION
// ============================================================================

/**
 * Resolves a WeekPosition to an actual week number given the total program length
 * 
 * Percentages are treated as "progress through the program":
 * - 0% = week 1 (first week)
 * - 100% = week N (last week)
 * - 50% = week at the halfway point
 * 
 * Formula: week = 1 + percentage × (totalWeeks - 1)
 */
export function resolveWeekPosition(position: WeekPosition, totalWeeks: number): number {
    if (typeof position === 'number') {
        return Math.min(position, totalWeeks);
    }

    if (position === 'first') {
        return 1;
    }

    if (position === 'last') {
        return totalWeeks;
    }

    // Percentage position (e.g., "50%" or "33.33333%" for arbitrary precision)
    // Treat percentage as "progress through the program" where 0% = week 1, 100% = week N
    const match = position.match(/^(\d+(?:\.\d+)?)%$/);
    if (match) {
        const percentage = parseFloat(match[1]) / 100;
        // Formula: 1 + percentage × (totalWeeks - 1)
        // For 12 weeks: 0% → 1, 33% → 1 + 0.33 × 11 ≈ 4.63 → 5, 66% → 1 + 0.66 × 11 ≈ 8.26 → 8
        // For 9 weeks: 0% → 1, 33% → 1 + 0.33 × 8 ≈ 3.64 → 4, 66% → 1 + 0.66 × 8 ≈ 6.28 → 6
        const weekNum = 1 + percentage * (totalWeeks - 1);
        return Math.max(1, Math.min(totalWeeks, Math.round(weekNum)));
    }

    return 1; // Fallback
}

/**
 * Generates all week numbers from template week definitions for a given program length
 * Uses progress-based floor semantics: each definition "owns" all weeks from its progress point
 * until the next definition starts.
 * 
 * This approach works with progress fractions (0 to 1) directly, avoiding rounding issues
 * that occur when resolving percentages to week numbers.
 */
export function interpolateWeeks(
    weekDefs: WeekDefinition[],
    totalWeeks: number
): Map<number, WeekDefinition> {
    // Convert all week definitions to progress values (0 to 1) and sort them
    const defsWithProgress = [...weekDefs]
        .map(def => {
            let defProgress = 0;
            if (def.position === 'first') {
                defProgress = 0;
            } else if (def.position === 'last') {
                defProgress = 1;
            } else if (typeof def.position === 'string' && def.position.endsWith('%')) {
                defProgress = parseFloat(def.position) / 100;
            } else if (typeof def.position === 'number') {
                // Convert absolute week number to progress
                defProgress = totalWeeks > 1 ? (def.position - 1) / (totalWeeks - 1) : 0;
            }
            return { def, defProgress };
        })
        .sort((a, b) => a.defProgress - b.defProgress);

    const weekMap = new Map<number, WeekDefinition>();

    // For each week, find the definition that "owns" it using progress-based floor semantics
    for (let week = 1; week <= totalWeeks; week++) {
        // Calculate this week's progress (0 to 1), where week 1 = 0 and week N = 1
        const weekProgress = totalWeeks > 1 ? (week - 1) / (totalWeeks - 1) : 0;

        // Find the definition with highest progress <= current week's progress (floor)
        let owningDef: WeekDefinition | null = defsWithProgress.length > 0 ? defsWithProgress[0].def : null;
        for (const { def, defProgress } of defsWithProgress) {
            if (defProgress <= weekProgress) {
                owningDef = def;
            } else {
                break; // Since sorted, no need to check further
            }
        }

        if (owningDef) {
            weekMap.set(week, { ...owningDef, position: week });
        }
    }

    return weekMap;
}

/**
 * Interpolates between two week definitions
 */
function interpolateWeekDefinition(
    prev: WeekDefinition,
    next: WeekDefinition,
    t: number, // 0 to 1
    weekNum: number
): WeekDefinition {
    return {
        position: weekNum,
        // Use the transition point to decide which phase we're in
        phaseName: t < 0.5 ? prev.phaseName : next.phaseName,
        focus: t < 0.5 ? prev.focus : next.focus,
        description: t < 0.5 ? prev.description : next.description,
        // Numerical values are linearly interpolated
        powerMultiplier: prev.powerMultiplier + t * (next.powerMultiplier - prev.powerMultiplier),
        targetRPE: Math.round(prev.targetRPE + t * (next.targetRPE - prev.targetRPE)),
        workRestRatio: t < 0.5 ? prev.workRestRatio : next.workRestRatio,
        // Optional fields
        sessionStyle: t < 0.5 ? prev.sessionStyle : next.sessionStyle,
        // Duration can be a number or string (percentage) - just carry forward, don't interpolate percentages
        durationMinutes: t < 0.5 ? prev.durationMinutes : next.durationMinutes,
    };
}

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
): import('../types').SessionBlock[] {
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

// ============================================================================
// FATIGUE MODIFIERS
// ============================================================================

/**
 * Checks if a fatigue condition is currently active
 */
export function checkFatigueCondition(condition: FatigueCondition, context: FatigueContext): boolean {
    const { fatigueScore, readinessScore } = context;

    // Handle FlexibleCondition objects
    if (typeof condition === 'object' && condition !== null) {
        const flexCond = condition as { fatigue?: string; readiness?: string; logic: 'and' | 'or' };

        const checkThreshold = (threshold: string | undefined, score: number): boolean | null => {
            if (!threshold) return null; // No threshold defined

            // Parse operator and value (e.g., ">50", "<30", ">=40", "<=60", or just "50")
            const match = threshold.match(/^(>=|<=|>|<)?(\d+)$/);
            if (!match) return null;

            const operator = match[1] || '>='; // Default to >= if no operator
            const value = parseInt(match[2], 10);

            switch (operator) {
                case '>': return score > value;
                case '<': return score < value;
                case '>=': return score >= value;
                case '<=': return score <= value;
                default: return score >= value;
            }
        };

        const fatigueResult = checkThreshold(flexCond.fatigue, fatigueScore);
        const readinessResult = checkThreshold(flexCond.readiness, readinessScore);

        // Apply logic
        if (flexCond.logic === 'and') {
            // Both must pass (if defined)
            if (fatigueResult === false || readinessResult === false) return false;
            return (fatigueResult === true || fatigueResult === null) &&
                (readinessResult === true || readinessResult === null);
        } else {
            // Either can pass (OR logic)
            return fatigueResult === true || readinessResult === true;
        }
    }

    // Handle legacy string conditions
    switch (condition) {
        case 'low_fatigue':
            return fatigueScore < FATIGUE_THRESHOLDS.low_fatigue.max;
        case 'moderate_fatigue':
            return fatigueScore >= FATIGUE_THRESHOLDS.moderate_fatigue.min &&
                fatigueScore < FATIGUE_THRESHOLDS.moderate_fatigue.max;
        case 'high_fatigue':
            return fatigueScore >= FATIGUE_THRESHOLDS.high_fatigue.min &&
                fatigueScore < FATIGUE_THRESHOLDS.high_fatigue.max;
        case 'very_high_fatigue':
            return fatigueScore >= FATIGUE_THRESHOLDS.very_high_fatigue.min;
        case 'fresh':
            return readinessScore >= READINESS_THRESHOLDS.fresh.min;
        case 'recovered':
            return readinessScore >= READINESS_THRESHOLDS.recovered.min &&
                readinessScore < READINESS_THRESHOLDS.recovered.max;
        case 'tired':
            return readinessScore >= READINESS_THRESHOLDS.tired.min &&
                readinessScore < READINESS_THRESHOLDS.tired.max;
        case 'overreached':
            return readinessScore < READINESS_THRESHOLDS.overreached.max;
        default:
            return false;
    }
}

/**
 * Applies fatigue modifiers to a plan week based on current athlete state
 */
export function applyFatigueModifiers(
    week: PlanWeek,
    context: FatigueContext,
    modifiers: FatigueModifier[]
): { week: PlanWeek; messages: string[] } {
    let modifiedWeek = { ...week };
    const messages: string[] = [];

    for (const modifier of modifiers) {
        // Check fatigue condition first
        if (!checkFatigueCondition(modifier.condition, context)) {
            continue;
        }

        // Check phase condition if specified
        if (modifier.phase !== undefined) {
            const phasesToMatch = Array.isArray(modifier.phase) ? modifier.phase : [modifier.phase];
            if (context.phase && !phasesToMatch.includes(context.phase)) {
                continue; // Skip if current phase doesn't match
            }
        }

        // Check week position condition if specified (supports relative positioning for variable-length programs)
        if (modifier.weekPosition !== undefined && context.weekNumber !== undefined && context.totalWeeks !== undefined) {
            const positions = Array.isArray(modifier.weekPosition) ? modifier.weekPosition : [modifier.weekPosition];
            const currentWeek = context.weekNumber;
            const total = context.totalWeeks;
            // Use floor semantics: progress where week 1 = 0, week N = 1
            const progress = total > 1 ? (currentWeek - 1) / (total - 1) : 0;

            let matchesAny = false;
            for (const pos of positions) {
                if (pos === 'first' && currentWeek === 1) {
                    matchesAny = true;
                    break;
                }
                if (pos === 'last' && currentWeek === total) {
                    matchesAny = true;
                    break;
                }
                if (pos === 'early' && progress <= 0.33) {
                    matchesAny = true;
                    break;
                }
                if (pos === 'mid' && progress > 0.33 && progress <= 0.66) {
                    matchesAny = true;
                    break;
                }
                if (pos === 'late' && progress > 0.66) {
                    matchesAny = true;
                    break;
                }

                if (typeof pos === 'string') {
                    // Handle comparison operators with percentages (e.g., ">50%", "<33.33%")
                    const compPercentMatch = pos.match(/^([><])(\d+(?:\.\d+)?)%$/);
                    if (compPercentMatch) {
                        const op = compPercentMatch[1];
                        const targetPercent = parseFloat(compPercentMatch[2]) / 100;
                        if (op === '>' && progress > targetPercent) {
                            matchesAny = true;
                            break;
                        }
                        if (op === '<' && progress < targetPercent) {
                            matchesAny = true;
                            break;
                        }
                        continue;
                    }

                    // Handle comparison operators with week numbers (e.g., ">5", "<10")
                    const compWeekMatch = pos.match(/^([><])(\d+)$/);
                    if (compWeekMatch) {
                        const op = compWeekMatch[1];
                        const targetWeek = parseInt(compWeekMatch[2]);
                        if (op === '>' && currentWeek > targetWeek) {
                            matchesAny = true;
                            break;
                        }
                        if (op === '<' && currentWeek < targetWeek) {
                            matchesAny = true;
                            break;
                        }
                        continue;
                    }

                    // Handle exact percentage positions like '25%', '50%', '75%', '33.3333%'
                    if (pos.endsWith('%')) {
                        const targetPercent = parseFloat(pos.slice(0, -1)) / 100;
                        // Use floor semantics: 33.33% starts at week = 1 + 0.3333 × (total - 1)
                        const targetWeek = 1 + targetPercent * (total - 1);
                        // Allow ±0.5 week tolerance for percentage matches (effectively same week)
                        if (Math.abs(currentWeek - targetWeek) <= 0.5) {
                            matchesAny = true;
                            break;
                        }
                    }
                }
            }

            if (!matchesAny) {
                continue; // Skip if week position doesn't match
            }
        }

        // All conditions passed, apply adjustments
        const adj = modifier.adjustments;

        if (adj.powerMultiplier !== undefined) {
            modifiedWeek.plannedPower = Math.round(modifiedWeek.plannedPower * adj.powerMultiplier);
        }

        if (adj.rpeAdjust !== undefined) {
            modifiedWeek.targetRPE = Math.max(1, Math.min(10, modifiedWeek.targetRPE + adj.rpeAdjust));
        }

        if (adj.restMultiplier !== undefined && modifiedWeek.restDurationSeconds) {
            modifiedWeek.restDurationSeconds = Math.round(modifiedWeek.restDurationSeconds * adj.restMultiplier);
        }

        if (adj.volumeMultiplier !== undefined && modifiedWeek.targetDurationMinutes) {
            modifiedWeek.targetDurationMinutes = Math.round(modifiedWeek.targetDurationMinutes * adj.volumeMultiplier);
        }

        if (adj.message) {
            messages.push(adj.message);
        }
    }

    return { week: modifiedWeek, messages };
}

// ============================================================================
// IMPORT / EXPORT
// ============================================================================

/**
 * Exports a template to a JSON string
 */
export function exportTemplateToJson(template: ProgramTemplate): string {
    return JSON.stringify(template, null, 2);
}

/**
 * Imports a template from a JSON string
 */
export function importTemplateFromJson(jsonString: string): ValidationResult {
    try {
        const parsed = JSON.parse(jsonString);
        return validateTemplate(parsed);
    } catch (e) {
        return {
            valid: false,
            errors: [{ field: 'json', message: `Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}` }]
        };
    }
}

/**
 * Converts a ProgramTemplate to a ProgramPreset (for use in the app)
 */
export function templateToPreset(template: ProgramTemplate): ProgramPreset {
    const weekOptions = getWeekOptions(template.weekConfig);
    const defaultWeekCount = weekOptions[Math.floor(weekOptions.length / 2)]; // Middle option

    // Return preset with additional template metadata for editor access
    return {
        id: template.id,
        name: template.name,
        description: template.description,
        generator: (basePower = 150, weekCount?: number) => generatePlanFromTemplate({
            template,
            basePower,
            weekCount: weekCount ?? defaultWeekCount,
        }),
        weekCount: defaultWeekCount,
        weekOptions: weekOptions,
        progressionMode: template.progressionMode,
        defaultSessionStyle: template.defaultSessionStyle,
        supportsCustomDuration: true,
        fatigueModifiers: template.fatigueModifiers,
        // Additional template metadata for editor access (these aren't part of ProgramPreset interface but are used by editor)
        weeks: template.weeks,
        weekConfig: template.weekConfig,
        author: template.author,
        tags: template.tags,
        defaultSessionDurationMinutes: template.defaultSessionDurationMinutes,
    } as ProgramPreset;
}

/**
 * Reconstructs a preset's generator function from its stored template metadata.
 * This is necessary because when presets are serialized to localStorage (as JSON),
 * the generator function is lost. The template metadata (weeks, weekConfig, etc.)
 * is preserved and can be used to regenerate the generator.
 * 
 * @param preset A preset that may have lost its generator function due to JSON serialization
 * @returns The preset with a working generator function
 */
export function hydratePreset(preset: ProgramPreset): ProgramPreset {
    // If the preset already has a working generator, return as-is
    if (typeof preset.generator === 'function') {
        return preset;
    }

    // Reconstruct the template from the preserved metadata
    const extendedPreset = preset as ProgramPreset & {
        weeks?: WeekDefinition[];
        weekConfig?: WeekConfig;
        author?: string;
        tags?: string[];
        defaultSessionDurationMinutes?: number;
    };

    // Check if we have the necessary template data to reconstruct the generator
    if (!extendedPreset.weeks || !extendedPreset.weekConfig) {
        console.warn(`Cannot hydrate preset "${preset.id}" - missing weeks or weekConfig metadata`);
        // Return with a fallback generator that produces an empty plan
        return {
            ...preset,
            generator: () => [],
        };
    }

    // Reconstruct the template
    const template: ProgramTemplate = {
        templateVersion: TEMPLATE_VERSION,
        id: preset.id,
        name: preset.name,
        description: preset.description,
        author: extendedPreset.author,
        tags: extendedPreset.tags,
        weekConfig: extendedPreset.weekConfig,
        defaultSessionStyle: preset.defaultSessionStyle || 'interval',
        progressionMode: preset.progressionMode || 'power',
        defaultSessionDurationMinutes: extendedPreset.defaultSessionDurationMinutes || 15,
        weeks: extendedPreset.weeks,
        fatigueModifiers: preset.fatigueModifiers,
    };

    // Use templateToPreset to create a fully functional preset with a working generator
    return templateToPreset(template);
}

/**
 * Creates a basic template from an existing preset
 * (Limited extraction - generator function cannot be fully serialized)
 */
export function presetToTemplate(
    preset: ProgramPreset,
    basePower: number = 150
): ProgramTemplate {
    const generatedPlan = preset.generator(basePower);

    return {
        templateVersion: '1.0',
        id: preset.id,
        name: preset.name,
        description: preset.description,
        weekConfig: {
            type: 'fixed',
            fixed: generatedPlan.length,
        },
        defaultSessionStyle: preset.defaultSessionStyle ?? 'interval',
        progressionMode: preset.progressionMode ?? 'power',
        defaultSessionDurationMinutes: 15,
        weeks: generatedPlan.map((week, index) => ({
            position: index + 1,
            phaseName: week.phaseName,
            focus: week.focus,
            description: week.description,
            powerMultiplier: week.plannedPower / basePower,
            workRestRatio: week.workRestRatio,
            targetRPE: week.targetRPE,
            sessionStyle: week.sessionStyle,
            durationMinutes: week.targetDurationMinutes,
            workDurationSeconds: week.workDurationSeconds,
            restDurationSeconds: week.restDurationSeconds,
        })),
        fatigueModifiers: [],
    };
}
