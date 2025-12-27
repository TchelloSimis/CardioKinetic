/**
 * Questionnaire Configuration
 * 
 * Defines the daily readiness questionnaire questions and an intelligent adjustment algorithm.
 * The questionnaire captures subjective wellness factors that the training load model
 * cannot measure directly (sleep quality, stress, nutrition, etc.).
 * 
 * The algorithm incorporates 6 intelligence layers:
 * 1. Synergy Detection - compound effects when related categories align
 * 2. Trend Analysis - historical pattern recognition (7-day)
 * 3. Cascade Effects - physiological rule-based triggers
 * 4. Enhanced Contradiction Detection - athlete profile pattern matching
 * 5. Cluster Weighting - time-aware category grouping
 * 6. Non-linear Scaling - extreme response amplification
 */

import { QuestionnaireQuestion, QuestionnaireResponse } from '../types';

// ============================================================================
// QUESTION DEFINITIONS
// ============================================================================

export const QUESTIONNAIRE_QUESTIONS: QuestionnaireQuestion[] = [
    // SLEEP
    {
        id: 'sleep_hours',
        category: 'sleep',
        question: 'Hours of sleep last night?',
        tooltips: {
            1: 'Under 4 hours',
            2: '4-5 hours',
            3: '6-7 hours',
            4: '7-8 hours',
            5: '8+ hours'
        },
        weight: 1.2  // Sleep is critical
    },
    {
        id: 'sleep_quality',
        category: 'sleep',
        question: 'How was your sleep quality?',
        tooltips: {
            1: 'Terrible, barely slept',
            2: 'Poor, woke many times',
            3: 'Okay, some interruptions',
            4: 'Good, woke once or twice',
            5: 'Excellent, uninterrupted'
        },
        weight: 1.0
    },

    // NUTRITION
    {
        id: 'hydration',
        category: 'nutrition',
        question: 'How was your hydration yesterday?',
        tooltips: {
            1: 'Barely drank anything',
            2: 'Not enough, felt thirsty',
            3: 'Adequate, could be better',
            4: 'Good, drank consistently',
            5: 'Excellent, very hydrated'
        },
        weight: 0.8
    },
    {
        id: 'nutrition',
        category: 'nutrition',
        question: 'How was your nutrition yesterday?',
        tooltips: {
            1: 'Skipped meals',
            2: 'Ate poorly, junk food',
            3: 'Average, not optimal',
            4: 'Ate well, balanced meals',
            5: 'Perfect nutrition day'
        },
        weight: 0.8
    },

    // STRESS
    {
        id: 'stress',
        category: 'stress',
        question: 'What is your stress level?',
        tooltips: {
            1: "Overwhelmed, can't cope",
            2: 'Very stressed',
            3: 'Some stress, manageable',
            4: 'Fairly relaxed',
            5: 'Completely calm'
        },
        weight: 1.0
    },

    // PHYSICAL
    {
        id: 'soreness',
        category: 'physical',
        question: 'How sore are your muscles?',
        tooltips: {
            1: 'Extremely sore, painful',
            2: 'Very sore',
            3: 'Moderately sore',
            4: 'Slightly sore',
            5: 'No soreness at all'
        },
        weight: 1.0
    },
    {
        id: 'energy',
        category: 'physical',
        question: 'What is your energy level right now?',
        tooltips: {
            1: 'Exhausted, need rest',
            2: 'Low energy, sluggish',
            3: 'Average energy',
            4: 'Good energy',
            5: 'Feeling energized'
        },
        weight: 1.2  // Energy is a strong indicator
    },

    // MOTIVATION
    {
        id: 'motivation',
        category: 'motivation',
        question: 'How motivated are you to train?',
        tooltips: {
            1: "Really don't want to",
            2: 'Would rather skip',
            3: 'Neutral, could go either way',
            4: 'Ready to train',
            5: "Can't wait to train"
        },
        weight: 0.8,
        optional: true  // User may check in on rest days
    }
];

// ============================================================================
// CATEGORY METADATA
// ============================================================================

export const CATEGORY_INFO: Record<QuestionnaireQuestion['category'], { label: string }> = {
    sleep: { label: 'Sleep' },
    nutrition: { label: 'Nutrition' },
    stress: { label: 'Stress' },
    physical: { label: 'Physical' },
    motivation: { label: 'Motivation' }
};

/**
 * Category clusters for time-aware weighting.
 * - Recovery Input: Yesterday's inputs that affect today
 * - Current State: How you actually feel right now
 * - External: Life context outside training
 */
const CATEGORY_CLUSTERS: Record<string, 'recovery_input' | 'current_state' | 'external'> = {
    sleep: 'recovery_input',
    nutrition: 'recovery_input',
    physical: 'current_state',
    motivation: 'current_state',
    stress: 'external'
};

const CLUSTER_WEIGHTS: Record<string, number> = {
    recovery_input: 0.9,   // Yesterday's inputs
    current_state: 1.1,    // How you feel now
    external: 1.0          // Life context
};

// ============================================================================
// ADJUSTMENT ALGORITHM - CONSTANTS
// ============================================================================

// Calibrated base adjustment magnitudes (1.6x and 2x from original)
const BASE_READINESS_ADJUSTMENT = 8;   // Was 5, increased for greater questionnaire impact
const BASE_FATIGUE_ADJUSTMENT = 8;     // Was 4, increased for greater questionnaire impact

// Synergy detection thresholds
const SYNERGY_STRONG_THRESHOLD = 2.2;  // Category avg ≤ this = strong negative
const SYNERGY_POSITIVE_THRESHOLD = 3.8; // Category avg ≥ this = strong positive

// Trend analysis thresholds
const TREND_DECLINE_THRESHOLD = 0.85;  // Today < 85% of average = declining
const TREND_IMPROVE_THRESHOLD = 1.15;  // Today > 115% of average = improving
const TREND_MIN_HISTORY = 3;           // Minimum days for trend analysis

// ============================================================================
// INTELLIGENCE LAYER TYPES
// ============================================================================

/**
 * Result of synergy detection between categories.
 */
export interface SynergyResult {
    synergyMultiplier: number;      // 1.0-1.5 based on alignment
    alignedCategories: number;
    direction: 'negative' | 'positive' | 'mixed';
}

/**
 * Result of historical trend analysis.
 */
export interface TrendResult {
    trendMultiplier: number;        // 0.85-1.3 based on pattern
    trendDirection: 'improving' | 'stable' | 'declining';
    daysAnalyzed: number;
    historicalAverage: number;
}

/**
 * Cascade effects from specific response triggers.
 */
export interface CascadeEffect {
    fatigueBoost: number;           // Additional fatigue adjustment
    readinessBoost: number;         // Additional readiness adjustment
    triggers: string[];             // Which rules triggered
}

/**
 * Athlete profile patterns detected from responses.
 */
export type AthleteProfile =
    | 'masked_fatigue'      // High motivation + low energy → overtraining risk
    | 'resilient'           // Low sleep + high energy → in supercompensation
    | 'stress_immune'       // High stress + high energy → mentally tough
    | 'honest_tired'        // Everything low → believe them
    | 'normal';             // No special pattern

/**
 * Detailed breakdown of all intelligence factors for debugging/UI.
 */
export interface IntelligenceFactors {
    synergyMultiplier: number;
    trendMultiplier: number;
    cascadeEffects: CascadeEffect;
    athleteProfile: AthleteProfile;
    profileModifier: number;
    clusterAdjustment: number;
    extremeResponsesDetected: number;
    nonLinearMultiplier: number;
}

// ============================================================================
// NON-LINEAR SCALING (Layer 6)
// ============================================================================

/**
 * Calculate non-linear weight amplifier for extreme responses.
 * Extreme responses (1 or 5) have outsized impact vs moderate (2-4).
 * 
 * @param value - Response value 1-5
 * @returns Amplifier between 1.0 (neutral) and 1.71 (extreme)
 */
export function calculateNonLinearAmplifier(value: number): number {
    const deviation = Math.abs(value - 3);  // 0, 1, or 2
    // Polynomial scaling: extreme responses matter more
    return 1 + Math.pow(deviation / 2, 1.5);  // 1.0 to 1.71
}

// ============================================================================
// SYNERGY DETECTION (Layer 1)
// ============================================================================

/**
 * Detect when multiple categories strongly agree.
 * Compound effects when 2+ categories indicate same signal.
 * 
 * @param responses - Current questionnaire responses
 * @returns Synergy result with multiplier 1.0-1.5
 */
export function detectCategorySynergy(
    responses: Record<string, number>
): SynergyResult {
    // Group responses by category and calculate averages
    const categoryAverages: Record<string, { sum: number; count: number }> = {};

    for (const question of QUESTIONNAIRE_QUESTIONS) {
        const value = responses[question.id];
        if (value === undefined) continue;

        if (!categoryAverages[question.category]) {
            categoryAverages[question.category] = { sum: 0, count: 0 };
        }
        categoryAverages[question.category].sum += value;
        categoryAverages[question.category].count++;
    }

    // Count categories at extremes
    let negativeCategories = 0;
    let positiveCategories = 0;

    for (const category of Object.keys(categoryAverages)) {
        const data = categoryAverages[category];
        if (data.count === 0) continue;

        const avg = data.sum / data.count;
        if (avg <= SYNERGY_STRONG_THRESHOLD) {
            negativeCategories++;
        } else if (avg >= SYNERGY_POSITIVE_THRESHOLD) {
            positiveCategories++;
        }
    }

    // Determine alignment
    const maxAligned = Math.max(negativeCategories, positiveCategories);
    let direction: 'negative' | 'positive' | 'mixed' = 'mixed';
    if (negativeCategories > positiveCategories && negativeCategories >= 2) {
        direction = 'negative';
    } else if (positiveCategories > negativeCategories && positiveCategories >= 2) {
        direction = 'positive';
    }

    // Calculate synergy multiplier
    let synergyMultiplier = 1.0;
    if (maxAligned >= 3) {
        synergyMultiplier = 1.5;  // Strong synergy
    } else if (maxAligned >= 2) {
        synergyMultiplier = 1.25; // Moderate synergy
    }

    return {
        synergyMultiplier,
        alignedCategories: maxAligned,
        direction
    };
}

// ============================================================================
// TREND ANALYSIS (Layer 2)
// ============================================================================

/**
 * Analyze 7-day trend in questionnaire responses.
 * Compares today's response to recent historical average.
 * 
 * @param todayAverage - Today's weighted average score
 * @param recentResponses - Last 7 days of questionnaire responses
 * @returns Trend result with multiplier 0.85-1.3
 */
export function analyzeTrend(
    todayAverage: number,
    recentResponses: QuestionnaireResponse[]
): TrendResult {
    // Need minimum history for trend analysis
    if (recentResponses.length < TREND_MIN_HISTORY) {
        return {
            trendMultiplier: 1.0,
            trendDirection: 'stable',
            daysAnalyzed: recentResponses.length,
            historicalAverage: todayAverage
        };
    }

    // Calculate historical average
    let totalSum = 0;
    let totalCount = 0;

    for (const response of recentResponses) {
        const avg = calculateWeightedAverage(response);
        totalSum += avg;
        totalCount++;
    }

    const historicalAverage = totalSum / totalCount;
    const ratio = todayAverage / historicalAverage;

    let trendDirection: 'improving' | 'stable' | 'declining' = 'stable';
    let trendMultiplier = 1.0;

    if (ratio < TREND_DECLINE_THRESHOLD) {
        // Today is worse than recent average
        trendDirection = 'declining';
        trendMultiplier = 1.3;  // Amplify negative adjustments
    } else if (ratio > TREND_IMPROVE_THRESHOLD) {
        // Today is better than recent average
        trendDirection = 'improving';
        trendMultiplier = 0.85; // Dampen positive (body catching up)
    }

    return {
        trendMultiplier,
        trendDirection,
        daysAnalyzed: recentResponses.length,
        historicalAverage
    };
}

/**
 * Apply physiological cascade rules for specific response patterns.
 * Certain responses trigger additional effects based on known physiology.
 * 
 * NOTE: Cascades are capped at ±8 total to prevent excessive stacking
 * when multiple extreme responses are present.
 * 
 * @param responses - Current questionnaire responses
 * @returns Cascade effects with additional adjustments
 */
export function applyCascadeRules(
    responses: Record<string, number>
): CascadeEffect {
    let fatigueBoost = 0;
    let readinessBoost = 0;
    const triggers: string[] = [];

    // Sleep deprivation cascade: under 4 hours of sleep
    if (responses.sleep_hours === 1) {
        fatigueBoost += 3;
        readinessBoost -= 2;
        triggers.push('sleep_deprivation');
    }

    // Extreme soreness: DOMS indicates muscle damage
    if (responses.soreness === 1) {
        fatigueBoost += 2;
        triggers.push('extreme_soreness');
    }

    // Exhaustion: body screaming for rest
    if (responses.energy === 1) {
        fatigueBoost += 2;
        readinessBoost -= 2;
        triggers.push('exhaustion');
    }

    // High motivation can partially compensate
    if (responses.motivation === 5) {
        fatigueBoost -= 2;
        readinessBoost += 2;
        triggers.push('high_motivation');
    }

    // Overwhelming stress: cortisol impact
    if (responses.stress === 1) {
        fatigueBoost += 2;
        readinessBoost -= 1;
        triggers.push('overwhelming_stress');
    }

    // Efficient sleeper / supercompensation: great sleep efficiency
    if (responses.sleep_hours === 5 && (responses.energy ?? 0) >= 4) {
        fatigueBoost -= 2;
        triggers.push('efficient_sleeper');
    }

    // Cap cascade effects to prevent excessive stacking
    const MAX_CASCADE = 8;
    fatigueBoost = Math.max(-MAX_CASCADE, Math.min(MAX_CASCADE, fatigueBoost));
    readinessBoost = Math.max(-MAX_CASCADE, Math.min(MAX_CASCADE, readinessBoost));

    return { fatigueBoost, readinessBoost, triggers };
}

// ============================================================================
// ATHLETE PROFILE DETECTION (Layer 4)
// ============================================================================

/**
 * Detect athlete profile patterns from response combinations.
 * Identifies subtle discrepancies that indicate specific states.
 * 
 * @param responses - Current questionnaire responses
 * @returns Profile and adjustment modifier
 */
export function detectAthleteProfile(
    responses: Record<string, number>
): { profile: AthleteProfile; adjustmentModifier: number } {
    const motivation = responses.motivation ?? 3;
    const energy = responses.energy ?? 3;
    const sleepHours = responses.sleep_hours ?? 3;
    const stress = responses.stress ?? 3;

    // Count categories with low scores (≤2)
    let lowCategories = 0;
    const categoryScores: Record<string, number[]> = {};

    for (const question of QUESTIONNAIRE_QUESTIONS) {
        const value = responses[question.id];
        if (value === undefined) continue;

        if (!categoryScores[question.category]) {
            categoryScores[question.category] = [];
        }
        categoryScores[question.category].push(value);
    }

    for (const scores of Object.values(categoryScores)) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avg <= 2) lowCategories++;
    }

    // Masked Fatigue: High motivation but low energy = overtraining risk
    // The mind is willing, but the body is not ready
    if (motivation >= 4 && energy <= 2) {
        return { profile: 'masked_fatigue', adjustmentModifier: 1.4 };
    }

    // Resilient: Low sleep but high energy = supercompensation
    // Trust the energy signal over the sleep input
    if (sleepHours <= 2 && energy >= 4) {
        return { profile: 'resilient', adjustmentModifier: 0.8 };
    }

    // Stress Immune: High stress but high energy = mentally tough
    // Can handle external stress without physical impact
    if (stress <= 2 && energy >= 4) {
        return { profile: 'stress_immune', adjustmentModifier: 1.0 };
    }

    // Honest Tired: Multiple categories are low
    // Believe all the signals, athlete is genuinely fatigued
    if (lowCategories >= 3) {
        return { profile: 'honest_tired', adjustmentModifier: 1.2 };
    }

    return { profile: 'normal', adjustmentModifier: 1.0 };
}

// ============================================================================
// WEIGHTED AVERAGE CALCULATION
// ============================================================================

/**
 * Calculate weighted average score from questionnaire responses.
 * Applies non-linear scaling for extreme responses.
 * 
 * @param response - Questionnaire response
 * @param applyNonLinear - Whether to apply non-linear extreme scaling
 * @param applyClusterWeights - Whether to apply category cluster weights
 * @returns Weighted average value between 1 and 5
 */
export function calculateWeightedAverage(
    response: QuestionnaireResponse,
    applyNonLinear: boolean = false,
    applyClusterWeights: boolean = false
): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const question of QUESTIONNAIRE_QUESTIONS) {
        const value = response.responses[question.id];
        if (value === undefined) continue;

        let weight = question.weight;

        // Apply non-linear scaling for extreme responses (Layer 6)
        if (applyNonLinear) {
            weight *= calculateNonLinearAmplifier(value);
        }

        // Apply cluster weighting (Layer 5)
        if (applyClusterWeights) {
            const cluster = CATEGORY_CLUSTERS[question.category];
            weight *= CLUSTER_WEIGHTS[cluster] ?? 1.0;
        }

        weightedSum += value * weight;
        totalWeight += weight;
    }

    if (totalWeight === 0) return 3; // Neutral if no responses
    return weightedSum / totalWeight;
}

/**
 * Count extreme responses (1 or 5) in the questionnaire.
 */
function countExtremeResponses(responses: Record<string, number>): number {
    return Object.values(responses).filter(v => v === 1 || v === 5).length;
}

// ============================================================================
// MAIN ADJUSTMENT FUNCTION
// ============================================================================

/**
 * Apply questionnaire-based adjustment to fatigue and readiness scores.
 * 
 * This function implements a 6-layer intelligence system:
 * 1. Synergy Detection - compound effects when categories align
 * 2. Trend Analysis - historical pattern recognition
 * 3. Cascade Effects - physiological trigger rules
 * 4. Athlete Profile Detection - pattern-based modifier
 * 5. Cluster Weighting - time-aware category grouping
 * 6. Non-linear Scaling - extreme response amplification
 * 
 * Core Principles:
 * - Contradiction > Confirmation: When subjective feel contradicts metrics,
 *   the adjustment is larger (captures hidden factors like illness, stress)
 * - Asymmetric risk: Feeling worse than metrics suggest is weighted more heavily
 * - Guaranteed minimum impact: Even confirmation provides a small nudge
 * 
 * @param baseReadiness - Base readiness score (0-100)
 * @param baseFatigue - Base fatigue score (0-100)
 * @param response - Today's questionnaire response
 * @param recentResponses - Last 7 days of responses (optional, for trend analysis)
 * @returns Adjusted scores with detailed intelligence breakdown
 */
export function applyQuestionnaireAdjustment(
    baseReadiness: number,
    baseFatigue: number,
    response: QuestionnaireResponse,
    recentResponses?: QuestionnaireResponse[]
): {
    readiness: number;
    fatigue: number;
    readinessChange: number;
    fatigueChange: number;
    intelligenceFactors?: IntelligenceFactors;
} {
    // Calculate base weighted average with non-linear scaling and cluster weights
    const avgScore = calculateWeightedAverage(response, true, true);
    const normalized = (avgScore - 3) / 2; // -1 to +1

    // Convert base scores to same -1 to +1 scale for comparison
    const metricsSignal = (baseReadiness - 50) / 50;     // -1 (tired) to +1 (fresh)
    const questionnaireSignal = normalized;              // -1 (terrible) to +1 (great)

    // How much do they agree? Negative = contradiction, positive = agreement
    const agreement = metricsSignal * questionnaireSignal;

    // Determine base contradiction multiplier
    let contradictionMultiplier: number;
    if (agreement < 0) {
        // CONTRADICTION: questionnaire and metrics disagree
        // Bigger adjustment - the user knows something the model doesn't
        contradictionMultiplier = 1.0 + Math.abs(agreement) * 0.5;  // 1.0 to 1.5x
    } else {
        // CONFIRMATION: both agree
        // Still apply adjustment, but slightly reduced
        contradictionMultiplier = 0.6 + agreement * 0.4;  // 0.6 to 1.0x
    }

    // Layer 1: Synergy Detection
    const synergy = detectCategorySynergy(response.responses);

    // Layer 2: Trend Analysis
    const trend = analyzeTrend(avgScore, recentResponses ?? []);

    // Layer 3: Cascade Rules
    const cascades = applyCascadeRules(response.responses);

    // Layer 4: Athlete Profile Detection
    const { profile, adjustmentModifier: profileModifier } = detectAthleteProfile(response.responses);

    // Layer 5: Cluster weighting already applied in calculateWeightedAverage
    const clusterAdjustment = 1.0; // Tracked for reporting

    // Layer 6: Count extreme responses (already applied in weighted average)
    const extremeCount = countExtremeResponses(response.responses);
    const nonLinearMultiplier = extremeCount > 0 ? 1 + (extremeCount * 0.05) : 1.0;

    // Combine all multipliers with a cap to prevent extreme values
    const rawMultiplier =
        contradictionMultiplier *
        synergy.synergyMultiplier *
        trend.trendMultiplier *
        profileModifier *
        nonLinearMultiplier;

    // Cap combined multiplier at 2.5x to prevent extreme adjustments
    const combinedMultiplier = Math.min(2.5, rawMultiplier);

    // Calculate base adjustments
    let readinessAdj = normalized * BASE_READINESS_ADJUSTMENT * combinedMultiplier;
    let fatigueAdj = -normalized * BASE_FATIGUE_ADJUSTMENT * combinedMultiplier;

    // Asymmetric safety: feeling worse is weighted more heavily (injury prevention)
    // Applied BEFORE cascades so cascades don't get multiplied
    if (normalized < 0) {
        readinessAdj *= 1.15;  // Reduced from 1.2 to prevent over-amplification
        fatigueAdj *= 1.15;
    }

    // Add cascade effects (not multiplied, these are fixed bonuses)
    readinessAdj += cascades.readinessBoost;
    fatigueAdj += cascades.fatigueBoost;

    // Clamp final values
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

    const intelligenceFactors: IntelligenceFactors = {
        synergyMultiplier: synergy.synergyMultiplier,
        trendMultiplier: trend.trendMultiplier,
        cascadeEffects: cascades,
        athleteProfile: profile,
        profileModifier,
        clusterAdjustment,
        extremeResponsesDetected: extremeCount,
        nonLinearMultiplier
    };

    return {
        readiness: clamp(Math.round(baseReadiness + readinessAdj), 0, 100),
        fatigue: clamp(Math.round(baseFatigue + fatigueAdj), 0, 100),
        readinessChange: Math.round(readinessAdj),
        fatigueChange: Math.round(fatigueAdj),
        intelligenceFactors
    };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get questions grouped by category for UI display
 */
export function getQuestionsByCategory(): Map<QuestionnaireQuestion['category'], QuestionnaireQuestion[]> {
    const grouped = new Map<QuestionnaireQuestion['category'], QuestionnaireQuestion[]>();

    for (const question of QUESTIONNAIRE_QUESTIONS) {
        const existing = grouped.get(question.category) || [];
        existing.push(question);
        grouped.set(question.category, existing);
    }

    return grouped;
}

/**
 * Get default responses (all neutral - 3, except optional questions which start empty)
 */
export function getDefaultResponses(): Record<string, number | undefined> {
    const responses: Record<string, number | undefined> = {};
    for (const question of QUESTIONNAIRE_QUESTIONS) {
        // Optional questions start with no value (user must actively choose)
        responses[question.id] = question.optional ? undefined : 3;
    }
    return responses;
}
