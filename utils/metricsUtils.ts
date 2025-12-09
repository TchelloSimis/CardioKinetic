/**
 * Metrics utility functions for calculating training load, fatigue, and readiness.
 */

/**
 * Calculate training load for a session using non-linear duration, RPE, and power ratio weighting.
 * 
 * Formula: RPE^1.5 × Duration^0.75 × PowerRatio^0.5 × 0.3
 * 
 * Rationale:
 * - RPE exponent (1.5): Higher RPE causes disproportionately more fatigue
 *   (RPE 10 is ~2.8× harder than RPE 5, not just 2×)
 * - Duration exponent (0.75): Diminishing returns on very long sessions
 *   (120 min is ~22× harder than 2 min, not 60×)
 * - Power ratio exponent (0.5): Sessions harder than your recent average add more load
 *   (200W when averaging 100W adds ~41% more load; 200W when averaging 400W reduces ~29%)
 * - Scaling factor (0.3): Calibrates output to maintain similar fatigue score ranges
 * 
 * @param rpe - Rating of Perceived Exertion (1-10)
 * @param durationMinutes - Session duration in minutes
 * @param powerRatio - Session power / recent average power (default 1.0 if no history)
 * @returns Training load value
 */
export function calculateSessionLoad(
    rpe: number,
    durationMinutes: number,
    powerRatio: number = 1.0
): number {
    // Clamp power ratio to prevent extreme values (0.25 to 4.0 range)
    const clampedRatio = Math.max(0.25, Math.min(4.0, powerRatio));

    return Math.pow(rpe, 1.5) * Math.pow(durationMinutes, 0.75) * Math.pow(clampedRatio, 0.5) * 0.3;
}

/**
 * Calculate the recent average power from session history using exponential weighting.
 * Uses a 28-day lookback with exponential decay (more recent = more weight).
 * 
 * @param sessions - Array of sessions with date and power
 * @param currentDate - The date to calculate average up to (exclusive)
 * @param basePower - Fallback power if no session history (from program settings)
 * @returns Recent weighted average power
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

        // Only consider sessions within lookback period and before current date
        if (daysAgo > 0 && daysAgo <= LOOKBACK_DAYS) {
            // Exponential decay weight: more recent sessions have higher weight
            const weight = Math.exp(-daysAgo / 14); // 14-day half-life
            weightedSum += session.power * weight;
            totalWeight += weight;
        }
    }

    // Return weighted average, or basePower if no relevant history
    return totalWeight > 0 ? weightedSum / totalWeight : basePower;
}
