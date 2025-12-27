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
    calculatePhasePositions,
    adjustThresholdsForPosition,
    estimateCumulativeFatigue
} from './algorithms';
import { WeekAnalysis } from './types';

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

// ============================================================================
// PHASE POSITION TESTS
// ============================================================================

// Helper to create minimal WeekAnalysis for testing
function createWeekAnalysis(cyclePhase: 'ascending' | 'peak' | 'descending' | 'trough'): WeekAnalysis {
    return {
        weekNumber: 1,
        phaseName: 'Test',
        powerMultiplier: 1.0,
        fatigueP15: 20,
        fatigueP30: 30,
        fatigueP50: 50,
        fatigueP70: 70,
        fatigueP85: 80,
        readinessP15: 20,
        readinessP30: 30,
        readinessP50: 50,
        readinessP70: 70,
        readinessP85: 80,
        fatigueVelocity: 2,
        fatigueAcceleration: 0,
        cyclePhase,
        cycleIndex: 0,
        isLocalPeak: false,
        isLocalTrough: false
    };
}

describe('calculatePhasePositions', () => {
    it('assigns early/mid/late positions within a 3-week ascending phase', () => {
        const analyses: WeekAnalysis[] = [
            createWeekAnalysis('ascending'),
            createWeekAnalysis('ascending'),
            createWeekAnalysis('ascending'),
        ];

        const positions = calculatePhasePositions(analyses);
        expect(positions[0].phasePosition).toBe('early');
        expect(positions[1].phasePosition).toBe('mid');
        expect(positions[2].phasePosition).toBe('late');
    });

    it('assigns correct position ratios within a phase', () => {
        const analyses: WeekAnalysis[] = [
            createWeekAnalysis('ascending'),
            createWeekAnalysis('ascending'),
            createWeekAnalysis('ascending'),
        ];

        const positions = calculatePhasePositions(analyses);
        expect(positions[0].positionRatio).toBe(0);   // start
        expect(positions[1].positionRatio).toBe(0.5); // middle
        expect(positions[2].positionRatio).toBe(1);   // end
    });

    it('resets position when phase changes', () => {
        const analyses: WeekAnalysis[] = [
            createWeekAnalysis('ascending'),
            createWeekAnalysis('ascending'),
            createWeekAnalysis('peak'),      // phase change
            createWeekAnalysis('descending'),
        ];

        const positions = calculatePhasePositions(analyses);
        // First two are ascending
        expect(positions[0].positionRatio).toBe(0);
        expect(positions[1].positionRatio).toBe(1);
        // Peak is a single-week phase
        expect(positions[2].positionRatio).toBe(0.5);
        // Descending is a single-week phase
        expect(positions[3].positionRatio).toBe(0.5);
    });

    it('handles single-week phases with mid position', () => {
        const analyses: WeekAnalysis[] = [
            createWeekAnalysis('ascending'),
            createWeekAnalysis('peak'),
            createWeekAnalysis('descending'),
        ];

        const positions = calculatePhasePositions(analyses);
        // Each is a single-week phase
        expect(positions[0].positionRatio).toBe(0.5);
        expect(positions[1].positionRatio).toBe(0.5);
        expect(positions[2].positionRatio).toBe(0.5);
        expect(positions[0].phasePosition).toBe('mid');
        expect(positions[1].phasePosition).toBe('mid');
        expect(positions[2].phasePosition).toBe('mid');
    });

    it('handles long ascending phases correctly', () => {
        const analyses: WeekAnalysis[] = [
            createWeekAnalysis('ascending'),
            createWeekAnalysis('ascending'),
            createWeekAnalysis('ascending'),
            createWeekAnalysis('ascending'),
            createWeekAnalysis('ascending'),
            createWeekAnalysis('ascending'),
        ];

        const positions = calculatePhasePositions(analyses);
        expect(positions[0].phasePosition).toBe('early');  // 0/5 = 0
        expect(positions[1].phasePosition).toBe('early');  // 1/5 = 0.2
        expect(positions[2].phasePosition).toBe('mid');    // 2/5 = 0.4
        expect(positions[3].phasePosition).toBe('mid');    // 3/5 = 0.6
        expect(positions[4].phasePosition).toBe('late');   // 4/5 = 0.8
        expect(positions[5].phasePosition).toBe('late');   // 5/5 = 1.0
    });
});

describe('adjustThresholdsForPosition', () => {
    it('lowers thresholds for early ascending (position 0)', () => {
        const { adjustedP30, adjustedP70 } = adjustThresholdsForPosition(30, 70, 0, 'ascending');
        // At position 0: shift = (0 - 0.5) * 15 = -7.5
        expect(adjustedP30).toBeLessThan(30);
        expect(adjustedP70).toBeLessThan(70);
        expect(adjustedP30).toBeCloseTo(22.5, 0);
        expect(adjustedP70).toBeCloseTo(62.5, 0);
    });

    it('raises thresholds for late ascending (position 1)', () => {
        const { adjustedP30, adjustedP70 } = adjustThresholdsForPosition(30, 70, 1, 'ascending');
        // At position 1: shift = (1 - 0.5) * 15 = +7.5
        expect(adjustedP30).toBeGreaterThan(30);
        expect(adjustedP70).toBeGreaterThan(70);
        expect(adjustedP30).toBeCloseTo(37.5, 0);
        expect(adjustedP70).toBeCloseTo(77.5, 0);
    });

    it('leaves mid position unchanged (position 0.5)', () => {
        const { adjustedP30, adjustedP70 } = adjustThresholdsForPosition(30, 70, 0.5, 'ascending');
        // At position 0.5: shift = 0
        expect(adjustedP30).toBe(30);
        expect(adjustedP70).toBe(70);
    });

    it('leaves non-ascending phases unchanged', () => {
        const { adjustedP30: p30_peak, adjustedP70: p70_peak } = adjustThresholdsForPosition(30, 70, 0, 'peak');
        expect(p30_peak).toBe(30);
        expect(p70_peak).toBe(70);

        const { adjustedP30: p30_desc, adjustedP70: p70_desc } = adjustThresholdsForPosition(30, 70, 0.5, 'descending');
        expect(p30_desc).toBe(30);
        expect(p70_desc).toBe(70);

        const { adjustedP30: p30_trough, adjustedP70: p70_trough } = adjustThresholdsForPosition(30, 70, 1, 'trough');
        expect(p30_trough).toBe(30);
        expect(p70_trough).toBe(70);
    });

    it('clamps values within valid range', () => {
        // Very low thresholds + early position should clamp to minimum 5
        const { adjustedP30: low30 } = adjustThresholdsForPosition(5, 50, 0, 'ascending');
        expect(low30).toBeGreaterThanOrEqual(5);

        // Very high thresholds + late position should clamp to maximum 95
        const { adjustedP70: high70 } = adjustThresholdsForPosition(50, 92, 1, 'ascending');
        expect(high70).toBeLessThanOrEqual(95);
    });
});

describe('estimateCumulativeFatigue', () => {
    it('estimates higher fatigue for late ascending position', () => {
        const early = estimateCumulativeFatigue(40, 0.1, 'ascending', 5);
        const late = estimateCumulativeFatigue(40, 0.9, 'ascending', 5);
        expect(late).toBeGreaterThan(early);
    });

    it('returns baseline for non-ascending phases', () => {
        const baseline = 50;
        expect(estimateCumulativeFatigue(baseline, 0.9, 'peak', 5)).toBe(baseline);
        expect(estimateCumulativeFatigue(baseline, 0.9, 'descending', 5)).toBe(baseline);
        expect(estimateCumulativeFatigue(baseline, 0.9, 'trough', 5)).toBe(baseline);
    });

    it('returns baseline for early ascending', () => {
        const baseline = 40;
        const result = estimateCumulativeFatigue(baseline, 0, 'ascending', 5);
        expect(result).toBe(baseline);
    });

    it('accumulation scales with velocity', () => {
        const baseline = 40;
        const position = 0.8;

        const lowVelocity = estimateCumulativeFatigue(baseline, position, 'ascending', 2);
        const highVelocity = estimateCumulativeFatigue(baseline, position, 'ascending', 8);

        expect(highVelocity).toBeGreaterThan(lowVelocity);
    });

    it('handles zero or negative velocity', () => {
        const baseline = 40;
        // Zero velocity means no accumulation
        expect(estimateCumulativeFatigue(baseline, 1, 'ascending', 0)).toBe(baseline);
        // Negative velocity (fatigue falling) also means no accumulation
        expect(estimateCumulativeFatigue(baseline, 1, 'ascending', -5)).toBe(baseline);
    });
});
