/**
 * Unit tests for weekInterpolation.ts
 * 
 * Tests week position resolution and interpolation logic.
 */

import { describe, it, expect } from 'vitest';
import {
    resolveWeekPosition,
    interpolateWeeks,
    interpolateWeekDefinition
} from './weekInterpolation';
import { WeekDefinition, WeekPosition } from '../programTemplate';

// ============================================================================
// resolveWeekPosition TESTS
// ============================================================================

describe('resolveWeekPosition', () => {
    it('should resolve numeric positions directly', () => {
        expect(resolveWeekPosition(1, 12)).toBe(1);
        expect(resolveWeekPosition(6, 12)).toBe(6);
        expect(resolveWeekPosition(12, 12)).toBe(12);
    });

    it('should clamp numeric positions to total weeks', () => {
        expect(resolveWeekPosition(15, 12)).toBe(12);
    });

    it('should resolve "first" to week 1', () => {
        expect(resolveWeekPosition('first', 12)).toBe(1);
        expect(resolveWeekPosition('first', 8)).toBe(1);
    });

    it('should resolve "last" to total weeks', () => {
        expect(resolveWeekPosition('last', 12)).toBe(12);
        expect(resolveWeekPosition('last', 8)).toBe(8);
    });

    it('should resolve 0% to week 1', () => {
        expect(resolveWeekPosition('0%', 12)).toBe(1);
    });

    it('should resolve 100% to last week', () => {
        expect(resolveWeekPosition('100%', 12)).toBe(12);
        expect(resolveWeekPosition('100%', 9)).toBe(9);
    });

    it('should resolve 50% to middle week', () => {
        expect(resolveWeekPosition('50%', 12)).toBe(7); // 1 + 0.5 * 11 = 6.5 → rounds to 7
        expect(resolveWeekPosition('50%', 9)).toBe(5);  // 1 + 0.5 * 8 = 5
    });

    it('should handle decimal percentages', () => {
        expect(resolveWeekPosition('33.33333%', 12)).toBe(5); // 1 + 0.333 * 11 ≈ 4.67 → rounds to 5
    });

    it('should fallback to 1 for unknown formats', () => {
        expect(resolveWeekPosition('unknown' as any, 12)).toBe(1);
    });
});

// ============================================================================
// interpolateWeeks TESTS
// ============================================================================

describe('interpolateWeeks', () => {
    const createWeekDef = (position: WeekPosition, phaseName: string): WeekDefinition => ({
        position,
        phaseName,
        description: `${phaseName} week`,
        focus: 'Volume',
        powerMultiplier: 1.0,
        workRestRatio: '1:1',
        targetRPE: 7
    });

    it('should return empty map for empty definitions', () => {
        const result = interpolateWeeks([], 12);
        expect(result.size).toBe(0);
    });

    it('should map all weeks to single definition', () => {
        const defs = [createWeekDef('first', 'Build')];
        const result = interpolateWeeks(defs, 8);

        expect(result.size).toBe(8);
        for (let i = 1; i <= 8; i++) {
            expect(result.get(i)?.phaseName).toBe('Build');
        }
    });

    it('should split weeks between two definitions', () => {
        const defs = [
            createWeekDef('first', 'Build'),
            createWeekDef('last', 'Peak')
        ];
        const result = interpolateWeeks(defs, 8);

        // First definition owns weeks 1-7, last owns week 8
        expect(result.get(1)?.phaseName).toBe('Build');
        expect(result.get(7)?.phaseName).toBe('Build');
        expect(result.get(8)?.phaseName).toBe('Peak');
    });

    it('should handle percentage positions', () => {
        const defs = [
            createWeekDef('0%', 'Phase1'),
            createWeekDef('50%', 'Phase2'),
            createWeekDef('100%', 'Phase3')
        ];
        const result = interpolateWeeks(defs, 12);

        expect(result.get(1)?.phaseName).toBe('Phase1');
        expect(result.get(6)?.phaseName).toBe('Phase1'); // Before 50%
        expect(result.get(7)?.phaseName).toBe('Phase2'); // At 50%
        expect(result.get(12)?.phaseName).toBe('Phase3'); // At 100%
    });

    it('should preserve position as week number in result', () => {
        const defs = [createWeekDef('first', 'Build')];
        const result = interpolateWeeks(defs, 4);

        expect(result.get(1)?.position).toBe(1);
        expect(result.get(2)?.position).toBe(2);
        expect(result.get(4)?.position).toBe(4);
    });

    it('should handle 3-week program', () => {
        const defs = [
            createWeekDef('first', 'Intro'),
            createWeekDef('last', 'Outro')
        ];
        const result = interpolateWeeks(defs, 3);

        expect(result.get(1)?.phaseName).toBe('Intro');
        expect(result.get(2)?.phaseName).toBe('Intro');
        expect(result.get(3)?.phaseName).toBe('Outro');
    });
});

// ============================================================================
// interpolateWeekDefinition TESTS
// ============================================================================

describe('interpolateWeekDefinition', () => {
    const prevWeek: WeekDefinition = {
        position: 1,
        phaseName: 'Build',
        description: 'Build week',
        focus: 'Volume',
        powerMultiplier: 0.8,
        targetRPE: 6,
        workRestRatio: '1:1',
        sessionStyle: 'interval',
        durationMinutes: 30
    };

    const nextWeek: WeekDefinition = {
        position: 4,
        phaseName: 'Peak',
        description: 'Peak week',
        focus: 'Intensity',
        powerMultiplier: 1.2,
        targetRPE: 9,
        workRestRatio: '2:1',
        sessionStyle: 'steady-state',
        durationMinutes: 45
    };

    it('should set position to provided week number', () => {
        const result = interpolateWeekDefinition(prevWeek, nextWeek, 0.5, 2);
        expect(result.position).toBe(2);
    });

    it('should use prev values when t < 0.5', () => {
        const result = interpolateWeekDefinition(prevWeek, nextWeek, 0.3, 2);

        expect(result.phaseName).toBe('Build');
        expect(result.focus).toBe('Volume');
        expect(result.workRestRatio).toBe('1:1');
        expect(result.sessionStyle).toBe('interval');
        expect(result.durationMinutes).toBe(30);
    });

    it('should use next values when t >= 0.5', () => {
        const result = interpolateWeekDefinition(prevWeek, nextWeek, 0.7, 3);

        expect(result.phaseName).toBe('Peak');
        expect(result.focus).toBe('Intensity');
        expect(result.workRestRatio).toBe('2:1');
        expect(result.sessionStyle).toBe('steady-state');
        expect(result.durationMinutes).toBe(45);
    });

    it('should linearly interpolate powerMultiplier', () => {
        const result = interpolateWeekDefinition(prevWeek, nextWeek, 0.5, 2);

        // 0.8 + 0.5 * (1.2 - 0.8) = 0.8 + 0.2 = 1.0
        expect(result.powerMultiplier).toBeCloseTo(1.0, 2);
    });

    it('should interpolate and round targetRPE', () => {
        const result = interpolateWeekDefinition(prevWeek, nextWeek, 0.5, 2);

        // 6 + 0.5 * (9 - 6) = 6 + 1.5 = 7.5 → rounds to 8
        expect(result.targetRPE).toBe(8);
    });

    it('should handle t = 0', () => {
        const result = interpolateWeekDefinition(prevWeek, nextWeek, 0, 1);

        expect(result.powerMultiplier).toBe(0.8);
        expect(result.targetRPE).toBe(6);
        expect(result.phaseName).toBe('Build');
    });

    it('should handle t = 1', () => {
        const result = interpolateWeekDefinition(prevWeek, nextWeek, 1, 4);

        expect(result.powerMultiplier).toBeCloseTo(1.2, 2);
        expect(result.targetRPE).toBe(9);
        expect(result.phaseName).toBe('Peak');
    });
});
