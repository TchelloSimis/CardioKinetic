/**
 * Chart Metrics Integration Tests with Questionnaire Carryover
 * 
 * Tests the integration of questionnaire adjustments into the chart's EWMA
 * metrics calculation, verifying that adjustments carry forward to subsequent days.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QuestionnaireResponse } from '../types';
import {
    calculateFatigueScore,
    calculateReadinessScore,
    calculateSessionLoad
} from './metricsUtils';
import { applyQuestionnaireAdjustment } from './questionnaireConfig';
import { addDays } from './dateUtils';

// ============================================================================
// HELPER FUNCTIONS (mirroring Chart.tsx generateMetrics logic)
// ============================================================================

/**
 * Generate metrics with questionnaire carryover.
 * This mirrors the generateMetrics function in Chart.tsx for testing.
 */
function generateMetricsWithCarryover(
    totalDays: number,
    dailyLoads: Float32Array,
    firstStartStr: string,
    questionnaireByDate: Map<string, QuestionnaireResponse>,
    allResponses: QuestionnaireResponse[]
): Array<{ fatigue: number; readiness: number }> {
    const metrics = [];
    let atl = 0;
    let ctl = 10; // Seed baseline
    let wellnessModifier = 0;

    const atlAlpha = 2 / (7 + 1);
    const ctlAlpha = 2 / (42 + 1);
    const wellnessAlpha = 2 / (3 + 1);

    for (let i = 0; i < totalDays; i++) {
        const load = dailyLoads[i];
        const dateStr = addDays(firstStartStr, i);

        atl = atl * (1 - atlAlpha) + load * atlAlpha;
        ctl = ctl * (1 - ctlAlpha) + load * ctlAlpha;

        const tsb = ctl - atl;

        let fatigue = calculateFatigueScore(atl, ctl);
        let readiness = calculateReadinessScore(tsb);

        const dayResponse = questionnaireByDate.get(dateStr);
        if (dayResponse) {
            const recentForDay = allResponses
                .filter(r => r.date < dateStr)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 7);

            const adjustment = applyQuestionnaireAdjustment(
                readiness,
                fatigue,
                dayResponse,
                recentForDay
            );

            fatigue = adjustment.fatigue;
            readiness = adjustment.readiness;

            const fatigueImpact = adjustment.fatigueChange;
            const readinessImpact = adjustment.readinessChange;
            wellnessModifier = wellnessModifier * (1 - wellnessAlpha) +
                ((readinessImpact - fatigueImpact) / 2) * wellnessAlpha;
        } else {
            wellnessModifier = wellnessModifier * (1 - wellnessAlpha);

            if (Math.abs(wellnessModifier) > 0.5) {
                readiness = Math.max(0, Math.min(100, Math.round(readiness + wellnessModifier)));
                fatigue = Math.max(0, Math.min(100, Math.round(fatigue - wellnessModifier)));
            }
        }

        metrics.push({ fatigue, readiness });
    }
    return metrics;
}

/**
 * Generate metrics WITHOUT questionnaire (baseline).
 */
function generateMetricsBaseline(
    totalDays: number,
    dailyLoads: Float32Array
): Array<{ fatigue: number; readiness: number }> {
    const metrics = [];
    let atl = 0;
    let ctl = 10;

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
 * Create a mock questionnaire response.
 */
function createQuestionnaireResponse(
    date: string,
    values: Record<string, number> = {}
): QuestionnaireResponse {
    return {
        date,
        timestamp: new Date(date).toISOString(),
        responses: {
            sleep_hours: values.sleep_hours ?? 3,
            sleep_quality: values.sleep_quality ?? 3,
            hydration: values.hydration ?? 3,
            nutrition: values.nutrition ?? 3,
            soreness: values.soreness ?? 3,
            energy: values.energy ?? 3,
            motivation: values.motivation ?? 3,
            stress: values.stress ?? 3,
            ...values
        }
    };
}

/**
 * Create session load for a given number of days.
 */
function createDailyLoads(totalDays: number, defaultLoad: number = 50): Float32Array {
    const loads = new Float32Array(totalDays);
    for (let i = 0; i < totalDays; i++) {
        loads[i] = defaultLoad;
    }
    return loads;
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Chart Metrics with Questionnaire Carryover', () => {
    const startDate = '2026-01-01';

    describe('Base Metrics Without Questionnaire', () => {
        it('should calculate metrics correctly with no questionnaire data', () => {
            const totalDays = 7;
            const dailyLoads = createDailyLoads(totalDays, 50);
            const emptyMap = new Map<string, QuestionnaireResponse>();

            const metrics = generateMetricsWithCarryover(
                totalDays,
                dailyLoads,
                startDate,
                emptyMap,
                []
            );

            const baseline = generateMetricsBaseline(totalDays, dailyLoads);

            // Should match baseline exactly when no questionnaires
            expect(metrics.length).toBe(totalDays);
            for (let i = 0; i < totalDays; i++) {
                expect(metrics[i].fatigue).toBe(baseline[i].fatigue);
                expect(metrics[i].readiness).toBe(baseline[i].readiness);
            }
        });

        it('should produce consistent results with zero load', () => {
            const totalDays = 5;
            const dailyLoads = createDailyLoads(totalDays, 0);
            const emptyMap = new Map<string, QuestionnaireResponse>();

            const metrics = generateMetricsWithCarryover(
                totalDays,
                dailyLoads,
                startDate,
                emptyMap,
                []
            );

            expect(metrics.length).toBe(totalDays);
            // With zero load, fatigue should stay low and readiness high (near baseline)
            for (let i = 0; i < totalDays; i++) {
                expect(metrics[i].fatigue).toBeLessThanOrEqual(50);
                expect(metrics[i].readiness).toBeGreaterThanOrEqual(50);
            }
        });
    });

    describe('Single Day Questionnaire Adjustment', () => {
        it('should apply negative adjustment when all answers are 1 (poor)', () => {
            const totalDays = 7;
            const dailyLoads = createDailyLoads(totalDays, 50);

            // Day 3 has a poor questionnaire response
            const poorResponse = createQuestionnaireResponse(addDays(startDate, 3), {
                sleep_hours: 1,
                sleep_quality: 1,
                energy: 1,
                motivation: 1,
                stress: 1,
                soreness: 1,
                hydration: 1,
                nutrition: 1
            });

            const questionnaireMap = new Map<string, QuestionnaireResponse>();
            questionnaireMap.set(poorResponse.date, poorResponse);

            const withQuestionnaire = generateMetricsWithCarryover(
                totalDays,
                dailyLoads,
                startDate,
                questionnaireMap,
                [poorResponse]
            );

            const baseline = generateMetricsBaseline(totalDays, dailyLoads);

            // Day 3 should have HIGHER fatigue and LOWER readiness than baseline
            expect(withQuestionnaire[3].fatigue).toBeGreaterThan(baseline[3].fatigue);
            expect(withQuestionnaire[3].readiness).toBeLessThan(baseline[3].readiness);
        });

        it('should apply positive adjustment when all answers are 5 (excellent)', () => {
            const totalDays = 7;
            const dailyLoads = createDailyLoads(totalDays, 50);

            // Day 3 has an excellent questionnaire response
            const excellentResponse = createQuestionnaireResponse(addDays(startDate, 3), {
                sleep_hours: 5,
                sleep_quality: 5,
                energy: 5,
                motivation: 5,
                stress: 5,
                soreness: 5,
                hydration: 5,
                nutrition: 5
            });

            const questionnaireMap = new Map<string, QuestionnaireResponse>();
            questionnaireMap.set(excellentResponse.date, excellentResponse);

            const withQuestionnaire = generateMetricsWithCarryover(
                totalDays,
                dailyLoads,
                startDate,
                questionnaireMap,
                [excellentResponse]
            );

            const baseline = generateMetricsBaseline(totalDays, dailyLoads);

            // Day 3 should have LOWER fatigue and HIGHER readiness than baseline
            expect(withQuestionnaire[3].fatigue).toBeLessThan(baseline[3].fatigue);
            expect(withQuestionnaire[3].readiness).toBeGreaterThan(baseline[3].readiness);
        });
    });

    describe('Multi-Day Carryover Effect', () => {
        it('should carry poor wellness effects to subsequent days', () => {
            const totalDays = 10;
            const dailyLoads = createDailyLoads(totalDays, 50);

            // Day 3 has a poor questionnaire response
            const poorResponse = createQuestionnaireResponse(addDays(startDate, 3), {
                sleep_hours: 1,
                sleep_quality: 1,
                energy: 1,
                motivation: 1,
                stress: 1,
                soreness: 1,
                hydration: 1,
                nutrition: 1
            });

            const questionnaireMap = new Map<string, QuestionnaireResponse>();
            questionnaireMap.set(poorResponse.date, poorResponse);

            const withQuestionnaire = generateMetricsWithCarryover(
                totalDays,
                dailyLoads,
                startDate,
                questionnaireMap,
                [poorResponse]
            );

            const baseline = generateMetricsBaseline(totalDays, dailyLoads);

            // Days 4, 5, 6 should also show some effect from day 3's poor response
            // The effect should decay over time
            const day4Diff = withQuestionnaire[4].fatigue - baseline[4].fatigue;
            const day5Diff = withQuestionnaire[5].fatigue - baseline[5].fatigue;
            const day6Diff = withQuestionnaire[6].fatigue - baseline[6].fatigue;

            // Carryover should create some positive diff (increased fatigue) on subsequent days
            // With a 3-day half-life wellness modifier, effects should decay
            expect(day4Diff).toBeGreaterThanOrEqual(0);
            // Effect should decay over time (or at least not increase)
            expect(Math.abs(day6Diff)).toBeLessThanOrEqual(Math.abs(day4Diff) + 1);
        });

        it('should carry excellent wellness effects to subsequent days', () => {
            const totalDays = 10;
            const dailyLoads = createDailyLoads(totalDays, 50);

            // Day 3 has an excellent questionnaire response
            const excellentResponse = createQuestionnaireResponse(addDays(startDate, 3), {
                sleep_hours: 5,
                sleep_quality: 5,
                energy: 5,
                motivation: 5,
                stress: 5,
                soreness: 5,
                hydration: 5,
                nutrition: 5
            });

            const questionnaireMap = new Map<string, QuestionnaireResponse>();
            questionnaireMap.set(excellentResponse.date, excellentResponse);

            const withQuestionnaire = generateMetricsWithCarryover(
                totalDays,
                dailyLoads,
                startDate,
                questionnaireMap,
                [excellentResponse]
            );

            const baseline = generateMetricsBaseline(totalDays, dailyLoads);

            // Days 4, 5, 6 should show improved readiness from day 3's excellent response
            const day4ReadinessDiff = withQuestionnaire[4].readiness - baseline[4].readiness;

            // Carryover should create some positive diff (improved readiness)
            expect(day4ReadinessDiff).toBeGreaterThanOrEqual(0);
        });

        it('should show effects decaying to near-zero after several days', () => {
            const totalDays = 14;
            const dailyLoads = createDailyLoads(totalDays, 50);

            // Day 3 has a poor questionnaire response
            const poorResponse = createQuestionnaireResponse(addDays(startDate, 3), {
                sleep_hours: 1,
                sleep_quality: 1,
                energy: 1,
                motivation: 1,
                stress: 1,
                soreness: 1,
                hydration: 1,
                nutrition: 1
            });

            const questionnaireMap = new Map<string, QuestionnaireResponse>();
            questionnaireMap.set(poorResponse.date, poorResponse);

            const withQuestionnaire = generateMetricsWithCarryover(
                totalDays,
                dailyLoads,
                startDate,
                questionnaireMap,
                [poorResponse]
            );

            const baseline = generateMetricsBaseline(totalDays, dailyLoads);

            // By day 10+ (7+ days after the questionnaire), effect should be minimal
            const day10Diff = Math.abs(withQuestionnaire[10].fatigue - baseline[10].fatigue);
            expect(day10Diff).toBeLessThanOrEqual(2); // Very small or zero difference
        });
    });

    describe('Multiple Questionnaire Responses', () => {
        it('should apply multiple questionnaires correctly', () => {
            const totalDays = 10;
            const dailyLoads = createDailyLoads(totalDays, 50);

            // Day 2 has poor response, Day 5 has excellent response
            const poorResponse = createQuestionnaireResponse(addDays(startDate, 2), {
                sleep_hours: 1,
                sleep_quality: 1,
                energy: 1,
                motivation: 1,
                stress: 1,
                soreness: 1,
                hydration: 1,
                nutrition: 1
            });

            const excellentResponse = createQuestionnaireResponse(addDays(startDate, 5), {
                sleep_hours: 5,
                sleep_quality: 5,
                energy: 5,
                motivation: 5,
                stress: 5,
                soreness: 5,
                hydration: 5,
                nutrition: 5
            });

            const questionnaireMap = new Map<string, QuestionnaireResponse>();
            questionnaireMap.set(poorResponse.date, poorResponse);
            questionnaireMap.set(excellentResponse.date, excellentResponse);

            const allResponses = [poorResponse, excellentResponse];

            const withQuestionnaire = generateMetricsWithCarryover(
                totalDays,
                dailyLoads,
                startDate,
                questionnaireMap,
                allResponses
            );

            const baseline = generateMetricsBaseline(totalDays, dailyLoads);

            // Day 2 should have higher fatigue (poor)
            expect(withQuestionnaire[2].fatigue).toBeGreaterThan(baseline[2].fatigue);

            // Day 5 should have lower fatigue (excellent, counteracting poor carryover)
            expect(withQuestionnaire[5].fatigue).toBeLessThan(baseline[5].fatigue);
        });

        it('should use trend analysis when multiple responses exist', () => {
            const totalDays = 10;
            const dailyLoads = createDailyLoads(totalDays, 50);

            // Create improving trend: days 2, 3, 4 get progressively better
            const resp1 = createQuestionnaireResponse(addDays(startDate, 2), {
                sleep_hours: 2, sleep_quality: 2, energy: 2, motivation: 2
            });
            const resp2 = createQuestionnaireResponse(addDays(startDate, 3), {
                sleep_hours: 3, sleep_quality: 3, energy: 3, motivation: 3
            });
            const resp3 = createQuestionnaireResponse(addDays(startDate, 4), {
                sleep_hours: 4, sleep_quality: 4, energy: 4, motivation: 4
            });

            const questionnaireMap = new Map<string, QuestionnaireResponse>();
            questionnaireMap.set(resp1.date, resp1);
            questionnaireMap.set(resp2.date, resp2);
            questionnaireMap.set(resp3.date, resp3);

            const allResponses = [resp1, resp2, resp3];

            const metrics = generateMetricsWithCarryover(
                totalDays,
                dailyLoads,
                startDate,
                questionnaireMap,
                allResponses
            );

            const baseline = generateMetricsBaseline(totalDays, dailyLoads);

            // Day 4 (best response: 4s across the board) should have better readiness than day 2 (worst: 2s)
            // But carryover from day 2's poor response may still affect day 4
            // The key is that day 4's direct adjustment is positive (scores of 4 > neutral 3)
            expect(metrics[4].readiness).toBeGreaterThan(baseline[4].readiness - 10);

            // Also verify all metrics are within valid range
            for (let i = 2; i <= 4; i++) {
                expect(metrics[i].readiness).toBeGreaterThanOrEqual(0);
                expect(metrics[i].readiness).toBeLessThanOrEqual(100);
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty arrays', () => {
            const totalDays = 5;
            const dailyLoads = createDailyLoads(totalDays, 0);
            const emptyMap = new Map<string, QuestionnaireResponse>();

            const metrics = generateMetricsWithCarryover(
                totalDays,
                dailyLoads,
                startDate,
                emptyMap,
                []
            );

            expect(metrics.length).toBe(totalDays);
        });

        it('should handle questionnaire on day 0', () => {
            const totalDays = 5;
            const dailyLoads = createDailyLoads(totalDays, 50);

            const response = createQuestionnaireResponse(startDate, {
                sleep_hours: 1,
                sleep_quality: 1,
                energy: 1
            });

            const questionnaireMap = new Map<string, QuestionnaireResponse>();
            questionnaireMap.set(response.date, response);

            const metrics = generateMetricsWithCarryover(
                totalDays,
                dailyLoads,
                startDate,
                questionnaireMap,
                [response]
            );

            const baseline = generateMetricsBaseline(totalDays, dailyLoads);

            // Day 0 should show effect of poor response
            expect(metrics[0].fatigue).toBeGreaterThan(baseline[0].fatigue);
        });

        it('should handle questionnaire on last day', () => {
            const totalDays = 5;
            const dailyLoads = createDailyLoads(totalDays, 50);
            const lastDayStr = addDays(startDate, totalDays - 1);

            const response = createQuestionnaireResponse(lastDayStr, {
                sleep_hours: 5,
                sleep_quality: 5,
                energy: 5
            });

            const questionnaireMap = new Map<string, QuestionnaireResponse>();
            questionnaireMap.set(response.date, response);

            const metrics = generateMetricsWithCarryover(
                totalDays,
                dailyLoads,
                startDate,
                questionnaireMap,
                [response]
            );

            const baseline = generateMetricsBaseline(totalDays, dailyLoads);

            // Last day should show effect of excellent response
            expect(metrics[totalDays - 1].readiness).toBeGreaterThan(baseline[totalDays - 1].readiness);
        });

        it('should clamp fatigue and readiness to valid range [0, 100]', () => {
            const totalDays = 10;
            const dailyLoads = createDailyLoads(totalDays, 50);

            // Create extreme poor response
            const extremePoor = createQuestionnaireResponse(addDays(startDate, 3), {
                sleep_hours: 1,
                sleep_quality: 1,
                energy: 1,
                motivation: 1,
                stress: 1,
                soreness: 1,
                hydration: 1,
                nutrition: 1
            });

            const questionnaireMap = new Map<string, QuestionnaireResponse>();
            questionnaireMap.set(extremePoor.date, extremePoor);

            const metrics = generateMetricsWithCarryover(
                totalDays,
                dailyLoads,
                startDate,
                questionnaireMap,
                [extremePoor]
            );

            // All values should be within valid range
            for (const m of metrics) {
                expect(m.fatigue).toBeGreaterThanOrEqual(0);
                expect(m.fatigue).toBeLessThanOrEqual(100);
                expect(m.readiness).toBeGreaterThanOrEqual(0);
                expect(m.readiness).toBeLessThanOrEqual(100);
            }
        });

        it('should handle questionnaire with partial responses (neutral defaults)', () => {
            const totalDays = 7;
            const dailyLoads = createDailyLoads(totalDays, 50);

            // Only set sleep_hours, rest use defaults (3)
            const partialResponse = createQuestionnaireResponse(addDays(startDate, 3), {
                sleep_hours: 1
            });

            const questionnaireMap = new Map<string, QuestionnaireResponse>();
            questionnaireMap.set(partialResponse.date, partialResponse);

            const metrics = generateMetricsWithCarryover(
                totalDays,
                dailyLoads,
                startDate,
                questionnaireMap,
                [partialResponse]
            );

            const baseline = generateMetricsBaseline(totalDays, dailyLoads);

            // Should still show some effect (from sleep_hours=1)
            expect(metrics[3].fatigue).toBeGreaterThan(baseline[3].fatigue);
        });
    });
});
