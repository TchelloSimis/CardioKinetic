/**
 * Chart Utilities
 * 
 * Utility functions for chart timeline and program calculations.
 * Extracted for testability.
 * 
 * All date operations use timezone-agnostic utilities from dateUtils.ts.
 */

import { ProgramRecord } from '../types';
import {
    getWeekNumber as getWeekNumberUtil,
    getDaysBetween,
    addDays,
    isDateInRange,
    getLocalDateString,
    parseLocalDate
} from './dateUtils';

// Re-export getWeekNumber from dateUtils for backward compatibility
export { getWeekNumber } from './dateUtils';

/**
 * Get the actual end date for a program as a YYYY-MM-DD string.
 * For completed programs, uses endDate. For active programs, uses plan length.
 * The returned date is the LAST day of the program (inclusive).
 */
export const getProgramEndDateStr = (program: ProgramRecord): string => {
    if (program.status === 'completed' && program.endDate) {
        return program.endDate;
    }
    // For active programs, use plan length
    const programWeeks = program.plan?.length || 12;
    // End date is (weeks * 7) - 1 days after start
    return addDays(program.startDate, (programWeeks * 7) - 1);
};

/**
 * Get the actual end date for a program.
 * For completed programs, uses endDate. For active programs, uses plan length.
 * The returned date is the LAST day of the program (inclusive).
 * 
 * @deprecated Use getProgramEndDateStr() for string-based operations
 */
export const getProgramEndDate = (program: ProgramRecord): Date => {
    return parseLocalDate(getProgramEndDateStr(program));
};

/**
 * Get the maximum week number for a program.
 * For completed programs, calculates from endDate. For active, uses plan length.
 */
export const getMaxProgramWeek = (program: ProgramRecord): number => {
    if (program.status === 'completed' && program.endDate) {
        const diffDays = getDaysBetween(program.startDate, program.endDate);
        return Math.max(1, Math.ceil(diffDays / 7));
    }
    return program.plan?.length || 12;
};

/**
 * Check if a session date (as string) falls within a program's active range.
 * Respects endDate for completed programs.
 * 
 * @param sessionDateStr - Session date as YYYY-MM-DD string
 * @param program - The program to check against
 */
export const isSessionInProgramRangeStr = (
    sessionDateStr: string,
    program: ProgramRecord
): boolean => {
    const endDateStr = getProgramEndDateStr(program);
    return isDateInRange(sessionDateStr, program.startDate, endDateStr);
};

/**
 * Check if a session date falls within a program's active range.
 * Respects endDate for completed programs.
 * 
 * @deprecated Use isSessionInProgramRangeStr() for string-based operations
 */
export const isSessionInProgramRange = (
    sessionDate: Date,
    program: ProgramRecord
): boolean => {
    const sessionDateStr = getLocalDateString(sessionDate);
    return isSessionInProgramRangeStr(sessionDateStr, program);
};

/**
 * Check if a specific date (as string) is within a program's active range.
 * Used for determining which program's plan to show for a given day.
 * 
 * @param dateStr - Date as YYYY-MM-DD string
 * @param program - The program to check against
 */
export const isDateInProgramRangeStr = (
    dateStr: string,
    program: ProgramRecord
): boolean => {
    const endDateStr = getProgramEndDateStr(program);
    return isDateInRange(dateStr, program.startDate, endDateStr);
};

/**
 * Check if a specific date is within a program's active range.
 * Used for determining which program's plan to show for a given day.
 * 
 * @deprecated Use isDateInProgramRangeStr() for string-based operations
 */
export const isDateInProgramRange = (
    date: Date,
    program: ProgramRecord
): boolean => {
    const dateStr = getLocalDateString(date);
    return isDateInProgramRangeStr(dateStr, program);
};

/**
 * Sanitize a week description by removing unresolved placeholders.
 * Handles legacy data that may have {weekInBlock}, {weekCount}, {blockName} remaining.
 * Removes "/{placeholder}" patterns and standalone "{placeholder}" patterns.
 */
export const sanitizeDescription = (description: string | undefined): string => {
    if (!description) return '';

    // Remove patterns like "/{weekCount}" or "/{blockName}" (slash followed by placeholder)
    let sanitized = description.replace(/\/\{[a-zA-Z]+\}/g, '');

    // Remove standalone placeholders like "{weekCount}" or "{blockName}"
    sanitized = sanitized.replace(/\{[a-zA-Z]+\}/g, '');

    // Clean up any double spaces or trailing "Week X/" patterns
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
};
