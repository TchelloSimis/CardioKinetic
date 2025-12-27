/**
 * Unit tests for monotonyUtils.ts
 * 
 * Tests training monotony and strain calculations based on Foster research.
 */

import { describe, it, expect } from 'vitest';
import {
    calculateMonotony,
    calculateStrain,
    getMonotonyRisk,
    getStrainRisk,
    calculateWeeklyLoad
} from './monotonyUtils';

// ============================================================================
// calculateMonotony TESTS
// ============================================================================

describe('calculateMonotony', () => {
    it('should return 1.0 for insufficient data', () => {
        const result = calculateMonotony([100, 100, 100]); // Less than 7 days
        expect(result).toBe(1.0);
    });

    it('should return high monotony for identical loads', () => {
        const loads = [100, 100, 100, 100, 100, 100, 100];
        const result = calculateMonotony(loads);
        // Mean / SD = 100 / 0 → capped at 5.0
        expect(result).toBe(5.0);
    });

    it('should return low monotony for varied loads', () => {
        const loads = [50, 150, 30, 200, 80, 120, 70];
        const result = calculateMonotony(loads);
        expect(result).toBeLessThan(2.0);
    });

    it('should return 1.0 for zero mean', () => {
        const loads = [0, 0, 0, 0, 0, 0, 0];
        const result = calculateMonotony(loads);
        expect(result).toBe(1.0);
    });

    it('should use only last 7 days by default', () => {
        const loads = [200, 200, 200, 50, 100, 150, 80, 120, 70, 90];
        const result = calculateMonotony(loads);
        // Only considers last 7 values
        expect(result).toBeLessThan(3.5);
    });

    it('should respect custom window size', () => {
        const loads = [100, 100, 100, 100, 100]; // 5 identical values
        const result = calculateMonotony(loads, 5);
        expect(result).toBe(5.0);
    });
});

// ============================================================================
// calculateStrain TESTS
// ============================================================================

describe('calculateStrain', () => {
    it('should multiply weekly load by monotony', () => {
        const result = calculateStrain(1000, 2.0);
        expect(result).toBe(2000);
    });

    it('should return 0 for 0 weekly load', () => {
        const result = calculateStrain(0, 5.0);
        expect(result).toBe(0);
    });

    it('should scale linearly with monotony', () => {
        const low = calculateStrain(1000, 1.0);
        const high = calculateStrain(1000, 3.0);
        expect(high).toBe(low * 3);
    });
});

// ============================================================================
// getMonotonyRisk TESTS
// ============================================================================

describe('getMonotonyRisk', () => {
    it('should return low for monotony < 1.5', () => {
        expect(getMonotonyRisk(1.0)).toBe('low');
        expect(getMonotonyRisk(1.4)).toBe('low');
    });

    it('should return moderate for monotony 1.5-2.0', () => {
        expect(getMonotonyRisk(1.5)).toBe('moderate');
        expect(getMonotonyRisk(1.9)).toBe('moderate');
    });

    it('should return high for monotony >= 2.0', () => {
        expect(getMonotonyRisk(2.0)).toBe('high');
        expect(getMonotonyRisk(5.0)).toBe('high');
    });
});

// ============================================================================
// getStrainRisk TESTS
// ============================================================================

describe('getStrainRisk', () => {
    it('should return low for strain < 3000', () => {
        expect(getStrainRisk(1000)).toBe('low');
        expect(getStrainRisk(2999)).toBe('low');
    });

    it('should return moderate for strain 3000-6000', () => {
        expect(getStrainRisk(3000)).toBe('moderate');
        expect(getStrainRisk(5999)).toBe('moderate');
    });

    it('should return high for strain >= 6000', () => {
        expect(getStrainRisk(6000)).toBe('high');
        expect(getStrainRisk(10000)).toBe('high');
    });
});

// ============================================================================
// calculateWeeklyLoad TESTS
// ============================================================================

describe('calculateWeeklyLoad', () => {
    it('should return 0 for empty array', () => {
        expect(calculateWeeklyLoad([])).toBe(0);
    });

    it('should sum last 7 days by default', () => {
        const loads = [10, 20, 30, 40, 50, 60, 70];
        const result = calculateWeeklyLoad(loads);
        expect(result).toBe(280); // 10+20+30+40+50+60+70
    });

    it('should only sum last N days when array is longer', () => {
        const loads = [100, 200, 10, 20, 30, 40, 50, 60, 70];
        const result = calculateWeeklyLoad(loads);
        expect(result).toBe(280); // Only last 7
    });

    it('should handle shorter arrays', () => {
        const loads = [10, 20, 30];
        const result = calculateWeeklyLoad(loads);
        expect(result).toBe(60);
    });

    it('should respect custom window size', () => {
        const loads = [10, 20, 30, 40, 50];
        const result = calculateWeeklyLoad(loads, 3);
        expect(result).toBe(120); // 30+40+50
    });
});
