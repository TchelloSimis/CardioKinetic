/**
 * Metrics utility functions for calculating training load, fatigue, and readiness.
 * 
 * This module implements a Daily-Cycle Approach based on the Banister Impulse-Response model.
 * Key features:
 * - Daily aggregation of session data (RPE, Duration, Power)
 * - Hybrid load combining Power Load (external) and RPE Load (internal)
 * - ACWR-based Fatigue Score with Logistic Sigmoid normalization
 * - TSB-based Readiness Score with Gaussian distribution
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DailyAggregatedData {
    date: string;
    totalDurationMinutes: number;      // t_total
    avgPower: number;                   // P_day (time-weighted)
    avgRPE: number;                     // RPE_day (time-weighted)
    sessionCount: number;
}

export interface DailyMetrics {
    date: string;
    dailyLoad: number;                  // L_Daily
    powerLoad: number;                  // L_P
    rpeLoad: number;                    // L_R
    atl: number;                        // Acute Training Load (7-day EWMA)
    ctl: number;                        // Chronic Training Load (42-day EWMA)
    acwr: number;                       // Acute:Chronic Workload Ratio
    tsb: number;                        // Training Stress Balance
    fatigueScore: number;               // 0-100 (Sigmoid)
    readinessScore: number;             // 0-100 (Gaussian)
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ATL_DAYS = 7;                     // Acute Training Load time constant
const CTL_DAYS = 42;                    // Chronic Training Load time constant
const POWER_BASELINE_DAYS = 42;         // Power baseline EWMA time constant

const ATL_ALPHA = 2 / (ATL_DAYS + 1);   // ~0.25
const CTL_ALPHA = 2 / (CTL_DAYS + 1);   // ~0.047

// Fatigue score parameters (Logistic Sigmoid)
const FATIGUE_MIDPOINT = 1.15;          // ACWR at 50% fatigue
const FATIGUE_STEEPNESS = 4.5;          // Sigmoid steepness
const CTL_MINIMUM = 15;                 // Minimum CTL baseline for new users

// Readiness score parameters (Asymmetric Gaussian)
const READINESS_OPTIMAL_TSB = 20;       // TSB for peak readiness (100)
const READINESS_WIDTH_UNDERTRAIN = 2000; // Gentler penalty for detraining (TSB > optimal)
const READINESS_WIDTH_OVERTRAIN = 1000;  // Steeper penalty for overtraining (TSB < optimal)

// ============================================================================
// LEGACY FUNCTION (kept for backward compatibility during transition)
// ============================================================================

/**
 * @deprecated Use calculateDailyLoad() for new implementations
 * Calculate training load for a session using non-linear duration, RPE, and power ratio weighting.
 */
export function calculateSessionLoad(
    rpe: number,
    durationMinutes: number,
    powerRatio: number = 1.0
): number {
    const clampedRatio = Math.max(0.25, Math.min(4.0, powerRatio));
    return Math.pow(rpe, 1.5) * Math.pow(durationMinutes, 0.75) * Math.pow(clampedRatio, 0.5) * 0.3;
}

/**
 * Calculate the recent average power from session history using exponential weighting.
 * Uses a 28-day lookback with exponential decay (more recent = more weight).
 */
export function calculateRecentAveragePower(
    sessions: Array<{ date: string; power: number }>,
    currentDate: Date,
    basePower: number = 150
): number {
    const LOOKBACK_DAYS = 28;
    const oneDay = 24 * 60 * 60 * 1000;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const session of sessions) {
        const sessionDate = new Date(session.date);
        sessionDate.setHours(0, 0, 0, 0);

        const daysAgo = Math.floor((currentDate.getTime() - sessionDate.getTime()) / oneDay);

        if (daysAgo > 0 && daysAgo <= LOOKBACK_DAYS) {
            const weight = Math.exp(-daysAgo / 14);
            weightedSum += session.power * weight;
            totalWeight += weight;
        }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : basePower;
}

// ============================================================================
// DAILY AGGREGATION
// ============================================================================

/**
 * Aggregate all sessions within a single day into representative daily metrics.
 * 
 * @param sessions - Array of sessions with date, duration, power, and rpe
 * @returns Map of date string to aggregated daily data
 */
export function aggregateDailySessions(
    sessions: Array<{ date: string; duration: number; power: number; rpe: number }>
): Map<string, DailyAggregatedData> {
    const dailyMap = new Map<string, DailyAggregatedData>();

    for (const session of sessions) {
        const dateKey = session.date;
        const existing = dailyMap.get(dateKey);

        if (existing) {
            // Add to existing day's data
            const newTotalDuration = existing.totalDurationMinutes + session.duration;

            // Time-weighted average power
            existing.avgPower = (existing.avgPower * existing.totalDurationMinutes + session.power * session.duration) / newTotalDuration;

            // Time-weighted average RPE
            existing.avgRPE = (existing.avgRPE * existing.totalDurationMinutes + session.rpe * session.duration) / newTotalDuration;

            existing.totalDurationMinutes = newTotalDuration;
            existing.sessionCount++;
        } else {
            // First session of the day
            dailyMap.set(dateKey, {
                date: dateKey,
                totalDurationMinutes: session.duration,
                avgPower: session.power,
                avgRPE: session.rpe,
                sessionCount: 1
            });
        }
    }

    return dailyMap;
}

// ============================================================================
// POWER BASELINE (42-day EWMA)
// ============================================================================

/**
 * Calculate the power baseline using 42-day EWMA of daily average power.
 * 
 * Formula: P_base(today) = P_base(yesterday) + α × (P_day - P_base(yesterday))
 * Where α = 2/(42+1)
 * 
 * @param dailyData - Map of aggregated daily data
 * @param upToDate - Calculate baseline up to this date
 * @param basePower - Initial/fallback power value
 * @returns Power baseline value
 */
export function calculatePowerBaseline(
    dailyData: Map<string, DailyAggregatedData>,
    upToDate: Date,
    basePower: number = 150
): number {
    const alpha = 2 / (POWER_BASELINE_DAYS + 1);
    let pBase = basePower;

    // Sort dates and iterate chronologically
    const sortedDates = Array.from(dailyData.keys()).sort();

    for (const dateStr of sortedDates) {
        const dayDate = new Date(dateStr);
        if (dayDate > upToDate) break;

        const dayData = dailyData.get(dateStr);
        if (dayData && dayData.avgPower > 0) {
            pBase = pBase + alpha * (dayData.avgPower - pBase);
        }
    }

    return pBase;
}

// ============================================================================
// DAILY LOAD CALCULATION
// ============================================================================

/**
 * Calculate Power Load (External Component).
 * 
 * Formula: L_P = 100 × (t_total/60) × (P_day/P_base)²
 * 
 * @param totalDurationMinutes - Total daily duration in minutes
 * @param avgPower - Daily average power (time-weighted)
 * @param powerBaseline - 42-day EWMA of power
 * @returns Power load value
 */
export function calculatePowerLoad(
    totalDurationMinutes: number,
    avgPower: number,
    powerBaseline: number
): number {
    if (powerBaseline <= 0 || avgPower <= 0) return 0;

    const durationHours = totalDurationMinutes / 60;
    const powerRatio = avgPower / powerBaseline;

    return 100 * durationHours * Math.pow(powerRatio, 2);
}

/**
 * Calculate RPE Load (Internal Component).
 * 
 * Formula: L_R = (RPE_day × t_total) / 4
 * 
 * @param avgRPE - Daily average RPE (time-weighted)
 * @param totalDurationMinutes - Total daily duration in minutes
 * @returns RPE load value
 */
export function calculateRPELoad(
    avgRPE: number,
    totalDurationMinutes: number
): number {
    return (avgRPE * totalDurationMinutes) / 4;
}

/**
 * Calculate Hybrid Daily Load combining Power and RPE components.
 * 
 * Formula: L_Daily = 0.6 × L_P + 0.4 × L_R
 * 
 * If Power is missing (0), uses 100% RPE load.
 * If RPE is missing (0), uses 100% Power load.
 * 
 * @param powerLoad - Power load component (L_P)
 * @param rpeLoad - RPE load component (L_R)
 * @returns Combined daily load
 */
export function calculateDailyLoad(
    powerLoad: number,
    rpeLoad: number
): number {
    // Handle missing data cases
    if (powerLoad <= 0 && rpeLoad > 0) {
        return rpeLoad;  // 100% RPE when no power data
    }
    if (rpeLoad <= 0 && powerLoad > 0) {
        return powerLoad;  // 100% Power when no RPE data
    }
    if (powerLoad <= 0 && rpeLoad <= 0) {
        return 0;
    }

    // Standard hybrid: 60% Power, 40% RPE
    return 0.6 * powerLoad + 0.4 * rpeLoad;
}

// ============================================================================
// SCORE CALCULATION
// ============================================================================

/**
 * Calculate Fatigue Score using ACWR with Logistic Sigmoid normalization.
 * 
 * Formula: Score = 100 / (1 + e^(-4.5 × (ACWR - 1.15)))
 * 
 * Uses CTL_MINIMUM (15) as baseline for new users to prevent ACWR explosion
 * when chronic load history is insufficient.
 * 
 * Interpretation:
 * - < 20: Fully Recovered
 * - 20-60: Functional Fatigue (Training Zone)
 * - 60-80: Overreaching (Caution)
 * - > 80: High Risk (Stop/Taper)
 * 
 * @param atl - Acute Training Load (7-day EWMA)
 * @param ctl - Chronic Training Load (42-day EWMA)
 * @returns Fatigue score 0-100
 */
export function calculateFatigueScore(atl: number, ctl: number): number {
    // Use minimum CTL baseline for new users to avoid ACWR explosion
    // This prevents misleading high fatigue scores when history is insufficient
    const effectiveCTL = Math.max(CTL_MINIMUM, ctl);

    const acwr = atl / effectiveCTL;
    const score = 100 / (1 + Math.exp(-FATIGUE_STEEPNESS * (acwr - FATIGUE_MIDPOINT)));

    return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Calculate Readiness Score using TSB with Asymmetric Gaussian distribution.
 * 
 * Uses different decay rates for overtraining vs detraining:
 * - Overtraining (TSB < 20): Steeper penalty (width=1000) - injury risk
 * - Undertraining (TSB > 20): Gentler penalty (width=2000) - fitness loss
 * 
 * The Gaussian peaks at TSB = +20, which aligns with research on optimal
 * TSB for peak performance (Friel, TrainingPeaks recommendations).
 * 
 * @param tsb - Training Stress Balance (CTL - ATL)
 * @returns Readiness score 0-100
 */
export function calculateReadinessScore(tsb: number): number {
    // Asymmetric Gaussian: stricter for overtraining, gentler for detraining
    const width = tsb >= READINESS_OPTIMAL_TSB
        ? READINESS_WIDTH_UNDERTRAIN  // Detraining side (gentler)
        : READINESS_WIDTH_OVERTRAIN;  // Overtraining side (steeper)

    const exponent = -Math.pow(tsb - READINESS_OPTIMAL_TSB, 2) / width;
    const score = 100 * Math.exp(exponent);

    return Math.round(Math.max(0, Math.min(100, score)));
}

// ============================================================================
// FULL METRICS CALCULATION
// ============================================================================

/**
 * Calculate complete daily metrics including ATL, CTL, ACWR, TSB, and scores.
 * 
 * This is the main entry point for the new framework.
 * 
 * @param sessions - All session data
 * @param startDate - Start date for calculations
 * @param endDate - End date for calculations
 * @param basePower - Initial/fallback power value
 * @returns Array of daily metrics
 */
export function calculateDailyMetrics(
    sessions: Array<{ date: string; duration: number; power: number; rpe: number }>,
    startDate: Date,
    endDate: Date,
    basePower: number = 150
): DailyMetrics[] {
    const oneDay = 24 * 60 * 60 * 1000;
    const metrics: DailyMetrics[] = [];

    // Aggregate sessions by day
    const dailyData = aggregateDailySessions(sessions);

    // Calculate power baseline
    const powerBaseline = calculatePowerBaseline(dailyData, endDate, basePower);

    // Initialize EWMA accumulators
    // ATL=9, CTL=10 gives TSB≈1 → ~75% starting readiness (neutral state)
    let atl = 9;
    let ctl = 10; // Seed with small baseline to prevent divide-by-zero

    // Iterate through each day
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / oneDay) + 1;

    for (let i = 0; i < totalDays; i++) {
        const currentDate = new Date(startDate.getTime() + i * oneDay);
        const dateStr = currentDate.toISOString().split('T')[0];

        // Get aggregated data for this day (if any)
        const dayData = dailyData.get(dateStr);

        let powerLoad = 0;
        let rpeLoad = 0;
        let dailyLoad = 0;

        if (dayData) {
            powerLoad = calculatePowerLoad(
                dayData.totalDurationMinutes,
                dayData.avgPower,
                powerBaseline
            );
            rpeLoad = calculateRPELoad(dayData.avgRPE, dayData.totalDurationMinutes);
            dailyLoad = calculateDailyLoad(powerLoad, rpeLoad);
        }

        // Update EWMA
        atl = atl * (1 - ATL_ALPHA) + dailyLoad * ATL_ALPHA;
        ctl = ctl * (1 - CTL_ALPHA) + dailyLoad * CTL_ALPHA;

        // Calculate derived metrics
        const acwr = ctl > 0 ? atl / ctl : 0;
        const tsb = ctl - atl;
        const fatigueScore = calculateFatigueScore(atl, ctl);
        const readinessScore = calculateReadinessScore(tsb);

        metrics.push({
            date: dateStr,
            dailyLoad,
            powerLoad,
            rpeLoad,
            atl,
            ctl,
            acwr,
            tsb,
            fatigueScore,
            readinessScore
        });
    }

    return metrics;
}

/**
 * Get the latest fatigue and readiness scores from session history.
 * 
 * Convenience function that returns just the most recent scores.
 * 
 * @param sessions - All session data
 * @param startDate - Start date for calculations
 * @param currentDate - Current date
 * @param basePower - Initial/fallback power value
 * @returns Object with fatigue, readiness, tsb, atl, ctl
 */
export function getCurrentMetrics(
    sessions: Array<{ date: string; duration: number; power: number; rpe: number }>,
    startDate: Date,
    currentDate: Date,
    basePower: number = 150
): { fatigue: number; readiness: number; tsb: number; atl: number; ctl: number } {
    const allMetrics = calculateDailyMetrics(sessions, startDate, currentDate, basePower);

    if (allMetrics.length === 0) {
        return { fatigue: 0, readiness: 72, tsb: 0, atl: 0, ctl: 10 };
    }

    const latest = allMetrics[allMetrics.length - 1];

    return {
        fatigue: latest.fatigueScore,
        readiness: latest.readinessScore,
        tsb: Math.round(latest.tsb),
        atl: latest.atl,
        ctl: latest.ctl
    };
}
