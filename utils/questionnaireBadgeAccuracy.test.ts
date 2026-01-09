/**
 * Questionnaire Badge Accuracy Tests
 * 
 * Tests that the +/- R +/- F badges on completed questionnaire tiles
 * accurately reflect the total effect of the questionnaire on fatigue/readiness.
 * 
 * Key invariant: badge = (values WITH questionnaire) - (values WITHOUT questionnaire)
 */

import { describe, it, expect } from 'vitest';
import { QuestionnaireResponse, Session, CriticalPowerEstimate } from '../types';
import { addDays } from './dateUtils';
import { applyQuestionnaireAdjustment } from './questionnaireConfig';
import {
    updateMetabolicFreshness,
    updateStructuralHealth,
    calculateReadinessScore as calculateChronicReadiness,
    applyStructuralCorrection,
    applyMetabolicCorrection,
    DEFAULT_PHI_RECOVERY,
    DEFAULT_CAP_METABOLIC,
    DEFAULT_CAP_STRUCTURAL,
    SIGMA_IMPACT,
} from './chronicFatigueModel';
import { aggregateDailyLoad } from './physiologicalCostEngine';

// ============================================================================
// HELPERS
// ============================================================================

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

function createMockSession(date: string, power: number, duration: number): Session {
    return {
        id: `session-${date}`,
        date,
        power,
        duration,
        rpe: 5,
        distance: 0,
        workRestRatio: '1:1'
    };
}

const mockCPEstimate: CriticalPowerEstimate = {
    cp: 200,
    wPrime: 15000,
    confidence: 0.8,
    dataPoints: 5,
    decayApplied: false,
    lastUpdated: new Date().toISOString()
};

function calculatePhiRecovery(response: QuestionnaireResponse | undefined): number {
    if (!response) return DEFAULT_PHI_RECOVERY;

    const { responses } = response;
    const sleepHours = responses['sleep_hours'] || 3;
    const sleepQuality = responses['sleep_quality'] || 3;
    const sleep = (sleepHours + sleepQuality) / 2;
    const nutrition = responses['nutrition'] || 3;
    const stress = responses['stress'] || 3;

    const sleepNorm = (sleep - 1) / 4;
    const nutritionNorm = (nutrition - 1) / 4;
    const stressNorm = (stress - 1) / 4;

    const avgFactor = (sleepNorm + nutritionNorm + stressNorm) / 3;
    return Math.max(0.5, Math.min(1.5, 0.5 + avgFactor));
}

/**
 * Simulate the metric calculation for a single day WITH and WITHOUT questionnaire,
 * returning the badge adjustment that should be displayed.
 */
function calculateBadgeAdjustment(
    sessions: Session[],
    startDate: string,
    simulatedDayIndex: number,
    allResponses: QuestionnaireResponse[],
    todayResponse: QuestionnaireResponse | undefined
): { readinessChange: number; fatigueChange: number } | undefined {
    // Build questionnaire map (includes todayResponse if present)
    const questionnaireByDate = new Map<string, QuestionnaireResponse>();
    allResponses.forEach(r => questionnaireByDate.set(r.date, r));
    if (todayResponse) {
        questionnaireByDate.set(todayResponse.date, todayResponse);
    }

    // Initialize state
    let sMeta = 0;
    let sStruct = 0;
    const capMeta = DEFAULT_CAP_METABOLIC;
    const capStruct = DEFAULT_CAP_STRUCTURAL;
    let wellnessModifier = 0;
    const wellnessAlpha = 2 / (3 + 1);

    let badgeAdjustment: { readinessChange: number; fatigueChange: number } | undefined;

    for (let i = 0; i <= simulatedDayIndex; i++) {
        const dateStr = addDays(startDate, i);
        const isSimulatedDate = (i === simulatedDayIndex);

        // Daily load
        const dailyLoad = aggregateDailyLoad(sessions, dateStr, mockCPEstimate);

        // Get questionnaire response for the day
        const dayResponse = questionnaireByDate.get(dateStr);
        const phiRecovery = calculatePhiRecovery(dayResponse);

        // Update compartments
        sMeta = updateMetabolicFreshness(sMeta, dailyLoad, phiRecovery, capMeta);
        sStruct = updateStructuralHealth(sStruct, dailyLoad, SIGMA_IMPACT, capStruct);

        // Apply Bayesian corrections
        if (dayResponse) {
            const soreness = dayResponse.responses['soreness'];
            const energy = dayResponse.responses['energy'];

            if (soreness && soreness <= 2) {
                const correction = applyStructuralCorrection(
                    { sMetabolic: sMeta, sStructural: sStruct, capMetabolic: capMeta, capStructural: capStruct, lastUpdated: '' },
                    soreness
                );
                sStruct = correction.sStructural;
            }
            if (energy && energy <= 2) {
                const correction = applyMetabolicCorrection(
                    { sMetabolic: sMeta, sStructural: sStruct, capMetabolic: capMeta, capStructural: capStruct, lastUpdated: '' },
                    energy
                );
                sMeta = correction.sMetabolic;
            }
        }

        // Calculate readiness/fatigue
        let readiness = calculateChronicReadiness(sMeta, sStruct, capMeta, capStruct);
        const metaRatio = sMeta / capMeta;
        const structRatio = sStruct / capStruct;
        const avgRatio = (metaRatio * 0.6 + structRatio * 0.4);
        let fatigue = Math.round(Math.min(100, Math.max(0, avgRatio * 100)));

        if (dayResponse) {
            // Capture pre-questionnaire values on simulated date
            const readinessBeforeQ = readiness;
            const fatigueBeforeQ = fatigue;

            // Get recent responses for trend analysis
            const allResponsesForTrend = [...allResponses, ...(todayResponse ? [todayResponse] : [])];
            const recentForDay = allResponsesForTrend
                .filter(r => r.date < dateStr)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 7);

            const adjustment = applyQuestionnaireAdjustment(
                readiness,
                fatigue,
                dayResponse,
                recentForDay
            );

            // Wellness modifier update
            const fatigueImpact = adjustment.fatigue - fatigue;
            const readinessImpact = adjustment.readiness - readiness;
            wellnessModifier = wellnessModifier * (1 - wellnessAlpha) +
                ((readinessImpact - fatigueImpact) / 2) * wellnessAlpha;

            readiness = adjustment.readiness;
            fatigue = adjustment.fatigue;

            // Capture badge on simulated date
            if (isSimulatedDate) {
                badgeAdjustment = {
                    readinessChange: readiness - readinessBeforeQ,
                    fatigueChange: fatigue - fatigueBeforeQ
                };
            }
        } else {
            wellnessModifier = wellnessModifier * (1 - wellnessAlpha);
            if (Math.abs(wellnessModifier) > 0.5) {
                readiness = Math.max(0, Math.min(100, Math.round(readiness + wellnessModifier)));
                fatigue = Math.max(0, Math.min(100, Math.round(fatigue - wellnessModifier)));
            }
        }
    }

    return badgeAdjustment;
}

// ============================================================================
// TESTS
// ============================================================================

describe('Questionnaire Badge Accuracy', () => {
    const startDate = '2026-01-01';

    describe('Badge reflects direct questionnaire effect', () => {
        it('neutral questionnaire (all 3s) should show approximately 0 adjustment', () => {
            const day = 5;
            const neutralResponse = createQuestionnaireResponse(addDays(startDate, day), {});

            const badge = calculateBadgeAdjustment([], startDate, day, [], neutralResponse);

            expect(badge).toBeDefined();
            expect(Math.abs(badge!.readinessChange)).toBeLessThanOrEqual(3);
            expect(Math.abs(badge!.fatigueChange)).toBeLessThanOrEqual(3);
        });

        it('extremely poor questionnaire should show negative readiness, positive fatigue', () => {
            const day = 5;
            const poorResponse = createQuestionnaireResponse(addDays(startDate, day), {
                sleep_hours: 1,
                sleep_quality: 1,
                hydration: 1,
                nutrition: 1,
                stress: 1,
                soreness: 1,
                energy: 1,
                motivation: 1
            });

            const badge = calculateBadgeAdjustment([], startDate, day, [], poorResponse);

            expect(badge).toBeDefined();
            expect(badge!.readinessChange).toBeLessThan(-10);
            expect(badge!.fatigueChange).toBeGreaterThan(10);
        });

        it('excellent questionnaire should show positive readiness, negative fatigue', () => {
            const day = 5;
            const excellentResponse = createQuestionnaireResponse(addDays(startDate, day), {
                sleep_hours: 5,
                sleep_quality: 5,
                hydration: 5,
                nutrition: 5,
                stress: 5,
                soreness: 5,
                energy: 5,
                motivation: 5
            });

            const badge = calculateBadgeAdjustment([], startDate, day, [], excellentResponse);

            expect(badge).toBeDefined();
            // Note: When baseline is already at 100% (no fatigue), excellent questionnaire
            // has ceiling effect - can't improve much. Just verify direction is correct.
            expect(badge!.readinessChange).toBeGreaterThanOrEqual(0);
            expect(badge!.fatigueChange).toBeLessThanOrEqual(0);
        });
    });

    describe('Badge shows total effect regardless of edits', () => {
        it('editing questionnaire should update badge to total effect from baseline', () => {
            const day = 5;

            // First fill: poor answers
            const firstFill = createQuestionnaireResponse(addDays(startDate, day), {
                sleep_hours: 2, energy: 2, stress: 2
            });
            const badgeAfterFirstFill = calculateBadgeAdjustment([], startDate, day, [], firstFill);

            // Edit: make answers worse
            const secondFill = createQuestionnaireResponse(addDays(startDate, day), {
                sleep_hours: 1, energy: 1, stress: 1
            });
            const badgeAfterEdit = calculateBadgeAdjustment([], startDate, day, [], secondFill);

            // Badge after edit should show TOTAL effect, not incremental
            // Since second fill is worse, the readiness change should be more negative
            expect(badgeAfterEdit!.readinessChange).toBeLessThan(badgeAfterFirstFill!.readinessChange);
            expect(badgeAfterEdit!.fatigueChange).toBeGreaterThan(badgeAfterFirstFill!.fatigueChange);
        });
    });

    describe('Badge excludes previous days questionnaire carryover', () => {
        it('badge for today should not include wellness carryover from previous days', () => {
            const today = 5;
            const yesterday = 4;

            // Excellent questionnaire yesterday
            const yesterdayResponse = createQuestionnaireResponse(addDays(startDate, yesterday), {
                sleep_hours: 5, energy: 5, stress: 5
            });

            // Neutral questionnaire today
            const todayResponse = createQuestionnaireResponse(addDays(startDate, today), {});

            // Calculate badge WITH previous day's questionnaire in history
            const badgeWithHistory = calculateBadgeAdjustment(
                [], startDate, today, [yesterdayResponse], todayResponse
            );

            // Calculate badge WITHOUT previous day's questionnaire
            const badgeWithoutHistory = calculateBadgeAdjustment(
                [], startDate, today, [], todayResponse
            );

            // Badge should be approximately the same - it shows TODAY's questionnaire effect only
            // There may be small differences due to trend analysis, but should be close
            expect(Math.abs(badgeWithHistory!.readinessChange - badgeWithoutHistory!.readinessChange)).toBeLessThanOrEqual(3);
            expect(Math.abs(badgeWithHistory!.fatigueChange - badgeWithoutHistory!.fatigueChange)).toBeLessThanOrEqual(3);
        });
    });

    describe('No questionnaire = no badge', () => {
        it('should return undefined when no questionnaire for simulated date', () => {
            const badge = calculateBadgeAdjustment([], startDate, 5, [], undefined);
            expect(badge).toBeUndefined();
        });
    });

    describe('Editing past questionnaires', () => {
        it('editing a past questionnaire should not change today\'s badge', () => {
            const today = 10;
            const pastDay = 3;

            // Today's questionnaire (neutral)
            const todayResponse = createQuestionnaireResponse(addDays(startDate, today), {});

            // Past questionnaire - original version (neutral)
            const pastResponseOriginal = createQuestionnaireResponse(addDays(startDate, pastDay), {});

            // Calculate badge with original past response
            const badgeWithOriginal = calculateBadgeAdjustment(
                [], startDate, today, [pastResponseOriginal], todayResponse
            );

            // Past questionnaire - edited version (extremely poor)
            const pastResponseEdited = createQuestionnaireResponse(addDays(startDate, pastDay), {
                sleep_hours: 1, energy: 1, stress: 1, soreness: 1
            });

            // Calculate badge with edited past response
            const badgeWithEdited = calculateBadgeAdjustment(
                [], startDate, today, [pastResponseEdited], todayResponse
            );

            // Today's badge should be the same regardless of past edits
            // (Badge only shows today's questionnaire effect, not historical changes)
            expect(badgeWithOriginal!.readinessChange).toBe(badgeWithEdited!.readinessChange);
            expect(badgeWithOriginal!.fatigueChange).toBe(badgeWithEdited!.fatigueChange);
        });

        it('editing past questionnaire should not affect badge when today has no questionnaire', () => {
            const today = 10;
            const pastDay = 3;

            // Past questionnaire - original (neutral)
            const pastOriginal = createQuestionnaireResponse(addDays(startDate, pastDay), {});
            const badgeNoToday1 = calculateBadgeAdjustment([], startDate, today, [pastOriginal], undefined);

            // Past questionnaire - edited (poor)
            const pastEdited = createQuestionnaireResponse(addDays(startDate, pastDay), {
                sleep_hours: 1, energy: 1
            });
            const badgeNoToday2 = calculateBadgeAdjustment([], startDate, today, [pastEdited], undefined);

            // Both should be undefined since no questionnaire for today
            expect(badgeNoToday1).toBeUndefined();
            expect(badgeNoToday2).toBeUndefined();
        });
    });
});
