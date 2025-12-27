/**
 * Unit tests for dateUtils - timezone-agnostic date utilities.
 */

import { describe, it, expect } from 'vitest';
import {
    getLocalDateString,
    parseLocalDate,
    getDaysBetween,
    addDays,
    compareDates,
    isDateInRange,
    isBefore,
    isAfter,
    isOnOrBefore,
    isOnOrAfter,
    formatDateShort,
    getWeekNumber,
    getDayIndex
} from './dateUtils';

describe('dateUtils', () => {
    describe('getLocalDateString', () => {
        it('should format a date as YYYY-MM-DD', () => {
            const date = new Date(2024, 0, 15); // Jan 15, 2024
            expect(getLocalDateString(date)).toBe('2024-01-15');
        });

        it('should pad single-digit months and days', () => {
            const date = new Date(2024, 2, 5); // Mar 5, 2024
            expect(getLocalDateString(date)).toBe('2024-03-05');
        });

        it('should handle December correctly', () => {
            const date = new Date(2024, 11, 31); // Dec 31, 2024
            expect(getLocalDateString(date)).toBe('2024-12-31');
        });

        it('should use current date by default', () => {
            const result = getLocalDateString();
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('parseLocalDate', () => {
        it('should parse YYYY-MM-DD to local midnight', () => {
            const date = parseLocalDate('2024-01-15');
            expect(date.getFullYear()).toBe(2024);
            expect(date.getMonth()).toBe(0); // January
            expect(date.getDate()).toBe(15);
            expect(date.getHours()).toBe(0);
            expect(date.getMinutes()).toBe(0);
            expect(date.getSeconds()).toBe(0);
        });

        it('should roundtrip with getLocalDateString', () => {
            const original = '2024-06-20';
            const parsed = parseLocalDate(original);
            const formatted = getLocalDateString(parsed);
            expect(formatted).toBe(original);
        });
    });

    describe('getDaysBetween', () => {
        it('should return 0 for same date', () => {
            expect(getDaysBetween('2024-01-15', '2024-01-15')).toBe(0);
        });

        it('should return positive for later date', () => {
            expect(getDaysBetween('2024-01-15', '2024-01-20')).toBe(5);
        });

        it('should return negative for earlier date', () => {
            expect(getDaysBetween('2024-01-20', '2024-01-15')).toBe(-5);
        });

        it('should handle month boundaries', () => {
            expect(getDaysBetween('2024-01-30', '2024-02-02')).toBe(3);
        });

        it('should handle year boundaries', () => {
            expect(getDaysBetween('2023-12-30', '2024-01-02')).toBe(3);
        });

        it('should handle leap years', () => {
            expect(getDaysBetween('2024-02-28', '2024-03-01')).toBe(2); // 2024 is leap year
            expect(getDaysBetween('2023-02-28', '2023-03-01')).toBe(1); // 2023 is not
        });
    });

    describe('addDays', () => {
        it('should add positive days', () => {
            expect(addDays('2024-01-15', 5)).toBe('2024-01-20');
        });

        it('should subtract with negative days', () => {
            expect(addDays('2024-01-15', -5)).toBe('2024-01-10');
        });

        it('should handle month overflow', () => {
            expect(addDays('2024-01-30', 5)).toBe('2024-02-04');
        });

        it('should handle year overflow', () => {
            expect(addDays('2024-12-30', 5)).toBe('2025-01-04');
        });

        it('should handle adding 0 days', () => {
            expect(addDays('2024-01-15', 0)).toBe('2024-01-15');
        });
    });

    describe('compareDates', () => {
        it('should return -1 when first date is earlier', () => {
            expect(compareDates('2024-01-15', '2024-01-20')).toBe(-1);
        });

        it('should return 1 when first date is later', () => {
            expect(compareDates('2024-01-20', '2024-01-15')).toBe(1);
        });

        it('should return 0 when dates are equal', () => {
            expect(compareDates('2024-01-15', '2024-01-15')).toBe(0);
        });
    });

    describe('isDateInRange', () => {
        it('should return true for date within range', () => {
            expect(isDateInRange('2024-01-15', '2024-01-10', '2024-01-20')).toBe(true);
        });

        it('should return true for date at start of range', () => {
            expect(isDateInRange('2024-01-10', '2024-01-10', '2024-01-20')).toBe(true);
        });

        it('should return true for date at end of range', () => {
            expect(isDateInRange('2024-01-20', '2024-01-10', '2024-01-20')).toBe(true);
        });

        it('should return false for date before range', () => {
            expect(isDateInRange('2024-01-05', '2024-01-10', '2024-01-20')).toBe(false);
        });

        it('should return false for date after range', () => {
            expect(isDateInRange('2024-01-25', '2024-01-10', '2024-01-20')).toBe(false);
        });
    });

    describe('isBefore / isAfter / isOnOrBefore / isOnOrAfter', () => {
        it('isBefore should work correctly', () => {
            expect(isBefore('2024-01-15', '2024-01-20')).toBe(true);
            expect(isBefore('2024-01-20', '2024-01-15')).toBe(false);
            expect(isBefore('2024-01-15', '2024-01-15')).toBe(false);
        });

        it('isAfter should work correctly', () => {
            expect(isAfter('2024-01-20', '2024-01-15')).toBe(true);
            expect(isAfter('2024-01-15', '2024-01-20')).toBe(false);
            expect(isAfter('2024-01-15', '2024-01-15')).toBe(false);
        });

        it('isOnOrBefore should work correctly', () => {
            expect(isOnOrBefore('2024-01-15', '2024-01-20')).toBe(true);
            expect(isOnOrBefore('2024-01-15', '2024-01-15')).toBe(true);
            expect(isOnOrBefore('2024-01-20', '2024-01-15')).toBe(false);
        });

        it('isOnOrAfter should work correctly', () => {
            expect(isOnOrAfter('2024-01-20', '2024-01-15')).toBe(true);
            expect(isOnOrAfter('2024-01-15', '2024-01-15')).toBe(true);
            expect(isOnOrAfter('2024-01-15', '2024-01-20')).toBe(false);
        });
    });

    describe('formatDateShort', () => {
        it('should format as "day/Mo"', () => {
            expect(formatDateShort('2024-01-15')).toBe('15/Ja');
            expect(formatDateShort('2024-06-05')).toBe('5/Ju');
            expect(formatDateShort('2024-12-25')).toBe('25/De');
        });
    });

    describe('getWeekNumber', () => {
        it('should return 1 for start date', () => {
            expect(getWeekNumber('2024-01-01', '2024-01-01')).toBe(1);
        });

        it('should return 1 for days 0-6', () => {
            expect(getWeekNumber('2024-01-01', '2024-01-01')).toBe(1);
            expect(getWeekNumber('2024-01-07', '2024-01-01')).toBe(1);
        });

        it('should return 2 for days 7-13', () => {
            expect(getWeekNumber('2024-01-08', '2024-01-01')).toBe(2);
            expect(getWeekNumber('2024-01-14', '2024-01-01')).toBe(2);
        });

        it('should return 0 for dates before start', () => {
            expect(getWeekNumber('2023-12-31', '2024-01-01')).toBe(0);
        });

        it('should handle multi-week spans', () => {
            expect(getWeekNumber('2024-01-15', '2024-01-01')).toBe(3);
            expect(getWeekNumber('2024-01-22', '2024-01-01')).toBe(4);
        });
    });

    describe('getDayIndex', () => {
        it('should return 0 for start date', () => {
            expect(getDayIndex('2024-01-01', '2024-01-01')).toBe(0);
        });

        it('should return positive for later dates', () => {
            expect(getDayIndex('2024-01-05', '2024-01-01')).toBe(4);
        });

        it('should return negative for earlier dates', () => {
            expect(getDayIndex('2023-12-30', '2024-01-01')).toBe(-2);
        });
    });

    describe('timezone-agnostic behavior', () => {
        it('should not shift dates regardless of time component', () => {
            // Create a date at 11:59 PM
            const lateNight = new Date(2024, 0, 15, 23, 59, 59);
            expect(getLocalDateString(lateNight)).toBe('2024-01-15');

            // Create a date at 12:01 AM
            const earlyMorning = new Date(2024, 0, 15, 0, 1, 0);
            expect(getLocalDateString(earlyMorning)).toBe('2024-01-15');
        });

        it('should produce consistent results for date strings', () => {
            // The key test: parsing and re-formatting should be idempotent
            const dates = ['2024-01-01', '2024-06-15', '2024-12-31'];
            for (const dateStr of dates) {
                const parsed = parseLocalDate(dateStr);
                const formatted = getLocalDateString(parsed);
                expect(formatted).toBe(dateStr);
            }
        });
    });
});
