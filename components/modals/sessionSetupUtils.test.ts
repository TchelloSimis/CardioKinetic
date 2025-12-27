/**
 * Unit tests for sessionSetupUtils.ts
 * 
 * Tests session setup helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
    parseRatio,
    roundTo5,
    gcd,
    interpolateColor,
    isLightColor,
    adjustWorkRestPair,
    formatDuration,
    getRPEColor,
    RPE_DESCRIPTIONS,
    DEFAULT_WORK_LIGHT,
    DEFAULT_WORK_DARK,
    DEFAULT_REST_LIGHT,
    DEFAULT_REST_DARK
} from './sessionSetupUtils';

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('Constants', () => {
    it('should export RPE_DESCRIPTIONS for all RPE values 1-10', () => {
        for (let i = 1; i <= 10; i++) {
            expect(RPE_DESCRIPTIONS[i]).toBeDefined();
            expect(typeof RPE_DESCRIPTIONS[i]).toBe('string');
        }
    });

    it('should export default color constants', () => {
        expect(DEFAULT_WORK_LIGHT).toMatch(/^#[0-9a-f]{6}$/i);
        expect(DEFAULT_WORK_DARK).toMatch(/^#[0-9a-f]{6}$/i);
        expect(DEFAULT_REST_LIGHT).toMatch(/^#[0-9a-f]{6}$/i);
        expect(DEFAULT_REST_DARK).toMatch(/^#[0-9a-f]{6}$/i);
    });
});

// ============================================================================
// parseRatio TESTS
// ============================================================================

describe('parseRatio', () => {
    it('should parse "1:1" ratio', () => {
        const result = parseRatio('1:1');
        expect(result.work).toBe(1);
        expect(result.rest).toBe(1);
    });

    it('should parse "2:1" ratio', () => {
        const result = parseRatio('2:1');
        expect(result.work).toBe(2);
        expect(result.rest).toBe(1);
    });

    it('should parse "1:2" ratio', () => {
        const result = parseRatio('1:2');
        expect(result.work).toBe(1);
        expect(result.rest).toBe(2);
    });

    it('should parse "3:2" ratio', () => {
        const result = parseRatio('3:2');
        expect(result.work).toBe(3);
        expect(result.rest).toBe(2);
    });

    it('should default to 1:1 for invalid input', () => {
        const result = parseRatio('invalid');
        expect(result.work).toBe(1);
        expect(result.rest).toBe(1);
    });

    it('should return { work: 1, rest: 0 } for "steady"', () => {
        const result = parseRatio('steady');
        expect(result.work).toBe(1);
        expect(result.rest).toBe(0);
    });
});

// ============================================================================
// roundTo5 TESTS
// ============================================================================

describe('roundTo5', () => {
    it('should round to nearest 5', () => {
        expect(roundTo5(7)).toBe(5);
        expect(roundTo5(8)).toBe(10);
        expect(roundTo5(12)).toBe(10);
        expect(roundTo5(13)).toBe(15);
    });

    it('should not change multiples of 5', () => {
        expect(roundTo5(5)).toBe(5);
        expect(roundTo5(10)).toBe(10);
        expect(roundTo5(25)).toBe(25);
    });
});

// ============================================================================
// gcd TESTS
// ============================================================================

describe('gcd', () => {
    it('should find GCD of 12 and 18', () => {
        expect(gcd(12, 18)).toBe(6);
    });

    it('should find GCD of 20 and 8', () => {
        expect(gcd(20, 8)).toBe(4);
    });

    it('should return a for gcd(a, 0)', () => {
        expect(gcd(15, 0)).toBe(15);
    });

    it('should return 1 for coprime numbers', () => {
        expect(gcd(17, 13)).toBe(1);
    });

    it('should be commutative', () => {
        expect(gcd(12, 18)).toBe(gcd(18, 12));
    });
});

// ============================================================================
// interpolateColor TESTS
// ============================================================================

describe('interpolateColor', () => {
    it('should return start color at t=0', () => {
        const result = interpolateColor('#ff0000', '#0000ff', 0);
        expect(result.toLowerCase()).toBe('#ff0000');
    });

    it('should return end color at t=1', () => {
        const result = interpolateColor('#ff0000', '#0000ff', 1);
        expect(result.toLowerCase()).toBe('#0000ff');
    });

    it('should interpolate at t=0.5', () => {
        const result = interpolateColor('#ff0000', '#0000ff', 0.5);
        // Mid-point between red and blue = purple (#800080 or similar)
        expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should return valid hex color', () => {
        const result = interpolateColor('#123456', '#abcdef', 0.3);
        expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });
});

// ============================================================================
// isLightColor TESTS
// ============================================================================

describe('isLightColor', () => {
    it('should return true for white', () => {
        expect(isLightColor('#ffffff')).toBe(true);
    });

    it('should return false for black', () => {
        expect(isLightColor('#000000')).toBe(false);
    });

    it('should return true for light colors', () => {
        expect(isLightColor('#ffff00')).toBe(true); // Yellow
    });

    it('should return false for dark colors', () => {
        expect(isLightColor('#800000')).toBe(false); // Dark red
    });
});

// ============================================================================
// adjustWorkRestPair TESTS
// ============================================================================

describe('adjustWorkRestPair', () => {
    it('should increase total by 10 when direction is 1', () => {
        const result = adjustWorkRestPair(30, 30, 1);
        expect(result.work + result.rest).toBe(70);
    });

    it('should decrease total by 10 when direction is -1', () => {
        const result = adjustWorkRestPair(30, 30, -1);
        expect(result.work + result.rest).toBe(50);
    });

    it('should maintain 5s minimums when decreasing', () => {
        const result = adjustWorkRestPair(10, 10, -1);
        expect(result.work).toBeGreaterThanOrEqual(5);
        expect(result.rest).toBeGreaterThanOrEqual(5);
    });

    it('should not exceed 600s total', () => {
        const result = adjustWorkRestPair(295, 295, 1);
        expect(result.work + result.rest).toBeLessThanOrEqual(600);
    });
});

// ============================================================================
// formatDuration TESTS
// ============================================================================

describe('formatDuration', () => {
    it('should format whole minutes', () => {
        expect(formatDuration(5)).toBe('5 min');
        expect(formatDuration(10)).toBe('10 min');
    });

    it('should format minutes with seconds', () => {
        expect(formatDuration(5.5)).toBe('5m 30s');
        expect(formatDuration(1.25)).toBe('1m 15s');
    });

    it('should round to nearest second', () => {
        const result = formatDuration(1.51);
        expect(result).toMatch(/\d+m \d+s/);
    });
});

// ============================================================================
// getRPEColor TESTS
// ============================================================================

describe('getRPEColor', () => {
    const readinessColor = '#00ff00';
    const fatigueColor = '#ff0000';

    it('should return a valid hex color', () => {
        const result = getRPEColor(5, readinessColor, fatigueColor);
        expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should return readiness-like color at RPE 1', () => {
        const result = getRPEColor(1, readinessColor, fatigueColor);
        // At RPE 1, factor is (1-1)/9 = 0, should be closer to readinessColor
        expect(result.toLowerCase()).toBe(readinessColor);
    });

    it('should return fatigue-like color at RPE 10', () => {
        const result = getRPEColor(10, readinessColor, fatigueColor);
        // At RPE 10, factor is (10-1)/9 = 1, should be fatigueColor
        expect(result.toLowerCase()).toBe(fatigueColor);
    });

    it('should produce different colors for different RPE', () => {
        const color1 = getRPEColor(1, readinessColor, fatigueColor);
        const color5 = getRPEColor(5, readinessColor, fatigueColor);
        const color10 = getRPEColor(10, readinessColor, fatigueColor);

        expect(color1).not.toBe(color10);
        expect(color5).not.toBe(color1);
        expect(color5).not.toBe(color10);
    });
});
