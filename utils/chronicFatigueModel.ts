/**
 * Dual-Compartment Chronic Fatigue Model
 * 
 * Splits fatigue into two reservoirs with different recovery dynamics:
 * 
 * 1. Metabolic Freshness (MET - Metabolic Energy Tank)
 *    - Represents: glycogen stores, hormonal balance, acute energy status
 *    - Feedback: "Do I have the energy to train?"
 *    - Time constant: τ_meta ≈ 2 days (fast recovery)
 * 
 * 2. Structural Health (MSK - MusculoSkeletal)
 *    - Represents: muscle fiber integrity, inflammation, joint/tendon stress
 *    - Feedback: "Does my body hurt? Am I at injury risk?"
 *    - Time constant: τ_struct ≈ 15 days (slow recovery)
 * 
 * Based on REVISED_CHRONIC_FATIGUE_MODEL.md Section 4-5
 */

import { Session, ChronicFatigueState, CriticalPowerEstimate, QuestionnaireResponse } from '../types';
import { calculateSessionCost, aggregateDailyLoad } from './physiologicalCostEngine';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Time constant for metabolic freshness decay (days) */
export const TAU_METABOLIC = 2;

/** Time constant for structural health decay (days) */
export const TAU_STRUCTURAL = 15;

/** Weight of metabolic state in readiness score */
export const W_METABOLIC = 0.6;

/** Weight of structural state in readiness score */
export const W_STRUCTURAL = 0.4;

/** Default structural impact multiplier */
export const SIGMA_IMPACT = 1.0;

/** Default metabolic capacity */
export const DEFAULT_CAP_METABOLIC = 100;

/** Default structural capacity */
export const DEFAULT_CAP_STRUCTURAL = 100;

/** Default recovery efficiency (baseline) */
export const DEFAULT_PHI_RECOVERY = 1.0;

/** High readiness threshold for "green light" training */
export const HIGH_READINESS_THRESHOLD = 80;

/** Low state threshold for fatigue detection */
export const LOW_STATE_THRESHOLD = 0.3; // 30% of capacity

/** High state threshold for fatigue detection */
export const HIGH_STATE_THRESHOLD = 0.6; // 60% of capacity

/** Detraining time constant (days) - fitness decay without training */
export const DETRAINING_TAU = 42;

// ============================================================================
// COMPARTMENT DYNAMICS
// ============================================================================

/**
 * Update metabolic freshness state for the next day.
 * 
 * Formula: MET(t) = MET(t-1) × e^(-1/(τ_meta × φ)) + Load
 * 
 * @param currentSMeta - Current metabolic state
 * @param dailyLoad - Physiological load added today
 * @param phiRecovery - Recovery efficiency modifier from questionnaire [0.5, 1.5]
 * @param capMetabolic - Metabolic capacity (max value)
 * @returns Updated metabolic state (capped at capacity)
 */
export function updateMetabolicFreshness(
    currentSMeta: number,
    dailyLoad: number,
    phiRecovery: number = DEFAULT_PHI_RECOVERY,
    capMetabolic: number = DEFAULT_CAP_METABOLIC
): number {
    // Adjust time constant by recovery efficiency
    // Lower phi = slower recovery = higher state retention
    const effectiveTau = TAU_METABOLIC * Math.max(0.5, phiRecovery);

    // Decay existing state
    const decayFactor = Math.exp(-1 / effectiveTau);
    const decayedState = currentSMeta * decayFactor;

    // Add new load
    const newState = decayedState + dailyLoad;

    // Cap at capacity
    return Math.min(capMetabolic, Math.max(0, newState));
}

/**
 * Update structural health state for the next day.
 * 
 * Formula: MSK(t) = MSK(t-1) × e^(-1/τ_struct) + Load × σ_impact
 * 
 * @param currentSStruct - Current structural state
 * @param dailyLoad - Physiological load added today
 * @param sigmaImpact - Impact multiplier (higher for high-impact activities)
 * @param capStructural - Structural capacity (max value)
 * @returns Updated structural state (capped at capacity)
 */
export function updateStructuralHealth(
    currentSStruct: number,
    dailyLoad: number,
    sigmaImpact: number = SIGMA_IMPACT,
    capStructural: number = DEFAULT_CAP_STRUCTURAL
): number {
    // Structural state decays slowly
    const decayFactor = Math.exp(-1 / TAU_STRUCTURAL);
    const decayedState = currentSStruct * decayFactor;

    // Add new load weighted by impact multiplier
    const newState = decayedState + dailyLoad * sigmaImpact;

    // Cap at capacity
    return Math.min(capStructural, Math.max(0, newState));
}

// ============================================================================
// READINESS CALCULATION
// ============================================================================

/**
 * Calculate composite readiness score from both compartments.
 * 
 * Formula: Readiness = 100 - min(100, (w₁ × MET/Cap_meta + w₂ × MSK/Cap_struct) × 100)
 * 
 * @param sMeta - Current metabolic state
 * @param sStruct - Current structural state
 * @param capMeta - Metabolic capacity
 * @param capStruct - Structural capacity
 * @returns Readiness score (0-100, higher = more ready)
 */
export function calculateReadinessScore(
    sMeta: number,
    sStruct: number,
    capMeta: number = DEFAULT_CAP_METABOLIC,
    capStruct: number = DEFAULT_CAP_STRUCTURAL
): number {
    const metaRatio = Math.min(1, sMeta / capMeta);
    const structRatio = Math.min(1, sStruct / capStruct);

    const weightedFatigue = W_METABOLIC * metaRatio + W_STRUCTURAL * structRatio;
    const readiness = 100 - Math.min(100, weightedFatigue * 100);

    return Math.round(Math.max(0, Math.min(100, readiness)));
}

/**
 * Interpret the readiness state and provide actionable feedback.
 * 
 * @param readiness - Readiness score (0-100)
 * @param sMeta - Current metabolic state
 * @param sStruct - Current structural state
 * @param capMeta - Metabolic capacity
 * @param capStruct - Structural capacity
 * @returns Interpretive status and recommendation
 */
export function interpretReadinessState(
    readiness: number,
    sMeta: number,
    sStruct: number,
    capMeta: number = DEFAULT_CAP_METABOLIC,
    capStruct: number = DEFAULT_CAP_STRUCTURAL
): {
    status: 'green_light' | 'metabolic_fatigue' | 'structural_fatigue' | 'both_fatigued' | 'recovering';
    recommendation: string;
    sessionSuggestion: 'high_intensity' | 'endurance' | 'active_recovery' | 'rest';
} {
    const metaRatio = sMeta / capMeta;
    const structRatio = sStruct / capStruct;
    const metaPct = Math.round(metaRatio * 100);
    const structPct = Math.round(structRatio * 100);

    const isMetaFatigued = metaRatio > HIGH_STATE_THRESHOLD;
    const isStructFatigued = structRatio > HIGH_STATE_THRESHOLD;
    const isMetaFresh = metaRatio < LOW_STATE_THRESHOLD;
    const isStructFresh = structRatio < LOW_STATE_THRESHOLD;

    if (readiness >= HIGH_READINESS_THRESHOLD && isMetaFresh && isStructFresh) {
        return {
            status: 'green_light',
            recommendation: `Primed for intensity (MET ${metaPct}%, MSK ${structPct}%). Both systems fresh - ideal for high-intensity work.`,
            sessionSuggestion: 'high_intensity',
        };
    }

    if (isMetaFatigued && isStructFatigued) {
        return {
            status: 'both_fatigued',
            recommendation: `High fatigue in both systems (MET ${metaPct}%, MSK ${structPct}%). Consider a rest day or very light activity.`,
            sessionSuggestion: 'rest',
        };
    }

    if (isMetaFatigued && !isStructFatigued) {
        return {
            status: 'metabolic_fatigue',
            recommendation: `Energy depleted (MET ${metaPct}%) but body integrity fine (MSK ${structPct}%). Zone 2 or endurance work is ideal.`,
            sessionSuggestion: 'endurance',
        };
    }

    if (!isMetaFatigued && isStructFatigued) {
        return {
            status: 'structural_fatigue',
            recommendation: `Energy available (MET ${metaPct}%) but injury risk elevated (MSK ${structPct}%). Active recovery or cross-training recommended.`,
            sessionSuggestion: 'active_recovery',
        };
    }

    // Moderate fatigue in both or neither
    return {
        status: 'recovering',
        recommendation: `Moderate fatigue (MET ${metaPct}%, MSK ${structPct}%). Listen to your body and adjust intensity accordingly.`,
        sessionSuggestion: readiness >= 60 ? 'endurance' : 'active_recovery',
    };
}

// ============================================================================
// STATE INITIALIZATION
// ============================================================================

/**
 * Create a fresh chronic fatigue state with default values.
 */
export function createDefaultChronicState(): ChronicFatigueState {
    return {
        sMetabolic: 0,
        sStructural: 0,
        capMetabolic: DEFAULT_CAP_METABOLIC,
        capStructural: DEFAULT_CAP_STRUCTURAL,
        lastUpdated: new Date().toISOString(),
    };
}

/**
 * Initialize chronic state by backfilling from historical session data.
 * Runs the model from t_-60 to t_now to establish current state.
 * 
 * @param sessions - All available sessions
 * @param cpEstimate - Current CP estimate for cost calculations
 * @param questionnaireHistory - Historical questionnaire responses for φ
 * @param lookbackDays - Number of days to backfill (default 60)
 * @param referenceDate - Reference date for calculation
 * @returns Initialized chronic fatigue state
 */
export function initializeChronicState(
    sessions: Session[],
    cpEstimate: CriticalPowerEstimate,
    questionnaireHistory: QuestionnaireResponse[] = [],
    lookbackDays: number = 60,
    referenceDate: Date = new Date()
): ChronicFatigueState {
    // Start with zero state
    let sMeta = 0;
    let sStruct = 0;

    const capMeta = DEFAULT_CAP_METABOLIC;
    const capStruct = DEFAULT_CAP_STRUCTURAL;

    // Calculate start date
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - lookbackDays);

    // Iterate through each day
    for (let day = 0; day <= lookbackDays; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + day);
        const dateStr = currentDate.toISOString().split('T')[0];

        // Calculate daily load
        const dailyLoad = aggregateDailyLoad(sessions, dateStr, cpEstimate);

        // Get recovery efficiency from questionnaire (if available)
        const dayQuestionnaire = questionnaireHistory.find(q => q.date === dateStr);
        const phiRecovery = dayQuestionnaire
            ? calculatePhiFromQuestionnaire(dayQuestionnaire)
            : DEFAULT_PHI_RECOVERY;

        // Update states
        sMeta = updateMetabolicFreshness(sMeta, dailyLoad, phiRecovery, capMeta);
        sStruct = updateStructuralHealth(sStruct, dailyLoad, SIGMA_IMPACT, capStruct);
    }

    return {
        sMetabolic: Math.round(sMeta * 100) / 100,
        sStructural: Math.round(sStruct * 100) / 100,
        capMetabolic: capMeta,
        capStructural: capStruct,
        lastUpdated: referenceDate.toISOString(),
    };
}

/**
 * Calculate recovery efficiency (φ) from questionnaire responses.
 * Maps sleep, nutrition, and stress to a [0.5, 1.5] scalar.
 * 
 * @param response - Questionnaire response
 * @returns Recovery efficiency scalar
 */
function calculatePhiFromQuestionnaire(response: QuestionnaireResponse): number {
    const { responses } = response;

    // Get relevant inputs (1-5 scale)
    // Use actual questionnaire field names - average sleep metrics
    const sleepHours = responses['sleep_hours'] || 3;
    const sleepQuality = responses['sleep_quality'] || 3;
    const sleep = (sleepHours + sleepQuality) / 2;
    const nutrition = responses['nutrition'] || 3;
    const stress = responses['stress'] || 3; // Note: 5 = low stress, 1 = high stress

    // Normalize to 0-1 range
    const sleepNorm = (sleep - 1) / 4;
    const nutritionNorm = (nutrition - 1) / 4;
    const stressNorm = (stress - 1) / 4; // Higher = less stressed

    // Calculate phi: 0.5 at worst, 1.5 at best
    // Base is 1.0 (neutral)
    const avgFactor = (sleepNorm + nutritionNorm + stressNorm) / 3;
    const phi = 0.5 + avgFactor; // Maps [0, 1] -> [0.5, 1.5]

    return Math.max(0.5, Math.min(1.5, phi));
}

// ============================================================================
// STATE UPDATE
// ============================================================================

/**
 * Update chronic state after a new day/session.
 * 
 * @param currentState - Current chronic state
 * @param dailyLoad - Total physiological load for the day
 * @param phiRecovery - Recovery efficiency from questionnaire
 * @param sigmaImpact - Structural impact multiplier
 * @returns Updated chronic state
 */
export function updateChronicState(
    currentState: ChronicFatigueState,
    dailyLoad: number,
    phiRecovery: number = DEFAULT_PHI_RECOVERY,
    sigmaImpact: number = SIGMA_IMPACT
): ChronicFatigueState {
    const sMeta = updateMetabolicFreshness(
        currentState.sMetabolic,
        dailyLoad,
        phiRecovery,
        currentState.capMetabolic
    );

    const sStruct = updateStructuralHealth(
        currentState.sStructural,
        dailyLoad,
        sigmaImpact,
        currentState.capStructural
    );

    return {
        sMetabolic: Math.round(sMeta * 100) / 100,
        sStructural: Math.round(sStruct * 100) / 100,
        capMetabolic: currentState.capMetabolic,
        capStructural: currentState.capStructural,
        lastUpdated: new Date().toISOString(),
    };
}

/**
 * Apply a rest day (no training) update to the state.
 * Just applies decay without adding any load.
 */
export function applyRestDay(
    currentState: ChronicFatigueState,
    phiRecovery: number = DEFAULT_PHI_RECOVERY
): ChronicFatigueState {
    return updateChronicState(currentState, 0, phiRecovery, SIGMA_IMPACT);
}

// ============================================================================
// STATE CORRECTIONS (Bayesian Updates)
// ============================================================================

/**
 * Apply structural correction based on soreness feedback.
 * If user reports high soreness but model shows low MSK, inject load.
 * 
 * Formula: ΔMSK = max(0, 0.5 × Cap - MSK)
 * 
 * @param currentState - Current chronic state
 * @param sorenessScore - User-reported soreness (1-5, 1 = extreme soreness)
 * @returns Updated state with correction applied
 */
export function applyStructuralCorrection(
    currentState: ChronicFatigueState,
    sorenessScore: number
): ChronicFatigueState {
    // Only apply correction for extreme/high soreness (1-2)
    if (sorenessScore > 2) {
        return currentState;
    }

    const modelThreshold = 0.2 * currentState.capStructural; // Model says "fresh"
    const injectionTarget = 0.5 * currentState.capStructural;

    if (currentState.sStructural < modelThreshold) {
        const injection = Math.max(0, injectionTarget - currentState.sStructural);

        return {
            ...currentState,
            sStructural: Math.round((currentState.sStructural + injection) * 100) / 100,
            lastUpdated: new Date().toISOString(),
        };
    }

    return currentState;
}

/**
 * Apply metabolic correction based on energy feedback.
 * If user reports exhaustion but model shows low MET, add fatigue penalty.
 * 
 * Formula: MET += 0.3 × Cap_meta
 * 
 * @param currentState - Current chronic state
 * @param energyScore - User-reported energy (1-5, 1 = exhausted)
 * @returns Updated state with correction applied
 */
export function applyMetabolicCorrection(
    currentState: ChronicFatigueState,
    energyScore: number
): ChronicFatigueState {
    // Only apply correction for exhausted/very low energy (1-2)
    if (energyScore > 2) {
        return currentState;
    }

    const modelThreshold = 0.2 * currentState.capMetabolic; // Model says "fresh"

    if (currentState.sMetabolic < modelThreshold) {
        const penalty = 0.3 * currentState.capMetabolic;

        return {
            ...currentState,
            sMetabolic: Math.round(Math.min(
                currentState.capMetabolic,
                currentState.sMetabolic + penalty
            ) * 100) / 100,
            lastUpdated: new Date().toISOString(),
        };
    }

    return currentState;
}

// ============================================================================
// DETRAINING PENALTY
// ============================================================================

/** Number of recent sessions to consider for detraining calculation */
export const DETRAINING_SESSION_COUNT = 5;

/**
 * Calculate Gaussian decay multiplier for a given number of days.
 * Uses e^(-(k/τ)²) where τ = 42 days.
 */
function gaussianDecay(daysSinceSession: number): number {
    if (daysSinceSession <= 0) return 1.0;
    return Math.exp(-Math.pow(daysSinceSession / DETRAINING_TAU, 2));
}

/**
 * Apply detraining penalty using harmonic-weighted average of recent sessions.
 * 
 * Formula: Σ (wᵢ × e^(-(kᵢ/42)²)) where wᵢ = 1/i (harmonic weights)
 * 
 * This prevents instant recovery after a long break by considering:
 * - The G most recent sessions
 * - More recent sessions weighted more heavily (1, 1/2, 1/3, 1/4, 1/5)
 * 
 * Example after 6-week break + 1 session back:
 * - k values: [0, 42, 44, 47, 49] → multipliers: [1.0, 0.37, 0.31, 0.24, 0.19]
 * - Harmonic weighted: ~0.63 (not 1.0)
 * 
 * @param readiness - Base readiness score (0-100)
 * @param daysSinceRecentSessions - Array of days since each recent session (most recent first)
 * @returns Adjusted readiness with detraining penalty applied
 */
export function applyDetrainingPenalty(
    readiness: number,
    daysSinceRecentSessions: number[]
): number {
    if (daysSinceRecentSessions.length === 0) return readiness;

    // Use up to G sessions
    const sessionsToUse = daysSinceRecentSessions.slice(0, DETRAINING_SESSION_COUNT);

    // Calculate harmonic weights: 1, 1/2, 1/3, 1/4, 1/5...
    let weightSum = 0;
    let weightedMultiplierSum = 0;

    for (let i = 0; i < sessionsToUse.length; i++) {
        const weight = 1 / (i + 1); // Harmonic: 1, 0.5, 0.33, 0.25, 0.2
        const multiplier = gaussianDecay(sessionsToUse[i]);

        weightedMultiplierSum += weight * multiplier;
        weightSum += weight;
    }

    const detrainingMultiplier = weightSum > 0 ? weightedMultiplierSum / weightSum : 1.0;

    return Math.round(Math.max(0, Math.min(100, readiness * detrainingMultiplier)));
}


