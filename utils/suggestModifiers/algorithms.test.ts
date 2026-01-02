/**
 * Tests for suggestModifiers algorithms module
 */

import { describe, it, expect } from 'vitest';
import {
    calculateAdaptiveWindows,
    smoothSignal,
    calculateDerivative,
    calculatePercentile,
    detectChangePoints,
    detectExtrema,
} from './algorithms';

describe('calculateAdaptiveWindows', () => {
    it('returns minimum values for short programs', () => {
        const result = calculateAdaptiveWindows(4);
        expect(result.local).toBe(2);
        expect(result.meso).toBe(3);
    });

    it('scales with program length', () => {
        const result = calculateAdaptiveWindows(12);
        expect(result.local).toBe(2); // floor(12 * 0.20) = 2
        expect(result.meso).toBe(4);  // floor(12 * 0.40) = 4
    });

    it('caps at sensible maximums', () => {
        const result = calculateAdaptiveWindows(52);
        expect(result.local).toBe(10); // floor(52 * 0.20) = 10
        expect(result.meso).toBe(20);  // floor(52 * 0.40) = 20
    });
});

describe('smoothSignal', () => {
    it('returns original data for short arrays', () => {
        const data = [10, 20, 30];
        const result = smoothSignal(data, 5);
        expect(result).toEqual(data);
    });

    it('smooths noisy data', () => {
        const data = [10, 50, 20, 60, 30]; // very noisy
        const result = smoothSignal(data, 3);
        // Middle values should be smoothed via weighted average
        // For index 2: weights [1,2,1], values [50,20,60] = (50*1 + 20*2 + 60*1) / 4 = 150/4 = 37.5
        expect(result[2]).toBeCloseTo(37.5, 1);
    });
});

describe('calculateDerivative', () => {
    it('returns zeros for constant array', () => {
        const data = [50, 50, 50, 50];
        const result = calculateDerivative(data);
        result.forEach(v => expect(v).toBe(0));
    });

    it('detects linear increase', () => {
        const data = [0, 10, 20, 30, 40];
        const result = calculateDerivative(data);
        // Middle values should be ~10
        expect(result[1]).toBe(10);
        expect(result[2]).toBe(10);
        expect(result[3]).toBe(10);
    });

    it('handles empty array', () => {
        expect(calculateDerivative([])).toEqual([]);
    });

    it('handles single element', () => {
        expect(calculateDerivative([50])).toEqual([0]);
    });
});

describe('calculatePercentile', () => {
    it('returns median for 50th percentile', () => {
        const data = [10, 20, 30, 40, 50];
        expect(calculatePercentile(data, 50)).toBe(30);
    });

    it('returns min for 0th percentile', () => {
        const data = [10, 20, 30, 40, 50];
        expect(calculatePercentile(data, 0)).toBe(10);
    });

    it('returns max for 100th percentile', () => {
        const data = [10, 20, 30, 40, 50];
        expect(calculatePercentile(data, 100)).toBe(50);
    });

    it('handles empty array', () => {
        expect(calculatePercentile([], 50)).toBe(0);
    });

    it('interpolates between values', () => {
        const data = [0, 100];
        expect(calculatePercentile(data, 50)).toBe(50);
        expect(calculatePercentile(data, 25)).toBe(25);
    });
});

describe('detectChangePoints', () => {
    it('returns empty for short arrays', () => {
        expect(detectChangePoints([1, 2], 5)).toEqual([]);
    });

    it('detects sudden increases', () => {
        const data = [10, 10, 10, 50, 50, 50];
        const result = detectChangePoints(data, 10);
        expect(result.length).toBeGreaterThan(0);
        expect(result).toContain(3); // change at index 3
    });

    it('detects sudden decreases', () => {
        const data = [50, 50, 50, 10, 10, 10];
        const result = detectChangePoints(data, 10);
        expect(result.length).toBeGreaterThan(0);
    });
});

describe('detectExtrema', () => {
    it('finds peaks', () => {
        const data = [10, 20, 100, 20, 10];
        const { peaks, troughs } = detectExtrema(data);
        expect(peaks).toContain(2);
    });

    it('finds troughs', () => {
        const data = [50, 40, 10, 40, 50];
        const { peaks, troughs } = detectExtrema(data);
        expect(troughs).toContain(2);
    });

    it('returns empty for flat data', () => {
        const data = [50, 50, 50, 50, 50];
        const { peaks, troughs } = detectExtrema(data);
        expect(peaks).toEqual([]);
        expect(troughs).toEqual([]);
    });
});
