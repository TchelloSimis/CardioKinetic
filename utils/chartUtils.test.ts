/**
 * Unit tests for Chart Utilities
 * 
 * Tests for program date calculations and incomplete program handling.
 */

import { describe, it, expect } from 'vitest';
import {
    getWeekNumber,
    getProgramEndDate,
    getMaxProgramWeek,
    isSessionInProgramRange,
    isDateInProgramRange
} from './chartUtils';
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
            const result = getProgramEndDate(program);
            expect(result.toISOString().split('T')[0]).toBe('2024-02-15');
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
            const result = getProgramEndDate(program);
            // 8 weeks = 56 days, but -1 for inclusive end = day 55
            const expected = new Date('2024-01-01');
            expected.setDate(expected.getDate() + (8 * 7) - 1);
            expect(result.toISOString().split('T')[0]).toBe(expected.toISOString().split('T')[0]);
        });

        it('should default to 12 weeks if plan is missing', () => {
            const program = createMockProgram({
                status: 'active',
                plan: []
            });
            const result = getProgramEndDate(program);
            const expected = new Date('2024-01-01');
            expected.setDate(expected.getDate() + (12 * 7) - 1);
            expect(result.toISOString().split('T')[0]).toBe(expected.toISOString().split('T')[0]);
        });

        it('should ignore endDate for active programs', () => {
            const program = createMockProgram({
                status: 'active',
                endDate: '2024-02-15' // Should be ignored
            });
            const result = getProgramEndDate(program);
            // Use plan length (12 weeks)
            const expected = new Date('2024-01-01');
            expected.setDate(expected.getDate() + (12 * 7) - 1);
            expect(result.toISOString().split('T')[0]).toBe(expected.toISOString().split('T')[0]);
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
            const sessionDate = new Date('2024-01-01');
            expect(isSessionInProgramRange(sessionDate, program)).toBe(true);
        });

        it('should return true for session on end date of completed program', () => {
            const program = createMockProgram({
                status: 'completed',
                startDate: '2024-01-01',
                endDate: '2024-01-28'
            });
            const sessionDate = new Date('2024-01-28');
            expect(isSessionInProgramRange(sessionDate, program)).toBe(true);
        });

        it('should return false for session before program start', () => {
            const program = createMockProgram({ startDate: '2024-01-01' });
            const sessionDate = new Date('2023-12-31');
            expect(isSessionInProgramRange(sessionDate, program)).toBe(false);
        });

        it('should return false for session after completed program end', () => {
            const program = createMockProgram({
                status: 'completed',
                startDate: '2024-01-01',
                endDate: '2024-01-28'
            });
            const sessionDate = new Date('2024-01-29');
            expect(isSessionInProgramRange(sessionDate, program)).toBe(false);
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
            const sessionDate = new Date('2024-01-25');
            expect(isSessionInProgramRange(sessionDate, program)).toBe(true);
        });
    });

    describe('isDateInProgramRange', () => {
        it('should return true for date on start date', () => {
            const program = createMockProgram({ startDate: '2024-01-01' });
            const date = new Date('2024-01-01');
            expect(isDateInProgramRange(date, program)).toBe(true);
        });

        it('should return true for date on end date of completed program', () => {
            const program = createMockProgram({
                status: 'completed',
                startDate: '2024-01-01',
                endDate: '2024-01-28'
            });
            const date = new Date('2024-01-28');
            expect(isDateInProgramRange(date, program)).toBe(true);
        });

        it('should return false for date after completed program end', () => {
            const program = createMockProgram({
                status: 'completed',
                startDate: '2024-01-01',
                endDate: '2024-01-28'
            });
            const date = new Date('2024-01-29');
            expect(isDateInProgramRange(date, program)).toBe(false);
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
            const week5Date = new Date('2024-02-01');
            expect(isDateInProgramRange(week5Date, program)).toBe(false);

            // Week 4 (last completed week) should be in range
            const week4Date = new Date('2024-01-25');
            expect(isDateInProgramRange(week4Date, program)).toBe(true);
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
            const endDate = getProgramEndDate(program);
            expect(endDate.toISOString().split('T')[0]).toBe('2024-01-28');

            // Verify week 5 dates are out of range
            expect(isDateInProgramRange(new Date('2024-01-29'), program)).toBe(false);
            expect(isDateInProgramRange(new Date('2024-02-01'), program)).toBe(false);

            // Verify week 4 dates are still in range
            expect(isDateInProgramRange(new Date('2024-01-22'), program)).toBe(true);
            expect(isDateInProgramRange(new Date('2024-01-28'), program)).toBe(true);
        });
    });
});
