/**
 * Unit tests for templateUtils.ts
 * 
 * Tests template import/export and conversion utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import {
    exportTemplateToJson,
    importTemplateFromJson,
    templateToPreset,
    hydratePreset,
    presetToTemplate
} from './templateUtils';
import { ProgramTemplate } from '../programTemplate';
import { ProgramPreset } from '../types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createValidTemplate = (): ProgramTemplate => ({
    templateVersion: '1.0',
    id: 'test-template',
    name: 'Test Template',
    description: 'A test description',
    author: 'Test Author',
    tags: ['test', 'example'],
    weekConfig: { type: 'fixed', fixed: 8 },
    defaultSessionStyle: 'interval',
    progressionMode: 'power',
    defaultSessionDurationMinutes: 30,
    weeks: [
        { position: 'first', phaseName: 'Build', focus: 'Volume', powerMultiplier: 0.8, targetRPE: 6, description: 'Build week', workRestRatio: '1:1' },
        { position: 'last', phaseName: 'Peak', focus: 'Intensity', powerMultiplier: 1.0, targetRPE: 8, description: 'Peak week', workRestRatio: '2:1' }
    ],
    fatigueModifiers: []
});

// ============================================================================
// exportTemplateToJson TESTS
// ============================================================================

describe('exportTemplateToJson', () => {
    it('should export template as valid JSON string', () => {
        const template = createValidTemplate();
        const json = exportTemplateToJson(template);

        expect(typeof json).toBe('string');
        expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should include all template fields', () => {
        const template = createValidTemplate();
        const json = exportTemplateToJson(template);
        const parsed = JSON.parse(json);

        expect(parsed.id).toBe('test-template');
        expect(parsed.name).toBe('Test Template');
        expect(parsed.description).toBe('A test description');
        expect(parsed.weekConfig.type).toBe('fixed');
        expect(parsed.weeks).toHaveLength(2);
    });

    it('should format JSON with indentation', () => {
        const template = createValidTemplate();
        const json = exportTemplateToJson(template);

        expect(json).toContain('\n');
        expect(json).toContain('  '); // 2-space indent
    });
});

// ============================================================================
// importTemplateFromJson TESTS
// ============================================================================

describe('importTemplateFromJson', () => {
    it('should import valid JSON template', () => {
        const template = createValidTemplate();
        const json = JSON.stringify(template);
        const result = importTemplateFromJson(json);

        expect(result.valid).toBe(true);
        expect(result.template?.id).toBe('test-template');
    });

    it('should reject invalid JSON syntax', () => {
        const result = importTemplateFromJson('{ invalid json }');

        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.some(e => e.message.includes('Invalid JSON'))).toBe(true);
    });

    it('should reject template with validation errors', () => {
        const invalidTemplate = { id: '', name: '' }; // Missing required fields
        const json = JSON.stringify(invalidTemplate);
        const result = importTemplateFromJson(json);

        expect(result.valid).toBe(false);
        expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should return template on successful import', () => {
        const template = createValidTemplate();
        const json = JSON.stringify(template);
        const result = importTemplateFromJson(json);

        expect(result.valid).toBe(true);
        expect(result.template).toBeDefined();
        expect(result.template?.name).toBe('Test Template');
    });
});

// ============================================================================
// templateToPreset TESTS
// ============================================================================

describe('templateToPreset', () => {
    it('should convert template to preset with generator function', () => {
        const template = createValidTemplate();
        const preset = templateToPreset(template);

        expect(preset.id).toBe('test-template');
        expect(preset.name).toBe('Test Template');
        expect(typeof preset.generator).toBe('function');
    });

    it('should preserve metadata fields', () => {
        const template = createValidTemplate();
        const preset = templateToPreset(template);

        expect(preset.description).toBe('A test description');
        expect(preset.progressionMode).toBe('power');
        expect(preset.defaultSessionStyle).toBe('interval');
    });

    it('should set weekCount to middle option', () => {
        const template = createValidTemplate();
        const preset = templateToPreset(template);

        // Fixed config with 8 weeks should give weekCount 8
        expect(preset.weekCount).toBe(8);
    });

    it('should calculate week options for variable templates', () => {
        const template = createValidTemplate();
        template.weekConfig = { type: 'variable', range: { min: 4, max: 12, step: 2 } };
        const preset = templateToPreset(template);

        expect(preset.weekOptions).toEqual([4, 6, 8, 10, 12]);
    });

    it('should include extended template metadata', () => {
        const template = createValidTemplate();
        const preset = templateToPreset(template) as any;

        expect(preset.weeks).toBeDefined();
        expect(preset.weekConfig).toBeDefined();
        expect(preset.author).toBe('Test Author');
        expect(preset.tags).toEqual(['test', 'example']);
    });

    it('should generate working plan from generator', () => {
        const template = createValidTemplate();
        const preset = templateToPreset(template);
        const plan = preset.generator(150, 8);

        expect(plan).toHaveLength(8);
        expect(plan[0].plannedPower).toBe(120); // 150 * 0.8
    });
});

// ============================================================================
// hydratePreset TESTS
// ============================================================================

describe('hydratePreset', () => {
    it('should return preset unchanged if generator already works', () => {
        const template = createValidTemplate();
        const preset = templateToPreset(template);
        const hydrated = hydratePreset(preset);

        expect(hydrated.generator).toBe(preset.generator);
    });

    it('should reconstruct generator from metadata', () => {
        const template = createValidTemplate();
        const preset = templateToPreset(template);

        // Simulate JSON serialization (loses function)
        const serialized = JSON.parse(JSON.stringify(preset));
        expect(typeof serialized.generator).not.toBe('function');

        const hydrated = hydratePreset(serialized);

        expect(typeof hydrated.generator).toBe('function');
        expect(hydrated.generator(150, 8)).toHaveLength(8);
    });

    it('should return fallback generator when metadata is missing', () => {
        const preset: ProgramPreset = {
            id: 'broken',
            name: 'Broken Preset',
            generator: null as any, // No generator
            weekCount: 8
        };

        const hydrated = hydratePreset(preset);

        expect(typeof hydrated.generator).toBe('function');
        expect(hydrated.generator(150)).toEqual([]); // Returns empty plan
    });
});

// ============================================================================
// presetToTemplate TESTS
// ============================================================================

describe('presetToTemplate', () => {
    it('should extract template from preset by running generator', () => {
        const originalTemplate = createValidTemplate();
        const preset = templateToPreset(originalTemplate);
        const extractedTemplate = presetToTemplate(preset, 150);

        expect(extractedTemplate.id).toBe('test-template');
        expect(extractedTemplate.name).toBe('Test Template');
        expect(extractedTemplate.weeks).toHaveLength(8);
    });

    it('should create fixed week config matching generated plan', () => {
        const originalTemplate = createValidTemplate();
        const preset = templateToPreset(originalTemplate);
        const extractedTemplate = presetToTemplate(preset, 150);

        expect(extractedTemplate.weekConfig.type).toBe('fixed');
        expect(extractedTemplate.weekConfig.fixed).toBe(8);
    });

    it('should preserve session style', () => {
        const originalTemplate = createValidTemplate();
        originalTemplate.defaultSessionStyle = 'steady-state';
        const preset = templateToPreset(originalTemplate);
        const extractedTemplate = presetToTemplate(preset, 150);

        expect(extractedTemplate.defaultSessionStyle).toBe('steady-state');
    });

    it('should calculate power multipliers relative to base power', () => {
        const originalTemplate = createValidTemplate();
        const preset = templateToPreset(originalTemplate);
        const extractedTemplate = presetToTemplate(preset, 100);

        // First week: 0.8 multiplier → 80W → 80/100 = 0.8
        expect(extractedTemplate.weeks[0].powerMultiplier).toBeCloseTo(0.8, 1);
    });

    it('should set templateVersion', () => {
        const preset = templateToPreset(createValidTemplate());
        const extractedTemplate = presetToTemplate(preset, 150);

        expect(extractedTemplate.templateVersion).toBe('1.0');
    });
});
