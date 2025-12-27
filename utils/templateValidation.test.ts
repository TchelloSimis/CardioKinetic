/**
 * Unit tests for templateValidation.ts
 * 
 * Tests template schema validation.
 */

import { describe, it, expect } from 'vitest';
import { validateTemplate, TEMPLATE_VERSION } from './templateValidation';

// ============================================================================
// VALID TEMPLATE FIXTURES
// ============================================================================

const createValidTemplate = (overrides: object = {}) => ({
    templateVersion: TEMPLATE_VERSION,
    id: 'test-template',
    name: 'Test Template',
    description: 'A test description',
    weekConfig: { type: 'fixed', fixed: 8 },
    defaultSessionStyle: 'interval',
    progressionMode: 'power',
    defaultSessionDurationMinutes: 30,
    weeks: [
        {
            position: 'first',
            phaseName: 'Week 1',
            focus: 'Volume',
            powerMultiplier: 0.8,
            targetRPE: 6,
            description: 'First week description',
            workRestRatio: '1:1'
        }
    ],
    fatigueModifiers: [],
    ...overrides
});

// ============================================================================
// validateTemplate TESTS - VALID TEMPLATES
// ============================================================================

describe('validateTemplate - valid templates', () => {
    it('should validate a minimal valid template', () => {
        const result = validateTemplate(createValidTemplate());
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should accept variable week config with range', () => {
        const template = createValidTemplate({
            weekConfig: { type: 'variable', range: { min: 4, max: 12, step: 2 } }
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(true);
    });

    it('should accept variable week config with customDurations', () => {
        const template = createValidTemplate({
            weekConfig: { type: 'variable', customDurations: [4, 8, 12] }
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(true);
    });

    it('should accept steady-state session style', () => {
        const template = createValidTemplate({ defaultSessionStyle: 'steady-state' });
        const result = validateTemplate(template);
        expect(result.valid).toBe(true);
    });

    it('should accept custom session style', () => {
        const template = createValidTemplate({ defaultSessionStyle: 'custom' });
        const result = validateTemplate(template);
        expect(result.valid).toBe(true);
    });

    it('should accept duration progression mode', () => {
        const template = createValidTemplate({ progressionMode: 'duration' });
        const result = validateTemplate(template);
        expect(result.valid).toBe(true);
    });

    it('should accept optional fields', () => {
        const template = createValidTemplate({
            author: 'Test Author',
            tags: ['endurance', 'interval']
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(true);
    });
});

// ============================================================================
// validateTemplate TESTS - INVALID TEMPLATES
// ============================================================================

describe('validateTemplate - invalid templates', () => {
    it('should reject non-object input', () => {
        expect(validateTemplate(null).valid).toBe(false);
        expect(validateTemplate(undefined).valid).toBe(false);
        expect(validateTemplate('string').valid).toBe(false);
        expect(validateTemplate(123).valid).toBe(false);
    });

    it('should reject missing required fields', () => {
        const result = validateTemplate({});
        expect(result.valid).toBe(false);
        expect(result.errors?.some(e => e.field === 'id')).toBe(true);
        expect(result.errors?.some(e => e.field === 'name')).toBe(true);
    });

    it('should reject empty id', () => {
        const template = createValidTemplate({ id: '' });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
        expect(result.errors?.some(e => e.field === 'id')).toBe(true);
    });

    it('should reject empty name', () => {
        const template = createValidTemplate({ name: '' });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
        expect(result.errors?.some(e => e.field === 'name')).toBe(true);
    });

    it('should reject invalid session style', () => {
        const template = createValidTemplate({ defaultSessionStyle: 'invalid' });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
        expect(result.errors?.some(e => e.field === 'defaultSessionStyle')).toBe(true);
    });

    it('should reject invalid progression mode', () => {
        const template = createValidTemplate({ progressionMode: 'invalid' });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
        expect(result.errors?.some(e => e.field === 'progressionMode')).toBe(true);
    });

    it('should reject invalid week config type', () => {
        const template = createValidTemplate({
            weekConfig: { type: 'invalid' }
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
    });

    it('should reject empty weeks array for non-block-based templates', () => {
        const template = createValidTemplate({ weeks: [] });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
    });

    it('should reject invalid defaultSessionDurationMinutes', () => {
        const template = createValidTemplate({ defaultSessionDurationMinutes: 0 });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
    });
});

// ============================================================================
// validateTemplate TESTS - WEEK DEFINITIONS
// ============================================================================

describe('validateTemplate - week definitions', () => {
    const createWeekDef = (overrides: object = {}) => ({
        position: 1,
        phaseName: 'Week 1',
        focus: 'Volume',
        description: 'Week description',
        workRestRatio: '1:1',
        powerMultiplier: 1.0,
        targetRPE: 7,
        ...overrides
    });

    it('should accept numeric position', () => {
        const template = createValidTemplate({
            weeks: [createWeekDef({ position: 1 })]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(true);
    });

    it('should accept percentage position', () => {
        const template = createValidTemplate({
            weeks: [createWeekDef({ position: '50%' })]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(true);
    });

    it('should accept "first" position', () => {
        const template = createValidTemplate({
            weeks: [createWeekDef({ position: 'first' })]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(true);
    });

    it('should accept "last" position', () => {
        const template = createValidTemplate({
            weeks: [createWeekDef({ position: 'last' })]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(true);
    });

    it('should reject invalid focus type', () => {
        const template = createValidTemplate({
            weeks: [createWeekDef({ focus: 'InvalidFocus' })]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
    });

    it('should reject powerMultiplier at or below 0', () => {
        const template = createValidTemplate({
            weeks: [createWeekDef({ powerMultiplier: 0 })]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
    });

    it('should reject targetRPE below 1', () => {
        const template = createValidTemplate({
            weeks: [createWeekDef({ targetRPE: 0 })]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
    });

    it('should reject targetRPE above 10', () => {
        const template = createValidTemplate({
            weeks: [createWeekDef({ targetRPE: 11 })]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
    });
});

// ============================================================================
// validateTemplate TESTS - FATIGUE MODIFIERS
// ============================================================================

describe('validateTemplate - fatigue modifiers', () => {
    it('should accept valid legacy fatigue modifier', () => {
        const template = createValidTemplate({
            fatigueModifiers: [{
                condition: 'high_fatigue',
                adjustments: { powerMultiplier: 0.9 }
            }]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(true);
    });

    it('should accept valid flexible fatigue modifier', () => {
        const template = createValidTemplate({
            fatigueModifiers: [{
                condition: { logic: 'and', fatigue: '>80' },
                adjustments: { powerMultiplier: 0.9 }
            }]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(true);
    });

    it('should reject modifier with invalid condition string', () => {
        const template = createValidTemplate({
            fatigueModifiers: [{
                condition: 'invalid_condition',
                adjustments: { powerMultiplier: 0.9 }
            }]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
    });

    it('should reject modifier with missing adjustments', () => {
        const template = createValidTemplate({
            fatigueModifiers: [{
                condition: 'high_fatigue'
                // Missing adjustments
            }]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
    });
});

// ============================================================================
// validateTemplate TESTS - BLOCK-BASED TEMPLATES
// ============================================================================

describe('validateTemplate - block-based templates', () => {
    const createValidBlock = (overrides: object = {}) => ({
        id: 'block-1',
        name: 'Build',
        weekCount: 3,
        powerProgression: [1.0, 1.02, 1.04],
        powerReference: 'base',
        focus: 'Volume',
        phaseName: 'Build Phase',
        description: 'Building block',
        workRestRatio: '1:1',
        targetRPE: 7,
        ...overrides
    });

    it('should accept valid block-based template', () => {
        const template = createValidTemplate({
            structureType: 'block-based',
            weeks: [], // Empty is OK for block-based
            programBlocks: [createValidBlock()]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(true);
    });

    it('should reject block without id', () => {
        const template = createValidTemplate({
            structureType: 'block-based',
            weeks: [],
            programBlocks: [createValidBlock({ id: '' })]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
    });

    it('should reject block with invalid weekCount', () => {
        const template = createValidTemplate({
            structureType: 'block-based',
            weeks: [],
            programBlocks: [createValidBlock({ weekCount: 0 })]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
    });

    it('should reject invalid powerReference', () => {
        const template = createValidTemplate({
            structureType: 'block-based',
            weeks: [],
            programBlocks: [createValidBlock({ powerReference: 'invalid-ref' })]
        });
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
    });
});
