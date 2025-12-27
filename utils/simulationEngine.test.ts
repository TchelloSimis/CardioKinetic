/**
 * Unit tests for simulationEngine.ts
 * 
 * Tests Monte Carlo simulation for training program predictions.
 */

import { describe, it, expect } from 'vitest';
import {
    runMonteCarloSimulation,
    flattenForChart,
    SimulationParams,
    SimulationResult
} from './simulationEngine';
import { ProgramPreset, PlanWeek } from '../types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockPreset = (): ProgramPreset => ({
    id: 'test-preset',
    name: 'Test Preset',
    description: 'A test preset',
    generator: (basePower: number, weekCount?: number): PlanWeek[] => {
        const weeks = weekCount ?? 4;
        return Array.from({ length: weeks }, (_, i) => ({
            week: i + 1,
            phaseName: `Week ${i + 1}`,
            focus: 'Volume' as const,
            plannedPower: basePower * (1 + i * 0.02),
            targetRPE: 6 + Math.floor(i / 2),
            workRestRatio: '1:1',
            sessionStyle: 'interval' as const,
            targetDurationMinutes: 30
        }));
    },
    weekCount: 4,
    progressionMode: 'power'
});

// ============================================================================
// runMonteCarloSimulation TESTS
// ============================================================================

describe('runMonteCarloSimulation', () => {
    it('should return result with correct structure', () => {
        const params: SimulationParams = {
            preset: createMockPreset(),
            basePower: 150,
            weekCount: 4,
            iterations: 100 // Use fewer iterations for testing
        };

        const result = runMonteCarloSimulation(params);

        expect(result).toHaveProperty('weeks');
        expect(result).toHaveProperty('programName');
        expect(result).toHaveProperty('basePower');
        expect(result).toHaveProperty('weekCount');
        expect(result).toHaveProperty('iterations');
    });

    it('should generate data for each week', () => {
        const params: SimulationParams = {
            preset: createMockPreset(),
            basePower: 150,
            weekCount: 6,
            iterations: 50
        };

        const result = runMonteCarloSimulation(params);

        expect(result.weeks).toHaveLength(6);
        expect(result.weekCount).toBe(6);
    });

    it('should include percentile bands for fatigue', () => {
        const params: SimulationParams = {
            preset: createMockPreset(),
            basePower: 150,
            weekCount: 4,
            iterations: 100
        };

        const result = runMonteCarloSimulation(params);

        for (const week of result.weeks) {
            expect(week.fatigue).toHaveProperty('min');
            expect(week.fatigue).toHaveProperty('p25');
            expect(week.fatigue).toHaveProperty('median');
            expect(week.fatigue).toHaveProperty('p75');
            expect(week.fatigue).toHaveProperty('max');

            // Verify ordering
            expect(week.fatigue.min).toBeLessThanOrEqual(week.fatigue.p25);
            expect(week.fatigue.p25).toBeLessThanOrEqual(week.fatigue.median);
            expect(week.fatigue.median).toBeLessThanOrEqual(week.fatigue.p75);
            expect(week.fatigue.p75).toBeLessThanOrEqual(week.fatigue.max);
        }
    });

    it('should include percentile bands for readiness', () => {
        const params: SimulationParams = {
            preset: createMockPreset(),
            basePower: 150,
            weekCount: 4,
            iterations: 100
        };

        const result = runMonteCarloSimulation(params);

        for (const week of result.weeks) {
            expect(week.readiness).toHaveProperty('min');
            expect(week.readiness).toHaveProperty('p25');
            expect(week.readiness).toHaveProperty('median');
            expect(week.readiness).toHaveProperty('p75');
            expect(week.readiness).toHaveProperty('max');

            // Verify ordering
            expect(week.readiness.min).toBeLessThanOrEqual(week.readiness.p25);
            expect(week.readiness.p25).toBeLessThanOrEqual(week.readiness.median);
            expect(week.readiness.median).toBeLessThanOrEqual(week.readiness.p75);
            expect(week.readiness.p75).toBeLessThanOrEqual(week.readiness.max);
        }
    });

    it('should include planned power and work', () => {
        const params: SimulationParams = {
            preset: createMockPreset(),
            basePower: 150,
            weekCount: 4,
            iterations: 50
        };

        const result = runMonteCarloSimulation(params);

        for (const week of result.weeks) {
            expect(week.plannedPower).toBeGreaterThan(0);
            expect(week.plannedWork).toBeGreaterThan(0);
        }
    });

    it('should use default iterations when not specified', () => {
        const params: SimulationParams = {
            preset: createMockPreset(),
            basePower: 150,
            weekCount: 2
            // No iterations specified
        };

        const result = runMonteCarloSimulation(params);

        expect(result.iterations).toBeGreaterThan(0);
    });

    it('should preserve metadata from preset', () => {
        const params: SimulationParams = {
            preset: createMockPreset(),
            basePower: 200,
            weekCount: 4,
            iterations: 50
        };

        const result = runMonteCarloSimulation(params);

        expect(result.programName).toBe('Test Preset');
        expect(result.basePower).toBe(200);
    });
});

// ============================================================================
// flattenForChart TESTS
// ============================================================================

describe('flattenForChart', () => {
    it('should flatten simulation result for chart consumption', () => {
        const simulatedResult: SimulationResult = {
            weeks: [
                {
                    week: 1,
                    plannedPower: 150,
                    plannedWork: 75,
                    fatigue: { min: 10, p25: 20, median: 30, p75: 40, max: 50 },
                    readiness: { min: 60, p25: 70, median: 80, p75: 85, max: 90 },
                    phase: 'Build'
                }
            ],
            programName: 'Test',
            basePower: 150,
            weekCount: 1,
            iterations: 100
        };

        const flattened = flattenForChart(simulatedResult);

        expect(flattened).toHaveLength(1);
        expect(flattened[0]).toHaveProperty('week', 1);
        expect(flattened[0]).toHaveProperty('plannedPower', 150);
    });

    it('should include all percentile keys', () => {
        const simulatedResult: SimulationResult = {
            weeks: [
                {
                    week: 1,
                    plannedPower: 150,
                    plannedWork: 75,
                    fatigue: { min: 10, p25: 20, median: 30, p75: 40, max: 50 },
                    readiness: { min: 60, p25: 70, median: 80, p75: 85, max: 90 },
                    phase: 'Build'
                }
            ],
            programName: 'Test',
            basePower: 150,
            weekCount: 1,
            iterations: 100
        };

        const flattened = flattenForChart(simulatedResult);

        expect(flattened[0]).toHaveProperty('fatigueMin', 10);
        expect(flattened[0]).toHaveProperty('fatigueP25', 20);
        expect(flattened[0]).toHaveProperty('fatigueMedian', 30);
        expect(flattened[0]).toHaveProperty('fatigueP75', 40);
        expect(flattened[0]).toHaveProperty('fatigueMax', 50);

        expect(flattened[0]).toHaveProperty('readinessMin', 60);
        expect(flattened[0]).toHaveProperty('readinessP25', 70);
        expect(flattened[0]).toHaveProperty('readinessMedian', 80);
        expect(flattened[0]).toHaveProperty('readinessP75', 85);
        expect(flattened[0]).toHaveProperty('readinessMax', 90);
    });

    it('should include phase name', () => {
        const simulatedResult: SimulationResult = {
            weeks: [
                {
                    week: 1,
                    plannedPower: 150,
                    plannedWork: 75,
                    fatigue: { min: 10, p25: 20, median: 30, p75: 40, max: 50 },
                    readiness: { min: 60, p25: 70, median: 80, p75: 85, max: 90 },
                    phase: 'Peak'
                }
            ],
            programName: 'Test',
            basePower: 150,
            weekCount: 1,
            iterations: 100
        };

        const flattened = flattenForChart(simulatedResult);

        // Name is formatted as 'W{week}', phase is stored in 'phase' field
        expect(flattened[0]).toHaveProperty('name', 'W1');
        expect(flattened[0]).toHaveProperty('phase', 'Peak');
    });

    it('should handle multiple weeks', () => {
        const simulatedResult: SimulationResult = {
            weeks: [
                {
                    week: 1,
                    plannedPower: 150,
                    plannedWork: 75,
                    fatigue: { min: 10, p25: 20, median: 30, p75: 40, max: 50 },
                    readiness: { min: 60, p25: 70, median: 80, p75: 85, max: 90 },
                    phase: 'Build'
                },
                {
                    week: 2,
                    plannedPower: 155,
                    plannedWork: 78,
                    fatigue: { min: 15, p25: 25, median: 35, p75: 45, max: 55 },
                    readiness: { min: 55, p25: 65, median: 75, p75: 80, max: 85 },
                    phase: 'Build'
                }
            ],
            programName: 'Test',
            basePower: 150,
            weekCount: 2,
            iterations: 100
        };

        const flattened = flattenForChart(simulatedResult);

        expect(flattened).toHaveLength(2);
        expect(flattened[0].week).toBe(1);
        expect(flattened[1].week).toBe(2);
    });
});
