/**
 * Unit tests for blockExpansion.ts
 * 
 * Tests block-based template expansion logic.
 */

import { describe, it, expect } from 'vitest';
import {
    countBlockOccurrences,
    formatBlockCounts,
    generateBlockSequence,
    calculateBlockPower,
    calculateBlockDuration,
    expandBlocksToWeeks
} from './blockExpansion';
import { ProgramTemplate, ProgramBlock, PowerReference } from '../programTemplate';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createBlock = (overrides: Partial<ProgramBlock> = {}): ProgramBlock => ({
    id: 'block-1',
    name: 'Build',
    weekCount: 3,
    powerProgression: [1.0, 1.02, 1.04],
    powerReference: 'base' as PowerReference,
    focus: 'Volume',
    phaseName: 'Build Phase',
    description: 'Building block week {weekInBlock} of {weekCount}',
    workRestRatio: '1:1',
    targetRPE: 7,
    ...overrides
});

const createBlockBasedTemplate = (overrides: Partial<ProgramTemplate> = {}): ProgramTemplate => ({
    templateVersion: '1.0',
    id: 'block-template',
    name: 'Block Template',
    description: 'A block-based template',
    structureType: 'block-based',
    weekConfig: { type: 'variable', range: { min: 4, max: 12, step: 1 } },
    defaultSessionStyle: 'interval',
    progressionMode: 'power',
    defaultSessionDurationMinutes: 30,
    weeks: [],
    programBlocks: [createBlock()],
    fatigueModifiers: [],
    ...overrides
});

// ============================================================================
// countBlockOccurrences TESTS
// ============================================================================

describe('countBlockOccurrences', () => {
    it('should count single block occurrences', () => {
        const template = createBlockBasedTemplate({
            programBlocks: [createBlock({ id: 'build', name: 'Build', weekCount: 3 })]
        });

        const counts = countBlockOccurrences(template, 9);
        expect(counts.get('build')).toBe(3); // 9 weeks / 3 weeks per block
    });

    it('should handle multiple block types with followedBy chain', () => {
        const template = createBlockBasedTemplate({
            programBlocks: [
                createBlock({ id: 'build', name: 'Build', weekCount: 3, followedBy: 'deload' }),
                createBlock({ id: 'deload', name: 'Deload', weekCount: 1, followedBy: 'build' })
            ]
        });

        const counts = countBlockOccurrences(template, 8);
        // Pattern: Build (3) + Deload (1) = 4 weeks per cycle
        // 8 weeks = 2 full cycles
        expect(counts.get('build')).toBe(2);
        expect(counts.get('deload')).toBe(2);
    });

    it('should return empty map for empty programBlocks', () => {
        const template = createBlockBasedTemplate({ programBlocks: [] });
        const counts = countBlockOccurrences(template, 8);
        expect(counts.size).toBe(0);
    });
});

// ============================================================================
// formatBlockCounts TESTS
// ============================================================================

describe('formatBlockCounts', () => {
    it('should format single block', () => {
        const template = createBlockBasedTemplate({
            programBlocks: [createBlock({ id: 'build', name: 'Build', weekCount: 4 })]
        });

        const formatted = formatBlockCounts(template, 8);
        expect(formatted).toContain('Build');
        expect(formatted).toContain('×2');
    });

    it('should format multiple blocks', () => {
        const template = createBlockBasedTemplate({
            programBlocks: [
                createBlock({ id: 'build', name: 'Build', weekCount: 3, followedBy: 'deload' }),
                createBlock({ id: 'deload', name: 'Deload', weekCount: 1, followedBy: 'build' })
            ]
        });

        const formatted = formatBlockCounts(template, 8);
        expect(formatted).toContain('Build');
        expect(formatted).toContain('Deload');
    });

    it('should return empty string for no blocks', () => {
        const template = createBlockBasedTemplate({ programBlocks: [] });
        const formatted = formatBlockCounts(template, 8);
        expect(formatted).toBe('');
    });
});

// ============================================================================
// generateBlockSequence TESTS
// ============================================================================

describe('generateBlockSequence', () => {
    it('should generate sequence for single block', () => {
        const blocks = [createBlock({ id: 'build', name: 'Build', weekCount: 3 })];
        const sequence = generateBlockSequence(blocks, 6);

        expect(sequence).toHaveLength(6);
        expect(sequence.every(s => s.blockId === 'build')).toBe(true);
    });

    it('should track week within block', () => {
        const blocks = [createBlock({ id: 'build', name: 'Build', weekCount: 3 })];
        const sequence = generateBlockSequence(blocks, 6);

        // Two cycles of 3 weeks
        expect(sequence[0].weekInBlock).toBe(1);
        expect(sequence[1].weekInBlock).toBe(2);
        expect(sequence[2].weekInBlock).toBe(3);
        expect(sequence[3].weekInBlock).toBe(1); // New cycle
    });

    it('should follow block chain via followedBy', () => {
        const blocks = [
            createBlock({ id: 'build', name: 'Build', weekCount: 2, followedBy: 'peak' }),
            createBlock({ id: 'peak', name: 'Peak', weekCount: 1, followedBy: 'build' })
        ];
        const sequence = generateBlockSequence(blocks, 6);

        // Pattern: Build, Build, Peak, Build, Build, Peak
        expect(sequence[0].blockId).toBe('build');
        expect(sequence[1].blockId).toBe('build');
        expect(sequence[2].blockId).toBe('peak');
        expect(sequence[3].blockId).toBe('build');
    });

    it('should return empty array for empty blocks', () => {
        const sequence = generateBlockSequence([], 5);
        expect(sequence).toEqual([]);
    });
});

// ============================================================================
// calculateBlockPower TESTS
// ============================================================================

describe('calculateBlockPower', () => {
    it('should use program base for base reference', () => {
        const result = calculateBlockPower('base', 1.1, 150, 160, 145);
        expect(result).toBe(165); // 150 * 1.1
    });

    it('should use previous week for previous reference', () => {
        const result = calculateBlockPower('previous', 1.05, 150, 160, 145);
        expect(result).toBe(168); // 160 * 1.05
    });

    it('should use block start for block_start reference', () => {
        const result = calculateBlockPower('block_start', 1.1, 150, 160, 145);
        expect(result).toBeCloseTo(160, 0); // 145 * 1.1 = 159.5 rounded to 160
    });

    it('should default to base for unknown reference', () => {
        const result = calculateBlockPower('unknown' as any, 1.0, 150, 160, 145);
        expect(result).toBe(150);
    });
});

// ============================================================================
// calculateBlockDuration TESTS
// ============================================================================

describe('calculateBlockDuration', () => {
    it('should use base duration for base reference', () => {
        const result = calculateBlockDuration('base', 1.2, 30, 35, 28);
        expect(result).toBe(36); // 30 * 1.2
    });

    it('should use previous week for previous reference', () => {
        const result = calculateBlockDuration('previous', 1.1, 30, 35, 28);
        expect(result).toBeCloseTo(38.5, 0); // 35 * 1.1
    });

    it('should use block start for block_start reference', () => {
        const result = calculateBlockDuration('block_start', 1.1, 30, 35, 28);
        expect(result).toBeCloseTo(30.8, 0); // 28 * 1.1
    });
});

// ============================================================================
// expandBlocksToWeeks TESTS
// ============================================================================

describe('expandBlocksToWeeks', () => {
    it('should expand blocks to correct number of weeks', () => {
        const template = createBlockBasedTemplate();
        const weeks = expandBlocksToWeeks(template, 6, 150);

        expect(weeks).toHaveLength(6);
    });

    it('should apply power progression within block', () => {
        const template = createBlockBasedTemplate({
            programBlocks: [createBlock({
                id: 'build',
                name: 'Build',
                weekCount: 3,
                powerProgression: [1.0, 1.05, 1.1],
                powerReference: 'base'
            })]
        });

        const weeks = expandBlocksToWeeks(template, 3, 100);

        expect(weeks[0].powerMultiplier).toBeCloseTo(1.0, 2);
        expect(weeks[1].powerMultiplier).toBeCloseTo(1.05, 2);
        expect(weeks[2].powerMultiplier).toBeCloseTo(1.1, 2);
    });

    it('should handle fixedFirstWeek', () => {
        const template = createBlockBasedTemplate({
            fixedFirstWeek: {
                position: 1,
                phaseName: 'Intro',
                focus: 'Recovery',
                powerMultiplier: 0.7,
                targetRPE: 5
            }
        });

        const weeks = expandBlocksToWeeks(template, 4, 150);

        expect(weeks[0].phaseName).toBe('Intro');
        expect(weeks[0].powerMultiplier).toBe(0.7);
    });

    it('should handle fixedLastWeek', () => {
        const template = createBlockBasedTemplate({
            fixedLastWeek: {
                position: 'last',
                phaseName: 'Taper',
                focus: 'Recovery',
                powerMultiplier: 0.6,
                targetRPE: 4
            }
        });

        const weeks = expandBlocksToWeeks(template, 4, 150);

        expect(weeks[3].phaseName).toBe('Taper');
        expect(weeks[3].powerMultiplier).toBe(0.6);
    });

    it('should return empty for templates with no programBlocks', () => {
        const template = createBlockBasedTemplate({ programBlocks: [] });

        const weeks = expandBlocksToWeeks(template, 4, 150);
        expect(weeks).toEqual([]);
    });
});
