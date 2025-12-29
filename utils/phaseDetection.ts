/**
 * Advanced Phase Detection Module
 * 
 * Mathematically rigorous phase detection using:
 * - Multi-signal sensor fusion (fatigue, CTL, power, readiness)
 * - Z-score normalization for athlete-agnostic thresholds
 * - Bayesian likelihood computation
 * - Hidden Markov Model transition probabilities
 * - Adaptation-aware variance tracking
 * 
 * Target: >90% accuracy across all program lengths
 */

import type { CyclePhase } from '../programTemplate.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface PhaseFeatures {
    // Normalized position features
    zFatigue: number;           // z-score of current fatigue
    zReadiness: number;         // z-score of current readiness

    // Normalized velocity features
    zFatigueVelocity: number;   // z-score of fatigue velocity
    zCTLSlope: number;          // z-score of CTL regression slope
    zPowerTrend: number;        // z-score of power trajectory

    // Acceleration features
    zFatigueAccel: number;      // z-score of fatigue acceleration

    // Stability/adaptation features
    varianceRatio: number;      // recent variance / historical variance (adaptation indicator)
    trendConsistency: number;   // R² of linear fit to fatigue (0-1)
    programProgress: number;    // position in program (0-1)

    // Raw values for edge case handling
    rawFatigue: number;
    rawVelocity: number;
    dataPoints: number;
}

export interface PhaseContext {
    fatigueHistory: number[];
    readinessHistory?: number[];
    ctlHistory?: number[];
    powerHistory?: number[];
    weekNumber: number;
    totalWeeks: number;
    previousPhase?: CyclePhase;
    previousConfidence?: number;
}

export interface CyclePhaseResult {
    phase: CyclePhase | undefined;
    confidence: number;
    features?: PhaseFeatures;
    likelihoods?: Record<CyclePhase, number>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Minimum data points for reliable detection
const MIN_DATA_POINTS = 5;
const IDEAL_DATA_POINTS = 8;

// Transition matrix: P(next_phase | current_phase)
// Encodes physiologically plausible phase sequences
const TRANSITION_MATRIX: Record<CyclePhase, Record<CyclePhase, number>> = {
    ascending: { ascending: 0.55, peak: 0.35, descending: 0.05, trough: 0.05 },
    peak: { ascending: 0.05, peak: 0.25, descending: 0.65, trough: 0.05 },
    descending: { ascending: 0.05, peak: 0.05, descending: 0.45, trough: 0.45 },
    trough: { ascending: 0.60, peak: 0.05, descending: 0.05, trough: 0.30 }
};

// Feature weights for likelihood computation
// Tuned for >90% accuracy - especially on deload/recovery weeks
// Type explicitly allows optional properties for safe access
type PhaseWeight = {
    zFatigueVelocity?: number;
    zCTLSlope?: number;
    zPowerTrend?: number;
    zFatigue?: number;
    zFatigueAccel?: number;
    trendConsistency?: number;
    zReadiness?: number;
    varianceRatio?: number;
};
const FEATURE_WEIGHTS: Record<CyclePhase, PhaseWeight> = {
    ascending: {
        zFatigueVelocity: 2.5,    // Strong positive velocity
        zCTLSlope: 2.0,           // CTL rising
        zPowerTrend: 2.5,         // Power increasing (strong signal)
        zFatigue: -0.5,           // Not at extreme high
        zFatigueAccel: 0.5,       // Positive acceleration
        trendConsistency: 0.8     // Consistent upward trend
    },
    peak: {
        zFatigue: 2.5,            // High fatigue position
        zFatigueVelocity: -2.0,   // Velocity near zero (penalize magnitude)
        zFatigueAccel: -2.0,      // Negative acceleration (turning down)
        zPowerTrend: 1.0,         // Power still high/stable at peak
        trendConsistency: -1.0,   // Trend breaking
        varianceRatio: 0.5        // Increased instability
    },
    descending: {
        zFatigueVelocity: -2.0,   // Negative velocity
        zCTLSlope: -1.5,          // CTL falling
        zPowerTrend: -3.0,        // Power decreasing (STRONG signal for deload)
        zFatigue: 0.5,            // From elevated position
        zFatigueAccel: -0.5,      // Negative acceleration
        trendConsistency: 0.5     // Consistent downward trend
    },
    trough: {
        zFatigue: -2.0,           // Low fatigue position  
        zFatigueVelocity: -1.0,   // Velocity near zero
        zFatigueAccel: 1.5,       // Positive acceleration (turning up)
        zReadiness: 1.5,          // High readiness expected
        zPowerTrend: -2.5,        // Power reduced (STRONG signal for recovery/deload)
        trendConsistency: -0.5,   // Trend may be breaking
        varianceRatio: 0.3        // Recovery stability
    }
};


// ============================================================================
// STATISTICAL FUNCTIONS
// ============================================================================

/**
 * Compute mean of array
 */
function mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Compute standard deviation
 */
function std(arr: number[]): number {
    if (arr.length < 2) return 1; // Avoid division by zero
    const m = mean(arr);
    const variance = arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (arr.length - 1);
    return Math.sqrt(variance) || 1; // Avoid zero std
}

/**
 * Compute z-score with safety checks
 */
function zScore(value: number, m: number, s: number): number {
    if (s < 0.001) return 0; // No variance = neutral
    return (value - m) / s;
}

/**
 * Compute linear regression slope using least squares
 */
function linearRegressionSlope(arr: number[]): number {
    const n = arr.length;
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += arr[i];
        sumXY += i * arr[i];
        sumX2 += i * i;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (Math.abs(denominator) < 0.001) return 0;

    return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Compute R² (coefficient of determination) for linear fit
 */
function rSquared(arr: number[]): number {
    if (arr.length < 3) return 0;

    const n = arr.length;
    const m = mean(arr);
    const slope = linearRegressionSlope(arr);
    const intercept = m - slope * (n - 1) / 2;

    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < n; i++) {
        const predicted = intercept + slope * i;
        ssRes += Math.pow(arr[i] - predicted, 2);
        ssTot += Math.pow(arr[i] - m, 2);
    }

    if (ssTot < 0.001) return 1; // All values same = perfect fit
    return 1 - ssRes / ssTot;
}

/**
 * Sigmoid activation function
 */
function sigmoid(x: number): number {
    // Clamp to prevent overflow
    const clampedX = Math.max(-20, Math.min(20, x));
    return 1 / (1 + Math.exp(-clampedX));
}

/**
 * Compute velocity (first derivative) using central difference
 */
function computeVelocity(arr: number[], windowSize: number = 3): number {
    if (arr.length < 2) return 0;

    const n = Math.min(windowSize, arr.length);
    const recent = arr.slice(-n);

    // Weighted velocity: more weight on recent changes
    let velocity = 0;
    let totalWeight = 0;
    for (let i = 1; i < recent.length; i++) {
        const weight = i; // Linear weighting: more recent = higher weight
        velocity += weight * (recent[i] - recent[i - 1]);
        totalWeight += weight;
    }

    return totalWeight > 0 ? velocity / totalWeight : 0;
}

/**
 * Compute acceleration (second derivative)
 */
function computeAcceleration(arr: number[]): number {
    if (arr.length < 3) return 0;

    const recent = arr.slice(-5);
    const velocities: number[] = [];

    for (let i = 1; i < recent.length; i++) {
        velocities.push(recent[i] - recent[i - 1]);
    }

    return computeVelocity(velocities);
}

// ============================================================================
// FEATURE COMPUTATION
// ============================================================================

/**
 * Compute all phase detection features from context
 */
export function computePhaseFeatures(context: PhaseContext): PhaseFeatures | undefined {
    const { fatigueHistory, readinessHistory, ctlHistory, powerHistory, weekNumber, totalWeeks } = context;

    if (fatigueHistory.length < MIN_DATA_POINTS) {
        return undefined;
    }

    // Use recent window for feature computation
    const windowSize = Math.min(IDEAL_DATA_POINTS, fatigueHistory.length);
    const recentFatigue = fatigueHistory.slice(-windowSize);

    // Current values
    const currentFatigue = recentFatigue[recentFatigue.length - 1];
    const currentReadiness = readinessHistory?.slice(-1)[0] ?? 70;

    // Historical statistics (all data for normalization)
    const fatigueMean = mean(fatigueHistory);
    const fatigueStd = std(fatigueHistory);

    // Velocity and acceleration
    const velocity = computeVelocity(recentFatigue);
    const acceleration = computeAcceleration(recentFatigue);

    // Compute velocity history for normalization
    const velocityHistory: number[] = [];
    for (let i = 1; i < fatigueHistory.length; i++) {
        velocityHistory.push(fatigueHistory[i] - fatigueHistory[i - 1]);
    }
    const velocityMean = mean(velocityHistory);
    const velocityStd = std(velocityHistory);

    // CTL slope (if available)
    let ctlSlope = 0;
    let ctlSlopeMean = 0;
    let ctlSlopeStd = 1;
    if (ctlHistory && ctlHistory.length >= 3) {
        ctlSlope = linearRegressionSlope(ctlHistory.slice(-5));
        // Normalize CTL slope against typical CTL changes
        ctlSlopeMean = 0; // CTL changes are typically centered around 0
        ctlSlopeStd = Math.max(1, std(ctlHistory)) / 10; // Scale to typical slope magnitude
    }

    // Power trend (if available)
    let powerTrend = 0;
    let powerTrendMean = 0;
    let powerTrendStd = 0.05; // Typical power changes are ~5%
    if (powerHistory && powerHistory.length >= 2) {
        powerTrend = computeVelocity(powerHistory);
    }

    // Readiness normalization
    const readinessMean = readinessHistory ? mean(readinessHistory) : 70;
    const readinessStd = readinessHistory ? std(readinessHistory) : 10;

    // Variance ratio (adaptation indicator)
    // Compare recent variance to early variance
    let varianceRatio = 1;
    if (fatigueHistory.length >= 8) {
        const earlyVariance = std(fatigueHistory.slice(0, 4)) ** 2;
        const recentVariance = std(fatigueHistory.slice(-4)) ** 2;
        varianceRatio = earlyVariance > 0.1 ? recentVariance / earlyVariance : 1;
    }

    // Trend consistency (R² of recent linear fit)
    const trendConsistency = rSquared(recentFatigue);

    // Program progress
    const programProgress = totalWeeks > 1 ? (weekNumber - 1) / (totalWeeks - 1) : 0;

    return {
        zFatigue: zScore(currentFatigue, fatigueMean, fatigueStd),
        zReadiness: zScore(currentReadiness, readinessMean, readinessStd),
        zFatigueVelocity: zScore(velocity, velocityMean, velocityStd),
        zCTLSlope: zScore(ctlSlope, ctlSlopeMean, ctlSlopeStd),
        zPowerTrend: zScore(powerTrend, powerTrendMean, powerTrendStd),
        zFatigueAccel: zScore(acceleration, 0, Math.max(1, velocityStd)),
        varianceRatio,
        trendConsistency,
        programProgress,
        rawFatigue: currentFatigue,
        rawVelocity: velocity,
        dataPoints: fatigueHistory.length
    };
}

// ============================================================================
// LIKELIHOOD COMPUTATION
// ============================================================================

/**
 * Compute weighted score for a phase given features
 */
function computePhaseScore(phase: CyclePhase, features: PhaseFeatures): number {
    const weights = FEATURE_WEIGHTS[phase];
    let score = 0;

    // Apply each weight
    if (weights.zFatigueVelocity !== undefined) {
        score += weights.zFatigueVelocity * features.zFatigueVelocity;
    }
    if (weights.zFatigue !== undefined) {
        score += weights.zFatigue * features.zFatigue;
    }
    if (weights.zFatigueAccel !== undefined) {
        score += weights.zFatigueAccel * features.zFatigueAccel;
    }
    if (weights.zCTLSlope !== undefined) {
        score += weights.zCTLSlope * features.zCTLSlope;
    }
    if (weights.zPowerTrend !== undefined) {
        score += weights.zPowerTrend * features.zPowerTrend;
    }
    if (weights.zReadiness !== undefined) {
        score += weights.zReadiness * features.zReadiness;
    }
    if (weights.trendConsistency !== undefined) {
        score += weights.trendConsistency * features.trendConsistency;
    }
    if (weights.varianceRatio !== undefined) {
        score += weights.varianceRatio * Math.log(features.varianceRatio + 0.1);
    }

    return score;
}

/**
 * Compute likelihood of each phase given features
 */
export function computePhaseLikelihoods(features: PhaseFeatures): Record<CyclePhase, number> {
    const scores: Record<CyclePhase, number> = {
        ascending: computePhaseScore('ascending', features),
        peak: computePhaseScore('peak', features),
        descending: computePhaseScore('descending', features),
        trough: computePhaseScore('trough', features)
    };

    // Convert scores to probabilities using softmax
    const maxScore = Math.max(...Object.values(scores));
    const expScores: Record<CyclePhase, number> = {
        ascending: Math.exp(scores.ascending - maxScore),
        peak: Math.exp(scores.peak - maxScore),
        descending: Math.exp(scores.descending - maxScore),
        trough: Math.exp(scores.trough - maxScore)
    };

    const total = Object.values(expScores).reduce((a, b) => a + b, 0);

    return {
        ascending: expScores.ascending / total,
        peak: expScores.peak / total,
        descending: expScores.descending / total,
        trough: expScores.trough / total
    };
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Advanced phase detection using Bayesian inference with HMM transitions
 */
export function detectCyclePhaseAdvanced(context: PhaseContext): CyclePhaseResult {
    const features = computePhaseFeatures(context);

    if (!features) {
        return { phase: undefined, confidence: 0 };
    }

    // Compute observation likelihoods
    const likelihoods = computePhaseLikelihoods(features);

    // Get prior from transition matrix (or uniform if no previous phase)
    const previousPhase = context.previousPhase;
    const prior: Record<CyclePhase, number> = previousPhase
        ? TRANSITION_MATRIX[previousPhase]
        : { ascending: 0.35, peak: 0.15, descending: 0.25, trough: 0.25 };

    // Adjust prior based on program progress
    // Early program: bias toward ascending
    // Late program: bias toward peak/descending
    const progressWeight = features.programProgress;
    const adjustedPrior: Record<CyclePhase, number> = {
        ascending: prior.ascending * (1 + 0.3 * (1 - progressWeight)),
        peak: prior.peak * (1 + 0.2 * progressWeight),
        descending: prior.descending * (1 + 0.1 * progressWeight),
        trough: prior.trough * (1 - 0.1 * progressWeight)
    };

    // Normalize adjusted prior
    const priorTotal = Object.values(adjustedPrior).reduce((a, b) => a + b, 0);
    for (const phase of Object.keys(adjustedPrior) as CyclePhase[]) {
        adjustedPrior[phase] /= priorTotal;
    }

    // Bayesian posterior: P(phase | data) ∝ P(data | phase) × P(phase | previous)
    const posterior: Record<CyclePhase, number> = {
        ascending: likelihoods.ascending * adjustedPrior.ascending,
        peak: likelihoods.peak * adjustedPrior.peak,
        descending: likelihoods.descending * adjustedPrior.descending,
        trough: likelihoods.trough * adjustedPrior.trough
    };

    // Normalize posterior
    const posteriorTotal = Object.values(posterior).reduce((a, b) => a + b, 0);
    for (const phase of Object.keys(posterior) as CyclePhase[]) {
        posterior[phase] /= posteriorTotal;
    }

    // Find best phase
    let bestPhase: CyclePhase = 'ascending';
    let maxProb = 0;
    for (const phase of Object.keys(posterior) as CyclePhase[]) {
        if (posterior[phase] > maxProb) {
            maxProb = posterior[phase];
            bestPhase = phase;
        }
    }

    // Confidence is the max posterior probability
    // Scale by data quality factor
    const dataQualityFactor = Math.min(1, features.dataPoints / IDEAL_DATA_POINTS);
    const confidence = maxProb * dataQualityFactor;

    // Stability check: require sufficient confidence to change phase
    const confidenceThreshold = previousPhase ? 0.35 : 0.25;
    if (previousPhase && bestPhase !== previousPhase && confidence < confidenceThreshold) {
        // Check if the change is at least somewhat likely
        const changeRatio = posterior[bestPhase] / posterior[previousPhase];
        if (changeRatio < 1.5) {
            // Not confident enough to change
            return {
                phase: previousPhase,
                confidence: confidence * 0.8,
                features,
                likelihoods
            };
        }
    }

    return {
        phase: bestPhase,
        confidence,
        features,
        likelihoods
    };
}

/**
 * Wrapper for backward compatibility with old detectCyclePhase signature
 */
export function detectCyclePhaseCompatible(
    fatigueHistory: number[],
    recentReadiness?: number,
    previousPhase?: CyclePhase
): CyclePhaseResult {
    const context: PhaseContext = {
        fatigueHistory,
        readinessHistory: recentReadiness !== undefined ? [recentReadiness] : undefined,
        weekNumber: fatigueHistory.length,
        totalWeeks: fatigueHistory.length + 4, // Estimate
        previousPhase
    };

    return detectCyclePhaseAdvanced(context);
}
