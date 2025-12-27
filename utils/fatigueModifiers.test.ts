/**
 * Unit tests for fatigueModifiers.ts
 * 
 * Tests fatigue modifier detection and application.
 */

import { describe, it, expect } from 'vitest';
import {
    detectCyclePhase,
    checkFatigueCondition,
    applyFatigueModifiers,
    FATIGUE_THRESHOLDS,
    READINESS_THRESHOLDS
} from './fatigueModifiers';
import { FatigueModifier, FatigueContext } from '../programTemplate';
import { PlanWeek } from '../types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createContext = (overrides: Partial<FatigueContext> = {}): FatigueContext => ({
    fatigueScore: 50,
    readinessScore: 70,
    ...overrides
});

const createPlanWeek = (overrides: Partial<PlanWeek> = {}): PlanWeek => ({
    week: 4,
    phaseName: 'Build',
    focus: 'Volume',
    plannedPower: 150,
    targetRPE: 7,
    workRestRatio: '1:1',
    sessionStyle: 'interval',
    targetDurationMinutes: 30,
    ...overrides
});

const createModifier = (overrides: Partial<FatigueModifier> = {}): FatigueModifier => ({
    condition: 'high_fatigue',
    adjustments: { powerMultiplier: 0.9 },
    ...overrides
});

// ============================================================================
// THRESHOLD CONSTANTS TESTS
// ============================================================================

describe('Threshold Constants', () => {
    it('should have valid fatigue thresholds with min/max', () => {
        expect(FATIGUE_THRESHOLDS).toBeDefined();
        expect(FATIGUE_THRESHOLDS.low_fatigue.max).toBe(30);
        expect(FATIGUE_THRESHOLDS.moderate_fatigue.min).toBe(30);
        expect(FATIGUE_THRESHOLDS.high_fatigue.min).toBe(60);
        expect(FATIGUE_THRESHOLDS.very_high_fatigue.min).toBe(80);
    });

    it('should have valid readiness thresholds with min/max', () => {
        expect(READINESS_THRESHOLDS).toBeDefined();
        expect(READINESS_THRESHOLDS.fresh.min).toBe(65);
        expect(READINESS_THRESHOLDS.recovered.min).toBe(50);
        expect(READINESS_THRESHOLDS.tired.min).toBe(35);
        expect(READINESS_THRESHOLDS.overreached.max).toBe(35);
    });
});

// ============================================================================
// detectCyclePhase TESTS
// ============================================================================

describe('detectCyclePhase', () => {
    it('should return undefined for insufficient data', () => {
        const result = detectCyclePhase([50, 55, 60]); // Less than 5 points
        expect(result.phase).toBeUndefined();
    });

    it('should detect ascending phase with increasing fatigue', () => {
        const history = [30, 40, 50, 60, 70, 75, 80];
        const result = detectCyclePhase(history);
        expect(['ascending', 'peak']).toContain(result.phase);
    });

    it('should detect descending phase with decreasing fatigue', () => {
        const history = [80, 70, 60, 50, 40, 35, 30];
        const result = detectCyclePhase(history);
        expect(['descending', 'trough']).toContain(result.phase);
    });

    it('should return confidence score', () => {
        const history = [30, 40, 50, 60, 70, 80, 90];
        const result = detectCyclePhase(history);

        expect(result.confidence).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should detect phase based on velocity and position', () => {
        // Stable-ish history at moderately high fatigue
        const history = [55, 56, 58, 57, 56, 58, 57];
        const result = detectCyclePhase(history);

        // Should return some phase
        expect(result.phase).toBeDefined();
    });
});

// ============================================================================
// checkFatigueCondition TESTS
// ============================================================================

describe('checkFatigueCondition', () => {
    it('should check legacy high_fatigue condition', () => {
        expect(checkFatigueCondition('high_fatigue', createContext({ fatigueScore: 70 }))).toBe(true);
        expect(checkFatigueCondition('high_fatigue', createContext({ fatigueScore: 50 }))).toBe(false);
    });

    it('should check legacy low_fatigue condition', () => {
        expect(checkFatigueCondition('low_fatigue', createContext({ fatigueScore: 20 }))).toBe(true);
        expect(checkFatigueCondition('low_fatigue', createContext({ fatigueScore: 40 }))).toBe(false);
    });

    it('should check legacy fresh condition', () => {
        expect(checkFatigueCondition('fresh', createContext({ readinessScore: 80 }))).toBe(true);
        expect(checkFatigueCondition('fresh', createContext({ readinessScore: 50 }))).toBe(false);
    });

    it('should check legacy overreached condition', () => {
        expect(checkFatigueCondition('overreached', createContext({ readinessScore: 25 }))).toBe(true);
        expect(checkFatigueCondition('overreached', createContext({ readinessScore: 50 }))).toBe(false);
    });

    it('should check flexible condition with fatigue threshold', () => {
        const condition = { logic: 'and' as const, fatigue: '>70' };
        expect(checkFatigueCondition(condition, createContext({ fatigueScore: 80 }))).toBe(true);
        expect(checkFatigueCondition(condition, createContext({ fatigueScore: 60 }))).toBe(false);
    });

    it('should check flexible condition with readiness threshold', () => {
        const condition = { logic: 'and' as const, readiness: '<50' };
        expect(checkFatigueCondition(condition, createContext({ readinessScore: 40 }))).toBe(true);
        expect(checkFatigueCondition(condition, createContext({ readinessScore: 60 }))).toBe(false);
    });

    it('should use OR logic when specified', () => {
        const condition = { logic: 'or' as const, fatigue: '>90', readiness: '<30' };
        // At least one should match
        expect(checkFatigueCondition(condition, createContext({ fatigueScore: 95, readinessScore: 50 }))).toBe(true);
        expect(checkFatigueCondition(condition, createContext({ fatigueScore: 50, readinessScore: 20 }))).toBe(true);
        // Neither matches
        expect(checkFatigueCondition(condition, createContext({ fatigueScore: 50, readinessScore: 50 }))).toBe(false);
    });

    it('should use AND logic when specified', () => {
        const condition = { logic: 'and' as const, fatigue: '>60', readiness: '<50' };
        // Both must match
        expect(checkFatigueCondition(condition, createContext({ fatigueScore: 70, readinessScore: 40 }))).toBe(true);
        // Only fatigue matches
        expect(checkFatigueCondition(condition, createContext({ fatigueScore: 70, readinessScore: 60 }))).toBe(false);
    });
});

// ============================================================================
// applyFatigueModifiers TESTS
// ============================================================================

describe('applyFatigueModifiers', () => {
    it('should return unchanged week when no modifiers match', () => {
        const week = createPlanWeek();
        const context = createContext({ fatigueScore: 30 }); // low fatigue
        const modifiers = [createModifier({ condition: 'high_fatigue' })];

        const result = applyFatigueModifiers(week, context, modifiers);

        expect(result.week.plannedPower).toBe(150);
        expect(result.messages).toHaveLength(0);
    });

    it('should apply power multiplier when condition matches', () => {
        const week = createPlanWeek({ plannedPower: 100 });
        const context = createContext({ fatigueScore: 70 }); // high fatigue
        const modifiers = [createModifier({
            condition: 'high_fatigue',
            adjustments: { powerMultiplier: 0.9 }
        })];

        const result = applyFatigueModifiers(week, context, modifiers);

        expect(result.week.plannedPower).toBe(90); // 100 * 0.9
    });

    it('should apply RPE adjustment', () => {
        const week = createPlanWeek({ targetRPE: 8 });
        const context = createContext({ fatigueScore: 70 }); // high fatigue
        const modifiers = [createModifier({
            condition: 'high_fatigue',
            adjustments: { rpeAdjust: -1 }
        })];

        const result = applyFatigueModifiers(week, context, modifiers);

        expect(result.week.targetRPE).toBe(7);
    });

    it('should apply rest multiplier for interval sessions', () => {
        const week = createPlanWeek({
            sessionStyle: 'interval',
            restDurationSeconds: 30
        });
        const context = createContext({ fatigueScore: 70 });
        const modifiers = [createModifier({
            condition: 'high_fatigue',
            adjustments: { restMultiplier: 1.5 }
        })];

        const result = applyFatigueModifiers(week, context, modifiers);

        expect(result.week.restDurationSeconds).toBe(45); // 30 * 1.5
    });

    it('should only apply highest priority modifier', () => {
        const week = createPlanWeek({ plannedPower: 100 });
        const context = createContext({ fatigueScore: 85 }); // very high fatigue
        const modifiers = [
            createModifier({
                priority: 2,
                condition: 'high_fatigue',
                adjustments: { powerMultiplier: 0.8 }
            }),
            createModifier({
                priority: 1,
                condition: 'very_high_fatigue',
                adjustments: { powerMultiplier: 0.7 }
            })
        ];

        const result = applyFatigueModifiers(week, context, modifiers);

        // Should apply priority 1 modifier (0.7 multiplier)
        expect(result.week.plannedPower).toBe(70);
    });

    it('should return message when modifier has message', () => {
        const week = createPlanWeek();
        const context = createContext({ fatigueScore: 70 });
        const modifiers = [createModifier({
            condition: 'high_fatigue',
            adjustments: { powerMultiplier: 0.9, message: 'High fatigue detected' }
        })];

        const result = applyFatigueModifiers(week, context, modifiers);

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]).toBe('High fatigue detected');
    });

    it('should clamp RPE between 1 and 10', () => {
        const week = createPlanWeek({ targetRPE: 9 });
        const context = createContext({ readinessScore: 90 });
        const modifiers = [createModifier({
            condition: 'fresh',
            adjustments: { rpeAdjust: 3 }
        })];

        const result = applyFatigueModifiers(week, context, modifiers);

        expect(result.week.targetRPE).toBe(10); // Clamped to max
    });

    it('should not go below 1 for RPE', () => {
        const week = createPlanWeek({ targetRPE: 2 });
        const context = createContext({ fatigueScore: 85 });
        const modifiers = [createModifier({
            condition: 'very_high_fatigue',
            adjustments: { rpeAdjust: -5 }
        })];

        const result = applyFatigueModifiers(week, context, modifiers);

        expect(result.week.targetRPE).toBe(1); // Clamped to min
    });
});
