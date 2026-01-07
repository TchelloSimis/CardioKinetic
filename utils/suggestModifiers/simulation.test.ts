/**
 * Unit tests for suggestModifiers/simulation.ts
 * 
 * Tests simulation and analysis pipeline.
 * Uses Chronic Fatigue Model (dual-compartment) function signatures.
 */

import { describe, it, expect } from 'vitest';
import {
    calculateFatigueScore,
    calculateReadinessScore,
    runSingleSimulation,
    runFullAnalysis
} from './simulation';
import { WeekDefinition } from '../../programTemplate';
import { DEFAULT_CAP_METABOLIC, DEFAULT_CAP_STRUCTURAL } from '../chronicFatigueModel';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createWeekDef = (overrides: Partial<WeekDefinition> = {}): WeekDefinition => ({
    position: 1,
    phaseName: 'Build',
    description: 'Test week',
    focus: 'Volume',
    powerMultiplier: 1.0,
    workRestRatio: '1:1',
    targetRPE: 7,
    durationMinutes: 30,
    ...overrides
});

// ============================================================================
// calculateFatigueScore TESTS (Chronic Model)
// ============================================================================

describe('calculateFatigueScore', () => {
    it('should return low fatigue when compartments are low', () => {
        // Low chronic state = low fatigue
        const result = calculateFatigueScore(5, 3);
        expect(result).toBeLessThan(30);
    });

    it('should return ~50 for moderate chronic state', () => {
        // Mid-range chronic state
        const capMeta = DEFAULT_CAP_METABOLIC;
        const capStruct = DEFAULT_CAP_STRUCTURAL;
        const result = calculateFatigueScore(capMeta * 0.5, capStruct * 0.5);
        expect(result).toBeGreaterThan(40);
        expect(result).toBeLessThan(60);
    });

    it('should return high fatigue when compartments are high', () => {
        const capMeta = DEFAULT_CAP_METABOLIC;
        const capStruct = DEFAULT_CAP_STRUCTURAL;
        const result = calculateFatigueScore(capMeta * 0.9, capStruct * 0.9);
        expect(result).toBeGreaterThan(80);
    });

    it('should be bounded between 0 and 100', () => {
        expect(calculateFatigueScore(0, 0)).toBeGreaterThanOrEqual(0);
        expect(calculateFatigueScore(200, 200)).toBeLessThanOrEqual(100);
    });
});

// ============================================================================
// calculateReadinessScore TESTS (Chronic Model)
// ============================================================================

describe('calculateReadinessScore', () => {
    it('should return high readiness when compartments are low', () => {
        // Low chronic state = high readiness
        const result = calculateReadinessScore(0, 0);
        expect(result).toBeGreaterThan(80);
    });

    it('should return lower readiness when metabolic fatigue is high', () => {
        const low = calculateReadinessScore(0, 0);
        const high = calculateReadinessScore(50, 10);
        expect(high).toBeLessThan(low);
    });

    it('should return lower readiness when structural fatigue is high', () => {
        const low = calculateReadinessScore(0, 0);
        const high = calculateReadinessScore(10, 50);
        expect(high).toBeLessThan(low);
    });

    it('should be bounded between 0 and 100', () => {
        expect(calculateReadinessScore(0, 0)).toBeLessThanOrEqual(100);
        expect(calculateReadinessScore(200, 200)).toBeGreaterThanOrEqual(0);
    });
});

// ============================================================================
// runSingleSimulation TESTS
// ============================================================================

describe('runSingleSimulation', () => {
    it('should return daily fatigue and readiness arrays', () => {
        const weeks = [createWeekDef()];
        const result = runSingleSimulation(weeks, 150);

        expect(result).toHaveProperty('dailyFatigue');
        expect(result).toHaveProperty('dailyReadiness');
        expect(Array.isArray(result.dailyFatigue)).toBe(true);
        expect(Array.isArray(result.dailyReadiness)).toBe(true);
    });

    it('should return 7 days per week', () => {
        const weeks = [createWeekDef(), createWeekDef()];
        const result = runSingleSimulation(weeks, 150);

        expect(result.dailyFatigue.length).toBe(14);
        expect(result.dailyReadiness.length).toBe(14);
    });

    it('should return valid fatigue scores', () => {
        const weeks = [createWeekDef()];
        const result = runSingleSimulation(weeks, 150);

        for (const score of result.dailyFatigue) {
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
        }
    });

    it('should return valid readiness scores', () => {
        const weeks = [createWeekDef()];
        const result = runSingleSimulation(weeks, 150);

        for (const score of result.dailyReadiness) {
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
        }
    });
});

// ============================================================================
// runFullAnalysis TESTS
// ============================================================================

describe('runFullAnalysis', () => {
    it('should return empty analysis for empty weeks', () => {
        const result = runFullAnalysis([], 150, 10, [], []);

        expect(result.weekAnalyses).toHaveLength(0);
        expect(result.globalTrend).toBe('stable');
    });

    it('should return analysis with required properties', () => {
        const weeks = [
            createWeekDef({ position: 1 }),
            createWeekDef({ position: 2 }),
            createWeekDef({ position: 3 }),
            createWeekDef({ position: 4 })
        ];

        // Generate fake simulation data
        const fatigueData = weeks.map(() => [40, 45, 50, 55, 60]);
        const readinessData = weeks.map(() => [70, 65, 60, 55, 50]);

        const result = runFullAnalysis(weeks, 150, 5, fatigueData, readinessData);

        expect(result).toHaveProperty('weekAnalyses');
        expect(result).toHaveProperty('detectedCycles');
        expect(result).toHaveProperty('globalTrend');
        expect(result).toHaveProperty('adaptationScore');
        expect(result).toHaveProperty('adaptiveWindows');
    });

    it('should return weekAnalyses for each week', () => {
        const weeks = [
            createWeekDef({ position: 1 }),
            createWeekDef({ position: 2 })
        ];

        const fatigueData = weeks.map(() => [45, 50, 55]);
        const readinessData = weeks.map(() => [65, 60, 55]);

        const result = runFullAnalysis(weeks, 150, 3, fatigueData, readinessData);

        expect(result.weekAnalyses.length).toBe(2);
    });

    it('should calculate percentiles in week analyses', () => {
        const weeks = [createWeekDef()];
        const fatigueData = [[30, 40, 50, 60, 70]];
        const readinessData = [[40, 50, 60, 70, 80]];

        const result = runFullAnalysis(weeks, 150, 5, fatigueData, readinessData);

        expect(result.weekAnalyses[0]).toHaveProperty('fatigueP50');
        expect(result.weekAnalyses[0]).toHaveProperty('readinessP50');
    });

    it('should detect global trend for programs with 4+ weeks', () => {
        const weeks = [
            createWeekDef({ position: 1, powerMultiplier: 0.8 }),
            createWeekDef({ position: 2, powerMultiplier: 0.9 }),
            createWeekDef({ position: 3, powerMultiplier: 1.0 }),
            createWeekDef({ position: 4, powerMultiplier: 1.1 })
        ];

        // Increasing fatigue over time
        const fatigueData = [[30], [40], [50], [60]];
        const readinessData = [[70], [60], [50], [40]];

        const result = runFullAnalysis(weeks, 150, 1, fatigueData, readinessData);

        expect(['improving', 'stable', 'declining']).toContain(result.globalTrend);
    });

    it('should calculate adaptation score', () => {
        const weeks = [
            createWeekDef({ position: 1 }),
            createWeekDef({ position: 2 }),
            createWeekDef({ position: 3 }),
            createWeekDef({ position: 4 })
        ];

        const fatigueData = weeks.map(() => [50, 55]);
        const readinessData = weeks.map(() => [55, 50]);

        const result = runFullAnalysis(weeks, 150, 2, fatigueData, readinessData);

        expect(result.adaptationScore).toBeGreaterThanOrEqual(-1);
        expect(result.adaptationScore).toBeLessThanOrEqual(1);
    });
});
