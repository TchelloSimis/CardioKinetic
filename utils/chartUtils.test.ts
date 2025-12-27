/**
 * Unit tests for Chart Utilities
 * 
 * Tests for program date calculations and incomplete program handling.
 */

import { describe, it, expect } from 'vitest';
import {
    getWeekNumber,
    getProgramEndDate,
    getProgramEndDateStr,
    getMaxProgramWeek,
    isSessionInProgramRange,
    isSessionInProgramRangeStr,
    isDateInProgramRange,
    isDateInProgramRangeStr,
    sanitizeDescription
} from './chartUtils';
import { getLocalDateString } from './dateUtils';
import { ProgramRecord, PlanWeek } from '../types';


// Helper to create a mock program
const createMockProgram = (overrides: Partial<ProgramRecord> = {}): ProgramRecord => ({
    id: 'prog-1',
    presetId: 'preset-1',
    name: 'Test Program',
    startDate: '2024-01-01',
    status: 'active',
    basePower: 150,
    plan: Array.from({ length: 12 }, (_, i) => ({
        week: i + 1,
        phaseName: 'Build',
        focus: 'Volume' as const,
        workRestRatio: '1:1',
        targetRPE: 7,
        plannedPower: 150 + i * 5,
        description: `Week ${i + 1}`
    })),
    ...overrides
});

describe('Chart Utilities', () => {
    describe('getWeekNumber', () => {
        it('should return 1 for same day as start', () => {
            expect(getWeekNumber('2024-01-01', '2024-01-01')).toBe(1);
        });

        it('should return 1 for day 6 (still in first week)', () => {
            expect(getWeekNumber('2024-01-07', '2024-01-01')).toBe(1);
        });

        it('should return 2 for day 7 (start of second week)', () => {
            expect(getWeekNumber('2024-01-08', '2024-01-01')).toBe(2);
        });

        it('should return 3 for day 14-20', () => {
            expect(getWeekNumber('2024-01-15', '2024-01-01')).toBe(3);
        });

        it('should return 0 for dates before program start', () => {
            expect(getWeekNumber('2023-12-31', '2024-01-01')).toBe(0);
        });

        it('should handle multiple weeks correctly', () => {
            expect(getWeekNumber('2024-03-01', '2024-01-01')).toBe(9);
        });
    });

    describe('getProgramEndDate', () => {
        it('should return endDate for completed programs', () => {
            const program = createMockProgram({
                status: 'completed',
                endDate: '2024-02-15'
            });
            const result = getProgramEndDateStr(program);
            expect(result).toBe('2024-02-15');
        });

        it('should use plan length for active programs', () => {
            const program = createMockProgram({
                status: 'active',
                plan: Array.from({ length: 8 }, (_, i) => ({
                    week: i + 1,
                    phaseName: 'Build',
                    focus: 'Volume' as const,
                    workRestRatio: '1:1',
                    targetRPE: 7,
                    plannedPower: 150,
                    description: `Week ${i + 1}`
                }))
            });
            const result = getProgramEndDateStr(program);
            // 8 weeks = 56 days, but -1 for inclusive end = day 55 = Feb 25
            // Jan has 31 days, so 31 + 24 = Feb 25
            expect(result).toBe('2024-02-25');
        });

        it('should default to 12 weeks if plan is missing', () => {
            const program = createMockProgram({
                status: 'active',
                plan: []
            });
            const result = getProgramEndDateStr(program);
            // 12 weeks = 84 days, but -1 = 83 = Mar 24
            expect(result).toBe('2024-03-24');
        });

        it('should ignore endDate for active programs', () => {
            const program = createMockProgram({
                status: 'active',
                endDate: '2024-02-15' // Should be ignored
            });
            const result = getProgramEndDateStr(program);
            // 12 weeks from Jan 1 = Mar 24
            expect(result).toBe('2024-03-24');
        });
    });

    describe('getMaxProgramWeek', () => {
        it('should return plan length for active programs', () => {
            const program = createMockProgram({ status: 'active' });
            expect(getMaxProgramWeek(program)).toBe(12);
        });

        it('should calculate weeks from endDate for completed programs', () => {
            const program = createMockProgram({
                status: 'completed',
                startDate: '2024-01-01',
                endDate: '2024-01-28' // 28 days = 4 weeks
            });
            expect(getMaxProgramWeek(program)).toBe(4);
        });

        it('should handle partial week completion', () => {
            const program = createMockProgram({
                status: 'completed',
                startDate: '2024-01-01',
                endDate: '2024-01-10' // 10 days = partial week 2
            });
            // ceil(10/7) = 2 weeks
            expect(getMaxProgramWeek(program)).toBe(2);
        });

        it('should handle same-day completion (minimum 1 week)', () => {
            const program = createMockProgram({
                status: 'completed',
                startDate: '2024-01-01',
                endDate: '2024-01-01' // Same day
            });
            // 0 days but minimum is 1 week
            expect(getMaxProgramWeek(program)).toBe(1);
        });

        it('should return 12 if plan is empty', () => {
            const program = createMockProgram({
                status: 'active',
                plan: []
            });
            expect(getMaxProgramWeek(program)).toBe(12);
        });
    });

    describe('isSessionInProgramRange', () => {
        it('should return true for session on start date', () => {
            const program = createMockProgram({ startDate: '2024-01-01' });
            expect(isSessionInProgramRangeStr('2024-01-01', program)).toBe(true);
        });

        it('should return true for session on end date of completed program', () => {
            const program = createMockProgram({
                status: 'completed',
                startDate: '2024-01-01',
                endDate: '2024-01-28'
            });
            expect(isSessionInProgramRangeStr('2024-01-28', program)).toBe(true);
        });

        it('should return false for session before program start', () => {
            const program = createMockProgram({ startDate: '2024-01-01' });
            expect(isSessionInProgramRangeStr('2023-12-31', program)).toBe(false);
        });

        it('should return false for session after completed program end', () => {
            const program = createMockProgram({
                status: 'completed',
                startDate: '2024-01-01',
                endDate: '2024-01-28'
            });
            expect(isSessionInProgramRangeStr('2024-01-29', program)).toBe(false);
        });

        it('should allow sessions during active program plan', () => {
            const program = createMockProgram({
                status: 'active',
                startDate: '2024-01-01',
                plan: Array.from({ length: 8 }, (_, i) => ({
                    week: i + 1,
                    phaseName: 'Build',
                    focus: 'Volume' as const,
                    workRestRatio: '1:1',
                    targetRPE: 7,
                    plannedPower: 150,
                    description: `Week ${i + 1}`
                }))
            });
            // Week 4 = days 21-27
            expect(isSessionInProgramRangeStr('2024-01-25', program)).toBe(true);
        });
    });

    describe('isDateInProgramRange', () => {
        it('should return true for date on start date', () => {
            const program = createMockProgram({ startDate: '2024-01-01' });
            expect(isDateInProgramRangeStr('2024-01-01', program)).toBe(true);
        });

        it('should return true for date on end date of completed program', () => {
            const program = createMockProgram({
                status: 'completed',
                startDate: '2024-01-01',
                endDate: '2024-01-28'
            });
            expect(isDateInProgramRangeStr('2024-01-28', program)).toBe(true);
        });

        it('should return false for date after completed program end', () => {
            const program = createMockProgram({
                status: 'completed',
                startDate: '2024-01-01',
                endDate: '2024-01-28'
            });
            expect(isDateInProgramRangeStr('2024-01-29', program)).toBe(false);
        });

        it('should not show planned data for weeks after endDate', () => {
            // This tests the core bug fix - completed programs should not show
            // planned data for weeks that were never executed
            const program = createMockProgram({
                status: 'completed',
                startDate: '2024-01-01',
                endDate: '2024-01-28', // 4 weeks
                plan: Array.from({ length: 12 }, (_, i) => ({
                    week: i + 1,
                    phaseName: 'Build',
                    focus: 'Volume' as const,
                    workRestRatio: '1:1',
                    targetRPE: 7,
                    plannedPower: 150,
                    description: `Week ${i + 1}`
                }))
            });

            // Week 5 should NOT be in range
            expect(isDateInProgramRangeStr('2024-02-01', program)).toBe(false);

            // Week 4 (last completed week) should be in range
            expect(isDateInProgramRangeStr('2024-01-25', program)).toBe(true);
        });
    });

    describe('integration: incomplete program handling', () => {
        it('should correctly handle a program finished at week 4 of 12', () => {
            const program = createMockProgram({
                status: 'completed',
                startDate: '2024-01-01',
                endDate: '2024-01-28', // End of week 4
                plan: Array.from({ length: 12 }, (_, i) => ({
                    week: i + 1,
                    phaseName: i < 4 ? 'Base' : i < 8 ? 'Build' : 'Peak',
                    focus: 'Volume' as const,
                    workRestRatio: '1:1',
                    targetRPE: 7,
                    plannedPower: 150 + i * 5,
                    description: `Week ${i + 1}`
                }))
            });

            // Verify max week is 4, not 12
            expect(getMaxProgramWeek(program)).toBe(4);

            // Verify endDate is respected
            const endDateStr = getProgramEndDateStr(program);
            expect(endDateStr).toBe('2024-01-28');

            // Verify week 5 dates are out of range
            expect(isDateInProgramRangeStr('2024-01-29', program)).toBe(false);
            expect(isDateInProgramRangeStr('2024-02-01', program)).toBe(false);

            // Verify week 4 dates are still in range
            expect(isDateInProgramRangeStr('2024-01-22', program)).toBe(true);
            expect(isDateInProgramRangeStr('2024-01-28', program)).toBe(true);
        });
    });

    describe('sanitizeDescription', () => {
        it('should return empty string for undefined', () => {
            expect(sanitizeDescription(undefined)).toBe('');
        });

        it('should return empty string for empty string', () => {
            expect(sanitizeDescription('')).toBe('');
        });

        it('should return unchanged string with no placeholders', () => {
            expect(sanitizeDescription('Week 1 of 4 in Build block')).toBe('Week 1 of 4 in Build block');
        });

        it('should remove /{weekCount} pattern', () => {
            expect(sanitizeDescription('Week 1/{weekCount}')).toBe('Week 1');
        });

        it('should remove standalone {weekCount} pattern', () => {
            expect(sanitizeDescription('Week 1 of {weekCount}')).toBe('Week 1 of');
        });

        it('should remove {weekInBlock} pattern', () => {
            expect(sanitizeDescription('Week {weekInBlock}/4')).toBe('Week /4');
        });

        it('should remove {blockName} pattern', () => {
            expect(sanitizeDescription('Building {blockName} block')).toBe('Building block');
        });

        it('should handle multiple placeholders', () => {
            expect(sanitizeDescription('Week {weekInBlock}/{weekCount} of {blockName}')).toBe('Week of');
        });

        it('should clean up multiple spaces', () => {
            expect(sanitizeDescription('Week  1  of  4')).toBe('Week 1 of 4');
        });

        it('should trim whitespace', () => {
            expect(sanitizeDescription('  Week 1  ')).toBe('Week 1');
        });

        it('should handle complex case from block templates', () => {
            // This is the actual case from the bug: "Week 1/{weekCount}"
            const input = 'Week 1/{weekCount}';
            const result = sanitizeDescription(input);
            expect(result).toBe('Week 1');
            expect(result).not.toContain('{');
            expect(result).not.toContain('}');
        });
    });
});
