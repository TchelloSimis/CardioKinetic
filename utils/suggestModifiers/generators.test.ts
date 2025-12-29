/**
 * Unit tests for suggestModifiers/generators.ts
 * 
 * Tests modifier generation logic.
 */

import { describe, it, expect } from 'vitest';
import { generateSmartModifiers } from './generators';
import { WeekDefinition, CyclePhase, FatigueModifier } from '../../programTemplate';
import { TrendAnalysis, WeekAnalysis } from './types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createWeekAnalysis = (overrides: Partial<WeekAnalysis> = {}): WeekAnalysis => ({
    weekNumber: 1,
    phaseName: 'Build',
    powerMultiplier: 1.0,
    fatigueP15: 30,
    fatigueP30: 40,
    fatigueP50: 50,
    fatigueP70: 60,
    fatigueP85: 70,
    readinessP15: 55,
    readinessP30: 65,
    readinessP50: 75,
    readinessP70: 85,
    readinessP85: 90,
    fatigueVelocity: 2,
    fatigueAcceleration: 0,
    cyclePhase: 'ascending' as CyclePhase,
    cycleIndex: 0,
    isLocalPeak: false,
    isLocalTrough: false,
    ...overrides
});

const createAnalysis = (overrides: Partial<TrendAnalysis> = {}): TrendAnalysis => ({
    weekAnalyses: [createWeekAnalysis()],
    detectedCycles: [],
    globalTrend: 'stable',
    adaptationScore: 0,
    adaptiveWindows: { local: 2, meso: 4 },
    ...overrides
});

const createWeekDef = (overrides: Partial<WeekDefinition> = {}): WeekDefinition => ({
    position: 1,
    phaseName: 'Build',
    description: 'Test week',
    focus: 'Volume',
    powerMultiplier: 1.0,
    workRestRatio: '1:1',
    targetRPE: 7,
    ...overrides
});

// ============================================================================
// generateSmartModifiers TESTS
// ============================================================================

describe('generateSmartModifiers', () => {
    it('should return array of modifiers', () => {
        const analysis = createAnalysis();
        const weeks = [createWeekDef()];

        const modifiers = generateSmartModifiers(analysis, weeks);

        expect(Array.isArray(modifiers)).toBe(true);
    });

    it('should return empty array for empty week analyses', () => {
        const analysis = createAnalysis({ weekAnalyses: [] });
        const weeks = [createWeekDef()];

        const modifiers = generateSmartModifiers(analysis, weeks);

        expect(modifiers).toHaveLength(0);
    });

    it('should generate modifiers with required fields', () => {
        const analysis = createAnalysis({
            weekAnalyses: [createWeekAnalysis({
                fatigueP70: 80,
                fatigueP85: 90
            })]
        });
        const weeks = [createWeekDef()];

        const modifiers = generateSmartModifiers(analysis, weeks);

        for (const mod of modifiers) {
            expect(mod.condition).toBeDefined();
            expect(mod.adjustments).toBeDefined();
        }
    });

    it('should generate fatigue-based modifiers for high fatigue predictions', () => {
        const analysis = createAnalysis({
            weekAnalyses: [createWeekAnalysis({
                fatigueP50: 75,
                fatigueP70: 85,
                fatigueP85: 92
            })]
        });
        const weeks = [createWeekDef()];

        const modifiers = generateSmartModifiers(analysis, weeks);

        // Should have at least one modifier with fatigue condition
        const hasFatigueModifier = modifiers.some(m =>
            typeof m.condition === 'object' &&
            (m.condition as any).fatigue !== undefined
        );
        expect(hasFatigueModifier).toBe(true);
    });

    it('should generate readiness-based modifiers for low readiness predictions', () => {
        const analysis = createAnalysis({
            weekAnalyses: [createWeekAnalysis({
                readinessP15: 25,
                readinessP30: 35,
                readinessP50: 45
            })]
        });
        const weeks = [createWeekDef()];

        const modifiers = generateSmartModifiers(analysis, weeks);

        // Should have at least one modifier with readiness condition
        const hasReadinessModifier = modifiers.some(m =>
            typeof m.condition === 'object' &&
            (m.condition as any).readiness !== undefined
        );
        expect(hasReadinessModifier).toBe(true);
    });

    it('should include cycle phase in some modifiers', () => {
        const analysis = createAnalysis({
            weekAnalyses: [createWeekAnalysis({ cyclePhase: 'peak' })]
        });
        const weeks = [createWeekDef()];

        const modifiers = generateSmartModifiers(analysis, weeks);

        // Some modifiers should be phase-specific
        const hasPhaseModifier = modifiers.some(m => m.cyclePhase !== undefined);
        expect(hasPhaseModifier).toBe(true);
    });

    it('should include overload protection modifiers', () => {
        const analysis = createAnalysis();
        const weeks = [createWeekDef()];

        const modifiers = generateSmartModifiers(analysis, weeks);

        // Should have critical fatigue modifier (>82%) - see generators.ts line 552
        const hasCriticalModifier = modifiers.some(m =>
            typeof m.condition === 'object' &&
            (m.condition as any).fatigue === '>82'
        );
        expect(hasCriticalModifier).toBe(true);
    });

    it('should generate session-type specific modifiers for interval sessions', () => {
        const analysis = createAnalysis();
        const weeks = [createWeekDef({ sessionStyle: 'interval' })];

        const modifiers = generateSmartModifiers(analysis, weeks);

        // Should have at least one interval-specific modifier
        const hasIntervalModifier = modifiers.some(m => m.sessionType === 'interval');
        expect(hasIntervalModifier).toBe(true);
    });

    it('should generate session-type specific modifiers for steady-state sessions', () => {
        const analysis = createAnalysis();
        const weeks = [createWeekDef({ sessionStyle: 'steady-state' })];

        const modifiers = generateSmartModifiers(analysis, weeks);

        // Should have at least one steady-state-specific modifier
        const hasSteadyStateModifier = modifiers.some(m => m.sessionType === 'steady-state');
        expect(hasSteadyStateModifier).toBe(true);
    });

    it('should generate trend-based modifiers for declining adaptation', () => {
        const analysis = createAnalysis({
            globalTrend: 'declining',
            adaptationScore: -0.5
        });
        const weeks = [createWeekDef()];

        const modifiers = generateSmartModifiers(analysis, weeks);

        // Should have a declining trend modifier
        const hasTrendModifier = modifiers.some(m =>
            m.adjustments.message?.toLowerCase().includes('declining')
        );
        expect(hasTrendModifier).toBe(true);
    });

    it('should generate opportunity modifiers for improving adaptation', () => {
        const analysis = createAnalysis({
            globalTrend: 'improving',
            adaptationScore: 0.7
        });
        const weeks = [createWeekDef()];

        const modifiers = generateSmartModifiers(analysis, weeks);

        // Should have an improving trend modifier
        const hasImprovingModifier = modifiers.some(m =>
            m.adjustments.message?.toLowerCase().includes('excellent')
        );
        expect(hasImprovingModifier).toBe(true);
    });

    it('should handle multiple cycle phases', () => {
        const analysis = createAnalysis({
            weekAnalyses: [
                createWeekAnalysis({ weekNumber: 1, cyclePhase: 'ascending' }),
                createWeekAnalysis({ weekNumber: 2, cyclePhase: 'peak' }),
                createWeekAnalysis({ weekNumber: 3, cyclePhase: 'descending' }),
                createWeekAnalysis({ weekNumber: 4, cyclePhase: 'trough' })
            ]
        });
        const weeks = [
            createWeekDef({ position: 1 }),
            createWeekDef({ position: 2 }),
            createWeekDef({ position: 3 }),
            createWeekDef({ position: 4 })
        ];

        const modifiers = generateSmartModifiers(analysis, weeks);

        // Should have modifiers for different phases
        expect(modifiers.length).toBeGreaterThan(5);
    });

    it('should include priority in all modifiers', () => {
        const analysis = createAnalysis();
        const weeks = [createWeekDef()];

        const modifiers = generateSmartModifiers(analysis, weeks);

        for (const mod of modifiers) {
            expect(typeof mod.priority).toBe('number');
        }
    });

    it('should include adjustments with message', () => {
        const analysis = createAnalysis();
        const weeks = [createWeekDef()];

        const modifiers = generateSmartModifiers(analysis, weeks);

        // Most modifiers should have messages
        const withMessages = modifiers.filter(m => m.adjustments.message);
        expect(withMessages.length).toBeGreaterThan(0);
    });
});
