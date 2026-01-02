/**
 * Unit tests for suggestModifiers/generators.ts
 * 
 * Tests modifier generation logic.
 */

import { describe, it, expect } from 'vitest';
import { generateSmartModifiers } from './generators';
import { WeekDefinition, FatigueModifier } from '../../programTemplate';
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

    it('should generate modifiers based on percentile thresholds', () => {
        const analysis = createAnalysis({
            weekAnalyses: [createWeekAnalysis({
                fatigueP70: 75,
                fatigueP85: 85,
                readinessP15: 25,
                readinessP30: 35
            })]
        });
        const weeks = [createWeekDef()];

        const modifiers = generateSmartModifiers(analysis, weeks);

        // Should generate modifiers for both fatigue and readiness
        expect(modifiers.length).toBeGreaterThan(0);
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

        // Should have progressively more aggressive modifiers
        const hasImprovingModifier = modifiers.some(m =>
            m.adjustments.message?.toLowerCase().includes('adaptation') ||
            m.adjustments.message?.toLowerCase().includes('overload')
        );
        expect(hasImprovingModifier).toBe(true);
    });

    it('should handle multiple weeks with different percentiles', () => {
        const analysis = createAnalysis({
            weekAnalyses: [
                createWeekAnalysis({ weekNumber: 1, fatigueP70: 60 }),
                createWeekAnalysis({ weekNumber: 2, fatigueP70: 70 }),
                createWeekAnalysis({ weekNumber: 3, fatigueP70: 80 }),
                createWeekAnalysis({ weekNumber: 4, fatigueP70: 70 })
            ]
        });
        const weeks = [
            createWeekDef({ position: 1 }),
            createWeekDef({ position: 2 }),
            createWeekDef({ position: 3 }),
            createWeekDef({ position: 4 })
        ];

        const modifiers = generateSmartModifiers(analysis, weeks);

        // Should generate modifiers based on aggregated percentile data
        expect(modifiers.length).toBeGreaterThan(0);
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

    it('should generate phaseName-based modifiers for named phases', () => {
        const analysis = createAnalysis({
            weekAnalyses: [
                createWeekAnalysis({ weekNumber: 1, phaseName: 'Build' }),
                createWeekAnalysis({ weekNumber: 2, phaseName: 'Build' }),
                createWeekAnalysis({ weekNumber: 3, phaseName: 'Peak' })
            ]
        });
        const weeks = [
            createWeekDef({ position: 1, phaseName: 'Build' }),
            createWeekDef({ position: 2, phaseName: 'Build' }),
            createWeekDef({ position: 3, phaseName: 'Peak' })
        ];

        const modifiers = generateSmartModifiers(analysis, weeks);

        // Should have phaseName-specific modifiers
        const hasPhaseNameModifier = modifiers.some(m => m.phaseName !== undefined);
        expect(hasPhaseNameModifier).toBe(true);
    });
});
