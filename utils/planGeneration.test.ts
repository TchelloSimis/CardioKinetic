/**
 * Unit tests for planGeneration.ts
 * 
 * Tests plan generation from templates.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    generatePlanFromTemplate,
    getValidWeekCount,
    getWeekOptions
} from './planGeneration';
import { ProgramTemplate, WeekConfig } from '../programTemplate';

// Mock sessionTimerUtils to avoid circular dependency
vi.mock('../hooks/sessionTimerUtils', () => ({
    generateBlockId: () => `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}));

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMinimalTemplate = (overrides: Partial<ProgramTemplate> = {}): ProgramTemplate => ({
    templateVersion: '1.0',
    id: 'test-template',
    name: 'Test Template',
    description: 'A test template',
    weekConfig: { type: 'fixed', fixed: 4 },
    defaultSessionStyle: 'interval',
    progressionMode: 'power',
    defaultSessionDurationMinutes: 30,
    weeks: [
        { position: 'first', phaseName: 'Week 1', description: 'Test week 1', focus: 'Volume', powerMultiplier: 0.8, workRestRatio: '1:1', targetRPE: 6 },
        { position: 'last', phaseName: 'Week 4', description: 'Test week 4', focus: 'Intensity', powerMultiplier: 1.0, workRestRatio: '1:1', targetRPE: 8 }
    ],
    fatigueModifiers: [],
    ...overrides
});

// ============================================================================
// getValidWeekCount TESTS
// ============================================================================

describe('getValidWeekCount', () => {
    it('should return fixed value for fixed config', () => {
        const config: WeekConfig = { type: 'fixed', fixed: 8 };
        expect(getValidWeekCount(config, 12)).toBe(8);
    });

    it('should default to 12 when fixed is undefined', () => {
        const config: WeekConfig = { type: 'fixed' };
        expect(getValidWeekCount(config, 6)).toBe(12);
    });

    it('should clamp to valid range for range config', () => {
        const config: WeekConfig = {
            type: 'variable',
            range: { min: 4, max: 12, step: 2 }
        };

        expect(getValidWeekCount(config, 3)).toBe(4);   // Below min
        expect(getValidWeekCount(config, 15)).toBe(12); // Above max
        expect(getValidWeekCount(config, 8)).toBe(8);   // Within range
    });

    it('should snap to nearest valid step', () => {
        const config: WeekConfig = {
            type: 'variable',
            range: { min: 4, max: 12, step: 2 }
        };

        expect(getValidWeekCount(config, 5)).toBe(6);  // 5 rounds to 6
        expect(getValidWeekCount(config, 7)).toBe(8);  // 7 rounds to 8
    });

    it('should use customDurations when provided', () => {
        const config: WeekConfig = {
            type: 'variable',
            customDurations: [4, 8, 12]
        };

        expect(getValidWeekCount(config, 8)).toBe(8);   // Exact match
        expect(getValidWeekCount(config, 6)).toBe(4);   // Closest (4)
        expect(getValidWeekCount(config, 10)).toBe(8);  // Closest (8)
        expect(getValidWeekCount(config, 15)).toBe(12); // Closest (12)
    });

    it('should return requested for unknown config types', () => {
        const config: WeekConfig = { type: 'fixed' as any };
        delete (config as any).fixed;
        expect(getValidWeekCount(config, 7)).toBe(12); // Falls through to default
    });
});

// ============================================================================
// getWeekOptions TESTS
// ============================================================================

describe('getWeekOptions', () => {
    it('should return single value for fixed config', () => {
        const config: WeekConfig = { type: 'fixed', fixed: 8 };
        expect(getWeekOptions(config)).toEqual([8]);
    });

    it('should default to [12] for fixed without value', () => {
        const config: WeekConfig = { type: 'fixed' };
        expect(getWeekOptions(config)).toEqual([12]);
    });

    it('should return all valid steps in range', () => {
        const config: WeekConfig = {
            type: 'variable',
            range: { min: 4, max: 10, step: 2 }
        };

        expect(getWeekOptions(config)).toEqual([4, 6, 8, 10]);
    });

    it('should use customDurations sorted ascending', () => {
        const config: WeekConfig = {
            type: 'variable',
            customDurations: [12, 4, 8]
        };

        expect(getWeekOptions(config)).toEqual([4, 8, 12]);
    });

    it('should return [12] for unknown config', () => {
        const config: WeekConfig = {} as any;
        expect(getWeekOptions(config)).toEqual([12]);
    });
});

// ============================================================================
// generatePlanFromTemplate TESTS
// ============================================================================

describe('generatePlanFromTemplate', () => {
    it('should generate correct number of weeks', () => {
        const template = createMinimalTemplate();
        const plan = generatePlanFromTemplate({
            template,
            basePower: 150,
            weekCount: 4
        });

        expect(plan).toHaveLength(4);
    });

    it('should apply power multipliers correctly', () => {
        const template = createMinimalTemplate({
            weeks: [
                { position: 'first', phaseName: 'Build', description: 'Test week', focus: 'Volume', powerMultiplier: 0.8, workRestRatio: '1:1', targetRPE: 6 },
                { position: 'last', phaseName: 'Peak', description: 'Test week', focus: 'Intensity', powerMultiplier: 1.1, workRestRatio: '1:1', targetRPE: 8 }
            ]
        });

        const plan = generatePlanFromTemplate({
            template,
            basePower: 100,
            weekCount: 4
        });

        expect(plan[0].plannedPower).toBe(80);  // 100 * 0.8
        expect(plan[3].plannedPower).toBe(110); // 100 * 1.1
    });

    it('should set default session style from template', () => {
        const template = createMinimalTemplate({ defaultSessionStyle: 'steady-state' });
        const plan = generatePlanFromTemplate({
            template,
            basePower: 150,
            weekCount: 4
        });

        expect(plan[0].sessionStyle).toBe('steady-state');
    });

    it('should use week-specific session style when provided', () => {
        const template = createMinimalTemplate({
            weeks: [
                { position: 'first', phaseName: 'Build', description: 'Test week', focus: 'Volume', powerMultiplier: 0.8, workRestRatio: '1:1', targetRPE: 6, sessionStyle: 'interval' },
                { position: 'last', phaseName: 'Peak', description: 'Test week', focus: 'Intensity', powerMultiplier: 1.0, workRestRatio: '1:1', targetRPE: 8, sessionStyle: 'steady-state' }
            ]
        });

        const plan = generatePlanFromTemplate({
            template,
            basePower: 150,
            weekCount: 4
        });

        expect(plan[0].sessionStyle).toBe('interval');
        expect(plan[3].sessionStyle).toBe('steady-state');
    });

    it('should resolve duration from template default', () => {
        const template = createMinimalTemplate({ defaultSessionDurationMinutes: 45 });
        const plan = generatePlanFromTemplate({
            template,
            basePower: 150,
            weekCount: 4
        });

        expect(plan[0].targetDurationMinutes).toBe(45);
    });

    it('should resolve percentage duration', () => {
        const template = createMinimalTemplate({
            defaultSessionDurationMinutes: 30,
            weeks: [
                { position: 'first', phaseName: 'Week 1', description: 'Test week', focus: 'Volume', powerMultiplier: 1.0, workRestRatio: '1:1', targetRPE: 7, durationMinutes: '150%' }
            ]
        });

        const plan = generatePlanFromTemplate({
            template,
            basePower: 150,
            weekCount: 4
        });

        expect(plan[0].targetDurationMinutes).toBe(45); // 30 * 1.5
    });

    it('should include work/rest parameters', () => {
        const template = createMinimalTemplate({
            weeks: [
                {
                    position: 'first',
                    phaseName: 'Week 1',
                    description: 'Test week',
                    focus: 'Volume',
                    powerMultiplier: 1.0,
                    targetRPE: 7,
                    workRestRatio: '2:1',
                    workDurationSeconds: 40,
                    restDurationSeconds: 20
                }
            ]
        });

        const plan = generatePlanFromTemplate({
            template,
            basePower: 150,
            weekCount: 4
        });

        expect(plan[0].workRestRatio).toBe('2:1');
        expect(plan[0].workDurationSeconds).toBe(40);
        expect(plan[0].restDurationSeconds).toBe(20);
    });

    it('should validate week count against template config', () => {
        const template = createMinimalTemplate({
            weekConfig: { type: 'variable', range: { min: 4, max: 8, step: 2 } }
        });

        const plan = generatePlanFromTemplate({
            template,
            basePower: 150,
            weekCount: 12 // Requests more than allowed
        });

        expect(plan).toHaveLength(8); // Clamped to max
    });
});
