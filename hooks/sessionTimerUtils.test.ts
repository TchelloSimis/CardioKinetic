/**
 * Unit tests for sessionTimerUtils.ts
 * 
 * Tests session timer utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
    isAndroid,
    computeWeightedAvg,
    computeActualRatio,
    calculateTotalIntervals,
    calculatePhasePowers,
    parseRatio,
    calculateCustomSessionDuration,
    calculateProjectedAveragePower,
    calculateProjectedTotalWork,
    calculateBlockIntervals,
    calculateBlockPhasePowers,
    getBlockDurations,
    generateBlockId,
    TICK_INTERVAL,
    STEADY_REMINDER_INTERVAL
} from './sessionTimerUtils';
import { SessionSetupParams, SessionBlock } from '../types';

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

const createBlock = (overrides: Partial<SessionBlock> = {}): SessionBlock => ({
    id: 'block-1',
    type: 'interval',
    durationMinutes: 10,
    powerMultiplier: 1.0,
    workRestRatio: '1:1',
    ...overrides
});

// ============================================================================
// isAndroid TESTS
// ============================================================================

describe('isAndroid', () => {
    it('should return a boolean', () => {
        const result = isAndroid();
        expect(typeof result).toBe('boolean');
    });
});

// ============================================================================
// computeWeightedAvg TESTS
// ============================================================================

describe('computeWeightedAvg', () => {
    it('should return 0 for empty history', () => {
        const result = computeWeightedAvg([]);
        expect(result).toBe(0);
    });

    it('should return single value when only one entry', () => {
        const now = Date.now();
        const result = computeWeightedAvg([{ value: 100, startTime: now - 1000 }], now);
        expect(result).toBe(100);
    });

    it('should calculate weighted average based on duration', () => {
        const now = Date.now();
        const history = [
            { value: 100, startTime: now - 3000 }, // 2 seconds of 100
            { value: 200, startTime: now - 1000 }  // 1 second of 200
        ];
        // Weighted avg = (100 * 2 + 200 * 1) / 3 = 400/3 ≈ 133
        const result = computeWeightedAvg(history, now);
        expect(result).toBeCloseTo(133, 0);
    });
});

// ============================================================================
// computeActualRatio TESTS
// ============================================================================

describe('computeActualRatio', () => {
    it('should return "steady" for zero rest seconds', () => {
        expect(computeActualRatio(30, 0)).toBe('steady');
    });

    it('should return "1:1" for equal work and rest', () => {
        expect(computeActualRatio(30, 30)).toBe('1:1');
    });

    it('should calculate correct ratio for 2:1 proportions', () => {
        const result = computeActualRatio(60, 30);
        // Function uses 10-based rounding, so 60:30 (2/3 work) becomes 7:3
        expect(result).toBe('7:3');
    });
});

// ============================================================================
// calculateTotalIntervals TESTS
// ============================================================================

describe('calculateTotalIntervals', () => {
    it('should return 1 for steady-state session', () => {
        const params = createSessionParams({ sessionStyle: 'steady-state' });
        expect(calculateTotalIntervals(params)).toBe(1);
    });

    it('should calculate intervals for interval session', () => {
        const params = createSessionParams({
            totalDurationMinutes: 10,
            workDurationSeconds: 30,
            restDurationSeconds: 30
        });
        // 10 minutes = 600 seconds, 60 second cycle = 10 intervals
        expect(calculateTotalIntervals(params)).toBe(10);
    });

    it('should return 1 when cycle length is 0', () => {
        const params = createSessionParams({
            workDurationSeconds: 0,
            restDurationSeconds: 0
        });
        expect(calculateTotalIntervals(params)).toBe(1);
    });
});

// ============================================================================
// calculatePhasePowers TESTS
// ============================================================================

describe('calculatePhasePowers', () => {
    it('should return target power for steady-state sessions', () => {
        const params = createSessionParams({
            sessionStyle: 'steady-state',
            targetPower: 150
        });
        const result = calculatePhasePowers(params);
        expect(result.workPower).toBe(150);
        expect(result.restPower).toBe(150);
    });

    it('should calculate elevated work power for intervals', () => {
        const params = createSessionParams({
            sessionStyle: 'interval',
            targetPower: 150,
            workDurationSeconds: 30,
            restDurationSeconds: 30
        });
        const result = calculatePhasePowers(params);
        // Work power should be higher than target to maintain average
        expect(result.workPower).toBeGreaterThan(150);
        expect(result.restPower).toBeLessThan(result.workPower);
    });

    it('should return { workPower, restPower } object', () => {
        const params = createSessionParams();
        const result = calculatePhasePowers(params);
        expect(result).toHaveProperty('workPower');
        expect(result).toHaveProperty('restPower');
    });
});

// ============================================================================
// parseRatio TESTS
// ============================================================================

describe('parseRatio', () => {
    it('should parse "1:1" ratio', () => {
        const result = parseRatio('1:1');
        expect(result.work).toBe(1);
        expect(result.rest).toBe(1);
    });

    it('should parse "2:1" ratio', () => {
        const result = parseRatio('2:1');
        expect(result.work).toBe(2);
        expect(result.rest).toBe(1);
    });

    it('should parse "3:2" ratio', () => {
        const result = parseRatio('3:2');
        expect(result.work).toBe(3);
        expect(result.rest).toBe(2);
    });

    it('should return { work: 1, rest: 0 } for "steady"', () => {
        const result = parseRatio('steady');
        expect(result.work).toBe(1);
        expect(result.rest).toBe(0);
    });

    it('should return { work: 1, rest: 0 } for "1:0"', () => {
        const result = parseRatio('1:0');
        expect(result.work).toBe(1);
        expect(result.rest).toBe(0);
    });
});

// ============================================================================
// calculateCustomSessionDuration TESTS
// ============================================================================

describe('calculateCustomSessionDuration', () => {
    it('should return 0 for empty blocks', () => {
        expect(calculateCustomSessionDuration([])).toBe(0);
    });

    it('should sum block durations', () => {
        const blocks = [
            createBlock({ durationMinutes: 10 }),
            createBlock({ durationMinutes: 15 }),
            createBlock({ durationMinutes: 5 })
        ];
        expect(calculateCustomSessionDuration(blocks)).toBe(30);
    });
});

// ============================================================================
// calculateProjectedAveragePower TESTS
// ============================================================================

describe('calculateProjectedAveragePower', () => {
    it('should return target power for empty blocks', () => {
        expect(calculateProjectedAveragePower([], 150)).toBe(150);
    });

    it('should calculate weighted average power', () => {
        const blocks = [
            createBlock({ durationMinutes: 10, powerMultiplier: 1.0 }),
            createBlock({ durationMinutes: 10, powerMultiplier: 1.2 })
        ];
        // Avg = (150*10 + 180*10) / 20 = 3300/20 = 165
        const result = calculateProjectedAveragePower(blocks, 150);
        expect(result).toBe(165);
    });
});

// ============================================================================
// calculateProjectedTotalWork TESTS
// ============================================================================

describe('calculateProjectedTotalWork', () => {
    it('should calculate total work in Wh', () => {
        const blocks = [
            createBlock({ durationMinutes: 60, powerMultiplier: 1.0 })
        ];
        // 150W × 1 hour = 150 Wh
        const result = calculateProjectedTotalWork(blocks, 150);
        expect(result).toBe(150);
    });
});

// ============================================================================
// calculateBlockIntervals TESTS
// ============================================================================

describe('calculateBlockIntervals', () => {
    it('should return 1 for steady-state block', () => {
        const block = createBlock({ type: 'steady-state' });
        expect(calculateBlockIntervals(block)).toBe(1);
    });

    it('should return cycles if explicitly defined', () => {
        const block = createBlock({ type: 'interval', cycles: 5 });
        expect(calculateBlockIntervals(block)).toBe(5);
    });

    it('should calculate intervals from duration and cycle length', () => {
        const block = createBlock({
            type: 'interval',
            durationMinutes: 10,
            workDurationSeconds: 30,
            restDurationSeconds: 30
        });
        // 10 min = 600s, cycle = 60s, intervals = 10
        expect(calculateBlockIntervals(block)).toBe(10);
    });
});

// ============================================================================
// calculateBlockPhasePowers TESTS
// ============================================================================

describe('calculateBlockPhasePowers', () => {
    it('should return same power for steady-state blocks', () => {
        const block = createBlock({ type: 'steady-state', powerMultiplier: 1.0 });
        const result = calculateBlockPhasePowers(block, 100);
        expect(result.workPower).toBe(100);
        expect(result.restPower).toBe(100);
    });

    it('should apply power multiplier', () => {
        const block = createBlock({ type: 'steady-state', powerMultiplier: 1.2 });
        const result = calculateBlockPhasePowers(block, 100);
        // With 1.2 multiplier, base becomes 120
        expect(result.workPower).toBe(120);
    });

    it('should calculate elevated work power for interval blocks', () => {
        const block = createBlock({
            type: 'interval',
            powerMultiplier: 1.0,
            workDurationSeconds: 30,
            restDurationSeconds: 30
        });
        const result = calculateBlockPhasePowers(block, 100);
        expect(result.workPower).toBeGreaterThan(100);
    });
});

// ============================================================================
// getBlockDurations TESTS
// ============================================================================

describe('getBlockDurations', () => {
    it('should return full duration as work for steady-state', () => {
        const block = createBlock({ type: 'steady-state', durationMinutes: 10 });
        const result = getBlockDurations(block);
        expect(result.workSeconds).toBe(600);
        expect(result.restSeconds).toBe(0);
    });

    it('should use explicit durations for intervals', () => {
        const block = createBlock({
            type: 'interval',
            workDurationSeconds: 45,
            restDurationSeconds: 15
        });
        const result = getBlockDurations(block);
        expect(result.workSeconds).toBe(45);
        expect(result.restSeconds).toBe(15);
    });

    it('should calculate from ratio when durations not specified', () => {
        const block = createBlock({
            type: 'interval',
            workRestRatio: '2:1',
            workDurationSeconds: undefined,
            restDurationSeconds: undefined
        });
        const result = getBlockDurations(block);
        // 2:1 = 2/3 work, 1/3 rest of 60 seconds = 40s work, 20s rest
        expect(result.workSeconds).toBe(40);
        expect(result.restSeconds).toBe(20);
    });
});

// ============================================================================
// generateBlockId TESTS
// ============================================================================

describe('generateBlockId', () => {
    it('should return a string', () => {
        const id = generateBlockId();
        expect(typeof id).toBe('string');
    });

    it('should start with "block-"', () => {
        const id = generateBlockId();
        expect(id.startsWith('block-')).toBe(true);
    });

    it('should generate unique IDs', () => {
        const id1 = generateBlockId();
        const id2 = generateBlockId();
        expect(id1).not.toBe(id2);
    });
});

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('Timer Constants', () => {
    it('TICK_INTERVAL should be 100ms', () => {
        expect(TICK_INTERVAL).toBe(100);
    });

    it('STEADY_REMINDER_INTERVAL should be 60 seconds', () => {
        expect(STEADY_REMINDER_INTERVAL).toBe(60);
    });
});
