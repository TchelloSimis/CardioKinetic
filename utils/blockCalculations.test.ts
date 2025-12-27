/**
 * Unit tests for blockCalculations.ts
 * 
 * Tests block metric calculations for templates and sessions.
 */

import { describe, it, expect } from 'vitest';
import {
    calculateBlockMetricsFromTemplate,
    calculateBlockMetricsFromSession,
    BlockMetrics
} from './blockCalculations';
import { TemplateBlock } from '../programTemplate';
import { SessionBlock } from '../types';

// ============================================================================
// calculateBlockMetricsFromTemplate TESTS
// ============================================================================

describe('calculateBlockMetricsFromTemplate', () => {
    it('should return base power for empty blocks', () => {
        const result = calculateBlockMetricsFromTemplate([], 150);

        expect(result.averagePower).toBe(150);
        expect(result.totalDuration).toBe(0);
        expect(result.totalWork).toBe(0);
    });

    it('should calculate metrics for a single steady block', () => {
        const blocks: TemplateBlock[] = [{
            type: 'steady-state',
            powerExpression: 1.0,
            durationExpression: 30
        }];

        const result = calculateBlockMetricsFromTemplate(blocks, 150);

        expect(result.averagePower).toBe(150);
        expect(result.totalDuration).toBe(30);
        // Work = Power * Duration / 60 = 150 * 30 / 60 = 75 Wh
        expect(result.totalWork).toBe(75);
    });

    it('should apply power multiplier correctly', () => {
        const blocks: TemplateBlock[] = [{
            type: 'steady-state',
            powerExpression: 1.2, // 120% of base power
            durationExpression: 30
        }];

        const result = calculateBlockMetricsFromTemplate(blocks, 100);

        expect(result.averagePower).toBe(120);
    });

    it('should apply week power multiplier correctly', () => {
        const blocks: TemplateBlock[] = [{
            type: 'steady-state',
            powerExpression: 1.0,
            durationExpression: 30
        }];

        const result = calculateBlockMetricsFromTemplate(blocks, 100, 1.1);

        expect(result.averagePower).toBe(110); // 100 * 1.0 * 1.1
    });

    it('should calculate time-weighted average power for multiple blocks', () => {
        const blocks: TemplateBlock[] = [
            { type: 'steady-state', powerExpression: 0.8, durationExpression: 10 },
            { type: 'steady-state', powerExpression: 1.2, durationExpression: 10 }
        ];

        const result = calculateBlockMetricsFromTemplate(blocks, 100);

        // Weighted avg: (80*10 + 120*10) / 20 = 2000/20 = 100
        expect(result.averagePower).toBe(100);
        expect(result.totalDuration).toBe(20);
    });

    it('should handle interval blocks with cycles', () => {
        const blocks: TemplateBlock[] = [{
            type: 'interval',
            powerExpression: 1.0,
            durationExpression: 5, // 5 minutes total
            cycles: 5,
            workDurationSeconds: 30,
            restDurationSeconds: 30
        }];

        const result = calculateBlockMetricsFromTemplate(blocks, 150);

        // Duration = cycles * (work + rest) / 60 = 5 * 60 / 60 = 5 min
        expect(result.totalDuration).toBe(5);
    });

    it('should parse string power expressions', () => {
        const blocks: TemplateBlock[] = [{
            type: 'steady-state',
            powerExpression: '0.9' as any,
            durationExpression: 30
        }];

        const result = calculateBlockMetricsFromTemplate(blocks, 100);

        expect(result.averagePower).toBe(90);
    });

    it('should default to 1.0 for invalid power expression', () => {
        const blocks: TemplateBlock[] = [{
            type: 'steady-state',
            powerExpression: 'invalid' as any,
            durationExpression: 30
        }];

        const result = calculateBlockMetricsFromTemplate(blocks, 100);

        expect(result.averagePower).toBe(100); // Defaults to 1.0
    });
});

// ============================================================================
// calculateBlockMetricsFromSession TESTS
// ============================================================================

describe('calculateBlockMetricsFromSession', () => {
    it('should return target power for empty blocks', () => {
        const result = calculateBlockMetricsFromSession([], 150);

        expect(result.averagePower).toBe(150);
        expect(result.totalDuration).toBe(0);
        expect(result.totalWork).toBe(0);
    });

    it('should calculate metrics for a single block', () => {
        const blocks: SessionBlock[] = [{
            id: 'block-1',
            type: 'steady-state',
            durationMinutes: 30,
            powerMultiplier: 1.0,
            workRestRatio: 'steady'
        }];

        const result = calculateBlockMetricsFromSession(blocks, 150);

        expect(result.averagePower).toBe(150);
        expect(result.totalDuration).toBe(30);
        expect(result.totalWork).toBe(75); // 150 * 30 / 60
    });

    it('should apply power multiplier correctly', () => {
        const blocks: SessionBlock[] = [{
            id: 'block-1',
            type: 'steady-state',
            durationMinutes: 30,
            powerMultiplier: 1.2,
            workRestRatio: 'steady'
        }];

        const result = calculateBlockMetricsFromSession(blocks, 100);

        expect(result.averagePower).toBe(120);
    });

    it('should calculate time-weighted average for multiple blocks', () => {
        const blocks: SessionBlock[] = [
            { id: 'b1', type: 'steady-state', durationMinutes: 10, powerMultiplier: 0.8, workRestRatio: 'steady' },
            { id: 'b2', type: 'steady-state', durationMinutes: 10, powerMultiplier: 1.2, workRestRatio: 'steady' }
        ];

        const result = calculateBlockMetricsFromSession(blocks, 100);

        // Weighted avg: (80*10 + 120*10) / 20 = 100
        expect(result.averagePower).toBe(100);
        expect(result.totalDuration).toBe(20);
    });

    it('should calculate total work correctly', () => {
        const blocks: SessionBlock[] = [
            { id: 'b1', type: 'steady-state', durationMinutes: 60, powerMultiplier: 1.0, workRestRatio: 'steady' }
        ];

        const result = calculateBlockMetricsFromSession(blocks, 100);

        // Work = 100W * 60min / 60 = 100 Wh
        expect(result.totalWork).toBe(100);
    });

    it('should handle mixed block types', () => {
        const blocks: SessionBlock[] = [
            { id: 'b1', type: 'steady-state', durationMinutes: 20, powerMultiplier: 0.7, workRestRatio: 'steady' },
            { id: 'b2', type: 'interval', durationMinutes: 10, powerMultiplier: 1.3, workRestRatio: '1:1' }
        ];

        const result = calculateBlockMetricsFromSession(blocks, 100);

        expect(result.totalDuration).toBe(30);
        // Avg power: (70*20 + 130*10) / 30 = 2700/30 = 90
        expect(result.averagePower).toBe(90);
    });
});
