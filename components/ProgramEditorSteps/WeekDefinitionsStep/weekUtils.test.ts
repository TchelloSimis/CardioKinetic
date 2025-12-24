/**
 * Unit tests for WeekDefinitionsStep utilities
 */

import { describe, it, expect } from 'vitest';
import {
    createDefaultWeek,
    createTrainingBlock,
    calculateIntervalDuration,
    getBlockSummary,
    SESSION_STYLE_OPTIONS,
} from './weekUtils';

describe('WeekDefinitionsStep Utilities', () => {
    describe('SESSION_STYLE_OPTIONS', () => {
        it('should have all required session styles', () => {
            expect(SESSION_STYLE_OPTIONS).toHaveLength(3);
            expect(SESSION_STYLE_OPTIONS.map(o => o.value)).toContain('interval');
            expect(SESSION_STYLE_OPTIONS.map(o => o.value)).toContain('steady-state');
            expect(SESSION_STYLE_OPTIONS.map(o => o.value)).toContain('custom');
        });
    });

    describe('createDefaultWeek', () => {
        it('should create week with steady-state defaults', () => {
            const week = createDefaultWeek(5, 'steady-state');

            expect(week.position).toBe(6);
            expect(week.phaseName).toBe('New Phase');
            expect(week.focus).toBe('Volume');
            expect(week.workRestRatio).toBe('steady');
            expect(week.sessionStyle).toBe('steady-state');
            expect(week.cycles).toBeUndefined();
        });

        it('should create week with interval defaults', () => {
            const week = createDefaultWeek(3, 'interval');

            expect(week.position).toBe(4);
            expect(week.sessionStyle).toBe('interval');
            expect(week.cycles).toBe(10);
            expect(week.workDurationSeconds).toBe(30);
            expect(week.restDurationSeconds).toBe(30);
            expect(week.durationMinutes).toBe(10);
            expect(week.workRestRatio).toBe('1:1');
        });

        it('should create week with custom defaults and blocks', () => {
            const week = createDefaultWeek(0, 'custom');

            expect(week.position).toBe(1);
            expect(week.sessionStyle).toBe('custom');
            expect(week.blocks).toBeDefined();
            expect(week.blocks).toHaveLength(1);
            expect(week.blocks![0].type).toBe('steady-state');
        });
    });

    describe('createTrainingBlock', () => {
        it('should create steady-state block with defaults', () => {
            const block = createTrainingBlock('steady-state');

            expect(block.type).toBe('steady-state');
            expect(block.durationExpression).toBe(5);
            expect(block.powerExpression).toBe(1.0);
            expect(block.cycles).toBeUndefined();
        });

        it('should create interval block with all fields', () => {
            const block = createTrainingBlock('interval');

            expect(block.type).toBe('interval');
            expect(block.durationExpression).toBe(5);
            expect(block.powerExpression).toBe(1.0);
            expect(block.cycles).toBe(5);
            expect(block.workDurationSeconds).toBe(30);
            expect(block.restDurationSeconds).toBe(30);
        });
    });

    describe('calculateIntervalDuration', () => {
        it('should calculate duration for 10 cycles of 30s/30s', () => {
            const duration = calculateIntervalDuration(10, 30, 30);
            expect(duration).toBe(10); // 10 * (30+30) / 60 = 10
        });

        it('should calculate duration for 5 cycles of 60s/30s', () => {
            const duration = calculateIntervalDuration(5, 60, 30);
            expect(duration).toBe(7.5); // 5 * (60+30) / 60 = 7.5
        });

        it('should calculate duration for 20 cycles of 15s/15s', () => {
            const duration = calculateIntervalDuration(20, 15, 15);
            expect(duration).toBe(10); // 20 * (15+15) / 60 = 10
        });
    });

    describe('getBlockSummary', () => {
        it('should format steady-state block summary', () => {
            const summary = getBlockSummary({
                type: 'steady-state',
                durationExpression: 10,
                powerExpression: 0.85
            });
            expect(summary).toBe('10min @ 85%');
        });

        it('should format interval block summary', () => {
            const summary = getBlockSummary({
                type: 'interval',
                durationExpression: 5,
                powerExpression: 1.0,
                cycles: 8,
                workDurationSeconds: 45,
                restDurationSeconds: 15
            });
            expect(summary).toBe('8×(45s/15s)');
        });

        it('should use defaults for missing interval values', () => {
            const summary = getBlockSummary({
                type: 'interval',
                durationExpression: 5,
                powerExpression: 1.0
            });
            expect(summary).toBe('5×(30s/30s)');
        });
    });
});
