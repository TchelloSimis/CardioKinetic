/**
 * Critical Power Engine Tests
 * 
 * Unit tests for eCP estimation algorithm.
 */

import { describe, it, expect } from 'vitest';
import {
    extractMMPBests,
    fitCPModel,
    applySubmaximalAnchor,
    applyDecay,
    calculateECP,
    isMaxEffortSession,
    shouldRecalculateECP,
    calculateScaledWPrime,
    CP_ESTIMATION_DURATIONS,
    RPE_MAX_EFFORT_THRESHOLD,
    DECAY_THRESHOLD_DAYS,
} from './criticalPowerEngine';
import { Session, MMPRecord, CriticalPowerEstimate } from '../types';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createSession(overrides: Partial<Session> = {}): Session {
    return {
        id: `session-${Date.now()}-${Math.random()}`,
        date: new Date().toISOString().split('T')[0],
        duration: 30,
        power: 180,
        distance: 10,
        rpe: 7,
        ...overrides,
    };
}

function createMMPRecord(overrides: Partial<MMPRecord> = {}): MMPRecord {
    return {
        duration: 300,
        power: 250,
        date: new Date().toISOString().split('T')[0],
        rpe: 9,
        isMaximalEffort: true,
        ...overrides,
    };
}

function createCPEstimate(overrides: Partial<CriticalPowerEstimate> = {}): CriticalPowerEstimate {
    return {
        cp: 200,
        wPrime: 18000,
        confidence: 0.85,
        lastUpdated: new Date().toISOString(),
        dataPoints: 5,
        decayApplied: false,
        ...overrides,
    };
}

function getDateDaysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
}

// ============================================================================
// EXTRACT MMP BESTS TESTS
// ============================================================================

describe('extractMMPBests', () => {
    it('returns empty array for no sessions', () => {
        const result = extractMMPBests([]);
        expect(result).toEqual([]);
    });

    it('extracts MMP records for sessions with average power only', () => {
        const sessions = [
            createSession({ duration: 45, power: 200, rpe: 9, date: getDateDaysAgo(5) }),
        ];

        const result = extractMMPBests(sessions, 60);

        // Should have records for durations <= 45 min (2700 sec)
        expect(result.length).toBeGreaterThan(0);
        expect(result.every(r => r.duration <= 2700)).toBe(true);
        expect(result.every(r => r.power === 200)).toBe(true);
    });

    it('filters sessions outside lookback window', () => {
        const sessions = [
            createSession({ duration: 30, power: 250, date: getDateDaysAgo(90) }), // Too old
            createSession({ duration: 30, power: 200, date: getDateDaysAgo(30) }), // Within range
        ];

        const result = extractMMPBests(sessions, 60);

        // Only recent session should contribute
        expect(result.every(r => r.power === 200)).toBe(true);
    });

    it('keeps best power for each duration', () => {
        const sessions = [
            createSession({ duration: 30, power: 180, rpe: 8, date: getDateDaysAgo(10) }),
            createSession({ duration: 30, power: 220, rpe: 9, date: getDateDaysAgo(5) }),
            createSession({ duration: 30, power: 200, rpe: 8, date: getDateDaysAgo(3) }),
        ];

        const result = extractMMPBests(sessions, 60);

        // Each duration should have the best value (220)
        expect(result.every(r => r.power === 220)).toBe(true);
    });

    it('extracts from high-resolution power data when available', () => {
        // Create a session with 5-second power samples
        const powerData = Array(360).fill(180); // 30 minutes at 180W
        // Add a 3-minute burst at higher power (indices 0-36 = 180 seconds / 5 = 36 samples)
        for (let i = 60; i < 96; i++) {
            powerData[i] = 280;
        }

        const sessions = [
            createSession({
                duration: 30,
                power: 190, // Average is lower
                rpe: 9,
                date: getDateDaysAgo(5),
                secondBySecondPower: powerData,
            }),
        ];

        const result = extractMMPBests(sessions, 60);

        // Should find the 3-minute best around 280W, not the average
        const threeMinRecord = result.find(r => r.duration === 180);
        expect(threeMinRecord).toBeDefined();
        expect(threeMinRecord!.power).toBeGreaterThan(200);
    });
});

// ============================================================================
// FIT CP MODEL TESTS
// ============================================================================

describe('fitCPModel', () => {
    it('returns null for insufficient data points', () => {
        const records = [
            createMMPRecord({ duration: 180, power: 280 }),
            createMMPRecord({ duration: 300, power: 260 }),
        ];

        const result = fitCPModel(records);
        expect(result).toBeNull();
    });

    it('fits model with valid data points', () => {
        // Create data that follows P = CP + W'/t approximately
        // CP = 200, W' = 15000
        const records = [
            createMMPRecord({ duration: 180, power: 200 + 15000 / 180 }),  // ~283
            createMMPRecord({ duration: 300, power: 200 + 15000 / 300 }),  // ~250
            createMMPRecord({ duration: 720, power: 200 + 15000 / 720 }),  // ~221
            createMMPRecord({ duration: 1200, power: 200 + 15000 / 1200 }), // ~213
        ];

        const result = fitCPModel(records);

        expect(result).not.toBeNull();
        expect(result!.cp).toBeCloseTo(200, -1); // Within 10W
        expect(result!.wPrime).toBeCloseTo(15000, -2); // Within 1000J
        expect(result!.confidence).toBeGreaterThan(0.5);
        expect(result!.dataPoints).toBe(4);
    });

    it('prefers maximal efforts when available', () => {
        const records = [
            createMMPRecord({ duration: 180, power: 280, isMaximalEffort: true }),
            createMMPRecord({ duration: 300, power: 250, isMaximalEffort: true }),
            createMMPRecord({ duration: 720, power: 220, isMaximalEffort: true }),
            // These should be ignored since we have enough maximal efforts
            createMMPRecord({ duration: 1200, power: 180, isMaximalEffort: false }),
            createMMPRecord({ duration: 2400, power: 160, isMaximalEffort: false }),
        ];

        const result = fitCPModel(records);

        expect(result).not.toBeNull();
        expect(result!.dataPoints).toBe(3); // Only maximal efforts used
    });

    it('uses all data when insufficient maximal efforts', () => {
        const records = [
            createMMPRecord({ duration: 180, power: 280, isMaximalEffort: true }),
            createMMPRecord({ duration: 300, power: 250, isMaximalEffort: false }),
            createMMPRecord({ duration: 720, power: 220, isMaximalEffort: false }),
            createMMPRecord({ duration: 1200, power: 210, isMaximalEffort: false }),
        ];

        const result = fitCPModel(records);

        expect(result).not.toBeNull();
        expect(result!.dataPoints).toBe(4); // All data used (only 1 maximal)
        expect(result!.confidence).toBeLessThan(0.8); // Lower confidence due to non-maximal
    });
});

// ============================================================================
// SUBMAXIMAL ANCHOR TESTS (ENHANCED VERSION)
// ============================================================================

describe('applySubmaximalAnchor', () => {
    it('returns unchanged estimate when no anchor sessions', () => {
        const estimate = createCPEstimate({ cp: 200 });
        const sessions: Session[] = [];

        const result = applySubmaximalAnchor(estimate, sessions);

        expect(result.cp).toBe(200);
    });

    it('adjusts CP upward with proximity factor for low RPE', () => {
        const estimate = createCPEstimate({ cp: 180, confidence: 0.8 });
        const sessions = [
            createSession({
                duration: 25, // 25 minutes (>15 min threshold)
                power: 200,
                rpe: 4, // Low effort → proximity factor ~1.15
                date: getDateDaysAgo(10),
            }),
        ];

        const result = applySubmaximalAnchor(estimate, sessions, 60);

        // Expected: 200 * 1.15 = 230
        expect(result.cp).toBe(230);
        expect(result.confidence).toBeLessThan(0.8);
    });

    it('applies tighter constraint for higher RPE (closer to CP)', () => {
        const estimate = createCPEstimate({ cp: 180, confidence: 0.8 });
        const sessions = [
            createSession({
                duration: 25,
                power: 200,
                rpe: 7.5, // High effort → proximity factor ~1.02
                date: getDateDaysAgo(10),
            }),
        ];

        const result = applySubmaximalAnchor(estimate, sessions, 60);

        // Expected: 200 * ~1.02 = ~204 (closer to actual power when RPE is high)
        expect(result.cp).toBeGreaterThan(200);
        expect(result.cp).toBeLessThan(210);
    });

    it('does not adjust when estimate exceeds anchor floor', () => {
        const estimate = createCPEstimate({ cp: 250 });
        const sessions = [
            createSession({
                duration: 25,
                power: 200,
                rpe: 4,
                date: getDateDaysAgo(10),
            }),
        ];

        const result = applySubmaximalAnchor(estimate, sessions, 60);

        // 200 * 1.15 = 230, which is less than current 250
        expect(result.cp).toBe(250); // Unchanged
    });

    it('ignores short duration sessions', () => {
        const estimate = createCPEstimate({ cp: 180 });
        const sessions = [
            createSession({
                duration: 10, // Only 10 minutes (<15 min threshold)
                power: 210,
                rpe: 6,
                date: getDateDaysAgo(10),
            }),
        ];

        const result = applySubmaximalAnchor(estimate, sessions, 60);

        expect(result.cp).toBe(180); // Unchanged - session too short
    });

    it('ignores sessions with very high RPE (above 8)', () => {
        const estimate = createCPEstimate({ cp: 180 });
        const sessions = [
            createSession({
                duration: 25,
                power: 210,
                rpe: 9, // RPE too high (above 8)
                date: getDateDaysAgo(10),
            }),
        ];

        const result = applySubmaximalAnchor(estimate, sessions, 60);

        expect(result.cp).toBe(180); // Unchanged - RPE out of range
    });

    it('ignores sessions with very low RPE (below 4)', () => {
        const estimate = createCPEstimate({ cp: 180 });
        const sessions = [
            createSession({
                duration: 25,
                power: 210,
                rpe: 3, // RPE too low (below 4)
                date: getDateDaysAgo(10),
            }),
        ];

        const result = applySubmaximalAnchor(estimate, sessions, 60);

        expect(result.cp).toBe(180); // Unchanged - RPE out of range
    });
});

// ============================================================================
// DECAY TESTS
// ============================================================================

describe('applyDecay', () => {
    it('does not apply decay within threshold period', () => {
        const estimate = createCPEstimate({ cp: 200, decayApplied: false });
        const sessions = [
            createSession({
                power: 200,
                rpe: 9,
                date: getDateDaysAgo(20), // Within 28-day threshold
            }),
        ];

        const { estimate: result, daysSinceMaxEffort } = applyDecay(estimate, sessions);

        expect(result.cp).toBe(200);
        expect(result.decayApplied).toBe(false);
        expect(daysSinceMaxEffort).toBe(20);
    });

    it('applies decay after threshold period', () => {
        const estimate = createCPEstimate({
            cp: 200,
            decayApplied: false,
            lastUpdated: getDateDaysAgo(60),
        });
        const sessions: Session[] = []; // No max efforts

        const { estimate: result, daysSinceMaxEffort } = applyDecay(estimate, sessions);

        expect(result.cp).toBeLessThan(200);
        expect(result.decayApplied).toBe(true);
        expect(daysSinceMaxEffort).toBeGreaterThan(DECAY_THRESHOLD_DAYS);
    });

    it('calculates correct decay amount', () => {
        // 42 days since max effort = 28 threshold + 14 days = 2 weeks of decay
        // Decay = 0.5% per week, so ~1% total
        const estimate = createCPEstimate({
            cp: 200,
            decayApplied: false,
            lastUpdated: getDateDaysAgo(42),
        });
        const sessions: Session[] = [];

        const { estimate: result } = applyDecay(estimate, sessions);

        // Expected: 200 * (1 - 0.005)^2 ≈ 198
        expect(result.cp).toBeGreaterThan(195);
        expect(result.cp).toBeLessThan(200);
    });
});

// ============================================================================
// CALCULATE ECP TESTS
// ============================================================================

describe('calculateECP', () => {
    it('returns fallback estimate with no sessions', () => {
        const result = calculateECP([], new Date(), null, 150);

        expect(result.cp).toBe(135); // 150 * 0.9
        expect(result.confidence).toBe(0);
        expect(result.dataPoints).toBe(0);
    });

    it('returns existing estimate with decay if insufficient new data', () => {
        const existing = createCPEstimate({
            cp: 200,
            lastUpdated: getDateDaysAgo(60),
        });
        const sessions = [
            createSession({ duration: 10, power: 180, date: getDateDaysAgo(5) }), // Too short for MMP
        ];

        const result = calculateECP(sessions, new Date(), existing);

        // Should return decayed version of existing
        expect(result.cp).toBeLessThan(200);
    });

    it('calculates new estimate from sufficient data', () => {
        const sessions = [
            createSession({ duration: 45, power: 230, rpe: 9, date: getDateDaysAgo(5) }),
            createSession({ duration: 30, power: 245, rpe: 9, date: getDateDaysAgo(10) }),
            createSession({ duration: 20, power: 260, rpe: 9, date: getDateDaysAgo(15) }),
        ];

        const result = calculateECP(sessions);

        expect(result.cp).toBeGreaterThan(0);
        expect(result.wPrime).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThan(0);
    });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('isMaxEffortSession', () => {
    it('returns true for high RPE at high power', () => {
        const session = createSession({ rpe: 9, power: 200 });
        const estimate = createCPEstimate({ cp: 200 });

        expect(isMaxEffortSession(session, estimate)).toBe(true);
    });

    it('returns false for low RPE', () => {
        const session = createSession({ rpe: 6, power: 200 });
        const estimate = createCPEstimate({ cp: 200 });

        expect(isMaxEffortSession(session, estimate)).toBe(false);
    });

    it('returns false for low power relative to CP', () => {
        const session = createSession({ rpe: 9, power: 150 });
        const estimate = createCPEstimate({ cp: 200 });

        expect(isMaxEffortSession(session, estimate)).toBe(false);
    });
});

describe('shouldRecalculateECP', () => {
    it('returns true for max effort sessions', () => {
        const session = createSession({ rpe: 9, power: 200, duration: 30 });
        const estimate = createCPEstimate({ cp: 200, wPrime: 15000 });

        expect(shouldRecalculateECP(session, estimate)).toBe(true);
    });

    it('returns true when session power approaches expected', () => {
        const session = createSession({ rpe: 7, power: 240, duration: 10 });
        const estimate = createCPEstimate({ cp: 200, wPrime: 15000 });

        // 10 min = 600 sec, expected = 200 + 15000/600 = 225W
        // 240W > 225 * 0.95 = ~214W
        expect(shouldRecalculateECP(session, estimate)).toBe(true);
    });

    it('returns false for routine sessions', () => {
        const session = createSession({ rpe: 5, power: 150, duration: 30 });
        const estimate = createCPEstimate({ cp: 200, wPrime: 15000 });

        expect(shouldRecalculateECP(session, estimate)).toBe(false);
    });
});

// ============================================================================
// POPULATION-SCALED W' TESTS
// ============================================================================

describe('calculateScaledWPrime', () => {
    it('calculates W\' from CP using typical ratio', () => {
        expect(calculateScaledWPrime(200)).toBe(18000); // 200W × 90s
        expect(calculateScaledWPrime(150)).toBe(13500); // 150W × 90s
        expect(calculateScaledWPrime(250)).toBe(22500); // 250W × 90s
    });

    it('rounds to nearest integer', () => {
        expect(calculateScaledWPrime(177)).toBe(15930); // 177 × 90 = 15930
    });
});

// ============================================================================
// ENHANCED ANCHOR INTEGRATION TESTS
// ============================================================================

describe('Enhanced Anchor in calculateECP', () => {
    it('uses steady-state sessions to estimate CP when no MMP data', () => {
        // Only steady-state sessions, no max efforts
        const sessions = [
            createSession({
                duration: 30,
                power: 200,
                rpe: 7, // Moderate-high effort, stable
                date: getDateDaysAgo(5),
            }),
        ];

        const result = calculateECP(sessions, new Date(), null, 150);

        // Should use enhanced anchor: 200 × proximityFactor(7) = 200 × 1.0375 ≈ 208
        expect(result.cp).toBeGreaterThan(200);
        expect(result.wPrime).toBe(calculateScaledWPrime(result.cp));
    });

    it('blends MMP estimate with steady-state anchor', () => {
        // Mix of sessions
        const sessions = [
            // Max effort session for MMP
            createSession({
                duration: 30,
                power: 220,
                rpe: 9,
                date: getDateDaysAgo(10),
            }),
            // Long steady-state at lower power
            createSession({
                duration: 45,
                power: 195,
                rpe: 6,
                date: getDateDaysAgo(5),
            }),
        ];

        const result = calculateECP(sessions, new Date());

        // Should have a reasonable CP estimate
        expect(result.cp).toBeGreaterThan(190);
        expect(result.confidence).toBeGreaterThan(0);
    });
});
