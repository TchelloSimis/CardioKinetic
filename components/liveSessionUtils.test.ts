/**
 * Unit tests for liveSessionUtils.ts
 * 
 * Tests time formatting, progress calculation, and chart data generation.
 */

import { describe, it, expect } from 'vitest';
import {
    formatTime,
    calculateProgress,
    getAccentDarkBg,
    generateSessionChartData
} from './liveSessionUtils';
import { SessionSetupParams, SessionResult, SessionBlock } from '../types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createSessionParams = (overrides: Partial<SessionSetupParams> = {}): SessionSetupParams => ({
    totalDurationMinutes: 30,
    targetPower: 150,
    targetRPE: 7,
    sessionStyle: 'interval',
    workDurationSeconds: 30,
    restDurationSeconds: 30,
    workRestRatio: '1:1',
    ...overrides
});

const createSessionResult = (overrides: Partial<SessionResult> = {}): SessionResult => ({
    actualDurationMinutes: 30,
    intervalsCompleted: 10,
    totalIntervals: 10,
    targetPower: 150,
    targetRPE: 7,
    workRestRatio: '1:1',
    sessionStyle: 'interval',
    wasCompleted: true,
    isGuidedSession: true,
    averagePower: 155,
    powerHistory: [
        { timeSeconds: 0, power: 150, phase: 'work' },
        { timeSeconds: 300, power: 160, phase: 'work' },
        { timeSeconds: 600, power: 155, phase: 'work' }
    ],
    ...overrides
});

// ============================================================================
// formatTime TESTS
// ============================================================================

describe('formatTime', () => {
    it('should format seconds only as 00:SS', () => {
        expect(formatTime(45)).toBe('00:45');
    });

    it('should format minutes and seconds as MM:SS', () => {
        expect(formatTime(125)).toBe('02:05');
    });

    it('should format exactly one minute as 01:00', () => {
        expect(formatTime(60)).toBe('01:00');
    });

    it('should pad seconds with leading zero', () => {
        expect(formatTime(65)).toBe('01:05');
    });

    it('should handle zero as 00:00', () => {
        expect(formatTime(0)).toBe('00:00');
    });

    it('should handle negative values as 00:00', () => {
        expect(formatTime(-10)).toBe('00:00');
    });
});

// ============================================================================
// calculateProgress TESTS
// ============================================================================

describe('calculateProgress', () => {
    it('should return 0 for elapsed = 0', () => {
        expect(calculateProgress(0, 100)).toBe(0);
    });

    it('should return 50 for elapsed = 50, total = 100', () => {
        expect(calculateProgress(50, 100)).toBe(50);
    });

    it('should return 100 for elapsed = total', () => {
        expect(calculateProgress(100, 100)).toBe(100);
    });

    it('should cap at 100 for elapsed > total', () => {
        expect(calculateProgress(150, 100)).toBe(100);
    });

    it('should return 0 for total <= 0', () => {
        expect(calculateProgress(50, 0)).toBe(0);
        expect(calculateProgress(50, -10)).toBe(0);
    });
});

// ============================================================================
// getAccentDarkBg TESTS
// ============================================================================

describe('getAccentDarkBg', () => {
    it('should return rgb format string', () => {
        const result = getAccentDarkBg('#ff0000');
        expect(result).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    });

    it('should return a darker color', () => {
        const result = getAccentDarkBg('#ffffff');
        // #ffffff at 15% = rgb(38, 38, 38)
        expect(result).toBe('rgb(38, 38, 38)');
    });

    it('should handle various hex colors', () => {
        expect(getAccentDarkBg('#ff0000')).toMatch(/^rgb\(/);
        expect(getAccentDarkBg('#00ff00')).toMatch(/^rgb\(/);
        expect(getAccentDarkBg('#0000ff')).toMatch(/^rgb\(/);
    });

    it('should handle edge cases without throwing', () => {
        // Function may not throw on all invalid inputs, but should return some rgb string
        expect(getAccentDarkBg('invalid')).toMatch(/^rgb\(/);
    });
});

// ============================================================================
// generateSessionChartData TESTS
// ============================================================================

describe('generateSessionChartData', () => {
    it('should return object with actualData, plannedData, and blockBoundaries', () => {
        const params = createSessionParams();
        const result = generateSessionChartData(params, null, 1800, 150, null);

        expect(result).toHaveProperty('actualData');
        expect(result).toHaveProperty('plannedData');
        expect(result).toHaveProperty('blockBoundaries');
    });

    it('should generate planned data for interval sessions', () => {
        const params = createSessionParams({
            sessionStyle: 'interval',
            totalDurationMinutes: 5,
            workDurationSeconds: 30,
            restDurationSeconds: 30
        });
        const result = generateSessionChartData(params, null, 300, 150, null);

        // Should have alternating work/rest power points
        expect(result.plannedData.length).toBeGreaterThan(2);
    });

    it('should generate two-point data for steady-state sessions', () => {
        const params = createSessionParams({
            sessionStyle: 'steady-state',
            totalDurationMinutes: 10
        });
        const result = generateSessionChartData(params, null, 600, 150, null);

        // Steady state should have start and end points
        expect(result.plannedData.length).toBe(2);
    });

    it('should use power history from result when available', () => {
        const params = createSessionParams();
        const sessionResult = createSessionResult({
            powerHistory: [
                { timeSeconds: 0, power: 150, phase: 'work' },
                { timeSeconds: 60, power: 160, phase: 'work' },
                { timeSeconds: 120, power: 155, phase: 'work' }
            ]
        });

        const result = generateSessionChartData(params, sessionResult, 1800, 150, null);

        expect(result.actualData.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle custom sessions with blocks', () => {
        const blocks: SessionBlock[] = [
            { id: '1', type: 'steady-state', durationMinutes: 5, powerMultiplier: 0.8 },
            { id: '2', type: 'interval', durationMinutes: 5, powerMultiplier: 1.0, workDurationSeconds: 30, restDurationSeconds: 30 }
        ];
        const params = createSessionParams({
            sessionStyle: 'custom',
            blocks
        });

        const result = generateSessionChartData(params, null, 600, 150, null);

        expect(result.plannedData.length).toBeGreaterThan(2);
        expect(result.blockBoundaries.length).toBe(1); // One boundary between two blocks
    });

    it('should use initialTargetPower when provided', () => {
        const params = createSessionParams({ targetPower: 200 });
        const result = generateSessionChartData(params, null, 1800, 150, 175);

        // Check that planned data uses initial target power (175) not current (150)
        expect(result.plannedData[0].plannedPower).toBeGreaterThanOrEqual(175);
    });

    it('should handle null params gracefully', () => {
        // Should not throw
        expect(() => generateSessionChartData(null, null, 1800, 150, null)).not.toThrow();
    });
});
