/**
 * Unit tests for LiveSessionGuide utilities
 */

import { describe, it, expect } from 'vitest';
import {
    getPhaseColor,
    getPhaseLabel,
    formatTimeDisplay,
    formatDurationMinutes,
    calculateSessionProgress,
    calculatePhaseProgress,
    createSessionSummary,
    validateSessionParams,
    adjustPower,
} from './sessionGuideUtils';

describe('LiveSessionGuide Utilities', () => {
    describe('getPhaseColor', () => {
        it('should return accent color for steady-state', () => {
            const result = getPhaseColor('work', 'steady-state', '#34d399');
            expect(result).toBe('#34d399');
        });

        it('should return accent for work phase in interval', () => {
            const result = getPhaseColor('work', 'interval', '#34d399');
            expect(result).toBe('#34d399');
        });

        it('should return gray for rest phase in interval', () => {
            const result = getPhaseColor('rest', 'interval', '#34d399');
            expect(result).toBe('#6b7280');
        });
    });

    describe('getPhaseLabel', () => {
        it('should return STEADY STATE for steady-state session', () => {
            const result = getPhaseLabel('work', 'steady-state');
            expect(result).toBe('STEADY STATE');
        });

        it('should return WORK for work phase', () => {
            const result = getPhaseLabel('work', 'interval');
            expect(result).toBe('WORK');
        });

        it('should return REST for rest phase', () => {
            const result = getPhaseLabel('rest', 'interval');
            expect(result).toBe('REST');
        });
    });

    describe('formatTimeDisplay', () => {
        it('should format 0 seconds', () => {
            expect(formatTimeDisplay(0)).toBe('0:00');
        });

        it('should format 90 seconds as 1:30', () => {
            expect(formatTimeDisplay(90)).toBe('1:30');
        });

        it('should format 3661 seconds as 61:01', () => {
            expect(formatTimeDisplay(3661)).toBe('61:01');
        });

        it('should handle negative values', () => {
            expect(formatTimeDisplay(-30)).toBe('-0:30');
        });
    });

    describe('formatDurationMinutes', () => {
        it('should format less than 1 minute as seconds', () => {
            expect(formatDurationMinutes(0.5)).toBe('30s');
        });

        it('should format 1 minute', () => {
            expect(formatDurationMinutes(1)).toBe('1min');
        });

        it('should format 15.5 minutes', () => {
            expect(formatDurationMinutes(15.5)).toBe('15.5min');
        });
    });

    describe('calculateSessionProgress', () => {
        it('should return 0 at start', () => {
            expect(calculateSessionProgress(0, 10)).toBe(0);
        });

        it('should return 50 at halfway', () => {
            expect(calculateSessionProgress(300, 10)).toBe(50);
        });

        it('should cap at 100', () => {
            expect(calculateSessionProgress(700, 10)).toBe(100);
        });
    });

    describe('calculatePhaseProgress', () => {
        it('should return 0 when full time remaining', () => {
            expect(calculatePhaseProgress(30, 30)).toBe(0);
        });

        it('should return 50 at halfway', () => {
            expect(calculatePhaseProgress(15, 30)).toBe(50);
        });

        it('should return 100 when no time remaining', () => {
            expect(calculatePhaseProgress(0, 30)).toBe(100);
        });
    });

    describe('createSessionSummary', () => {
        it('should format steady-state summary', () => {
            const result = createSessionSummary({
                actualDurationMinutes: 15,
                averagePower: 150,
                intervalsCompleted: 0,
                sessionStyle: 'steady-state',
            } as any);
            expect(result).toBe('15min @ 150W');
        });

        it('should format interval summary', () => {
            const result = createSessionSummary({
                actualDurationMinutes: 10,
                averagePower: 180,
                intervalsCompleted: 10,
                sessionStyle: 'interval',
            } as any);
            expect(result).toBe('10 intervals, 10min total');
        });
    });

    describe('validateSessionParams', () => {
        it('should return false for null params', () => {
            expect(validateSessionParams(null)).toBe(false);
        });

        it('should return false for missing sessionStyle', () => {
            expect(validateSessionParams({ totalDurationMinutes: 10, targetPower: 100 } as any)).toBe(false);
        });

        it('should return false for zero duration', () => {
            expect(validateSessionParams({
                sessionStyle: 'interval',
                totalDurationMinutes: 0,
                targetPower: 100
            } as any)).toBe(false);
        });

        it('should return true for valid params', () => {
            expect(validateSessionParams({
                sessionStyle: 'interval',
                totalDurationMinutes: 10,
                targetPower: 150
            } as any)).toBe(true);
        });
    });

    describe('adjustPower', () => {
        it('should increase power', () => {
            expect(adjustPower(100, 5)).toBe(105);
        });

        it('should decrease power', () => {
            expect(adjustPower(100, -5)).toBe(95);
        });

        it('should cap at max power', () => {
            expect(adjustPower(495, 10)).toBe(500);
        });

        it('should floor at min power', () => {
            expect(adjustPower(55, -10)).toBe(50);
        });
    });
});
