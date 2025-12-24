/**
 * Unit tests for DevTools Utilities
 */

import { describe, it, expect } from 'vitest';
import {
    formatNotificationEntry,
    getNotificationBadgeColor,
    getWeekNumber,
    formatDisplayDate,
    hexToRgb,
    rgbToHsl,
    randomVariance,
    randomRPE,
} from './devToolsUtils';

describe('DevTools Utilities', () => {
    describe('formatNotificationEntry', () => {
        it('should format entry with type and time', () => {
            const entry = { type: 'info', time: 1703433600000 };
            const result = formatNotificationEntry(entry);
            expect(result).toContain('[');
            expect(result).toContain(']');
            expect(result).toContain('info');
        });

        it('should include message when present', () => {
            const entry = { type: 'error', time: Date.now(), message: 'Test error' };
            const result = formatNotificationEntry(entry);
            expect(result).toContain('Test error');
        });
    });

    describe('getNotificationBadgeColor', () => {
        it('should return red colors for error type', () => {
            const result = getNotificationBadgeColor('error');
            expect(result.bg).toContain('red');
            expect(result.text).toContain('red');
        });

        it('should return yellow colors for warning type', () => {
            const result = getNotificationBadgeColor('warning');
            expect(result.bg).toContain('yellow');
            expect(result.text).toContain('yellow');
        });

        it('should return green colors for success type', () => {
            const result = getNotificationBadgeColor('success');
            expect(result.bg).toContain('green');
            expect(result.text).toContain('green');
        });

        it('should return blue colors for default type', () => {
            const result = getNotificationBadgeColor('info');
            expect(result.bg).toContain('blue');
            expect(result.text).toContain('blue');
        });
    });

    describe('getWeekNumber', () => {
        it('should return 1 for same day', () => {
            const result = getWeekNumber('2024-01-01', '2024-01-01');
            expect(result).toBe(1);
        });

        it('should return 2 for day 7', () => {
            const result = getWeekNumber('2024-01-08', '2024-01-01');
            expect(result).toBe(2);
        });

        it('should return correct week for day 14', () => {
            const result = getWeekNumber('2024-01-15', '2024-01-01');
            expect(result).toBe(3);
        });
    });

    describe('formatDisplayDate', () => {
        it('should format date in readable format', () => {
            const result = formatDisplayDate('2024-01-15');
            // Just verify it produces a readable date string (month/day/year in some format)
            expect(result).toMatch(/\w+/); // Contains word characters
            expect(result).toMatch(/\d/); // Contains digits
        });
    });

    describe('hexToRgb', () => {
        it('should parse valid hex color', () => {
            const result = hexToRgb('#ff5500');
            expect(result).toEqual({ r: 255, g: 85, b: 0 });
        });

        it('should handle hex without #', () => {
            const result = hexToRgb('34d399');
            expect(result).toEqual({ r: 52, g: 211, b: 153 });
        });

        it('should return null for invalid hex', () => {
            const result = hexToRgb('invalid');
            expect(result).toBeNull();
        });
    });

    describe('rgbToHsl', () => {
        it('should convert pure red', () => {
            const result = rgbToHsl(255, 0, 0);
            expect(result.h).toBe(0);
            expect(result.s).toBe(100);
            expect(result.l).toBe(50);
        });

        it('should convert pure green', () => {
            const result = rgbToHsl(0, 255, 0);
            expect(result.h).toBe(120);
            expect(result.s).toBe(100);
            expect(result.l).toBe(50);
        });

        it('should convert white', () => {
            const result = rgbToHsl(255, 255, 255);
            expect(result.h).toBe(0);
            expect(result.s).toBe(0);
            expect(result.l).toBe(100);
        });
    });

    describe('randomVariance', () => {
        it('should return value within variance range', () => {
            const base = 100;
            const variance = 0.1;
            const results = Array.from({ length: 100 }, () => randomVariance(base, variance));

            results.forEach(result => {
                expect(result).toBeGreaterThanOrEqual(base * 0.9);
                expect(result).toBeLessThanOrEqual(base * 1.1);
            });
        });
    });

    describe('randomRPE', () => {
        it('should return value within 1-10 bounds', () => {
            const results = Array.from({ length: 100 }, () => randomRPE(5, 3));

            results.forEach(result => {
                expect(result).toBeGreaterThanOrEqual(1);
                expect(result).toBeLessThanOrEqual(10);
            });
        });

        it('should clamp high values to 10', () => {
            // Target 12 should always return <= 10
            const results = Array.from({ length: 20 }, () => randomRPE(12, 0));
            results.forEach(result => {
                expect(result).toBeLessThanOrEqual(10);
            });
        });
    });
});
