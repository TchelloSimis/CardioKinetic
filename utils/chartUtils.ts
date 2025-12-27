/**
 * Chart Utilities
 * 
 * Utility functions for chart timeline and program calculations.
 * Extracted for testability.
 */

import { ProgramRecord } from '../types';

/**
 * Calculate week number from a date string and start date string.
 * Returns 1-indexed week number (Week 1 is the first week).
 * Returns 0 for dates before the start date.
 */
export const getWeekNumber = (dateStr: string, startStr: string): number => {
    const d = new Date(dateStr);
    const s = new Date(startStr);
    d.setHours(0, 0, 0, 0);
    s.setHours(0, 0, 0, 0);
    const diffTime = d.getTime() - s.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 0;
    return Math.floor(diffDays / 7) + 1;
};

/**
 * Get the actual end date for a program.
 * For completed programs, uses endDate. For active programs, uses plan length.
 * The returned date is the LAST day of the program (inclusive).
 */
export const getProgramEndDate = (program: ProgramRecord): Date => {
    if (program.status === 'completed' && program.endDate) {
        return new Date(program.endDate);
    }
    // For active programs, use plan length
    const programWeeks = program.plan?.length || 12;
    const end = new Date(program.startDate);
    end.setDate(end.getDate() + (programWeeks * 7) - 1);
    return end;
};

/**
 * Get the maximum week number for a program.
 * For completed programs, calculates from endDate. For active, uses plan length.
 */
export const getMaxProgramWeek = (program: ProgramRecord): number => {
    if (program.status === 'completed' && program.endDate) {
        const start = new Date(program.startDate);
        const end = new Date(program.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(1, Math.ceil(diffDays / 7));
    }
    return program.plan?.length || 12;
};

/**
 * Check if a session date falls within a program's active range.
 * Respects endDate for completed programs.
 */
export const isSessionInProgramRange = (
    sessionDate: Date,
    program: ProgramRecord
): boolean => {
    const startDate = new Date(program.startDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = getProgramEndDate(program);
    endDate.setHours(0, 0, 0, 0);
    // Add 1 day to include sessions on end date
    endDate.setDate(endDate.getDate() + 1);

    const session = new Date(sessionDate);
    session.setHours(0, 0, 0, 0);

    return session >= startDate && session < endDate;
};

/**
 * Check if a specific date is within a program's active range.
 * Used for determining which program's plan to show for a given day.
 */
export const isDateInProgramRange = (
    date: Date,
    program: ProgramRecord
): boolean => {
    const pStart = new Date(program.startDate);
    pStart.setHours(0, 0, 0, 0);

    const pEnd = getProgramEndDate(program);
    pEnd.setHours(0, 0, 0, 0);
    // Add 1 day to include the end date
    pEnd.setDate(pEnd.getDate() + 1);

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    return checkDate >= pStart && checkDate < pEnd;
};
