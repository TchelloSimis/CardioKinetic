/**
 * Questionnaire Configuration
 * 
 * Defines the daily readiness questionnaire questions and the adjustment algorithm.
 * The questionnaire captures subjective wellness factors that the training load model
 * cannot measure directly (sleep quality, stress, nutrition, etc.).
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

// ============================================================================
// ADJUSTMENT ALGORITHM
// ============================================================================

// Base adjustment magnitudes
const BASE_READINESS_ADJUSTMENT = 5;
const BASE_FATIGUE_ADJUSTMENT = 4;

/**
 * Calculate weighted average score from questionnaire responses.
 * Returns a value between 1 and 5.
 */
export function calculateWeightedAverage(response: QuestionnaireResponse): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const question of QUESTIONNAIRE_QUESTIONS) {
        const value = response.responses[question.id];
        if (value !== undefined) {
            weightedSum += value * question.weight;
            totalWeight += question.weight;
        }
    }

    if (totalWeight === 0) return 3; // Neutral if no responses
    return weightedSum / totalWeight;
}

/**
 * Apply questionnaire-based adjustment to fatigue and readiness scores.
 * 
 * Core Principles:
 * 1. Contradiction > Confirmation: When subjective feel contradicts metrics, 
 *    the adjustment is larger (captures hidden factors like illness, stress)
 * 2. Asymmetric risk: Feeling worse than metrics suggest is weighted more heavily
 * 3. Guaranteed minimum impact: Even confirmation provides a small nudge
 */
export function applyQuestionnaireAdjustment(
    baseReadiness: number,
    baseFatigue: number,
    response: QuestionnaireResponse
): { readiness: number; fatigue: number; readinessChange: number; fatigueChange: number } {
    const avgScore = calculateWeightedAverage(response);
    const normalized = (avgScore - 3) / 2; // -1 to +1

    // Convert base scores to same -1 to +1 scale for comparison
    const metricsSignal = (baseReadiness - 50) / 50;     // -1 (tired) to +1 (fresh)
    const questionnaireSignal = normalized;              // -1 (terrible) to +1 (great)

    // How much do they agree? Negative = contradiction, positive = agreement
    const agreement = metricsSignal * questionnaireSignal;

    // Determine adjustment multiplier based on agreement
    let multiplier: number;
    if (agreement < 0) {
        // CONTRADICTION: questionnaire and metrics disagree
        // Bigger adjustment - the user knows something the model doesn't
        multiplier = 1.0 + Math.abs(agreement) * 0.5;  // 1.0 to 1.5x
    } else {
        // CONFIRMATION: both agree
        // Still apply adjustment, but slightly reduced
        multiplier = 0.6 + agreement * 0.4;  // 0.6 to 1.0x
    }

    // Calculate adjustments
    let readinessAdj = normalized * BASE_READINESS_ADJUSTMENT * multiplier;
    let fatigueAdj = -normalized * BASE_FATIGUE_ADJUSTMENT * multiplier;

    // Asymmetric safety: feeling worse is weighted more heavily (injury prevention)
    if (normalized < 0) {
        readinessAdj *= 1.2;
        fatigueAdj *= 1.2;
    }

    // Clamp final values
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

    return {
        readiness: clamp(Math.round(baseReadiness + readinessAdj), 0, 100),
        fatigue: clamp(Math.round(baseFatigue + fatigueAdj), 0, 100),
        readinessChange: Math.round(readinessAdj),
        fatigueChange: Math.round(fatigueAdj)
    };
}

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
