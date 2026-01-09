/**
 * Unit tests for rpeHeartRateUtils.ts
 * 
 * Tests RPE to Heart Rate conversion functions
 */

import { describe, it, expect } from 'vitest';
import {
    calculateXFromRPE,
    calculateHeartRateFromX,
    calculateHeartRateForRPE,
    getHeartRateBandForRPE,
    formatHeartRateBand,
} from './rpeHeartRateUtils';

describe('rpeHeartRateUtils', () => {
    // Constants from the equation for reference:
    // RPE = 0.02 * X² + 0.1659 * X - 1.3221
    // X = 20 * (H / (208 - 0.7 * A))
    // MaxHR at age 24 = 208 - 0.7 * 24 = 191.2

    describe('calculateXFromRPE', () => {
        it('should return positive X values for valid RPE', () => {
            expect(calculateXFromRPE(6)).toBeGreaterThan(0);
            expect(calculateXFromRPE(8)).toBeGreaterThan(0);
            expect(calculateXFromRPE(10)).toBeGreaterThan(0);
        });

        it('should return higher X for higher RPE', () => {
            const x6 = calculateXFromRPE(6);
            const x8 = calculateXFromRPE(8);
            const x10 = calculateXFromRPE(10);
            expect(x8).toBeGreaterThan(x6);
            expect(x10).toBeGreaterThan(x8);
        });

        it('should handle edge case RPE values', () => {
            expect(calculateXFromRPE(1)).toBeGreaterThan(0);
            expect(calculateXFromRPE(0.5)).toBeGreaterThanOrEqual(0);
        });
    });

    describe('calculateHeartRateFromX', () => {
        it('should calculate correct heart rate for age 24', () => {
            // MaxHR = 208 - 0.7 * 24 = 191.2
            // H = X * MaxHR / 20
            const x = 10;
            const age = 24;
            const expected = (10 * 191.2) / 20; // 95.6
            expect(calculateHeartRateFromX(x, age)).toBeCloseTo(expected, 1);
        });

        it('should return lower HR for older ages', () => {
            const x = 15;
            const hr24 = calculateHeartRateFromX(x, 24);
            const hr40 = calculateHeartRateFromX(x, 40);
            expect(hr40).toBeLessThan(hr24);
        });
    });

    describe('calculateHeartRateForRPE', () => {
        it('should return floored integer for age 24', () => {
            const hr = calculateHeartRateForRPE(6, 24);
            expect(Number.isInteger(hr)).toBe(true);
        });

        it('should return increasing HR for increasing RPE', () => {
            const age = 24;
            const hr5 = calculateHeartRateForRPE(5, age);
            const hr6 = calculateHeartRateForRPE(6, age);
            const hr7 = calculateHeartRateForRPE(7, age);
            const hr8 = calculateHeartRateForRPE(8, age);

            expect(hr6).toBeGreaterThan(hr5);
            expect(hr7).toBeGreaterThan(hr6);
            expect(hr8).toBeGreaterThan(hr7);
        });
    });

    describe('getHeartRateBandForRPE', () => {
        it('should return floored integers for band bounds', () => {
            const band = getHeartRateBandForRPE(6, 24);
            expect(Number.isInteger(band.lower)).toBe(true);
            expect(Number.isInteger(band.upper)).toBe(true);
        });

        it('should have upper > lower', () => {
            const band = getHeartRateBandForRPE(6, 24);
            expect(band.upper).toBeGreaterThan(band.lower);
        });

        it('should calculate band for RPE 6 with ±0.25 RPE margin', () => {
            const age = 24;
            const band = getHeartRateBandForRPE(6, age);

            // Band should be between HR at RPE 5.75 and HR at RPE 6.25
            const hrLower = calculateHeartRateForRPE(5.75, age);
            const hrUpper = calculateHeartRateForRPE(6.25, age);

            expect(band.lower).toBe(hrLower);
            expect(band.upper).toBe(hrUpper);
        });
    });

    describe('formatHeartRateBand', () => {
        it('should format band correctly', () => {
            const result = formatHeartRateBand({ lower: 145, upper: 156 });
            expect(result).toBe('~145–156 bpm');
        });

        it('should handle single digit difference', () => {
            const result = formatHeartRateBand({ lower: 100, upper: 105 });
            expect(result).toBe('~100–105 bpm');
        });
    });

    // Integration test: Full RPE descriptions for age 24
    describe('HR Bands for Age 24', () => {
        const age = 24;

        it('should calculate reasonable HR ranges for common RPE values', () => {
            // Log out the bands for verification
            const testCases = [
                { rpe: 5, desc: 'Progressive Pace' },
                { rpe: 6, desc: 'Hard Activity' },
                { rpe: 6.5, desc: 'Challenging' },
                { rpe: 7, desc: 'Vigorous Activity' },
                { rpe: 7.5, desc: 'Very Challenging' },
                { rpe: 8, desc: 'Hard Intensity' },
                { rpe: 9, desc: 'Very Hard Intensity' },
                { rpe: 10, desc: 'All-Out Sprint' },
            ];

            for (const tc of testCases) {
                const band = getHeartRateBandForRPE(tc.rpe, age);
                // All HR values should be physiologically reasonable (60-220 bpm)
                expect(band.lower).toBeGreaterThan(60);
                expect(band.upper).toBeLessThan(220);
                // Band should represent a reasonable range (typically 5-15 bpm)
                const range = band.upper - band.lower;
                expect(range).toBeGreaterThan(0);
                expect(range).toBeLessThan(20);
            }
        });
    });
});
