/**
 * Training Monotony & Strain Calculations
 * 
 * Based on Foster et al. research on training load monitoring. Monotony measures
 * the lack of variation in training, which increases injury/illness risk
 * regardless of absolute training load.
 * 
 * Formula: Monotony = Mean Daily Load / SD Daily Load
 * Formula: Strain = Weekly Load × Monotony
 * 
 * References:
 * - Foster, C. (1998). Monitoring training in athletes with reference to overtraining syndrome.
 * - Foster, C. et al. (2001). A new approach to monitoring exercise training.
 */

/**
 * Calculate training monotony from daily loads.
 * 
 * Monotony measures how uniform/repetitive the training is:
 * - Low monotony (<1.5): Good variation between sessions
 * - Moderate monotony (1.5-2.0): Some concern, consider adding variety
 * - High monotony (>2.0): Risky - too little variation
 * 
 * @param dailyLoads - Array of daily training loads
 * @param windowDays - Window size for calculation (default 7 days)
 * @returns Monotony value (typically 1.0-5.0)
 */
export function calculateMonotony(dailyLoads: number[], windowDays: number = 7): number {
    if (dailyLoads.length < windowDays) return 1.0;

    const recent = dailyLoads.slice(-windowDays);
    const mean = recent.reduce((a, b) => a + b, 0) / windowDays;

    if (mean === 0) return 1.0;

    const variance = recent.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / windowDays;
    const sd = Math.sqrt(variance);

    // Cap at 5 for extremely monotonous training
    return sd > 0 ? Math.min(5.0, mean / sd) : 5.0;
}

/**
 * Calculate training strain.
 * 
 * Strain = Weekly Load × Monotony
 * 
 * High strain indicates both high volume AND repetitive training,
 * which significantly increases injury/illness risk.
 * 
 * @param weeklyLoad - Total training load for the week
 * @param monotony - Monotony value from calculateMonotony()
 * @returns Strain value
 */
export function calculateStrain(weeklyLoad: number, monotony: number): number {
    return weeklyLoad * monotony;
}

/**
 * Get monotony risk level.
 * 
 * Based on Foster research thresholds:
 * - <1.5: Low risk (good session variety)
 * - 1.5-2.0: Moderate risk (could use more variety)
 * - >2.0: High risk (needs more session variation)
 * 
 * @param monotony - Monotony value from calculateMonotony()
 * @returns Risk level string
 */
export function getMonotonyRisk(monotony: number): 'low' | 'moderate' | 'high' {
    if (monotony < 1.5) return 'low';       // Good variation
    if (monotony < 2.0) return 'moderate';  // Some concern
    return 'high';                          // Needs more variety
}

/**
 * Get strain risk level.
 * 
 * Strain thresholds depend on individual baseline, but general guidelines:
 * - Strain < 3000: Low risk (manageable)
 * - Strain 3000-6000: Moderate risk (monitor closely)
 * - Strain > 6000: High risk (consider deload)
 * 
 * @param strain - Strain value from calculateStrain()
 * @returns Risk level string
 */
export function getStrainRisk(strain: number): 'low' | 'moderate' | 'high' {
    if (strain < 3000) return 'low';
    if (strain < 6000) return 'moderate';
    return 'high';
}

/**
 * Calculate weekly load from daily loads.
 * 
 * @param dailyLoads - Array of daily training loads
 * @param windowDays - Window size (default 7)
 * @returns Total load for the window
 */
export function calculateWeeklyLoad(dailyLoads: number[], windowDays: number = 7): number {
    if (dailyLoads.length === 0) return 0;
    const recent = dailyLoads.slice(-windowDays);
    return recent.reduce((a, b) => a + b, 0);
}
