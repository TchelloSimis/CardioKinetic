/**
 * Physiological Cost Engine
 * 
 * Calculates accumulated physiological cost from high-resolution power data.
 * Key insight: Cost is non-linear and state-dependent.
 * Generating 300W when "depleted" costs more than when "fresh".
 * 
 * Uses W'bal-style acute deficit tracking to weight instantaneous cost.
 * 
 * Based on REVISED_CHRONIC_FATIGUE_MODEL.md Section 3
 */

import { Session, CriticalPowerEstimate, SessionStyle } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Stress multiplier when W' is depleted (K_fatigue in the model) */
export const K_FATIGUE = 1.5;

/** Reference scale for normalizing daily load to ~0-100 range */
export const REFERENCE_SCALE = 30000; // Joules

/** Default sample interval for high-resolution power data (seconds) */
export const DEFAULT_SAMPLE_INTERVAL = 5;

/** Variability factor for interval sessions when high-res data unavailable */
const INTERVAL_VARIABILITY_FACTOR = 1.35;

/** Variability factor for custom sessions when high-res data unavailable */
const CUSTOM_VARIABILITY_FACTOR = 1.25;

// ============================================================================
// ACUTE DEFICIT TRACKING
// ============================================================================

/**
 * Track W' depletion/recovery throughout a power sequence.
 * This implements the W'bal-style tracking from the model.
 * 
 * @param powerSequence - Power samples (watts)
 * @param cp - Critical Power (watts)
 * @param wPrime - W' capacity (joules)
 * @param deltaT - Time between samples (seconds)
 * @returns Current deficit and history of deficit values
 */
export function trackAcuteDeficit(
    powerSequence: number[],
    cp: number,
    wPrime: number,
    deltaT: number = DEFAULT_SAMPLE_INTERVAL
): { deficit: number; deficitHistory: number[] } {
    if (powerSequence.length === 0 || wPrime <= 0) {
        return { deficit: 0, deficitHistory: [] };
    }

    const deficitHistory: number[] = [];
    let deficit = 0;

    for (const power of powerSequence) {
        if (power > cp) {
            // Above CP: depleting W'
            const deltaD = (power - cp) * deltaT;
            deficit = Math.min(wPrime, deficit + deltaD);
        } else {
            // Below CP: recovering W' (proportional to remaining capacity)
            const wRemaining = wPrime - deficit;
            const recoveryRate = wRemaining / wPrime;
            const deltaD = (power - cp) * recoveryRate * deltaT;
            deficit = Math.max(0, deficit + deltaD);
        }

        deficitHistory.push(deficit);
    }

    return { deficit, deficitHistory };
}

// ============================================================================
// INSTANTANEOUS COST CALCULATION
// ============================================================================

/**
 * Calculate the physiological cost of a single power sample.
 * Cost increases when the athlete is depleted (high acute deficit).
 * 
 * Formula: Cost(t) = P(t) × (1 + K_fatigue × D_acute/W')
 * 
 * @param power - Instantaneous power (watts)
 * @param acuteDeficit - Current W' deficit (joules)
 * @param wPrime - Total W' capacity (joules)
 * @returns Cost in "physiological credits" (unit-less)
 */
export function calculateInstantaneousCost(
    power: number,
    acuteDeficit: number,
    wPrime: number
): number {
    if (wPrime <= 0 || power <= 0) {
        return 0;
    }

    const depletionRatio = Math.min(1, acuteDeficit / wPrime);
    const fatigueMultiplier = 1 + K_FATIGUE * depletionRatio;

    return power * fatigueMultiplier;
}

// ============================================================================
// DAILY LOAD INTEGRATION
// ============================================================================

/**
 * Integrate physiological cost over an entire session.
 * This is the main calculation that produces the daily load value.
 * 
 * Formula: Load = (1/ReferenceScale) × ∫ Cost(t) dt
 * 
 * @param powerSequence - Power samples (watts)
 * @param cp - Critical Power (watts)
 * @param wPrime - W' capacity (joules)
 * @param deltaT - Time between samples (seconds)
 * @returns Daily load value (normalized to ~0-100 scale)
 */
export function integrateDailyCost(
    powerSequence: number[],
    cp: number,
    wPrime: number,
    deltaT: number = DEFAULT_SAMPLE_INTERVAL
): number {
    if (powerSequence.length === 0 || cp <= 0 || wPrime <= 0) {
        return 0;
    }

    // Track deficit throughout session
    const { deficitHistory } = trackAcuteDeficit(powerSequence, cp, wPrime, deltaT);

    // Integrate cost over session
    let totalCost = 0;

    for (let i = 0; i < powerSequence.length; i++) {
        const instantCost = calculateInstantaneousCost(
            powerSequence[i],
            deficitHistory[i],
            wPrime
        );
        totalCost += instantCost * deltaT;
    }

    // Normalize to load scale
    return totalCost / REFERENCE_SCALE;
}

// ============================================================================
// FALLBACK ESTIMATION
// ============================================================================

/**
 * Estimate physiological cost when high-resolution data is unavailable.
 * Uses session average power with heuristic adjustments for session type.
 * 
 * Steady-state: P × duration (no W' depletion)
 * Interval: P × duration × variability factor
 * Custom: P × duration × moderate variability factor
 * 
 * @param avgPower - Average session power (watts)
 * @param durationMinutes - Session duration (minutes)
 * @param cp - Critical Power (watts)
 * @param wPrime - W' capacity (joules)
 * @param sessionStyle - Type of session
 * @param workRestRatio - Work:rest ratio for intervals (e.g., "2:1")
 * @returns Estimated daily load
 */
export function estimateCostFromAverage(
    avgPower: number,
    durationMinutes: number,
    cp: number,
    wPrime: number,
    sessionStyle: SessionStyle = 'steady-state',
    workRestRatio?: string
): number {
    if (avgPower <= 0 || durationMinutes <= 0) {
        return 0;
    }

    const durationSeconds = durationMinutes * 60;

    // Base cost (simple integration assuming constant power)
    let baseCost = avgPower * durationSeconds;

    if (sessionStyle === 'steady-state') {
        // Steady-state: minimal W' involvement, use base cost
        // Only add deficit factor if power is near or above CP
        if (avgPower > cp * 0.9) {
            // Slight multiplier for threshold-level steady state
            const intensityFactor = (avgPower / cp) ** 0.3;
            baseCost *= intensityFactor;
        }
    } else if (sessionStyle === 'interval') {
        // Intervals: significant W' depletion likely
        // Apply variability factor based on work/rest ratio
        let variabilityFactor = INTERVAL_VARIABILITY_FACTOR;

        if (workRestRatio) {
            // Higher work:rest ratio = more sustained stress
            const [work, rest] = workRestRatio.split(':').map(Number);
            if (work && rest && rest > 0) {
                const ratio = work / rest;
                // 2:1 ratio = 1.4x, 1:1 = 1.35x, 1:2 = 1.25x
                variabilityFactor = 1.2 + Math.min(0.25, ratio * 0.1);
            }
        }

        baseCost *= variabilityFactor;
    } else {
        // Custom sessions: moderate variability assumption
        baseCost *= CUSTOM_VARIABILITY_FACTOR;
    }

    // Normalize to load scale
    return baseCost / REFERENCE_SCALE;
}

// ============================================================================
// SESSION COST CALCULATION
// ============================================================================

/**
 * Calculate physiological cost for a complete session.
 * Uses high-resolution data if available, otherwise falls back to estimation.
 * 
 * @param session - The session to calculate cost for
 * @param cpEstimate - Current Critical Power estimate
 * @returns Calculated physiological cost (daily load contribution)
 */
export function calculateSessionCost(
    session: Session,
    cpEstimate: CriticalPowerEstimate
): number {
    const { cp, wPrime } = cpEstimate;

    // Prefer high-resolution data
    if (session.secondBySecondPower && session.secondBySecondPower.length > 0) {
        return integrateDailyCost(
            session.secondBySecondPower,
            cp,
            wPrime,
            DEFAULT_SAMPLE_INTERVAL
        );
    }

    // Fall back to average-based estimation
    return estimateCostFromAverage(
        session.power,
        session.duration,
        cp,
        wPrime,
        session.sessionStyle || determineSessionStyle(session),
        session.workRestRatio
    );
}

/**
 * Determine session style from session data when not explicitly set.
 */
function determineSessionStyle(session: Session): SessionStyle {
    if (session.workRestRatio && session.workRestRatio !== 'steady') {
        return 'interval';
    }
    return 'steady-state';
}

// ============================================================================
// DAILY AGGREGATION
// ============================================================================

/**
 * Aggregate physiological cost for all sessions on a given day.
 * 
 * @param sessions - Sessions to aggregate
 * @param targetDate - The date to aggregate for (YYYY-MM-DD)
 * @param cpEstimate - Current Critical Power estimate
 * @returns Total daily load
 */
export function aggregateDailyLoad(
    sessions: Session[],
    targetDate: string,
    cpEstimate: CriticalPowerEstimate
): number {
    const daySessions = sessions.filter(s => s.date === targetDate);

    if (daySessions.length === 0) {
        return 0;
    }

    let totalLoad = 0;
    for (const session of daySessions) {
        totalLoad += calculateSessionCost(session, cpEstimate);
    }

    return totalLoad;
}

/**
 * Calculate daily loads for a range of dates.
 * Returns a map from date string to daily load value.
 * 
 * @param sessions - All sessions to process
 * @param startDate - Start of range (YYYY-MM-DD)
 * @param endDate - End of range (YYYY-MM-DD)
 * @param cpEstimate - Current Critical Power estimate
 * @returns Map of date -> daily load
 */
export function calculateDailyLoads(
    sessions: Session[],
    startDate: string,
    endDate: string,
    cpEstimate: CriticalPowerEstimate
): Map<string, number> {
    const loads = new Map<string, number>();

    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        loads.set(dateStr, aggregateDailyLoad(sessions, dateStr, cpEstimate));
    }

    return loads;
}
