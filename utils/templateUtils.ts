/**
 * Template Utilities
 * 
 * Functions for validating, importing, exporting, and generating plans from templates.
 * 
 * This module re-exports functionality from domain-specific sub-modules:
 * - templateValidation: Schema validation
 * - weekInterpolation: Position resolution and week interpolation
 * - planGeneration: Plan generation from templates
 * - fatigueModifiers: Fatigue condition checking and adjustments
 */

import { PlanWeek, ProgramPreset } from '../types';
import {
    ProgramTemplate,
    WeekDefinition,
    WeekConfig,
    ValidationResult,
} from '../programTemplate';

// Re-export from sub-modules
export { TEMPLATE_VERSION, validateTemplate } from './templateValidation';
export { resolveWeekPosition, interpolateWeeks, interpolateWeekDefinition } from './weekInterpolation';
export { generatePlanFromTemplate, getValidWeekCount, getWeekOptions } from './planGeneration';
export { FATIGUE_THRESHOLDS, READINESS_THRESHOLDS, checkFatigueCondition, applyFatigueModifiers } from './fatigueModifiers';

// Import for local use
import { TEMPLATE_VERSION, validateTemplate } from './templateValidation';
import { generatePlanFromTemplate, getWeekOptions } from './planGeneration';

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
