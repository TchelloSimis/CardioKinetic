/**
 * Unit tests for metricsUtils.ts
 * 
 * Tests the core training metrics calculations including ATL, CTL, TSB,
 * fatigue scores, and readiness scores.
 */

import { describe, it, expect } from 'vitest';
import {
    calculateSessionLoad,
    calculateRecentAveragePower,
    aggregateDailySessions,
    calculatePowerBaseline,
    calculatePowerLoad,
    calculateRPELoad,
    calculateDailyLoad,
    calculateFatigueScore,
    calculateReadinessScore,
    calculateDailyMetrics,
    getCurrentMetrics,
    DailyAggregatedData
} from './metricsUtils';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createSession = (overrides: Partial<{ date: string; duration: number; power: number; rpe: number }> = {}) => ({
    date: '2024-01-15',
    duration: 30,
    power: 150,
    rpe: 7,
    ...overrides
});

// ============================================================================
// calculateSessionLoad TESTS (Legacy function)
// ============================================================================

describe('calculateSessionLoad', () => {
    it('should calculate load with default power ratio', () => {
        const load = calculateSessionLoad(7, 30);
        // RPE^1.5 * Duration^0.75 * PowerRatio^0.5 * 0.3
        // 7^1.5 * 30^0.75 * 1^0.5 * 0.3 ≈ 18.52 * 12.82 * 1 * 0.3 ≈ 71.2
        expect(load).toBeGreaterThan(50);
        expect(load).toBeLessThan(100);
    });

    it('should increase load with higher RPE', () => {
        const lowRPE = calculateSessionLoad(5, 30);
        const highRPE = calculateSessionLoad(9, 30);
        expect(highRPE).toBeGreaterThan(lowRPE);
    });

    it('should increase load with longer duration', () => {
        const short = calculateSessionLoad(7, 15);
        const long = calculateSessionLoad(7, 60);
        expect(long).toBeGreaterThan(short);
    });

    it('should increase load with higher power ratio', () => {
        const lowPower = calculateSessionLoad(7, 30, 0.8);
        const highPower = calculateSessionLoad(7, 30, 1.2);
        expect(highPower).toBeGreaterThan(lowPower);
    });

    it('should clamp power ratio to valid range', () => {
        // Very low ratio should be clamped to 0.25
        const veryLow = calculateSessionLoad(7, 30, 0.1);
        const minClamped = calculateSessionLoad(7, 30, 0.25);
        expect(veryLow).toBeCloseTo(minClamped, 2);

        // Very high ratio should be clamped to 4.0
        const veryHigh = calculateSessionLoad(7, 30, 10);
        const maxClamped = calculateSessionLoad(7, 30, 4.0);
        expect(veryHigh).toBeCloseTo(maxClamped, 2);
    });
});

// ============================================================================
// calculateRecentAveragePower TESTS
// ============================================================================

describe('calculateRecentAveragePower', () => {
    it('should return base power when no sessions', () => {
        const result = calculateRecentAveragePower([], new Date('2024-01-15'), 150);
        expect(result).toBe(150);
    });

    it('should return base power when all sessions are too old', () => {
        const sessions = [
            { date: '2023-12-01', power: 200 }
        ];
        const result = calculateRecentAveragePower(sessions, new Date('2024-01-15'), 150);
        expect(result).toBe(150);
    });

    it('should weight recent sessions more heavily', () => {
        const currentDate = new Date('2024-01-15');
        const sessions = [
            { date: '2024-01-14', power: 200 }, // 1 day ago - high weight
            { date: '2024-01-01', power: 100 }  // 14 days ago - lower weight
        ];
        const result = calculateRecentAveragePower(sessions, currentDate, 150);
        // Recent session should dominate, so result should be closer to 200
        expect(result).toBeGreaterThan(150);
    });

    it('should ignore sessions on the current date', () => {
        const sessions = [
            { date: '2024-01-15', power: 300 }, // Same day - should be ignored
            { date: '2024-01-14', power: 150 }  // 1 day ago
        ];
        const result = calculateRecentAveragePower(sessions, new Date('2024-01-15'), 100);
        expect(result).toBeCloseTo(150, 0);
    });
});

// ============================================================================
// aggregateDailySessions TESTS
// ============================================================================

describe('aggregateDailySessions', () => {
    it('should return empty map for no sessions', () => {
        const result = aggregateDailySessions([]);
        expect(result.size).toBe(0);
    });

    it('should aggregate single session correctly', () => {
        const sessions = [createSession()];
        const result = aggregateDailySessions(sessions);

        expect(result.size).toBe(1);
        const dayData = result.get('2024-01-15');
        expect(dayData?.totalDurationMinutes).toBe(30);
        expect(dayData?.avgPower).toBe(150);
        expect(dayData?.avgRPE).toBe(7);
        expect(dayData?.sessionCount).toBe(1);
    });

    it('should aggregate multiple sessions on same day with time weighting', () => {
        const sessions = [
            createSession({ date: '2024-01-15', duration: 30, power: 100, rpe: 5 }),
            createSession({ date: '2024-01-15', duration: 30, power: 200, rpe: 9 })
        ];
        const result = aggregateDailySessions(sessions);

        expect(result.size).toBe(1);
        const dayData = result.get('2024-01-15');
        expect(dayData?.totalDurationMinutes).toBe(60);
        expect(dayData?.avgPower).toBe(150); // (100*30 + 200*30) / 60
        expect(dayData?.avgRPE).toBe(7);     // (5*30 + 9*30) / 60
        expect(dayData?.sessionCount).toBe(2);
    });

    it('should handle multiple days separately', () => {
        const sessions = [
            createSession({ date: '2024-01-15', power: 150 }),
            createSession({ date: '2024-01-16', power: 180 })
        ];
        const result = aggregateDailySessions(sessions);

        expect(result.size).toBe(2);
        expect(result.get('2024-01-15')?.avgPower).toBe(150);
        expect(result.get('2024-01-16')?.avgPower).toBe(180);
    });
});

// ============================================================================
// calculatePowerBaseline TESTS
// ============================================================================

describe('calculatePowerBaseline', () => {
    it('should return base power for empty data', () => {
        const result = calculatePowerBaseline(new Map(), new Date('2024-01-15'), 150);
        expect(result).toBe(150);
    });

    it('should update baseline with EWMA', () => {
        const dailyData = new Map<string, DailyAggregatedData>();
        dailyData.set('2024-01-15', {
            date: '2024-01-15',
            totalDurationMinutes: 30,
            avgPower: 200,
            avgRPE: 7,
            sessionCount: 1
        });

        const result = calculatePowerBaseline(dailyData, new Date('2024-01-15'), 150);
        // Alpha ≈ 0.047, so result = 150 + 0.047 * (200 - 150) ≈ 152.3
        expect(result).toBeGreaterThan(150);
        expect(result).toBeLessThan(200);
    });

    it('should not include dates after upToDate', () => {
        const dailyData = new Map<string, DailyAggregatedData>();
        dailyData.set('2024-01-20', {
            date: '2024-01-20',
            totalDurationMinutes: 30,
            avgPower: 300,
            avgRPE: 7,
            sessionCount: 1
        });

        const result = calculatePowerBaseline(dailyData, new Date('2024-01-15'), 150);
        expect(result).toBe(150); // Future data should be ignored
    });
});

// ============================================================================
// calculatePowerLoad TESTS
// ============================================================================

describe('calculatePowerLoad', () => {
    it('should return 0 for zero power baseline', () => {
        expect(calculatePowerLoad(30, 150, 0)).toBe(0);
    });

    it('should return 0 for zero average power', () => {
        expect(calculatePowerLoad(30, 0, 150)).toBe(0);
    });

    it('should calculate correctly with formula', () => {
        // L_P = 100 × (t_total/60) × (P_day/P_base)²
        // = 100 × (60/60) × (150/150)² = 100 × 1 × 1 = 100
        const result = calculatePowerLoad(60, 150, 150);
        expect(result).toBeCloseTo(100, 1);
    });

    it('should scale with duration', () => {
        const short = calculatePowerLoad(30, 150, 150);
        const long = calculatePowerLoad(60, 150, 150);
        expect(long).toBe(short * 2);
    });

    it('should scale quadratically with power ratio', () => {
        const base = calculatePowerLoad(60, 150, 150);
        const double = calculatePowerLoad(60, 300, 150);
        expect(double).toBe(base * 4); // (2)^2 = 4
    });
});

// ============================================================================
// calculateRPELoad TESTS
// ============================================================================

describe('calculateRPELoad', () => {
    it('should calculate correctly with formula', () => {
        // L_R = (RPE × t_total) / 4
        // = (7 × 60) / 4 = 105
        const result = calculateRPELoad(7, 60);
        expect(result).toBe(105);
    });

    it('should scale linearly with RPE', () => {
        const low = calculateRPELoad(5, 30);
        const high = calculateRPELoad(10, 30);
        expect(high).toBe(low * 2);
    });

    it('should scale linearly with duration', () => {
        const short = calculateRPELoad(7, 30);
        const long = calculateRPELoad(7, 60);
        expect(long).toBe(short * 2);
    });
});

// ============================================================================
// calculateDailyLoad TESTS
// ============================================================================

describe('calculateDailyLoad', () => {
    it('should return 0 for both loads zero', () => {
        expect(calculateDailyLoad(0, 0)).toBe(0);
    });

    it('should return 100% RPE load when power is 0', () => {
        expect(calculateDailyLoad(0, 50)).toBe(50);
    });

    it('should return 100% power load when RPE is 0', () => {
        expect(calculateDailyLoad(50, 0)).toBe(50);
    });

    it('should blend 60/40 when both present', () => {
        // 0.6 * 100 + 0.4 * 50 = 60 + 20 = 80
        const result = calculateDailyLoad(100, 50);
        expect(result).toBe(80);
    });
});

// ============================================================================
// calculateFatigueScore TESTS
// ============================================================================

describe('calculateFatigueScore', () => {
    it('should return low fatigue for low ACWR', () => {
        // ACWR = 10/50 = 0.2 (well below 1.15 midpoint)
        const result = calculateFatigueScore(10, 50);
        expect(result).toBeLessThan(10);
    });

    it('should return ~50% fatigue at ACWR = 1.15', () => {
        // ACWR = 1.15 should give ~50% fatigue
        const result = calculateFatigueScore(17.25, 15); // 17.25/15 = 1.15
        expect(result).toBeGreaterThan(40);
        expect(result).toBeLessThan(60);
    });

    it('should return high fatigue for high ACWR', () => {
        // ACWR = 60/30 = 2.0 (well above 1.15 midpoint)
        const result = calculateFatigueScore(60, 30);
        expect(result).toBeGreaterThan(90);
    });

    it('should use CTL minimum for new users', () => {
        // Very low CTL should be clamped to 15
        const result = calculateFatigueScore(15, 5);
        // ACWR = 15/15 = 1.0 (using CTL_MINIMUM)
        expect(result).toBeLessThan(50);
    });

    it('should clamp result between 0 and 100', () => {
        const veryHigh = calculateFatigueScore(200, 15);
        expect(veryHigh).toBeLessThanOrEqual(100);

        const veryLow = calculateFatigueScore(0, 50);
        expect(veryLow).toBeGreaterThanOrEqual(0);
    });
});

// ============================================================================
// calculateReadinessScore TESTS
// ============================================================================

describe('calculateReadinessScore', () => {
    it('should return 100% readiness at optimal TSB (+20)', () => {
        const result = calculateReadinessScore(20);
        expect(result).toBe(100);
    });

    it('should decrease for overtraining (negative TSB)', () => {
        const optimal = calculateReadinessScore(20);
        const overtrained = calculateReadinessScore(-20);
        expect(overtrained).toBeLessThan(optimal);
    });

    it('should decrease gently for detraining (high TSB)', () => {
        const optimal = calculateReadinessScore(20);
        const detrained = calculateReadinessScore(60);
        expect(detrained).toBeLessThan(optimal);
        // But detraining penalty should be gentler than overtraining
        const overtrained = calculateReadinessScore(-20); // Same distance from optimal
        expect(detrained).toBeGreaterThan(overtrained);
    });

    it('should clamp result between 0 and 100', () => {
        const result = calculateReadinessScore(20);
        expect(result).toBeLessThanOrEqual(100);
        expect(result).toBeGreaterThanOrEqual(0);
    });
});

// ============================================================================
// calculateDailyMetrics TESTS
// ============================================================================

describe('calculateDailyMetrics', () => {
    it('should return metrics for each day in range', () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-07');
        const result = calculateDailyMetrics([], startDate, endDate, 150);

        expect(result).toHaveLength(7);
        expect(result[0].date).toBe('2024-01-01');
        expect(result[6].date).toBe('2024-01-07');
    });

    it('should calculate ATL and CTL with EWMA', () => {
        const sessions = [
            createSession({ date: '2024-01-01', duration: 60, power: 150, rpe: 7 })
        ];
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-03');
        const result = calculateDailyMetrics(sessions, startDate, endDate, 150);

        // First day should have higher ATL due to session
        expect(result[0].atl).toBeGreaterThan(result[0].ctl);
    });

    it('should calculate fatigue and readiness scores', () => {
        const sessions = [
            createSession({ date: '2024-01-01', duration: 60, power: 150, rpe: 7 })
        ];
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-03');
        const result = calculateDailyMetrics(sessions, startDate, endDate, 150);

        // All days should have valid scores
        for (const day of result) {
            expect(day.fatigueScore).toBeGreaterThanOrEqual(0);
            expect(day.fatigueScore).toBeLessThanOrEqual(100);
            expect(day.readinessScore).toBeGreaterThanOrEqual(0);
            expect(day.readinessScore).toBeLessThanOrEqual(100);
        }
    });
});

// ============================================================================
// getCurrentMetrics TESTS
// ============================================================================

describe('getCurrentMetrics', () => {
    it('should return default values for empty sessions', () => {
        const result = getCurrentMetrics(
            [],
            new Date('2024-01-01'),
            new Date('2024-01-15'),
            150
        );

        expect(result.fatigue).toBeLessThan(5); // Very low fatigue for new user
        expect(result.readiness).toBeGreaterThan(0);
        expect(result.ctl).toBeGreaterThanOrEqual(0);
    });

    it('should return latest metrics after sessions', () => {
        const sessions = [
            createSession({ date: '2024-01-10', duration: 60, power: 180, rpe: 8 }),
            createSession({ date: '2024-01-12', duration: 45, power: 160, rpe: 7 })
        ];
        const result = getCurrentMetrics(
            sessions,
            new Date('2024-01-01'),
            new Date('2024-01-15'),
            150
        );

        expect(result.fatigue).toBeGreaterThan(0);
        expect(result.atl).toBeGreaterThan(0);
        expect(result.ctl).toBeGreaterThan(0);
    });
});
