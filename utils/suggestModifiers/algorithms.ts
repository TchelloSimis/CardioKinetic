/**
 * Suggest Modifiers Module - Signal Processing Algorithms
 * 
 * Contains signal processing functions: smoothing, derivatives, percentiles,
 * CUSUM change-point detection, and extrema detection.
 */

// ============================================================================
// ADAPTIVE WINDOW SIZING
// ============================================================================

/**
 * Calculate adaptive window sizes based on program length.
 * 
 * Formula:
 * - localWindow = max(2, min(N-1, floor(N × 0.20)))  // ~20%, never exceeds N-1
 * - mesoWindow  = max(3, min(N, floor(N × 0.40)))    // ~40%, never exceeds N
 */
export function calculateAdaptiveWindows(programLength: number): { local: number; meso: number } {
    const N = programLength;

    const local = Math.max(2, Math.min(N - 1, Math.floor(N * 0.20)));
    const meso = Math.max(3, Math.min(N, Math.floor(N * 0.40)));

    return { local, meso };
}

// ============================================================================
// SIGNAL PROCESSING
// ============================================================================

/**
 * Savitzky-Golay style smoothing with adaptive window
 */
export function smoothSignal(data: number[], windowSize: number): number[] {
    if (data.length < windowSize) return [...data];

    const result: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;

        for (let j = -halfWindow; j <= halfWindow; j++) {
            const idx = i + j;
            if (idx >= 0 && idx < data.length) {
                const weight = halfWindow + 1 - Math.abs(j);
                sum += data[idx] * weight;
                count += weight;
            }
        }

        result.push(sum / count);
    }

    return result;
}

/**
 * Calculate first derivative (velocity)
 */
export function calculateDerivative(data: number[]): number[] {
    if (data.length < 2) return new Array(data.length).fill(0);

    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            result.push(data[1] - data[0]);
        } else if (i === data.length - 1) {
            result.push(data[i] - data[i - 1]);
        } else {
            result.push((data[i + 1] - data[i - 1]) / 2);
        }
    }
    return result;
}

/**
 * Calculate percentile from array
 */
export function calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

// ============================================================================
// CUSUM CHANGE-POINT DETECTION
// ============================================================================

/**
 * Detect change points using CUSUM algorithm
 */
export function detectChangePoints(data: number[], threshold: number): number[] {
    if (data.length < 3) return [];

    const changePoints: number[] = [];
    let cusumPos = 0;
    let cusumNeg = 0;

    for (let i = 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];

        cusumPos = Math.max(0, cusumPos + diff - threshold * 0.3);
        cusumNeg = Math.min(0, cusumNeg + diff + threshold * 0.3);

        if (cusumPos > threshold) {
            changePoints.push(i);
            cusumPos = 0;
        }
        if (cusumNeg < -threshold) {
            changePoints.push(i);
            cusumNeg = 0;
        }
    }

    return changePoints;
}

/**
 * Detect local peaks and troughs
 */
export function detectExtrema(data: number[]): { peaks: number[]; troughs: number[] } {
    const peaks: number[] = [];
    const troughs: number[] = [];

    for (let i = 1; i < data.length - 1; i++) {
        if (data[i] > data[i - 1] + 2 && data[i] > data[i + 1] + 2) {
            peaks.push(i);
        }
        if (data[i] < data[i - 1] - 2 && data[i] < data[i + 1] - 2) {
            troughs.push(i);
        }
    }

    return { peaks, troughs };
}
