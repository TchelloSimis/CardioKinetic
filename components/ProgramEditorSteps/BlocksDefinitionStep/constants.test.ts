/**
 * Unit tests for BlocksDefinitionStep module
 */

import { describe, it, expect } from 'vitest';
import {
    POWER_REFERENCE_OPTIONS,
    PROGRESSION_TYPE_OPTIONS,
    SESSION_STYLE_OPTIONS,
    generateBlockId,
} from './constants';

describe('BlocksDefinitionStep Constants', () => {
    describe('POWER_REFERENCE_OPTIONS', () => {
        it('should have all required options', () => {
            expect(POWER_REFERENCE_OPTIONS).toHaveLength(3);
            expect(POWER_REFERENCE_OPTIONS.map(o => o.value)).toContain('base');
            expect(POWER_REFERENCE_OPTIONS.map(o => o.value)).toContain('previous');
            expect(POWER_REFERENCE_OPTIONS.map(o => o.value)).toContain('block_start');
        });

        it('should have labels for all options', () => {
            POWER_REFERENCE_OPTIONS.forEach(option => {
                expect(option.label).toBeTruthy();
                expect(typeof option.label).toBe('string');
            });
        });
    });

    describe('PROGRESSION_TYPE_OPTIONS', () => {
        it('should have all required options', () => {
            expect(PROGRESSION_TYPE_OPTIONS).toHaveLength(3);
            expect(PROGRESSION_TYPE_OPTIONS.map(o => o.value)).toContain('power');
            expect(PROGRESSION_TYPE_OPTIONS.map(o => o.value)).toContain('duration');
            expect(PROGRESSION_TYPE_OPTIONS.map(o => o.value)).toContain('double');
        });
    });

    describe('SESSION_STYLE_OPTIONS', () => {
        it('should have all session styles', () => {
            expect(SESSION_STYLE_OPTIONS).toHaveLength(3);
            expect(SESSION_STYLE_OPTIONS.map(o => o.value)).toContain('interval');
            expect(SESSION_STYLE_OPTIONS.map(o => o.value)).toContain('steady-state');
            expect(SESSION_STYLE_OPTIONS.map(o => o.value)).toContain('custom');
        });
    });
});

describe('generateBlockId', () => {
    it('should generate lowercase id from name', () => {
        const id = generateBlockId('My Block', []);
        expect(id).toBe('my-block');
    });

    it('should replace special characters with hyphens', () => {
        const id = generateBlockId('Block (Test) #1', []);
        expect(id).toBe('block-test-1');
    });

    it('should trim leading and trailing hyphens', () => {
        const id = generateBlockId('---Block---', []);
        expect(id).toBe('block');
    });

    it('should add suffix for duplicate ids', () => {
        const existingIds = ['my-block', 'my-block-1'];
        const id = generateBlockId('My Block', existingIds);
        expect(id).toBe('my-block-2');
    });

    it('should handle empty name', () => {
        const id = generateBlockId('', []);
        // The function should handle empty strings gracefully
        expect(typeof id).toBe('string');
    });

    it('should increment suffix until unique', () => {
        const existingIds = ['block', 'block-1', 'block-2', 'block-3'];
        const id = generateBlockId('Block', existingIds);
        expect(id).toBe('block-4');
    });
});
