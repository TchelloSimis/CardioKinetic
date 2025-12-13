/**
 * Template Validation
 * 
 * Functions for validating program template JSON objects
 */

import {
    ProgramTemplate,
    WeekDefinition,
    FatigueModifier,
    ValidationResult,
    ValidationError,
    WeekFocus,
    ProgramBlock,
    PowerReference,
} from '../programTemplate';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Current template schema version */
export const TEMPLATE_VERSION = '1.0' as const;

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
        // For variable type, need either range OR customDurations
        if (weekConfig.type === 'variable') {
            const range = weekConfig.range as Record<string, unknown> | undefined;
            const customDurations = weekConfig.customDurations as number[] | undefined;

            if (customDurations && Array.isArray(customDurations)) {
                // Validate customDurations
                if (customDurations.length === 0) {
                    errors.push({ field: 'weekConfig.customDurations', message: 'Must have at least one duration' });
                } else {
                    for (let i = 0; i < customDurations.length; i++) {
                        if (typeof customDurations[i] !== 'number' || customDurations[i] <= 0 || !Number.isInteger(customDurations[i])) {
                            errors.push({ field: `weekConfig.customDurations[${i}]`, message: 'Must be a positive integer' });
                        }
                    }
                }
            } else if (!range || typeof range.min !== 'number' || typeof range.max !== 'number' || typeof range.step !== 'number') {
                errors.push({ field: 'weekConfig.range', message: 'Required min, max, step for variable-length programs (or use customDurations)' });
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

    // Validate based on structure type
    const isBlockBased = obj.structureType === 'block-based';

    if (isBlockBased) {
        // Block-based templates use programBlocks instead of weeks
        if (!Array.isArray(obj.programBlocks) || obj.programBlocks.length === 0) {
            errors.push({ field: 'programBlocks', message: 'Required non-empty array for block-based templates' });
        } else {
            (obj.programBlocks as unknown[]).forEach((block, index) => {
                const blockErrors = validateProgramBlock(block, index, obj.programBlocks as unknown[]);
                errors.push(...blockErrors);
            });
        }

        // Validate fixedFirstWeek and fixedLastWeek if present
        if (obj.fixedFirstWeek) {
            const firstWeekErrors = validateWeekDefinition(obj.fixedFirstWeek, 0);
            errors.push(...firstWeekErrors.map(e => ({ ...e, field: 'fixedFirstWeek.' + e.field.replace(/^weeks\[0\]\.?/, '') })));
        }
        if (obj.fixedLastWeek) {
            const lastWeekErrors = validateWeekDefinition(obj.fixedLastWeek, 0);
            errors.push(...lastWeekErrors.map(e => ({ ...e, field: 'fixedLastWeek.' + e.field.replace(/^weeks\[0\]\.?/, '') })));
        }
    } else {
        // Traditional week-based templates require weeks array
        if (!Array.isArray(obj.weeks) || obj.weeks.length === 0) {
            errors.push({ field: 'weeks', message: 'Must be a non-empty array' });
        } else {
            (obj.weeks as unknown[]).forEach((week, index) => {
                const weekErrors = validateWeekDefinition(week, index);
                errors.push(...weekErrors);
            });
        }
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

/**
 * Validates a ProgramBlock in a block-based template
 */
function validateProgramBlock(block: unknown, index: number, allBlocks: unknown[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const prefix = `programBlocks[${index}]`;

    if (!block || typeof block !== 'object') {
        return [{ field: prefix, message: 'Must be an object' }];
    }

    const b = block as Record<string, unknown>;

    // Required fields
    if (!b.id || typeof b.id !== 'string') {
        errors.push({ field: `${prefix}.id`, message: 'Required string field' });
    }

    if (!b.name || typeof b.name !== 'string') {
        errors.push({ field: `${prefix}.name`, message: 'Required string field' });
    }

    if (typeof b.weekCount !== 'number' || b.weekCount <= 0 || !Number.isInteger(b.weekCount)) {
        errors.push({ field: `${prefix}.weekCount`, message: 'Must be a positive integer' });
    }

    // Power reference validation
    const validReferences: PowerReference[] = ['base', 'previous', 'block_start'];
    if (!validReferences.includes(b.powerReference as PowerReference)) {
        errors.push({ field: `${prefix}.powerReference`, message: 'Must be "base", "previous", or "block_start"' });
    }

    // Power progression validation
    if (!Array.isArray(b.powerProgression)) {
        errors.push({ field: `${prefix}.powerProgression`, message: 'Must be an array of numbers' });
    } else {
        if (typeof b.weekCount === 'number' && b.powerProgression.length !== b.weekCount) {
            errors.push({ field: `${prefix}.powerProgression`, message: `Length must equal weekCount (${b.weekCount})` });
        }
        for (let i = 0; i < b.powerProgression.length; i++) {
            if (typeof b.powerProgression[i] !== 'number' || b.powerProgression[i] <= 0) {
                errors.push({ field: `${prefix}.powerProgression[${i}]`, message: 'Must be a positive number' });
            }
        }
    }

    // Focus validation
    const validFocuses: WeekFocus[] = ['Density', 'Intensity', 'Volume', 'Recovery'];
    if (!validFocuses.includes(b.focus as WeekFocus)) {
        errors.push({ field: `${prefix}.focus`, message: 'Must be Density, Intensity, Volume, or Recovery' });
    }

    if (!b.phaseName || typeof b.phaseName !== 'string') {
        errors.push({ field: `${prefix}.phaseName`, message: 'Required string field' });
    }

    if (!b.description || typeof b.description !== 'string') {
        errors.push({ field: `${prefix}.description`, message: 'Required string field' });
    }

    if (!b.workRestRatio || typeof b.workRestRatio !== 'string') {
        errors.push({ field: `${prefix}.workRestRatio`, message: 'Required string field (e.g., "1:2")' });
    }

    // RPE validation (can be number or array)
    if (typeof b.targetRPE === 'number') {
        if (b.targetRPE < 1 || b.targetRPE > 10) {
            errors.push({ field: `${prefix}.targetRPE`, message: 'Must be between 1 and 10' });
        }
    } else if (Array.isArray(b.targetRPE)) {
        for (let i = 0; i < b.targetRPE.length; i++) {
            if (typeof b.targetRPE[i] !== 'number' || b.targetRPE[i] < 1 || b.targetRPE[i] > 10) {
                errors.push({ field: `${prefix}.targetRPE[${i}]`, message: 'Must be a number between 1 and 10' });
            }
        }
    } else {
        errors.push({ field: `${prefix}.targetRPE`, message: 'Must be a number or array of numbers' });
    }

    // followedBy validation - must reference a valid block ID
    if (b.followedBy !== undefined) {
        if (typeof b.followedBy !== 'string') {
            errors.push({ field: `${prefix}.followedBy`, message: 'Must be a string (block ID)' });
        } else {
            const validIds = (allBlocks as Record<string, unknown>[])
                .filter(bl => bl && typeof bl === 'object')
                .map(bl => bl.id)
                .filter(id => typeof id === 'string');
            if (!validIds.includes(b.followedBy)) {
                errors.push({ field: `${prefix}.followedBy`, message: `Must reference a valid block ID. Valid IDs: ${validIds.join(', ')}` });
            }
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
