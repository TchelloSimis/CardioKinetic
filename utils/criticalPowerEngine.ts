/**
 * Critical Power Estimation Engine
 * 
 * Implements the "eCP" (Estimated Critical Power) algorithm using:
 * - Mean Maximal Power (MMP) curve analysis
 * - 2-parameter model: P(t) = W'/t + CP
 * - RPE-filtered regression for accuracy
 * - Submaximal anchor validation
 * - 28-day decay if no max efforts seen
 * 
 * Based on REVISED_CHRONIC_FATIGUE_MODEL.md Section 2
 */

import { Session, MMPRecord, CriticalPowerEstimate } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Target durations for MMP extraction (seconds) */
export const CP_ESTIMATION_DURATIONS = [180, 300, 720, 1200, 2400] as const; // 3m, 5m, 12m, 20m, 40m

/** RPE threshold for considering an effort "maximal" */
export const RPE_MAX_EFFORT_THRESHOLD = 9;

/** RPE threshold for submaximal anchor (low perceived effort) */
export const RPE_SUBMAXIMAL_THRESHOLD = 5;

/** Minimum duration for submaximal anchor (seconds) */
export const SUBMAXIMAL_MIN_DURATION = 20 * 60; // 20 minutes

/** Days without max effort before decay is applied */
export const DECAY_THRESHOLD_DAYS = 28;

/** Weekly decay rate for CP when no max efforts seen */
export const DECAY_RATE_PER_WEEK = 0.005; // 0.5%

/** Default lookback window for MMP extraction (days) */
export const DEFAULT_LOOKBACK_DAYS = 60;

/** Minimum data points required for regression */
export const MIN_DATA_POINTS = 3;

/** Default W' for new users or when regression fails (joules) */
export const DEFAULT_W_PRIME = 17500; // ~17.5 kJ, population average

/** Minimum confidence threshold for valid estimate */
export const MIN_CONFIDENCE = 0.3;

/** Typical W'/CP ratio in seconds (research-based range: 75-100s) */
export const W_PRIME_CP_RATIO = 90;

/** Confidence reduction when using population-scaled W' instead of measured */
export const SCALED_W_PRIME_CONFIDENCE_PENALTY = 0.4;

/** Minimum duration for enhanced submaximal anchor (minutes) */
export const ENHANCED_ANCHOR_MIN_DURATION = 15;

// ============================================================================
// MMP EXTRACTION
// ============================================================================

/**
 * Calculate rolling average power for a given duration from power data.
 * Uses a sliding window approach.
 */
function calculateBestAverageForDuration(
    powerData: number[],
    durationSeconds: number,
    sampleIntervalSeconds: number = 5
): number {
    const samplesNeeded = Math.ceil(durationSeconds / sampleIntervalSeconds);

    if (powerData.length < samplesNeeded) {
        return 0; // Not enough data
    }

    let maxAvg = 0;
    let windowSum = 0;

    // Initialize first window
    for (let i = 0; i < samplesNeeded; i++) {
        windowSum += powerData[i];
    }
    maxAvg = windowSum / samplesNeeded;

    // Slide window through remaining data
    for (let i = samplesNeeded; i < powerData.length; i++) {
        windowSum += powerData[i] - powerData[i - samplesNeeded];
        const avg = windowSum / samplesNeeded;
        if (avg > maxAvg) {
            maxAvg = avg;
        }
    }

    return Math.round(maxAvg);
}

/**
 * Extract best efforts for target durations from a single session.
 * Uses secondBySecondPower if available, otherwise estimates from average.
 */
function extractSessionMMPBests(
    session: Session,
    targetDurations: readonly number[] = CP_ESTIMATION_DURATIONS
): MMPRecord[] {
    const records: MMPRecord[] = [];
    const isMaximalEffort = session.rpe >= RPE_MAX_EFFORT_THRESHOLD;
    const sessionDurationSeconds = session.duration * 60;

    if (session.secondBySecondPower && session.secondBySecondPower.length > 0) {
        // High-resolution data available - calculate actual bests
        for (const duration of targetDurations) {
            if (duration <= sessionDurationSeconds) {
                const power = calculateBestAverageForDuration(
                    session.secondBySecondPower,
                    duration,
                    5 // Assuming 5-second intervals
                );

                if (power > 0) {
                    records.push({
                        duration,
                        power,
                        date: session.date,
                        rpe: session.rpe,
                        isMaximalEffort,
                    });
                }
            }
        }
    } else {
        // No high-res data - use session average power for durations <= session duration
        // Only useful for sessions that are longer than target duration
        for (const duration of targetDurations) {
            if (duration <= sessionDurationSeconds && session.power > 0) {
                // For steady-state, average power IS the power for all durations
                // For intervals, this is an underestimate (conservative)
                records.push({
                    duration,
                    power: session.power,
                    date: session.date,
                    rpe: session.rpe,
                    isMaximalEffort,
                });
            }
        }
    }

    return records;
}

/**
 * Extract best MMP records from multiple sessions within lookback window.
 * Returns the best power for each duration with corresponding metadata.
 */
export function extractMMPBests(
    sessions: Session[],
    lookbackDays: number = DEFAULT_LOOKBACK_DAYS,
    referenceDate: Date = new Date()
): MMPRecord[] {
    const cutoffDate = new Date(referenceDate);
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // Filter sessions within lookback window
    const recentSessions = sessions.filter(s => s.date >= cutoffStr);

    // Collect all MMP records
    const allRecords: MMPRecord[] = [];
    for (const session of recentSessions) {
        allRecords.push(...extractSessionMMPBests(session));
    }

    // Keep only the best power for each duration
    const bestByDuration = new Map<number, MMPRecord>();

    for (const record of allRecords) {
        const existing = bestByDuration.get(record.duration);
        if (!existing || record.power > existing.power) {
            bestByDuration.set(record.duration, record);
        }
    }

    return Array.from(bestByDuration.values()).sort((a, b) => a.duration - b.duration);
}

// ============================================================================
// CP MODEL FITTING
// ============================================================================

/**
 * Perform weighted least-squares regression to fit CP model.
 * Model: P(t) = W'/t + CP
 * Rearranged: P = CP + W' * (1/t)
 * 
 * Uses only maximal efforts (RPE >= 9) for the regression when available.
 * Falls back to all data if insufficient maximal efforts.
 */
export function fitCPModel(mmpRecords: MMPRecord[]): CriticalPowerEstimate | null {
    if (mmpRecords.length < MIN_DATA_POINTS) {
        return null;
    }

    // Prefer maximal efforts for regression
    const maximalEfforts = mmpRecords.filter(r => r.isMaximalEffort);
    const recordsToUse = maximalEfforts.length >= MIN_DATA_POINTS
        ? maximalEfforts
        : mmpRecords;

    if (recordsToUse.length < MIN_DATA_POINTS) {
        return null;
    }

    // Linear regression: P = CP + W' * (1/t)
    // x = 1/t, y = P
    // y = a + b*x where a = CP, b = W'

    const n = recordsToUse.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (const record of recordsToUse) {
        const x = 1 / record.duration;  // 1/t
        const y = record.power;          // P
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (Math.abs(denominator) < 1e-10) {
        return null; // Singular matrix
    }

    const wPrime = (n * sumXY - sumX * sumY) / denominator;
    const cp = (sumY - wPrime * sumX) / n;

    // Validate results - W' must be positive (> 0, not just non-negative)
    if (cp <= 0 || wPrime <= 0) {
        return null; // Invalid model fit
    }

    // Calculate R² for confidence
    const yMean = sumY / n;
    let ssTot = 0, ssRes = 0;

    for (const record of recordsToUse) {
        const x = 1 / record.duration;
        const yPred = cp + wPrime * x;
        ssTot += (record.power - yMean) ** 2;
        ssRes += (record.power - yPred) ** 2;
    }

    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Confidence based on R², number of points, and maximal effort usage
    let confidence = Math.max(0, Math.min(1, rSquared));
    confidence *= Math.min(1, recordsToUse.length / 5); // Scale by data quantity
    confidence *= maximalEfforts.length >= MIN_DATA_POINTS ? 1 : 0.7; // Penalty for non-maximal data

    return {
        cp: Math.round(cp),
        wPrime: Math.round(wPrime),
        confidence: Math.round(confidence * 100) / 100,
        lastUpdated: new Date().toISOString(),
        dataPoints: recordsToUse.length,
        decayApplied: false,
    };
}

// ============================================================================
// ENHANCED SUBMAXIMAL ANCHOR WITH RPE PROXIMITY SCORING
// ============================================================================

/**
 * RPE-based proximity factor.
 * Higher RPE during stable effort means power is closer to CP.
 * 
 * Returns a multiplier for how much to boost the CP floor above session power.
 * At RPE 8: power ≈ CP (multiplier ≈ 1.0)
 * At RPE 4: power is well below CP (multiplier ≈ 1.15)
 */
function calculateProximityFactor(rpe: number): number {
    // Linear interpolation: RPE 4 → 1.15, RPE 8 → 1.0
    // Clamped to [4, 8] range for safety
    const clampedRPE = Math.max(4, Math.min(8, rpe));
    return 1.15 - 0.0375 * (clampedRPE - 4);
}

/**
 * Check if a session has stable RPE (not increasing over time).
 * A session has stable RPE if the standard deviation is low
 * or if there's no RPE history (single RPE value assumed stable).
 */
function hasStableRPE(session: Session): boolean {
    const rpeHistory = session.chartData?.rpeHistory;

    if (!rpeHistory || rpeHistory.length < 2) {
        return true; // Single RPE value is considered stable
    }

    // Calculate standard deviation of RPE values
    const rpes = rpeHistory.map(e => e.rpe);
    const mean = rpes.reduce((a, b) => a + b, 0) / rpes.length;
    const variance = rpes.reduce((sum, r) => sum + (r - mean) ** 2, 0) / rpes.length;
    const stdDev = Math.sqrt(variance);

    // RPE is stable if std dev < 0.5 (half an RPE point)
    return stdDev < 0.5;
}

/**
 * Calculate population-scaled W' from CP estimate.
 * Used when insufficient MMP data is available for direct W' estimation.
 * 
 * @param cp - Critical Power estimate in watts
 * @returns W' estimate in joules
 */
export function calculateScaledWPrime(cp: number): number {
    return Math.round(cp * W_PRIME_CP_RATIO);
}

/**
 * Enhanced submaximal anchor using RPE proximity scoring.
 * 
 * For sessions with stable RPE (not increasing):
 * - Infers CP ≥ Power × proximityFactor
 * - Higher stable RPE = tighter constraint (power closer to CP)
 * 
 * This replaces the original binary RPE <= 5 threshold with a
 * continuous model that learns from moderate-effort steady-state work.
 * 
 * @returns Updated estimate with CP floor applied if needed
 */
export function applyEnhancedSubmaximalAnchor(
    estimate: CriticalPowerEstimate,
    sessions: Session[],
    lookbackDays: number = DEFAULT_LOOKBACK_DAYS,
    referenceDate: Date = new Date()
): CriticalPowerEstimate {
    const cutoffDate = new Date(referenceDate);
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // Find steady-state sessions with stable RPE and sufficient duration
    const anchorSessions = sessions.filter(s =>
        s.date >= cutoffStr &&
        s.duration >= ENHANCED_ANCHOR_MIN_DURATION &&
        s.power > 0 &&
        s.rpe >= 4 && s.rpe <= 8 && // Moderate effort range
        (s.sessionStyle === 'steady-state' || !s.sessionStyle) &&
        hasStableRPE(s)
    );

    if (anchorSessions.length === 0) {
        return estimate;
    }

    // Calculate CP floor from each anchor session
    const cpFloors: { floor: number; confidence: number }[] = [];

    for (const session of anchorSessions) {
        const proximityFactor = calculateProximityFactor(session.rpe);
        const cpFloor = session.power * proximityFactor;

        // Confidence based on duration and RPE level
        // Longer sessions and higher RPE = more confident
        const durationConfidence = Math.min(1, session.duration / 30); // Full at 30 min
        const rpeConfidence = (session.rpe - 4) / 4; // Higher RPE = more confident
        const confidence = durationConfidence * rpeConfidence;

        cpFloors.push({ floor: cpFloor, confidence });
    }

    // Use highest confident floor
    cpFloors.sort((a, b) => {
        // Sort by floor × confidence (weighted floor)
        return (b.floor * b.confidence) - (a.floor * a.confidence);
    });

    const bestFloor = cpFloors[0];

    // Only apply if floor exceeds current estimate
    if (bestFloor.floor > estimate.cp) {
        return {
            ...estimate,
            cp: Math.round(bestFloor.floor),
            confidence: Math.max(MIN_CONFIDENCE, Math.min(estimate.confidence, bestFloor.confidence)),
        };
    }

    return estimate;
}

/**
 * Legacy submaximal anchor (kept for backwards compatibility).
 * @deprecated Use applyEnhancedSubmaximalAnchor instead.
 */
export function applySubmaximalAnchor(
    estimate: CriticalPowerEstimate,
    sessions: Session[],
    lookbackDays: number = DEFAULT_LOOKBACK_DAYS,
    referenceDate: Date = new Date()
): CriticalPowerEstimate {
    // Delegate to enhanced version
    return applyEnhancedSubmaximalAnchor(estimate, sessions, lookbackDays, referenceDate);
}

// ============================================================================
// CP DECAY
// ============================================================================

/**
 * Apply decay to CP if no maximal efforts seen for threshold period.
 * Returns days since last max effort and whether decay was applied.
 */
export function applyDecay(
    estimate: CriticalPowerEstimate,
    sessions: Session[],
    referenceDate: Date = new Date()
): { estimate: CriticalPowerEstimate; daysSinceMaxEffort: number } {
    // Find most recent maximal effort
    const maximalSessions = sessions
        .filter(s => s.rpe >= RPE_MAX_EFFORT_THRESHOLD && s.power >= estimate.cp * 0.9)
        .map(s => new Date(s.date).getTime());

    if (maximalSessions.length === 0) {
        // No max efforts on record - check from estimate date
        const estimateDate = new Date(estimate.lastUpdated).getTime();
        const daysSince = Math.floor((referenceDate.getTime() - estimateDate) / (1000 * 60 * 60 * 24));

        if (daysSince > DECAY_THRESHOLD_DAYS && !estimate.decayApplied) {
            const weeksOfDecay = (daysSince - DECAY_THRESHOLD_DAYS) / 7;
            const decayFactor = Math.pow(1 - DECAY_RATE_PER_WEEK, weeksOfDecay);

            return {
                estimate: {
                    ...estimate,
                    cp: Math.round(estimate.cp * decayFactor),
                    confidence: estimate.confidence * 0.8,
                    decayApplied: true,
                },
                daysSinceMaxEffort: daysSince,
            };
        }

        return { estimate, daysSinceMaxEffort: daysSince };
    }

    const lastMaxEffortDate = new Date(Math.max(...maximalSessions));
    const daysSinceMaxEffort = Math.floor(
        (referenceDate.getTime() - lastMaxEffortDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceMaxEffort > DECAY_THRESHOLD_DAYS) {
        const weeksOfDecay = (daysSinceMaxEffort - DECAY_THRESHOLD_DAYS) / 7;
        const decayFactor = Math.pow(1 - DECAY_RATE_PER_WEEK, weeksOfDecay);

        return {
            estimate: {
                ...estimate,
                cp: Math.round(estimate.cp * decayFactor),
                confidence: estimate.confidence * 0.8,
                decayApplied: true,
            },
            daysSinceMaxEffort,
        };
    }

    return {
        estimate: { ...estimate, decayApplied: false },
        daysSinceMaxEffort,
    };
}

// ============================================================================
// MAIN ESTIMATION FUNCTION
// ============================================================================

/**
 * Calculate or update Critical Power estimate from session history.
 * This is the main entry point for the eCP algorithm.
 * 
 * @param sessions - All available sessions
 * @param currentDate - Reference date (default: now)
 * @param existingEstimate - Previous estimate to update (for decay tracking)
 * @param basePower - User's base power for fallback when insufficient data
 */
export function calculateECP(
    sessions: Session[],
    currentDate: Date = new Date(),
    existingEstimate?: CriticalPowerEstimate | null,
    basePower?: number
): CriticalPowerEstimate {
    // Step 1: Extract MMP bests from recent sessions
    const mmpBests = extractMMPBests(sessions, DEFAULT_LOOKBACK_DAYS, currentDate);

    // Step 2: Attempt to fit CP model
    let estimate = fitCPModel(mmpBests);

    // Step 3: Handle insufficient data
    if (!estimate) {
        // If we have an existing estimate, return it (possibly with decay)
        if (existingEstimate) {
            const { estimate: decayed } = applyDecay(existingEstimate, sessions, currentDate);
            // Still apply enhanced anchor to potentially improve CP
            return applyEnhancedSubmaximalAnchor(decayed, sessions, DEFAULT_LOOKBACK_DAYS, currentDate);
        }

        // No data and no prior estimate - use base power or default
        const fallbackCP = basePower ? Math.round(basePower * 0.9) : 150;
        let fallbackEstimate: CriticalPowerEstimate = {
            cp: fallbackCP,
            wPrime: calculateScaledWPrime(fallbackCP), // Use population-scaled W'
            confidence: 0,
            lastUpdated: currentDate.toISOString(),
            dataPoints: 0,
            decayApplied: false,
        };

        // Try to improve with enhanced anchor from steady-state sessions
        fallbackEstimate = applyEnhancedSubmaximalAnchor(fallbackEstimate, sessions, DEFAULT_LOOKBACK_DAYS, currentDate);

        // Re-scale W' if CP was improved by anchor
        if (fallbackEstimate.cp !== fallbackCP) {
            fallbackEstimate.wPrime = calculateScaledWPrime(fallbackEstimate.cp);
        }

        return fallbackEstimate;
    }

    // Step 4: Apply enhanced submaximal anchor with RPE proximity scoring
    estimate = applyEnhancedSubmaximalAnchor(estimate, sessions, DEFAULT_LOOKBACK_DAYS, currentDate);

    // Step 5: Scale W' if it's at default OR physiologically implausible (< 5 kJ)
    // When MMP data is from steady-state sessions (same power across all durations),
    // the regression produces near-zero W' which is incorrect.
    const MIN_PLAUSIBLE_W_PRIME = 5000; // 5 kJ minimum
    if (estimate.wPrime === DEFAULT_W_PRIME || estimate.wPrime < MIN_PLAUSIBLE_W_PRIME) {
        const scaledWPrime = calculateScaledWPrime(estimate.cp);
        estimate = {
            ...estimate,
            wPrime: scaledWPrime,
            confidence: estimate.confidence * (1 - SCALED_W_PRIME_CONFIDENCE_PENALTY),
        };
    }

    // Step 6: Check for decay (if estimate is older)
    const { estimate: finalEstimate } = applyDecay(estimate, sessions, currentDate);

    return finalEstimate;
}

/**
 * Check if a session qualifies as a max effort.
 * Used to determine if CP needs recalculation after session.
 */
export function isMaxEffortSession(session: Session, cpEstimate: CriticalPowerEstimate): boolean {
    return session.rpe >= RPE_MAX_EFFORT_THRESHOLD && session.power >= cpEstimate.cp * 0.9;
}

/**
 * Check if eCP estimate should be recalculated based on new session.
 * Returns true if:
 * - New session contains max effort data
 * - Session power exceeds current MMP for its duration
 */
export function shouldRecalculateECP(
    newSession: Session,
    existingEstimate: CriticalPowerEstimate
): boolean {
    // Always recalculate on max effort
    if (isMaxEffortSession(newSession, existingEstimate)) {
        return true;
    }

    // Check if session power might improve MMP curve
    const sessionDurationSeconds = newSession.duration * 60;

    // For durations in our target range, check if power is noteworthy
    for (const targetDuration of CP_ESTIMATION_DURATIONS) {
        if (sessionDurationSeconds >= targetDuration) {
            // Estimate what power we'd expect at this duration from current model
            const expectedPower = existingEstimate.cp + existingEstimate.wPrime / targetDuration;

            // If session power is > 95% of expected, worth recalculating
            if (newSession.power > expectedPower * 0.95) {
                return true;
            }
        }
    }

    return false;
}
