/**
 * RPE Correction Loop
 * 
 * Compares actual session RPE to model-predicted difficulty.
 * When significant mismatch detected:
 * 1. Apply penalty load to MET for 24 hours
 * 2. If mismatch persists >3 sessions, trigger CP downgrade
 * 
 * Based on REVISED_CHRONIC_FATIGUE_MODEL.md Section 5.3
 */

import { Session, CriticalPowerEstimate, ChronicFatigueState, SessionStyle } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** RPE points difference to trigger a mismatch */
export const RPE_MISMATCH_THRESHOLD = 2;

/** Duration of penalty load effect (hours) */
export const PENALTY_DURATION_HOURS = 24;

/** Number of consecutive mismatches to trigger CP downgrade */
export const DOWNGRADE_SESSION_THRESHOLD = 3;

/** CP reduction percentage on downgrade trigger */
export const CP_DOWNGRADE_PERCENT = 0.02; // 2%

/** Penalty load as fraction of metabolic capacity */
export const PENALTY_LOAD_FRACTION = 0.2; // 20%

// ============================================================================
// RPE PREDICTION
// ============================================================================

/**
 * Calculate predicted session difficulty (RPE) based on CP and session parameters.
 * Uses a simple model: RPE scales with intensity relative to CP.
 * 
 * @param plannedPower - Target power for the session
 * @param plannedDurationMinutes - Session duration
 * @param cp - Critical Power estimate
 * @param wPrime - W' estimate
 * @param sessionStyle - Type of session
 * @returns Predicted RPE (1-10)
 */
export function calculatePredictedDifficulty(
    plannedPower: number,
    plannedDurationMinutes: number,
    cp: number,
    wPrime: number,
    sessionStyle: SessionStyle
): number {
    if (cp <= 0 || plannedPower <= 0) {
        return 5; // Default moderate
    }

    const intensityRatio = plannedPower / cp;
    const durationSeconds = plannedDurationMinutes * 60;

    let baseRPE: number;

    if (intensityRatio < 0.6) {
        // Very easy (Zone 1-2)
        baseRPE = 2 + intensityRatio * 3;
    } else if (intensityRatio < 0.8) {
        // Moderate (Zone 2-3)
        baseRPE = 4 + (intensityRatio - 0.6) * 5;
    } else if (intensityRatio < 1.0) {
        // Hard (Zone 3-4)
        baseRPE = 5 + (intensityRatio - 0.8) * 10;
    } else {
        // Very hard - above CP
        baseRPE = 7 + Math.min(3, (intensityRatio - 1.0) * 10);
    }

    // Adjust for duration
    // Longer sessions at same intensity feel harder
    const durationFactor = 1 + Math.log10(Math.max(10, durationSeconds / 60)) * 0.1;

    // Adjust for session type
    // Intervals feel harder at same average power
    let styleFactor = 1.0;
    if (sessionStyle === 'interval') {
        styleFactor = 1.15; // Intervals feel ~15% harder
    } else if (sessionStyle === 'custom') {
        styleFactor = 1.1;
    }

    const predictedRPE = baseRPE * durationFactor * styleFactor;

    return Math.round(Math.min(10, Math.max(1, predictedRPE)) * 10) / 10;
}

// ============================================================================
// MISMATCH DETECTION
// ============================================================================

/**
 * Compare actual vs predicted RPE and detect significant mismatch.
 * 
 * @param actualRPE - User-reported RPE
 * @param predictedRPE - Model-predicted RPE
 * @returns Mismatch info
 */
export function detectRPEMismatch(
    actualRPE: number,
    predictedRPE: number
): {
    isMismatch: boolean;
    direction: 'higher' | 'lower' | 'match';
    magnitude: number;
} {
    const difference = actualRPE - predictedRPE;
    const magnitude = Math.abs(difference);

    if (magnitude >= RPE_MISMATCH_THRESHOLD) {
        return {
            isMismatch: true,
            direction: difference > 0 ? 'higher' : 'lower',
            magnitude,
        };
    }

    return {
        isMismatch: false,
        direction: 'match',
        magnitude,
    };
}

// ============================================================================
// PENALTY APPLICATION
// ============================================================================

/**
 * Apply penalty load to metabolic state when user feels worse than expected.
 * This captures hidden fatigue that the model didn't predict.
 * 
 * @param currentState - Current chronic fatigue state
 * @param mismatchMagnitude - How many RPE points higher than expected
 * @returns Updated state with penalty applied
 */
export function applyPenaltyLoad(
    currentState: ChronicFatigueState,
    mismatchMagnitude: number
): ChronicFatigueState {
    // Scale penalty by mismatch magnitude
    // e.g., 2 RPE points = 20% of capacity, 3 RPE points = 30%
    const penaltyFraction = PENALTY_LOAD_FRACTION * (mismatchMagnitude / RPE_MISMATCH_THRESHOLD);
    const penalty = currentState.capMetabolic * Math.min(0.5, penaltyFraction);

    return {
        ...currentState,
        sMetabolic: Math.min(
            currentState.capMetabolic,
            currentState.sMetabolic + penalty
        ),
        lastUpdated: new Date().toISOString(),
    };
}

// ============================================================================
// CP DOWNGRADE
// ============================================================================

/**
 * Check if CP should be downgraded based on persistent mismatch pattern.
 * 
 * @param recentMismatches - Array of recent sessions' mismatch status (true = higher than expected)
 * @param currentCP - Current CP estimate
 * @returns Whether to downgrade and new CP value
 */
export function checkCPDowngradeTrigger(
    recentMismatches: boolean[],
    currentCP: number
): { shouldDowngrade: boolean; newCP: number; } {
    // Count consecutive recent mismatches (user feeling worse than predicted)
    let consecutiveHigh = 0;

    // Check from most recent backwards
    for (let i = recentMismatches.length - 1; i >= 0; i--) {
        if (recentMismatches[i]) {
            consecutiveHigh++;
        } else {
            break;
        }
    }

    if (consecutiveHigh >= DOWNGRADE_SESSION_THRESHOLD) {
        const newCP = Math.round(currentCP * (1 - CP_DOWNGRADE_PERCENT));
        return {
            shouldDowngrade: true,
            newCP,
        };
    }

    return {
        shouldDowngrade: false,
        newCP: currentCP,
    };
}

/**
 * Apply CP downgrade to estimate.
 */
export function applyCPDowngrade(
    estimate: CriticalPowerEstimate
): CriticalPowerEstimate {
    return {
        ...estimate,
        cp: Math.round(estimate.cp * (1 - CP_DOWNGRADE_PERCENT)),
        // Also reduce W' proportionally
        wPrime: Math.round(estimate.wPrime * (1 - CP_DOWNGRADE_PERCENT * 0.5)),
        confidence: estimate.confidence * 0.9, // Reduce confidence
        lastUpdated: new Date().toISOString(),
    };
}

// ============================================================================
// SESSION ANALYSIS
// ============================================================================

/**
 * Analyze a completed session and return corrections to apply.
 * This is the main entry point for the RPE correction loop.
 * 
 * @param session - Completed session
 * @param cpEstimate - Current CP estimate
 * @param currentState - Current chronic fatigue state
 * @param recentMismatchHistory - Recent mismatch history for CP downgrade check
 * @returns Corrections to apply
 */
export function analyzeSessionForCorrections(
    session: Session,
    cpEstimate: CriticalPowerEstimate,
    currentState: ChronicFatigueState,
    recentMismatchHistory: boolean[] = []
): {
    predictedRPE: number;
    mismatch: { isMismatch: boolean; direction: 'higher' | 'lower' | 'match'; magnitude: number };
    stateCorrection: ChronicFatigueState | null;
    cpCorrection: CriticalPowerEstimate | null;
    updatedMismatchHistory: boolean[];
} {
    // Calculate predicted difficulty
    const predictedRPE = calculatePredictedDifficulty(
        session.power,
        session.duration,
        cpEstimate.cp,
        cpEstimate.wPrime,
        session.sessionStyle || 'steady-state'
    );

    // Detect mismatch
    const mismatch = detectRPEMismatch(session.rpe, predictedRPE);

    let stateCorrection: ChronicFatigueState | null = null;
    let cpCorrection: CriticalPowerEstimate | null = null;

    // Update mismatch history (only track "higher than expected" mismatches)
    const updatedMismatchHistory = [
        ...recentMismatchHistory.slice(-9), // Keep last 9
        mismatch.isMismatch && mismatch.direction === 'higher',
    ];

    if (mismatch.isMismatch && mismatch.direction === 'higher') {
        // User felt worse than expected - apply penalty load
        stateCorrection = applyPenaltyLoad(currentState, mismatch.magnitude);

        // Check for CP downgrade
        const cpDowngradeCheck = checkCPDowngradeTrigger(updatedMismatchHistory, cpEstimate.cp);
        if (cpDowngradeCheck.shouldDowngrade) {
            cpCorrection = applyCPDowngrade(cpEstimate);
        }
    }

    return {
        predictedRPE,
        mismatch,
        stateCorrection,
        cpCorrection,
        updatedMismatchHistory,
    };
}
