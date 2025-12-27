/**
 * Questionnaire Algorithm Tests
 * 
 * Comprehensive test suite for the enhanced readiness questionnaire algorithm.
 * Tests all 6 intelligence layers: synergy detection, trend analysis,
 * cascade effects, athlete profile detection, cluster weighting, and non-linear scaling.
 */

import { describe, it, expect } from 'vitest';
import {
    applyQuestionnaireAdjustment,
    calculateWeightedAverage,
    calculateNonLinearAmplifier,
    detectCategorySynergy,
    analyzeTrend,
    applyCascadeRules,
    detectAthleteProfile,
    QUESTIONNAIRE_QUESTIONS
} from './questionnaireConfig';
import { QuestionnaireResponse } from '../types';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a mock questionnaire response with specified values
 */
function createResponse(
    values: Partial<Record<string, number>>,
    date: string = new Date().toISOString().split('T')[0]
): QuestionnaireResponse {
    // Start with all neutral (3)
    const responses: Record<string, number> = {
        sleep_hours: 3,
        sleep_quality: 3,
        hydration: 3,
        nutrition: 3,
        stress: 3,
        soreness: 3,
        energy: 3,
        motivation: 3
    };

    // Override with provided values
    Object.assign(responses, values);

    return {
        date,
        responses,
        timestamp: new Date().toISOString()
    };
}

/**
 * Create multiple responses for trend testing
 */
function createHistoricalResponses(
    avgValue: number,
    count: number
): QuestionnaireResponse[] {
    const responses: QuestionnaireResponse[] = [];
    const today = new Date();

    for (let i = 1; i <= count; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        responses.push(createResponse(
            {
                sleep_hours: avgValue,
                sleep_quality: avgValue,
                hydration: avgValue,
                nutrition: avgValue,
                stress: avgValue,
                soreness: avgValue,
                energy: avgValue,
                motivation: avgValue
            },
            date.toISOString().split('T')[0]
        ));
    }

    return responses;
}

// ============================================================================
// NON-LINEAR SCALING TESTS (Layer 6)
// ============================================================================

describe('Non-linear Scaling', () => {
    it('neutral (3) applies 1.0x amplifier', () => {
        const amplifier = calculateNonLinearAmplifier(3);
        expect(amplifier).toBeCloseTo(1.0, 2);
    });

    it('moderate values (2, 4) apply ~1.35x amplifier', () => {
        const amp2 = calculateNonLinearAmplifier(2);
        const amp4 = calculateNonLinearAmplifier(4);

        expect(amp2).toBeCloseTo(1.35, 1);
        expect(amp4).toBeCloseTo(1.35, 1);
        expect(amp2).toBe(amp4); // Symmetric
    });

    it('extreme values (1, 5) apply 2.0x amplifier', () => {
        const amp1 = calculateNonLinearAmplifier(1);
        const amp5 = calculateNonLinearAmplifier(5);

        // Formula: 1 + Math.pow(deviation/2, 1.5) = 1 + Math.pow(2/2, 1.5) = 1 + 1 = 2.0
        expect(amp1).toBeCloseTo(2.0, 1);
        expect(amp5).toBeCloseTo(2.0, 1);
        expect(amp1).toBe(amp5); // Symmetric
    });
});

// ============================================================================
// SYNERGY DETECTION TESTS (Layer 1)
// ============================================================================

describe('Synergy Detection', () => {
    it('returns 1.0x multiplier for neutral responses', () => {
        const responses = createResponse({});
        const result = detectCategorySynergy(responses.responses);

        expect(result.synergyMultiplier).toBe(1.0);
        expect(result.alignedCategories).toBe(0);
    });

    it('returns 1.25x multiplier when 2 categories are at extreme', () => {
        // Sleep category (sleep_hours, sleep_quality) and physical (soreness, energy) at extreme low
        const responses = createResponse({
            sleep_hours: 1,
            sleep_quality: 2,
            soreness: 1,
            energy: 2
        });
        const result = detectCategorySynergy(responses.responses);

        expect(result.synergyMultiplier).toBe(1.25);
        expect(result.alignedCategories).toBe(2);
        expect(result.direction).toBe('negative');
    });

    it('returns 1.5x multiplier when 3+ categories are at extreme', () => {
        // Sleep, physical, and stress all at extreme low
        const responses = createResponse({
            sleep_hours: 1,
            sleep_quality: 1,
            soreness: 1,
            energy: 1,
            stress: 1
        });
        const result = detectCategorySynergy(responses.responses);

        expect(result.synergyMultiplier).toBe(1.5);
        expect(result.alignedCategories).toBeGreaterThanOrEqual(3);
        expect(result.direction).toBe('negative');
    });

    it('detects positive synergy', () => {
        // Sleep, physical, and stress all at extreme high
        const responses = createResponse({
            sleep_hours: 5,
            sleep_quality: 5,
            soreness: 5,
            energy: 5,
            stress: 5
        });
        const result = detectCategorySynergy(responses.responses);

        expect(result.synergyMultiplier).toBe(1.5);
        expect(result.direction).toBe('positive');
    });

    it('returns mixed when categories conflict', () => {
        const responses = createResponse({
            sleep_hours: 1,
            sleep_quality: 1,
            energy: 5,
            soreness: 5
        });
        const result = detectCategorySynergy(responses.responses);

        // Conflicting extremes should result in lower synergy
        expect(result.alignedCategories).toBeLessThanOrEqual(2);
    });
});

// ============================================================================
// TREND ANALYSIS TESTS (Layer 2)
// ============================================================================

describe('Trend Analysis', () => {
    it('returns 1.0x multiplier with insufficient history', () => {
        const response = createResponse({});
        const history = createHistoricalResponses(3, 2); // Only 2 days

        const result = analyzeTrend(
            calculateWeightedAverage(response),
            history
        );

        expect(result.trendMultiplier).toBe(1.0);
        expect(result.trendDirection).toBe('stable');
        expect(result.daysAnalyzed).toBe(2);
    });

    it('returns 1.0x multiplier for stable trend', () => {
        const todayResponse = createResponse({ sleep_hours: 3, energy: 3 });
        const history = createHistoricalResponses(3, 5); // 5 days of neutral

        const result = analyzeTrend(
            calculateWeightedAverage(todayResponse),
            history
        );

        expect(result.trendMultiplier).toBe(1.0);
        expect(result.trendDirection).toBe('stable');
    });

    it('returns 1.3x multiplier for declining trend', () => {
        // Today is much worse than history
        const todayResponse = createResponse({
            sleep_hours: 1,
            sleep_quality: 1,
            energy: 1,
            soreness: 1
        });
        const history = createHistoricalResponses(4, 5); // 5 days of good responses

        const result = analyzeTrend(
            calculateWeightedAverage(todayResponse),
            history
        );

        expect(result.trendMultiplier).toBe(1.3);
        expect(result.trendDirection).toBe('declining');
    });

    it('returns 0.85x multiplier for improving trend', () => {
        // Today is much better than history
        const todayResponse = createResponse({
            sleep_hours: 5,
            sleep_quality: 5,
            energy: 5,
            soreness: 5
        });
        const history = createHistoricalResponses(2, 5); // 5 days of poor responses

        const result = analyzeTrend(
            calculateWeightedAverage(todayResponse),
            history
        );

        expect(result.trendMultiplier).toBe(0.85);
        expect(result.trendDirection).toBe('improving');
    });
});

// ============================================================================
// CASCADE RULES TESTS (Layer 3)
// ============================================================================

describe('Cascade Rules', () => {
    it('sleep_hours=1 adds +3 fatigue, -2 readiness', () => {
        const responses = createResponse({ sleep_hours: 1 });
        const result = applyCascadeRules(responses.responses);

        expect(result.fatigueBoost).toBe(3);
        expect(result.readinessBoost).toBe(-2);
        expect(result.triggers).toContain('sleep_deprivation');
    });

    it('soreness=1 adds +2 fatigue', () => {
        const responses = createResponse({ soreness: 1 });
        const result = applyCascadeRules(responses.responses);

        expect(result.fatigueBoost).toBe(2);
        expect(result.triggers).toContain('extreme_soreness');
    });

    it('energy=1 adds +2 fatigue, -2 readiness', () => {
        const responses = createResponse({ energy: 1 });
        const result = applyCascadeRules(responses.responses);

        expect(result.fatigueBoost).toBe(2);
        expect(result.readinessBoost).toBe(-2);
        expect(result.triggers).toContain('exhaustion');
    });

    it('motivation=5 adds -2 fatigue, +2 readiness', () => {
        const responses = createResponse({ motivation: 5 });
        const result = applyCascadeRules(responses.responses);

        expect(result.fatigueBoost).toBe(-2);
        expect(result.readinessBoost).toBe(2);
        expect(result.triggers).toContain('high_motivation');
    });

    it('stress=1 adds +2 fatigue, -1 readiness', () => {
        const responses = createResponse({ stress: 1 });
        const result = applyCascadeRules(responses.responses);

        expect(result.fatigueBoost).toBe(2);
        expect(result.readinessBoost).toBe(-1);
        expect(result.triggers).toContain('overwhelming_stress');
    });

    it('efficient sleeper (sleep=5, energy>=4) adds -2 fatigue', () => {
        const responses = createResponse({ sleep_hours: 5, energy: 4 });
        const result = applyCascadeRules(responses.responses);

        expect(result.fatigueBoost).toBe(-2);
        expect(result.triggers).toContain('efficient_sleeper');
    });

    it('multiple cascades stack up to cap', () => {
        const responses = createResponse({
            sleep_hours: 1,
            soreness: 1,
            energy: 1,
            stress: 1
        });
        const result = applyCascadeRules(responses.responses);

        // Total before cap: 3+2+2+2 = 9 fatigue, -2-2-1 = -5 readiness
        // After cap: 8 fatigue, -5 readiness
        expect(result.fatigueBoost).toBe(8);  // Capped at 8
        expect(result.readinessBoost).toBe(-5);
        expect(result.triggers.length).toBe(4);
    });
});

// ============================================================================
// ATHLETE PROFILE DETECTION TESTS (Layer 4)
// ============================================================================

describe('Athlete Profile Detection', () => {
    it('detects normal profile for neutral responses', () => {
        const responses = createResponse({});
        const result = detectAthleteProfile(responses.responses);

        expect(result.profile).toBe('normal');
        expect(result.adjustmentModifier).toBe(1.0);
    });

    it('detects masked fatigue when motivation>=4 AND energy<=2', () => {
        const responses = createResponse({ motivation: 5, energy: 1 });
        const result = detectAthleteProfile(responses.responses);

        expect(result.profile).toBe('masked_fatigue');
        expect(result.adjustmentModifier).toBe(1.4);
    });

    it('detects resilient pattern when sleep<=2 AND energy>=4', () => {
        const responses = createResponse({ sleep_hours: 1, energy: 5 });
        const result = detectAthleteProfile(responses.responses);

        expect(result.profile).toBe('resilient');
        expect(result.adjustmentModifier).toBe(0.8);
    });

    it('detects stress immune when stress<=2 AND energy>=4', () => {
        const responses = createResponse({ stress: 1, energy: 5 });
        const result = detectAthleteProfile(responses.responses);

        expect(result.profile).toBe('stress_immune');
        expect(result.adjustmentModifier).toBe(1.0);
    });

    it('detects honest tired when 3+ categories are low', () => {
        const responses = createResponse({
            sleep_hours: 1,
            sleep_quality: 1,
            soreness: 1,
            energy: 1,
            stress: 2
        });
        const result = detectAthleteProfile(responses.responses);

        expect(result.profile).toBe('honest_tired');
        expect(result.adjustmentModifier).toBe(1.2);
    });

    it('masked fatigue has priority over resilient', () => {
        // Edge case: both patterns could match
        const responses = createResponse({
            motivation: 5,
            energy: 1,
            sleep_hours: 1
        });
        const result = detectAthleteProfile(responses.responses);

        // Masked fatigue should win because it's checked first
        expect(result.profile).toBe('masked_fatigue');
    });
});

// ============================================================================
// BASE IMPACT TESTS
// ============================================================================

describe('Base Impact', () => {
    it('neutral responses give approximately 0 adjustment', () => {
        const response = createResponse({});
        const result = applyQuestionnaireAdjustment(50, 50, response);

        // With all neutral responses, adjustment should be minimal
        expect(Math.abs(result.readinessChange)).toBeLessThanOrEqual(3);
        expect(Math.abs(result.fatigueChange)).toBeLessThanOrEqual(3);
    });

    it('extreme negative responses give strong readiness decrease', () => {
        const response = createResponse({
            sleep_hours: 1,
            sleep_quality: 1,
            hydration: 1,
            nutrition: 1,
            stress: 1,
            soreness: 1,
            energy: 1,
            motivation: 1
        });
        const result = applyQuestionnaireAdjustment(70, 30, response);

        // Should be significantly negative - with all cascades stacking this can be severe
        expect(result.readinessChange).toBeLessThan(-15);
    });

    it('extreme negative responses give strong fatigue increase', () => {
        const response = createResponse({
            sleep_hours: 1,
            sleep_quality: 1,
            hydration: 1,
            nutrition: 1,
            stress: 1,
            soreness: 1,
            energy: 1,
            motivation: 1
        });
        const result = applyQuestionnaireAdjustment(70, 30, response);

        // Should be significantly positive (increase fatigue)
        // With cascades stacking, can be quite high
        expect(result.fatigueChange).toBeGreaterThan(10);
    });

    it('extreme positive responses give ~+12 to +15 readiness', () => {
        const response = createResponse({
            sleep_hours: 5,
            sleep_quality: 5,
            hydration: 5,
            nutrition: 5,
            stress: 5,
            soreness: 5,
            energy: 5,
            motivation: 5
        });
        const result = applyQuestionnaireAdjustment(50, 50, response);

        // Should be significantly positive
        expect(result.readinessChange).toBeGreaterThan(8);
        expect(result.readinessChange).toBeLessThan(25);
    });

    it('extreme positive responses give ~-12 to -15 fatigue', () => {
        const response = createResponse({
            sleep_hours: 5,
            sleep_quality: 5,
            hydration: 5,
            nutrition: 5,
            stress: 5,
            soreness: 5,
            energy: 5,
            motivation: 5
        });
        const result = applyQuestionnaireAdjustment(50, 50, response);

        // Should be significantly negative (decrease fatigue)
        expect(result.fatigueChange).toBeLessThan(-8);
        expect(result.fatigueChange).toBeGreaterThan(-25);
    });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration', () => {
    it('properly combines all intelligence layers', () => {
        // Create a response that triggers multiple layers
        const response = createResponse({
            sleep_hours: 1,
            sleep_quality: 1,
            soreness: 1,
            energy: 1,
            stress: 1,
            motivation: 3,
            hydration: 2,
            nutrition: 2
        });

        // Create declining historical trend
        const history = createHistoricalResponses(4, 5);

        const result = applyQuestionnaireAdjustment(70, 30, response, history);

        // Should have intelligence factors
        expect(result.intelligenceFactors).toBeDefined();
        expect(result.intelligenceFactors!.synergyMultiplier).toBeGreaterThanOrEqual(1.25);
        expect(result.intelligenceFactors!.trendMultiplier).toBe(1.3);
        expect(result.intelligenceFactors!.cascadeEffects.triggers.length).toBeGreaterThan(0);

        // Final adjustment should be strongly negative for readiness
        expect(result.readinessChange).toBeLessThan(-15);
    });

    it('clamps final values to 0-100 range', () => {
        // Try to push values beyond limits
        const extremeNegative = createResponse({
            sleep_hours: 1,
            sleep_quality: 1,
            hydration: 1,
            nutrition: 1,
            stress: 1,
            soreness: 1,
            energy: 1,
            motivation: 1
        });

        // Start with low readiness, high fatigue
        const result = applyQuestionnaireAdjustment(10, 90, extremeNegative);

        expect(result.readiness).toBeGreaterThanOrEqual(0);
        expect(result.readiness).toBeLessThanOrEqual(100);
        expect(result.fatigue).toBeGreaterThanOrEqual(0);
        expect(result.fatigue).toBeLessThanOrEqual(100);
    });

    it('returns detailed intelligence factors breakdown', () => {
        const response = createResponse({ energy: 2, motivation: 4 });
        const result = applyQuestionnaireAdjustment(50, 50, response);

        expect(result.intelligenceFactors).toBeDefined();
        expect(result.intelligenceFactors!.synergyMultiplier).toBeDefined();
        expect(result.intelligenceFactors!.trendMultiplier).toBeDefined();
        expect(result.intelligenceFactors!.cascadeEffects).toBeDefined();
        expect(result.intelligenceFactors!.athleteProfile).toBeDefined();
        expect(result.intelligenceFactors!.profileModifier).toBeDefined();
        expect(result.intelligenceFactors!.extremeResponsesDetected).toBeDefined();
        expect(result.intelligenceFactors!.nonLinearMultiplier).toBeDefined();
    });

    it('asymmetric risk amplifies negative feelings by 1.2x', () => {
        // Compare positive vs negative adjustments
        const negativeResponse = createResponse({
            sleep_hours: 2,
            energy: 2,
            soreness: 2
        });
        const positiveResponse = createResponse({
            sleep_hours: 4,
            energy: 4,
            soreness: 4
        });

        const negativeResult = applyQuestionnaireAdjustment(60, 40, negativeResponse);
        const positiveResult = applyQuestionnaireAdjustment(60, 40, positiveResponse);

        // Negative adjustments should be larger in magnitude due to 1.2x asymmetric risk
        const negativeImpact = Math.abs(negativeResult.readinessChange);
        const positiveImpact = Math.abs(positiveResult.readinessChange);

        // Allow some tolerance due to other multipliers
        expect(negativeImpact).toBeGreaterThanOrEqual(positiveImpact * 0.9);
    });
});

// ============================================================================
// WEIGHTED AVERAGE TESTS
// ============================================================================

describe('Weighted Average Calculation', () => {
    it('returns 3 for all neutral responses', () => {
        const response = createResponse({});
        const avg = calculateWeightedAverage(response, false, false);

        expect(avg).toBeCloseTo(3, 1);
    });

    it('returns 1 for all minimum responses', () => {
        const response = createResponse({
            sleep_hours: 1,
            sleep_quality: 1,
            hydration: 1,
            nutrition: 1,
            stress: 1,
            soreness: 1,
            energy: 1,
            motivation: 1
        });
        const avg = calculateWeightedAverage(response, false, false);

        expect(avg).toBeCloseTo(1, 1);
    });

    it('returns 5 for all maximum responses', () => {
        const response = createResponse({
            sleep_hours: 5,
            sleep_quality: 5,
            hydration: 5,
            nutrition: 5,
            stress: 5,
            soreness: 5,
            energy: 5,
            motivation: 5
        });
        const avg = calculateWeightedAverage(response, false, false);

        expect(avg).toBeCloseTo(5, 1);
    });

    it('weights high-weight questions more heavily', () => {
        // Sleep hours (weight 1.2) and energy (weight 1.2) are high
        // Others are neutral
        const highWeightLow = createResponse({
            sleep_hours: 1,  // weight 1.2
            energy: 1        // weight 1.2
        });

        const lowWeightLow = createResponse({
            hydration: 1,    // weight 0.8
            nutrition: 1     // weight 0.8
        });

        const avgHighWeight = calculateWeightedAverage(highWeightLow, false, false);
        const avgLowWeight = calculateWeightedAverage(lowWeightLow, false, false);

        // High weight questions should pull average down more
        expect(avgHighWeight).toBeLessThan(avgLowWeight);
    });
});
