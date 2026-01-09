/**
 * RPE Heart Rate Utilities
 * 
 * Calculates estimated heart rate bands from RPE values based on the equation:
 * RPE = 0.02 * X² + 0.1659 * X - 1.3221
 * where X = 20 * (H / (208 - 0.7 * A))
 * 
 * H = Heart Rate (bpm), A = Age (years)
 */

// Coefficients from the RPE equation
const A_COEFF = 0.02;
const B_COEFF = 0.1659;
const C_COEFF = -1.3221;

/**
 * Calculate X factor from RPE using quadratic formula
 * From: RPE = 0.02×X² + 0.1659×X - 1.3221
 * Rearranged: 0.02×X² + 0.1659×X - (1.3221 + RPE) = 0
 * 
 * Using quadratic formula: X = (-b + √(b² - 4ac)) / 2a
 * We take positive root since X must be positive
 */
export function calculateXFromRPE(rpe: number): number {
    // Rearrange to: aX² + bX + c = 0 where c = -(1.3221 + RPE)
    const a = A_COEFF;
    const b = B_COEFF;
    const c = C_COEFF - rpe; // Note: equation is RPE = ... so we rearrange to 0 = -RPE + ...

    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
        // Should not happen for valid RPE values 1-10, but handle gracefully
        return 0;
    }

    // Take positive root
    return (-b + Math.sqrt(discriminant)) / (2 * a);
}

/**
 * Calculate heart rate from X factor and age
 * From: X = 20 × (H / (208 - 0.7×A))
 * Solved for H: H = X × (208 - 0.7×A) / 20
 */
export function calculateHeartRateFromX(x: number, age: number): number {
    const maxHR = 208 - 0.7 * age;
    return (x * maxHR) / 20;
}

/**
 * Calculate heart rate for a given RPE and age
 * Returns floored integer (Math.floor) for accuracy
 */
export function calculateHeartRateForRPE(rpe: number, age: number): number {
    const x = calculateXFromRPE(rpe);
    const hr = calculateHeartRateFromX(x, age);
    return Math.floor(hr);
}

/**
 * Get heart rate band for an RPE value (±0.25 RPE)
 * For integer RPE (e.g., 6): band is RPE 5.75 to 6.25
 * For half-step RPE (e.g., 6.5): band is RPE 6.25 to 6.75
 * 
 * Returns floored integers for both bounds (Math.floor)
 */
export function getHeartRateBandForRPE(rpe: number, age: number): { lower: number; upper: number } {
    const lowerRPE = rpe - 0.25;
    const upperRPE = rpe + 0.25;

    const lowerX = calculateXFromRPE(lowerRPE);
    const upperX = calculateXFromRPE(upperRPE);

    const lowerHR = calculateHeartRateFromX(lowerX, age);
    const upperHR = calculateHeartRateFromX(upperX, age);

    return {
        lower: Math.floor(lowerHR),
        upper: Math.floor(upperHR)
    };
}

/**
 * Format HR band as human-readable string
 * e.g., "~145–156 bpm"
 */
export function formatHeartRateBand(band: { lower: number; upper: number }): string {
    return `~${band.lower}–${band.upper} bpm`;
}
