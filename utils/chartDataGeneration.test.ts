/**
 * Unit tests for Chart Data Generation Logic
 * 
 * Tests the data aggregation and display logic for the analytics chart,
 * specifically focusing on how fatigue/readiness are displayed in
 * weeks view vs days view.
 * 
 * CURRENT BEHAVIOR:
 * - Days View: Shows daily fatigue/readiness values directly
 * - Weeks View: Shows WEEKLY AVERAGES for fatigue/readiness (not end-of-week)
 * - Both views display data up to currentDate (supports simulated date), not just last session
 * - Partial weeks correctly average only the days up to currentDate
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    calculateFatigueScore,
    calculateReadinessScore,
    calculateSessionLoad,
    calculateRecentAveragePower
} from './metricsUtils';
import {
    getWeekNumber,
    getProgramEndDateStr,
    isDateInProgramRangeStr
} from './chartUtils';
import { parseLocalDate, getLocalDateString, getDayIndex, addDays } from './dateUtils';
import { Session, ProgramRecord, PlanWeek } from '../types';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Generates EWMA metrics for testing (mirrors Chart.tsx generateMetrics)
 */
function generateMetricsForTest(totalDays: number, dailyLoads: Float32Array) {
    const metrics = [];
    let atl = 0;
    let ctl = 10; // Seed baseline (matches Chart.tsx)

    const atlAlpha = 2 / (7 + 1);
    const ctlAlpha = 2 / (42 + 1);

    for (let i = 0; i < totalDays; i++) {
        const load = dailyLoads[i];

        atl = atl * (1 - atlAlpha) + load * atlAlpha;
        ctl = ctl * (1 - ctlAlpha) + load * ctlAlpha;

        const tsb = ctl - atl;

        metrics.push({
            fatigue: calculateFatigueScore(atl, ctl),
            readiness: calculateReadinessScore(tsb)
        });
    }
    return metrics;
}

/**
 * Creates a mock session for testing
 */
function createMockSession(overrides: Partial<Session> = {}): Session {
    return {
        id: `session-${Math.random().toString(36).substr(2, 9)}`,
        date: '2024-01-01',
        duration: 30,
        power: 150,
        rpe: 7,
        ...overrides
    };
}

/**
 * Creates a mock program for testing
 */
function createMockProgram(overrides: Partial<ProgramRecord> = {}): ProgramRecord {
    return {
        id: 'prog-1',
        presetId: 'preset-1',
        name: 'Test Program',
        startDate: '2024-01-01',
        status: 'active',
        basePower: 150,
        plan: Array.from({ length: 12 }, (_, i) => ({
            week: i + 1,
            phaseName: 'Build',
            focus: 'Volume' as const,
            workRestRatio: '1:1',
            targetRPE: 7,
            plannedPower: 150 + i * 5,
            description: `Week ${i + 1}`
        })),
        ...overrides
    };
}

/**
 * Parse a date string as local date (timezone-agnostic).
 * Uses dateUtils for consistent behavior.
 */
function parseTestDate(dateStr: string): Date {
    return parseLocalDate(dateStr);
}

/**
 * Simulates the weekly data generation logic from Chart.tsx
 * Updated to use WEEKLY AVERAGES and currentDate-based cutoff
 */
function generateWeeklyDataForTest(
    sessions: Session[],
    programs: ProgramRecord[],
    totalDays: number,
    firstStart: Date,
    currentDate?: Date // Optional currentDate for testing (simulated date support)
) {
    const oneDay = 24 * 60 * 60 * 1000;
    const basePower = programs[0]?.basePower || 150;

    // Calculate current day index (uses currentDate or defaults to end of timeline)
    // Use UTC-safe calculation to avoid timezone issues
    const firstStartUTC = Date.UTC(
        firstStart.getUTCFullYear(),
        firstStart.getUTCMonth(),
        firstStart.getUTCDate()
    );
    const currentDateForCalc = currentDate || new Date(firstStart.getTime() + (totalDays - 1) * oneDay);
    const currentDateUTC = Date.UTC(
        currentDateForCalc.getUTCFullYear(),
        currentDateForCalc.getUTCMonth(),
        currentDateForCalc.getUTCDate()
    );
    const currentDayIndex = Math.floor((currentDateUTC - firstStartUTC) / oneDay);

    // Calculate daily loads
    const dailyLoads = new Float32Array(totalDays).fill(0);

    sessions.forEach(s => {
        const sessionDate = new Date(s.date);
        const sessionDateUTC = Date.UTC(
            sessionDate.getUTCFullYear(),
            sessionDate.getUTCMonth(),
            sessionDate.getUTCDate()
        );
        const dayIndex = Math.floor((sessionDateUTC - firstStartUTC) / oneDay);
        if (dayIndex >= 0 && dayIndex < totalDays) {
            const recentAvgPower = calculateRecentAveragePower(sessions, sessionDate, basePower);
            const powerRatio = s.power / recentAvgPower;
            dailyLoads[dayIndex] += calculateSessionLoad(s.rpe, s.duration, powerRatio);
        }
    });

    const dailyMetrics = generateMetricsForTest(totalDays, dailyLoads);

    // Generate weekly data with AVERAGES (new behavior)
    const weekly = [];
    const totalWeeks = Math.ceil(totalDays / 7);

    for (let w = 0; w < totalWeeks; w++) {
        const weekStartIndex = w * 7;
        const weekEndIndex = Math.min((w + 1) * 7 - 1, totalDays - 1);

        // Effective end index respects currentDayIndex
        const effectiveEndIndex = Math.min(weekEndIndex, currentDayIndex);

        let fatigue = null;
        let readiness = null;

        // Only show if this week has started and has days up to current date
        if (weekStartIndex <= currentDayIndex && effectiveEndIndex >= weekStartIndex) {
            // Calculate AVERAGE of all days in the week up to current date
            let fatigueSum = 0;
            let readinessSum = 0;
            let daysWithMetrics = 0;

            for (let d = weekStartIndex; d <= effectiveEndIndex && d < dailyMetrics.length; d++) {
                fatigueSum += dailyMetrics[d].fatigue;
                readinessSum += dailyMetrics[d].readiness;
                daysWithMetrics++;
            }

            if (daysWithMetrics > 0) {
                fatigue = Math.round(fatigueSum / daysWithMetrics);
                readiness = Math.round(readinessSum / daysWithMetrics);
            }
        }

        weekly.push({
            name: `W${w + 1}`,
            index: w,
            Fatigue: fatigue,
            Readiness: readiness,
            weekStartIndex,
            weekEndIndex,
            effectiveEndIndex
        });
    }

    return { weekly, dailyMetrics, currentDayIndex };
}

/**
 * Simulates the daily data generation logic from Chart.tsx
 * Updated to use currentDate-based cutoff
 */
function generateDailyDataForTest(
    sessions: Session[],
    programs: ProgramRecord[],
    totalDays: number,
    firstStart: Date,
    currentDate?: Date // Optional currentDate for testing (simulated date support)
) {
    const oneDay = 24 * 60 * 60 * 1000;
    const basePower = programs[0]?.basePower || 150;

    // Calculate current day index (uses currentDate or defaults to end of timeline)
    // Use UTC-safe calculation to avoid timezone issues
    const firstStartUTC = Date.UTC(
        firstStart.getUTCFullYear(),
        firstStart.getUTCMonth(),
        firstStart.getUTCDate()
    );
    const currentDateForCalc = currentDate || new Date(firstStart.getTime() + (totalDays - 1) * oneDay);
    const currentDateUTC = Date.UTC(
        currentDateForCalc.getUTCFullYear(),
        currentDateForCalc.getUTCMonth(),
        currentDateForCalc.getUTCDate()
    );
    const currentDayIndex = Math.floor((currentDateUTC - firstStartUTC) / oneDay);

    // Calculate daily loads
    const dailyLoads = new Float32Array(totalDays).fill(0);

    sessions.forEach(s => {
        const sessionDate = new Date(s.date);
        const sessionDateUTC = Date.UTC(
            sessionDate.getUTCFullYear(),
            sessionDate.getUTCMonth(),
            sessionDate.getUTCDate()
        );
        const dayIndex = Math.floor((sessionDateUTC - firstStartUTC) / oneDay);
        if (dayIndex >= 0 && dayIndex < totalDays) {
            const recentAvgPower = calculateRecentAveragePower(sessions, sessionDate, basePower);
            const powerRatio = s.power / recentAvgPower;
            dailyLoads[dayIndex] += calculateSessionLoad(s.rpe, s.duration, powerRatio);
        }
    });

    const dailyMetrics = generateMetricsForTest(totalDays, dailyLoads);

    // Generate daily data
    const daily = [];
    for (let i = 0; i < totalDays; i++) {
        let fatigue = null;
        let readiness = null;
        // Show metrics up to currentDayIndex (not lastSessionDayIndex)
        if (i <= currentDayIndex && i < dailyMetrics.length) {
            fatigue = dailyMetrics[i].fatigue;
            readiness = dailyMetrics[i].readiness;
        }

        daily.push({
            index: i,
            Fatigue: fatigue,
            Readiness: readiness
        });
    }

    return { daily, dailyMetrics, currentDayIndex };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Chart Data Generation - Fatigue/Readiness Display', () => {
    describe('Days View - Daily Metrics Display', () => {
        it('should display fatigue/readiness values for each day directly', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-01-05');
            const sessions = [
                createMockSession({ date: '2024-01-01', power: 150, rpe: 7, duration: 30 }),
                createMockSession({ date: '2024-01-03', power: 160, rpe: 8, duration: 35 }),
            ];
            const programs = [createMockProgram()];

            const { daily, dailyMetrics, currentDayIndex } = generateDailyDataForTest(
                sessions, programs, 7, firstStart, currentDate
            );

            // currentDayIndex should be 4 (Jan 5)
            expect(currentDayIndex).toBe(4);

            // Day 0 (Jan 1) - has session, should have metrics
            expect(daily[0].Fatigue).not.toBeNull();
            expect(daily[0].Readiness).not.toBeNull();
            expect(daily[0].Fatigue).toBe(dailyMetrics[0].fatigue);
            expect(daily[0].Readiness).toBe(dailyMetrics[0].readiness);

            // Day 2 (Jan 3) - has session, should have metrics
            expect(daily[2].Fatigue).not.toBeNull();
            expect(daily[2].Fatigue).toBe(dailyMetrics[2].fatigue);

            // Day 4 (Jan 5) - no session but within currentDate, should have metrics
            expect(daily[4].Fatigue).not.toBeNull();
            expect(daily[4].Fatigue).toBe(dailyMetrics[4].fatigue);

            // Day 5 and 6 - after currentDayIndex, should be null
            expect(daily[5].Fatigue).toBeNull();
            expect(daily[6].Fatigue).toBeNull();
        });

        it('should show metrics up to currentDate, not just last session date', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-01-14'); // Well after last session
            const sessions = [
                createMockSession({ date: '2024-01-01', power: 150, rpe: 7, duration: 30 }),
                createMockSession({ date: '2024-01-03', power: 160, rpe: 8, duration: 35 }),
            ];
            const programs = [createMockProgram()];

            const { daily, currentDayIndex } = generateDailyDataForTest(
                sessions, programs, 21, firstStart, currentDate
            );

            // currentDayIndex should be 13 (Jan 14)
            expect(currentDayIndex).toBe(13);

            // All days 0-13 should have metrics (even after last session on Jan 3)
            for (let i = 0; i <= 13; i++) {
                expect(daily[i].Fatigue).not.toBeNull();
                expect(daily[i].Readiness).not.toBeNull();
            }

            // Days 14+ should be null (after currentDate)
            for (let i = 14; i < 21; i++) {
                expect(daily[i].Fatigue).toBeNull();
                expect(daily[i].Readiness).toBeNull();
            }
        });

        it('should show different metric values for each day (EWMA progression)', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-01-05');
            // Use moderate loads that won't saturate the sigmoid at 100
            const sessions = [
                createMockSession({ date: '2024-01-01', power: 150, rpe: 5, duration: 20 }),
                createMockSession({ date: '2024-01-02', power: 150, rpe: 5, duration: 20 }),
                createMockSession({ date: '2024-01-03', power: 150, rpe: 5, duration: 20 }),
            ];
            const programs = [createMockProgram()];

            const { daily } = generateDailyDataForTest(sessions, programs, 5, firstStart, currentDate);

            // Fatigue should increase or stay same (EWMA accumulates load)
            // With moderate loads, fatigue should be measurably different
            expect(daily[0].Fatigue).toBeLessThanOrEqual(daily[1].Fatigue!);
            expect(daily[1].Fatigue).toBeLessThanOrEqual(daily[2].Fatigue!);

            // The key insight: consecutive sessions cause ATL to build up
            // Verify we get actual numeric values
            expect(daily[0].Fatigue).toBeGreaterThanOrEqual(0);
            expect(daily[2].Fatigue).toBeGreaterThanOrEqual(daily[0].Fatigue!);
        });
    });

    describe('Weeks View - Weekly Averages (NEW BEHAVIOR)', () => {
        it('should use weekly averages, not end-of-week metrics', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-01-07'); // Full week 1
            // Sessions distributed across week 1
            const sessions = [
                createMockSession({ date: '2024-01-01', power: 150, rpe: 5, duration: 30 }),
                createMockSession({ date: '2024-01-05', power: 180, rpe: 8, duration: 45 }),
                createMockSession({ date: '2024-01-07', power: 190, rpe: 9, duration: 50 }),
            ];
            const programs = [createMockProgram()];

            const { weekly, dailyMetrics } = generateWeeklyDataForTest(
                sessions, programs, 7, firstStart, currentDate
            );

            // Calculate expected average
            let fatigueSum = 0;
            let readinessSum = 0;
            for (let i = 0; i <= 6; i++) {
                fatigueSum += dailyMetrics[i].fatigue;
                readinessSum += dailyMetrics[i].readiness;
            }
            const expectedFatigue = Math.round(fatigueSum / 7);
            const expectedReadiness = Math.round(readinessSum / 7);

            // Week 1 should use AVERAGE, not end-of-week value
            expect(weekly[0].Fatigue).toBe(expectedFatigue);
            expect(weekly[0].Readiness).toBe(expectedReadiness);

            // Prove it's NOT end-of-week (unless they happen to be the same)
            // Average will differ from the final day's value in most cases
        });

        it('should handle partial weeks correctly (average only completed days)', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-01-04'); // Day 3 = 4 days into week 1
            const sessions = [
                createMockSession({ date: '2024-01-01', power: 150, rpe: 7, duration: 30 }),
                createMockSession({ date: '2024-01-03', power: 160, rpe: 7, duration: 30 }),
            ];
            const programs = [createMockProgram()];

            const { weekly, dailyMetrics, currentDayIndex } = generateWeeklyDataForTest(
                sessions, programs, 14, firstStart, currentDate
            );

            // currentDayIndex = 3 (Jan 4)
            expect(currentDayIndex).toBe(3);
            expect(weekly[0].effectiveEndIndex).toBe(3);

            // Calculate expected average for days 0-3 only
            let fatigueSum = 0;
            let readinessSum = 0;
            for (let i = 0; i <= 3; i++) {
                fatigueSum += dailyMetrics[i].fatigue;
                readinessSum += dailyMetrics[i].readiness;
            }
            const expectedFatigue = Math.round(fatigueSum / 4);
            const expectedReadiness = Math.round(readinessSum / 4);

            expect(weekly[0].Fatigue).toBe(expectedFatigue);
            expect(weekly[0].Readiness).toBe(expectedReadiness);

            // Week 2 should be null (hasn't started yet)
            expect(weekly[1].Fatigue).toBeNull();
        });

        it('should display null for weeks after currentDate', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-01-05'); // Day 4, still in week 1
            const sessions = [
                createMockSession({ date: '2024-01-02', power: 150, rpe: 7, duration: 30 }),
            ];
            const programs = [createMockProgram()];

            const { weekly, currentDayIndex } = generateWeeklyDataForTest(
                sessions, programs, 21, firstStart, currentDate
            );

            expect(currentDayIndex).toBe(4);

            // Week 1 (days 0-6): should show (partial week up to day 4)
            expect(weekly[0].Fatigue).not.toBeNull();
            expect(weekly[0].Readiness).not.toBeNull();

            // Week 2 (days 7-13): should be null (hasn't started)
            expect(weekly[1].Fatigue).toBeNull();
            expect(weekly[1].Readiness).toBeNull();

            // Week 3 (days 14-20): should be null
            expect(weekly[2].Fatigue).toBeNull();
            expect(weekly[2].Readiness).toBeNull();
        });

        it('should handle multi-week programs correctly', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-01-21'); // Day 20, in week 3
            const sessions = [
                // Week 1
                createMockSession({ date: '2024-01-03', power: 150, rpe: 7, duration: 30 }),
                // Week 2
                createMockSession({ date: '2024-01-10', power: 160, rpe: 7, duration: 35 }),
                // Week 3
                createMockSession({ date: '2024-01-17', power: 170, rpe: 8, duration: 40 }),
            ];
            const programs = [createMockProgram()];

            const { weekly, currentDayIndex } = generateWeeklyDataForTest(
                sessions, programs, 28, firstStart, currentDate
            );

            expect(currentDayIndex).toBe(20);

            // Week 1, 2, 3 should have metrics
            expect(weekly[0].Fatigue).not.toBeNull();
            expect(weekly[1].Fatigue).not.toBeNull();
            expect(weekly[2].Fatigue).not.toBeNull();

            // Week 4 should be null (hasn't started)
            expect(weekly[3].Fatigue).toBeNull();
        });
    });

    describe('Metrics Display with currentDate (simulated date support)', () => {
        it('should display metrics up to simulated date, even with no recent sessions', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-01-20'); // Simulated date
            const sessions = [
                // Only session on day 1
                createMockSession({ date: '2024-01-01', power: 150, rpe: 7, duration: 30 }),
            ];
            const programs = [createMockProgram()];

            const { daily, currentDayIndex } = generateDailyDataForTest(
                sessions, programs, 21, firstStart, currentDate
            );

            expect(currentDayIndex).toBe(19);

            // All days 0-19 should have metrics (even though last session was day 0)
            for (let i = 0; i <= 19; i++) {
                expect(daily[i].Fatigue).not.toBeNull();
                expect(daily[i].Readiness).not.toBeNull();
            }

            // Day 20 should be null
            expect(daily[20].Fatigue).toBeNull();
        });

        it('should not display metrics for dates after simulated current date', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-01-05'); // Simulated date in middle
            const sessions = [
                createMockSession({ date: '2024-01-01', power: 150, rpe: 7, duration: 30 }),
            ];
            const programs = [createMockProgram()];

            const { daily, currentDayIndex } = generateDailyDataForTest(
                sessions, programs, 14, firstStart, currentDate
            );

            expect(currentDayIndex).toBe(4);

            // Days 0-4 should have metrics
            for (let i = 0; i <= 4; i++) {
                expect(daily[i].Fatigue).not.toBeNull();
            }

            // Days 5-13 should be null (after simulated current date)
            for (let i = 5; i < 14; i++) {
                expect(daily[i].Fatigue).toBeNull();
            }
        });

        it('should handle simulated date in the middle of a week', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-01-10'); // Day 9, in middle of week 2
            const sessions = [
                createMockSession({ date: '2024-01-03', power: 150, rpe: 7, duration: 30 }),
                createMockSession({ date: '2024-01-08', power: 160, rpe: 7, duration: 30 }),
            ];
            const programs = [createMockProgram()];

            const { weekly, dailyMetrics, currentDayIndex } = generateWeeklyDataForTest(
                sessions, programs, 21, firstStart, currentDate
            );

            expect(currentDayIndex).toBe(9);

            // Week 1 should be complete (full 7 days)
            expect(weekly[0].effectiveEndIndex).toBe(6);

            // Week 2 should be partial (days 7-9 only)
            expect(weekly[1].effectiveEndIndex).toBe(9);

            // Calculate expected week 2 average (days 7, 8, 9)
            let fatigueSum = 0;
            let readinessSum = 0;
            for (let i = 7; i <= 9; i++) {
                fatigueSum += dailyMetrics[i].fatigue;
                readinessSum += dailyMetrics[i].readiness;
            }
            const expectedFatigue = Math.round(fatigueSum / 3);
            const expectedReadiness = Math.round(readinessSum / 3);

            expect(weekly[1].Fatigue).toBe(expectedFatigue);
            expect(weekly[1].Readiness).toBe(expectedReadiness);

            // Week 3 should be null
            expect(weekly[2].Fatigue).toBeNull();
        });
    });

    describe('EWMA Metric Calculations', () => {
        it('should use ACWR Sigmoid for fatigue calculation', () => {
            // Low ATL, normal CTL = low fatigue
            const lowFatigue = calculateFatigueScore(5, 15);
            expect(lowFatigue).toBeLessThan(50);

            // High ATL, normal CTL = high fatigue
            const highFatigue = calculateFatigueScore(25, 15);
            expect(highFatigue).toBeGreaterThan(50);
        });

        it('should use TSB Gaussian for readiness calculation', () => {
            // Optimal TSB (~20) = high readiness
            const optimalReadiness = calculateReadinessScore(20);
            expect(optimalReadiness).toBeGreaterThan(90);

            // Very negative TSB (overtrained) = low readiness
            const lowReadiness = calculateReadinessScore(-30);
            expect(lowReadiness).toBeLessThan(30);

            // Very high TSB (detrained) = moderate readiness
            const detrainedReadiness = calculateReadinessScore(60);
            expect(detrainedReadiness).toBeLessThan(optimalReadiness);
        });

        it('should show increasing fatigue with consecutive high-load sessions', () => {
            // Simulate 7 days of moderate-load training (load that doesn't saturate sigmoid)
            const dailyLoads = new Float32Array(7);
            for (let i = 0; i < 7; i++) {
                dailyLoads[i] = 30; // Moderate daily load to avoid sigmoid saturation
            }

            const metrics = generateMetricsForTest(7, dailyLoads);

            // Fatigue should increase over time as ATL builds
            expect(metrics[0].fatigue).toBeLessThanOrEqual(metrics[3].fatigue);
            expect(metrics[3].fatigue).toBeLessThanOrEqual(metrics[6].fatigue);

            // Verify we're getting real numeric values
            expect(metrics[0].fatigue).toBeGreaterThanOrEqual(0);
            expect(metrics[6].fatigue).toBeGreaterThanOrEqual(0);
        });

        it('should show decreasing fatigue during rest days', () => {
            // 3 days of training, then 4 rest days
            const dailyLoads = new Float32Array(7);
            dailyLoads[0] = 100;
            dailyLoads[1] = 100;
            dailyLoads[2] = 100;
            // Days 3-6 are rest (0 load)

            const metrics = generateMetricsForTest(7, dailyLoads);

            // Fatigue should peak around day 2-3, then decrease
            const peakFatigue = Math.max(metrics[2].fatigue, metrics[3].fatigue);
            expect(metrics[6].fatigue).toBeLessThan(peakFatigue);
        });
    });

    describe('Week Number Calculation Integration', () => {
        it('should correctly map dates to week numbers', () => {
            const startDate = '2024-01-01';

            // Day 0-6 = Week 1
            expect(getWeekNumber('2024-01-01', startDate)).toBe(1);
            expect(getWeekNumber('2024-01-07', startDate)).toBe(1);

            // Day 7-13 = Week 2
            expect(getWeekNumber('2024-01-08', startDate)).toBe(2);
            expect(getWeekNumber('2024-01-14', startDate)).toBe(2);

            // Day 14-20 = Week 3
            expect(getWeekNumber('2024-01-15', startDate)).toBe(3);
        });

        it('should return 0 for dates before program start', () => {
            expect(getWeekNumber('2023-12-31', '2024-01-01')).toBe(0);
        });
    });

    describe('Program Range Respecting', () => {
        it('should not display planned data for weeks after completed program endDate', () => {
            const program = createMockProgram({
                status: 'completed',
                startDate: '2024-01-01',
                endDate: '2024-01-28', // 4 weeks only
                plan: Array.from({ length: 12 }, (_, i) => ({
                    week: i + 1,
                    phaseName: 'Build',
                    focus: 'Volume' as const,
                    workRestRatio: '1:1',
                    targetRPE: 7,
                    plannedPower: 150 + i * 5,
                    description: `Week ${i + 1}`
                }))
            });

            // Week 4 date should be in range
            expect(isDateInProgramRangeStr('2024-01-25', program)).toBe(true);

            // Week 5 date should NOT be in range
            expect(isDateInProgramRangeStr('2024-01-29', program)).toBe(false);
        });

        it('should correctly calculate endDate for active vs completed programs', () => {
            const activeProgram = createMockProgram({ status: 'active' });
            const completedProgram = createMockProgram({
                status: 'completed',
                endDate: '2024-02-15'
            });

            const activeEnd = getProgramEndDateStr(activeProgram);
            const completedEnd = getProgramEndDateStr(completedProgram);

            // Active: uses plan length (12 weeks from Jan 1 = Mar 24)
            expect(activeEnd).toBe('2024-03-24');

            // Completed: uses endDate
            expect(completedEnd).toBe('2024-02-15');
        });
    });

    describe('Multiple Sessions Per Day', () => {
        it('should aggregate loads from multiple sessions on same day', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-01-03');
            const sessions = [
                createMockSession({ date: '2024-01-01', power: 150, rpe: 7, duration: 30 }),
                createMockSession({ date: '2024-01-01', power: 160, rpe: 8, duration: 25 }), // Same day
            ];
            const programs = [createMockProgram()];

            const { dailyMetrics } = generateDailyDataForTest(
                sessions, programs, 3, firstStart, currentDate
            );

            const singleSessionDay = [createMockSession({ date: '2024-01-01', power: 150, rpe: 7, duration: 30 })];
            const { dailyMetrics: singleMetrics } = generateDailyDataForTest(
                singleSessionDay, programs, 3, firstStart, currentDate
            );

            // Multiple sessions should result in higher fatigue than single session
            expect(dailyMetrics[0].fatigue).toBeGreaterThan(singleMetrics[0].fatigue);
        });
    });

    describe('Edge Cases', () => {
        it('should handle program with only one day of data', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-01-01');
            const sessions = [
                createMockSession({ date: '2024-01-01', power: 150, rpe: 7, duration: 30 }),
            ];
            const programs = [createMockProgram()];

            const { daily } = generateDailyDataForTest(sessions, programs, 1, firstStart, currentDate);
            const weeklyData = generateWeeklyDataForTest(sessions, programs, 1, firstStart, currentDate);

            expect(daily[0].Fatigue).not.toBeNull();
            expect(weeklyData.weekly[0].Fatigue).not.toBeNull();
        });

        it('should handle very long programs (12+ weeks)', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-03-24'); // End of 12 weeks
            const sessions = Array.from({ length: 12 }, (_, i) =>
                createMockSession({
                    date: new Date(firstStart.getTime() + i * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    power: 150 + i * 5,
                    rpe: 7,
                    duration: 30
                })
            );
            const programs = [createMockProgram()];

            const { weekly } = generateWeeklyDataForTest(sessions, programs, 84, firstStart, currentDate);

            // All 12 weeks should have data
            expect(weekly.length).toBe(12);
            for (let i = 0; i < 12; i++) {
                expect(weekly[i].Fatigue).not.toBeNull();
            }
        });

        it('should handle sessions at exact week boundaries', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-01-14');
            const sessions = [
                createMockSession({ date: '2024-01-07', power: 150, rpe: 7, duration: 30 }), // Last day of week 1
                createMockSession({ date: '2024-01-08', power: 160, rpe: 7, duration: 30 }), // First day of week 2
            ];
            const programs = [createMockProgram()];

            const { daily } = generateDailyDataForTest(sessions, programs, 14, firstStart, currentDate);

            // Day 6 (Jan 7) should have metrics
            expect(daily[6].Fatigue).not.toBeNull();
            // Day 7 (Jan 8) should have metrics
            expect(daily[7].Fatigue).not.toBeNull();
        });

        it('should handle no sessions with currentDate set', () => {
            const firstStart = new Date('2024-01-01');
            const currentDate = new Date('2024-01-07');
            const sessions: Session[] = [];
            const programs = [createMockProgram()];

            const { daily, currentDayIndex } = generateDailyDataForTest(
                sessions, programs, 14, firstStart, currentDate
            );

            expect(currentDayIndex).toBe(6);

            // Days 0-6 should still have metrics (baseline metrics with no load)
            for (let i = 0; i <= 6; i++) {
                expect(daily[i].Fatigue).not.toBeNull();
                expect(daily[i].Readiness).not.toBeNull();
            }

            // Days 7+ should be null
            for (let i = 7; i < 14; i++) {
                expect(daily[i].Fatigue).toBeNull();
            }
        });
    });
});

describe('Chart Data Generation - Power/Work Display', () => {
    describe('Weekly Actual Power/Work', () => {
        it('should calculate weekly average power from sessions', () => {
            const sessions = [
                createMockSession({ date: '2024-01-02', power: 140, rpe: 7, duration: 30 }),
                createMockSession({ date: '2024-01-04', power: 160, rpe: 7, duration: 30 }),
                createMockSession({ date: '2024-01-06', power: 150, rpe: 7, duration: 30 }),
            ];

            // Average = (140 + 160 + 150) / 3 = 150
            const avgPower = Math.round(sessions.reduce((sum, s) => sum + s.power, 0) / sessions.length);
            expect(avgPower).toBe(150);
        });

        it('should calculate weekly average work from sessions', () => {
            const sessions = [
                createMockSession({ date: '2024-01-02', power: 150, rpe: 7, duration: 30 }), // Work = 150 * 30 / 60 = 75 Wh
                createMockSession({ date: '2024-01-04', power: 150, rpe: 7, duration: 60 }), // Work = 150 * 60 / 60 = 150 Wh
            ];

            // Average work = (75 + 150) / 2 = 112.5 ≈ 113
            const avgWork = Math.round(
                sessions.reduce((sum, s) => sum + (s.power * s.duration / 60), 0) / sessions.length
            );
            expect(avgWork).toBe(113);
        });
    });

    describe('Daily Actual Power/Work', () => {
        it('should show session power directly on session day', () => {
            const session = createMockSession({ date: '2024-01-01', power: 175, rpe: 7, duration: 30 });
            expect(session.power).toBe(175);
        });

        it('should calculate work correctly (Power × Duration / 60)', () => {
            const session = createMockSession({ date: '2024-01-01', power: 180, rpe: 7, duration: 45 });
            const work = Math.round(session.power * session.duration / 60);
            expect(work).toBe(135); // 180 * 45 / 60 = 135 Wh
        });
    });

    describe('Planned Power from Program', () => {
        it('should get planned power from program plan for correct week', () => {
            const program = createMockProgram();
            const week3Plan = program.plan?.find(w => w.week === 3);

            // Based on createMockProgram: plannedPower = 150 + i * 5, week 3 = index 2 = 160
            expect(week3Plan?.plannedPower).toBe(160);
        });

        it('should use first day of week planned values for weekly chart', () => {
            const program = createMockProgram();
            const week1Plan = program.plan?.find(w => w.week === 1);
            const week2Plan = program.plan?.find(w => w.week === 2);

            expect(week1Plan?.plannedPower).toBe(150);
            expect(week2Plan?.plannedPower).toBe(155);
        });
    });
});
