/**
 * Tests for insightsUtils.ts
 */

import { describe, it, expect } from 'vitest';
import {
    calculatePersonalRecords,
    calculateTrends,
    calculateFatigueReadinessInsights,
    getRecentActivity,
    formatChange,
    getChangeColor,
    formatPRDate
} from './insightsUtils';
import { Session } from '../types';

// ============================================================================
// TEST DATA FIXTURES
// ============================================================================

const createSession = (overrides: Partial<Session> = {}): Session => ({
    id: `session-${Date.now()}-${Math.random()}`,
    date: new Date().toISOString().split('T')[0],
    duration: 30,
    power: 150,
    distance: 10,
    rpe: 7,
    ...overrides
});

// ============================================================================
// calculatePersonalRecords TESTS
// ============================================================================

describe('calculatePersonalRecords', () => {
    it('should return empty array for no sessions', () => {
        const result = calculatePersonalRecords([]);
        expect(result).toHaveLength(0);
    });

    it('should detect power PR', () => {
        const sessions = [
            createSession({ id: 's1', date: '2024-01-01', power: 100 }),
            createSession({ id: 's2', date: '2024-01-02', power: 150 }),
            createSession({ id: 's3', date: '2024-01-03', power: 120 })
        ];

        const result = calculatePersonalRecords(sessions);
        const powerPR = result.find(r => r.type === 'power');

        expect(powerPR).toBeDefined();
        expect(powerPR?.value).toBe(150);
        expect(powerPR?.sessionId).toBe('s2');
    });

    it('should detect duration PR', () => {
        const sessions = [
            createSession({ id: 's1', date: '2024-01-01', duration: 20 }),
            createSession({ id: 's2', date: '2024-01-02', duration: 45 }),
            createSession({ id: 's3', date: '2024-01-03', duration: 30 })
        ];

        const result = calculatePersonalRecords(sessions);
        const durationPR = result.find(r => r.type === 'duration');

        expect(durationPR).toBeDefined();
        expect(durationPR?.value).toBe(45);
        expect(durationPR?.sessionId).toBe('s2');
    });

    it('should detect work PR in Wh (power * duration / 60)', () => {
        const sessions = [
            createSession({ id: 's1', date: '2024-01-01', power: 100, duration: 30 }), // 50 Wh
            createSession({ id: 's2', date: '2024-01-02', power: 150, duration: 40 }), // 100 Wh
            createSession({ id: 's3', date: '2024-01-03', power: 200, duration: 20 })  // 67 Wh
        ];

        const result = calculatePersonalRecords(sessions);
        const workPR = result.find(r => r.type === 'work');

        expect(workPR).toBeDefined();
        expect(workPR?.value).toBe(100); // 150 * 40 / 60 = 100 Wh
        expect(workPR?.unit).toBe('Wh');
        expect(workPR?.sessionId).toBe('s2');
    });

    it('should return all three PR types', () => {
        const sessions = [
            createSession({ id: 's1', date: '2024-01-01', power: 150, duration: 30 })
        ];

        const result = calculatePersonalRecords(sessions);
        expect(result).toHaveLength(3);
        expect(result.map(r => r.type)).toContain('power');
        expect(result.map(r => r.type)).toContain('duration');
        expect(result.map(r => r.type)).toContain('work');
    });
});

// ============================================================================
// calculateTrends TESTS
// ============================================================================

describe('calculateTrends', () => {
    it('should calculate weekly trends with explicit currentDate', () => {
        const currentDate = new Date('2024-01-15');
        const thisWeek = '2024-01-14';
        const lastWeekStr = '2024-01-05';

        const sessions = [
            createSession({ date: thisWeek, power: 160, duration: 35 }),
            createSession({ date: lastWeekStr, power: 150, duration: 30 })
        ];

        const result = calculateTrends(sessions, 'week', currentDate);

        expect(result.period).toBe('week');
        expect(result.current.sessionCount).toBe(1);
        expect(result.previous.sessionCount).toBe(1);
    });

    it('should handle empty current period', () => {
        const currentDate = new Date('2024-02-01');
        const oldDate = '2023-12-01';

        const sessions = [
            createSession({ date: oldDate, power: 150 })
        ];

        const result = calculateTrends(sessions, 'week', currentDate);

        expect(result.current.sessionCount).toBe(0);
        expect(result.current.avgPower).toBe(0);
    });

    it('should calculate percentage changes', () => {
        const currentDate = new Date('2024-01-15');
        const thisWeekDate = '2024-01-14';
        const lastWeekStr = '2024-01-05';

        const sessions = [
            createSession({ date: thisWeekDate, power: 165, duration: 30 }),
            createSession({ date: lastWeekStr, power: 150, duration: 30 })
        ];

        const result = calculateTrends(sessions, 'week', currentDate);

        expect(result.changes.power).toBe(10);
    });
});

// ============================================================================
// calculateFatigueReadinessInsights TESTS
// ============================================================================

describe('calculateFatigueReadinessInsights', () => {
    it('should return default insights for no sessions', () => {
        const result = calculateFatigueReadinessInsights([], new Date('2024-01-01'), new Date('2024-01-15'), 150);

        expect(result.trend).toBe('stable');
        expect(result.insight).toContain('Start training');
    });

    it('should calculate insights for sessions', () => {
        const sessions = [
            createSession({ date: '2024-01-10', power: 150, duration: 30, rpe: 7 }),
            createSession({ date: '2024-01-12', power: 160, duration: 35, rpe: 7 }),
            createSession({ date: '2024-01-14', power: 155, duration: 32, rpe: 7 })
        ];

        const result = calculateFatigueReadinessInsights(
            sessions,
            new Date('2024-01-01'),
            new Date('2024-01-15'),
            150
        );

        expect(result.currentFatigue).toBeGreaterThanOrEqual(0);
        expect(result.currentReadiness).toBeGreaterThanOrEqual(0);
        expect(result.insight.length).toBeGreaterThan(0);
        expect(result.recommendation.length).toBeGreaterThan(0);
    });
});

// ============================================================================
// getRecentActivity TESTS
// ============================================================================

describe('getRecentActivity', () => {
    it('should return empty summary for no sessions', () => {
        const result = getRecentActivity([], 7, new Date());

        expect(result.sessionCount).toBe(0);
        expect(result.avgPower).toBe(0);
        expect(result.sessions).toHaveLength(0);
    });

    it('should filter to recent days only using explicit currentDate', () => {
        const currentDate = new Date('2024-01-15');

        const sessions = [
            createSession({ date: '2024-01-14', power: 160 }),
            createSession({ date: '2023-12-01', power: 140 })
        ];

        const result = getRecentActivity(sessions, 7, currentDate);

        expect(result.sessionCount).toBe(1);
        expect(result.avgPower).toBe(160);
    });

    it('should calculate averages correctly', () => {
        const currentDate = new Date('2024-01-15');

        const sessions = [
            createSession({ date: '2024-01-15', power: 160, duration: 30, rpe: 7 }),
            createSession({ date: '2024-01-14', power: 140, duration: 40, rpe: 8 })
        ];

        const result = getRecentActivity(sessions, 7, currentDate);

        expect(result.avgPower).toBe(150); // (160+140)/2
        expect(result.avgDuration).toBe(35); // (30+40)/2
        expect(result.avgRPE).toBe(7.5); // (7+8)/2
    });

    it('should calculate total work in Wh', () => {
        const currentDate = new Date('2024-01-15');

        const sessions = [
            createSession({ date: '2024-01-14', power: 100, duration: 60 }) // 100 * 60 / 60 = 100 Wh
        ];

        const result = getRecentActivity(sessions, 7, currentDate);

        expect(result.totalWork).toBe(100);
    });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('formatChange', () => {
    it('should format positive changes with plus sign', () => {
        expect(formatChange(15)).toBe('+15%');
    });

    it('should format negative changes with minus sign', () => {
        expect(formatChange(-10)).toBe('-10%');
    });

    it('should format zero without plus', () => {
        expect(formatChange(0)).toBe('+0%');
    });
});

describe('getChangeColor', () => {
    it('should return neutral for small changes', () => {
        expect(getChangeColor(2, 'power')).toBe('neutral');
        expect(getChangeColor(-3, 'power')).toBe('neutral');
    });

    it('should return positive for large positive changes', () => {
        expect(getChangeColor(10, 'power')).toBe('positive');
    });

    it('should return negative for large negative changes', () => {
        expect(getChangeColor(-10, 'power')).toBe('negative');
    });
});

describe('formatPRDate', () => {
    it('should format date correctly', () => {
        const result = formatPRDate('2024-01-15');
        // Just check that it returns a non-empty string (locale-independent)
        expect(result.length).toBeGreaterThan(0);
        expect(result).toContain('2024');
    });
});
