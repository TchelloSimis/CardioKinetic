/**
 * Advanced Adaptive Trend Detection for Fatigue Modifier Suggestions
 * 
 * This module implements a sophisticated algorithm that:
 * 1. Uses ADAPTIVE window sizing based on program length
 * 2. Runs Monte Carlo simulations to get per-week percentiles
 * 3. Applies signal processing (smoothing, derivatives) to extract trends
 * 4. Uses CUSUM change-point detection to find natural cycle boundaries
 * 5. Generates modifiers with cyclePhase and phaseName filters
 * 
 * NO hardcoded window sizes - everything adapts to program structure.
 */

import { WeekDefinition, FatigueModifier, FlexibleCondition, CyclePhase } from '../programTemplate';

// ============================================================================
// CONSTANTS
// ============================================================================

const ATL_DAYS = 7;
const CTL_DAYS = 42;
const ATL_ALPHA = 2.0 / (ATL_DAYS + 1);
const CTL_ALPHA = 2.0 / (CTL_DAYS + 1);

const FATIGUE_MIDPOINT = 1.15;
const FATIGUE_STEEPNESS = 4.5;
const READINESS_OPTIMAL_TSB = 20.0;
const READINESS_WIDTH = 1250.0;

const DEFAULT_SESSION_DURATION = 15;
const DEFAULT_SESSIONS_PER_WEEK_MIN = 2;
const DEFAULT_SESSIONS_PER_WEEK_MAX = 4;

// Percentile thresholds
// Standard tier (30th-70th interval) - for moderate deviations
const P30 = 30;
const P50 = 50;
const P70 = 70;
// Extreme tier (15th-85th interval) - for significant deviations
const P15 = 15;
const P85 = 85;

// ============================================================================
// TYPES
// ============================================================================

export interface WeekAnalysis {
    weekNumber: number;
    phaseName: string;
    powerMultiplier: number;

    // Percentiles from simulation
    fatigueP15: number;
    fatigueP30: number;
    fatigueP50: number;
    fatigueP70: number;
    fatigueP85: number;
    readinessP15: number;
    readinessP30: number;
    readinessP50: number;
    readinessP70: number;
    readinessP85: number;

    // Derivatives
    fatigueVelocity: number;
    fatigueAcceleration: number;

    // Cycle context
    cyclePhase: CyclePhase;
    cycleIndex: number;

    // Flags
    isLocalPeak: boolean;
    isLocalTrough: boolean;
}

export interface TrendAnalysis {
    weekAnalyses: WeekAnalysis[];
    detectedCycles: CycleInfo[];
    globalTrend: 'improving' | 'stable' | 'declining';
    adaptationScore: number;
    adaptiveWindows: { local: number; meso: number };
}

export interface CycleInfo {
    index: number;
    startWeek: number;
    endWeek: number;
    peakWeek: number | null;
    troughWeek: number | null;
    avgFatigue: number;
    avgReadiness: number;
}

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
function smoothSignal(data: number[], windowSize: number): number[] {
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
function calculateDerivative(data: number[]): number[] {
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
function calculatePercentile(values: number[], percentile: number): number {
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
function detectChangePoints(data: number[], threshold: number): number[] {
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
function detectExtrema(data: number[]): { peaks: number[]; troughs: number[] } {
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

// ============================================================================
// CYCLE PHASE CLASSIFICATION
// ============================================================================

/**
 * Classify week into cycle phase based on:
 * 1. Coach-declared week focus (Recovery = trough, overrides all else)
 * 2. Template power trajectory (power increasing/decreasing)
 * 3. Simulated fatigue trajectory (as tiebreaker)
 * 
 * Coach intent takes highest precedence - if they schedule a Recovery week,
 * that's a trough regardless of what the numbers say.
 */
function classifyCyclePhase(
    fatigueVelocity: number,
    fatigueAcceleration: number,
    fatigueValue: number,
    powerVelocity: number,  // Rate of change in power multiplier
    isLocalPeak: boolean,
    isLocalTrough: boolean,
    weekFocus?: 'Density' | 'Intensity' | 'Volume' | 'Recovery'
): CyclePhase {
    // 1. COACH-DECLARED FOCUS takes highest precedence
    // Recovery weeks are ALWAYS troughs - protect the athlete's rest
    if (weekFocus === 'Recovery') return 'trough';

    // Intensity/Density focus with high power suggests peak or ascending
    if ((weekFocus === 'Intensity' || weekFocus === 'Density') && powerVelocity >= 0) {
        // If power is at local maximum or plateauing high, it's a peak
        if (powerVelocity < 0.02 && powerVelocity > -0.02 && fatigueValue > 50) {
            return 'peak';
        }
        // Otherwise still building
        return 'ascending';
    }

    // Explicit peaks/troughs from fatigue data
    if (isLocalPeak) return 'peak';
    if (isLocalTrough) return 'trough';

    // 2. POWER TRAJECTORY takes precedence (reflects coach's intent)
    // Power dropping = descending/consolidation phase
    if (powerVelocity < -0.02) return 'descending';
    // Power rising = ascending/build phase
    if (powerVelocity > 0.02) return 'ascending';

    // 3. For small power changes, use fatigue analysis as tiebreaker

    // High fatigue with decelerating increase = peak
    if (fatigueValue > 60 && fatigueVelocity > -2 && fatigueVelocity < 3 && fatigueAcceleration < -1) {
        return 'peak';
    }

    // Clearly rising fatigue
    if (fatigueVelocity > 3) return 'ascending';

    // Low fatigue with accelerating = trough (recovery complete)
    if (fatigueValue < 35 && fatigueVelocity > -2 && fatigueVelocity < 3 && fatigueAcceleration > 1) {
        return 'trough';
    }

    // Clearly falling fatigue
    if (fatigueVelocity < -3) return 'descending';

    // Use fatigue position as tiebreaker for stable periods
    if (fatigueValue > 55) return fatigueVelocity >= 0 ? 'peak' : 'descending';
    if (fatigueValue < 35) return fatigueVelocity <= 0 ? 'trough' : 'ascending';

    // Default based on fatigue direction
    return fatigueVelocity >= 0 ? 'ascending' : 'descending';
}

// ============================================================================
// SIMULATION CORE
// ============================================================================

function calculateFatigueScore(atl: number, ctl: number): number {
    if (ctl <= 0.001) return atl > 0 ? Math.min(100, Math.round(atl * 2)) : 0;
    const acwr = atl / ctl;
    const score = 100 / (1 + Math.exp(-FATIGUE_STEEPNESS * (acwr - FATIGUE_MIDPOINT)));
    return Math.round(Math.max(0, Math.min(100, score)));
}

function calculateReadinessScore(tsb: number): number {
    const exponent = -Math.pow(tsb - READINESS_OPTIMAL_TSB, 2) / READINESS_WIDTH;
    return Math.round(Math.max(0, Math.min(100, 100 * Math.exp(exponent))));
}

function runSingleSimulation(
    weeks: WeekDefinition[],
    basePower: number
): { dailyFatigue: number[]; dailyReadiness: number[] } {
    const numWeeks = weeks.length;
    const numDays = numWeeks * 7;
    const dailyLoads: number[] = new Array(numDays).fill(0);

    for (let weekIdx = 0; weekIdx < numWeeks; weekIdx++) {
        const week = weeks[weekIdx];
        const weekStart = weekIdx * 7;
        const numSessions = Math.floor(Math.random() *
            (DEFAULT_SESSIONS_PER_WEEK_MAX - DEFAULT_SESSIONS_PER_WEEK_MIN + 1)) +
            DEFAULT_SESSIONS_PER_WEEK_MIN;

        const availableDays = [0, 1, 2, 3, 4, 5, 6];
        for (let s = 0; s < numSessions; s++) {
            if (availableDays.length === 0) break;
            const idx = Math.floor(Math.random() * availableDays.length);
            const day = availableDays[idx];
            availableDays.splice(idx, 1);

            const dayIdx = weekStart + day;
            const powerMult = week.powerMultiplier || 1.0;
            const rpe = week.targetRPE || 6;
            const duration = typeof week.durationMinutes === 'number'
                ? week.durationMinutes : DEFAULT_SESSION_DURATION;

            const actualPower = basePower * powerMult * (1.0 + (Math.random() - 0.5) * 0.1);
            const actualRPE = Math.max(1, Math.min(10, rpe + (Math.random() - 0.5)));

            const powerRatio = actualPower / basePower;
            const clampedRatio = Math.max(0.25, Math.min(4.0, powerRatio));
            const load = Math.pow(actualRPE, 1.5) * Math.pow(duration, 0.75) *
                Math.pow(clampedRatio, 0.5) * 0.3;

            dailyLoads[dayIdx] += load;
        }
    }

    const dailyFatigue: number[] = [];
    const dailyReadiness: number[] = [];
    let atl = 0, ctl = 10;

    for (let i = 0; i < numDays; i++) {
        atl = atl * (1 - ATL_ALPHA) + dailyLoads[i] * ATL_ALPHA;
        ctl = ctl * (1 - CTL_ALPHA) + dailyLoads[i] * CTL_ALPHA;
        dailyFatigue.push(calculateFatigueScore(atl, ctl));
        dailyReadiness.push(calculateReadinessScore(ctl - atl));
    }

    return { dailyFatigue, dailyReadiness };
}

// ============================================================================
// FULL ANALYSIS PIPELINE
// ============================================================================

function runFullAnalysis(
    weeks: WeekDefinition[],
    basePower: number,
    numSimulations: number,
    fatigueData: number[][],
    readinessData: number[][]
): TrendAnalysis {
    const numWeeks = weeks.length;

    if (numWeeks === 0) {
        return {
            weekAnalyses: [],
            detectedCycles: [],
            globalTrend: 'stable',
            adaptationScore: 0,
            adaptiveWindows: { local: 2, meso: 3 }
        };
    }

    // Calculate adaptive windows
    const adaptiveWindows = calculateAdaptiveWindows(numWeeks);

    // Calculate percentiles
    const fatigueP15 = fatigueData.map(d => calculatePercentile(d, P15));
    const fatigueP30 = fatigueData.map(d => calculatePercentile(d, P30));
    const fatigueP50 = fatigueData.map(d => calculatePercentile(d, P50));
    const fatigueP70 = fatigueData.map(d => calculatePercentile(d, P70));
    const fatigueP85 = fatigueData.map(d => calculatePercentile(d, P85));
    const readinessP15 = readinessData.map(d => calculatePercentile(d, P15));
    const readinessP30 = readinessData.map(d => calculatePercentile(d, P30));
    const readinessP50 = readinessData.map(d => calculatePercentile(d, P50));
    const readinessP70 = readinessData.map(d => calculatePercentile(d, P70));
    const readinessP85 = readinessData.map(d => calculatePercentile(d, P85));

    // Signal processing with adaptive windows
    const smoothedFatigue = smoothSignal(fatigueP50, adaptiveWindows.local);
    const fatigueVelocity = calculateDerivative(smoothedFatigue);
    const fatigueAcceleration = calculateDerivative(fatigueVelocity);

    // CUSUM with adaptive threshold
    const avgFatigue = fatigueP50.reduce((a, b) => a + b, 0) / numWeeks;
    const cusumThreshold = avgFatigue * 0.25;
    const changePoints = detectChangePoints(smoothedFatigue, cusumThreshold);

    // Detect extrema
    const { peaks, troughs } = detectExtrema(smoothedFatigue);

    // Build week analyses
    const weekAnalyses: WeekAnalysis[] = [];
    let currentCycleIndex = 0;

    // Calculate power trajectory from template
    const powerMultipliers = weeks.map(w => w.powerMultiplier || 1.0);
    const powerVelocity = calculateDerivative(powerMultipliers);

    for (let w = 0; w < numWeeks; w++) {
        // Track cycle transitions at change points
        if (changePoints.includes(w) && w > 0) {
            currentCycleIndex++;
        }

        const isLocalPeak = peaks.includes(w);
        const isLocalTrough = troughs.includes(w);

        const cyclePhase = classifyCyclePhase(
            fatigueVelocity[w],
            fatigueAcceleration[w],
            fatigueP50[w],
            powerVelocity[w],
            isLocalPeak,
            isLocalTrough,
            weeks[w].focus  // Pass week focus for coach intent
        );

        weekAnalyses.push({
            weekNumber: w + 1,
            phaseName: weeks[w].phaseName || '',
            powerMultiplier: weeks[w].powerMultiplier || 1.0,
            fatigueP15: Math.round(fatigueP15[w]),
            fatigueP30: Math.round(fatigueP30[w]),
            fatigueP50: Math.round(fatigueP50[w]),
            fatigueP70: Math.round(fatigueP70[w]),
            fatigueP85: Math.round(fatigueP85[w]),
            readinessP15: Math.round(readinessP15[w]),
            readinessP30: Math.round(readinessP30[w]),
            readinessP50: Math.round(readinessP50[w]),
            readinessP70: Math.round(readinessP70[w]),
            readinessP85: Math.round(readinessP85[w]),
            fatigueVelocity: fatigueVelocity[w],
            fatigueAcceleration: fatigueAcceleration[w],
            cyclePhase,
            cycleIndex: currentCycleIndex,
            isLocalPeak,
            isLocalTrough
        });
    }

    // Build cycle info
    const detectedCycles: CycleInfo[] = [];
    const cycleIndexes = [...new Set(weekAnalyses.map(w => w.cycleIndex))];

    for (const idx of cycleIndexes) {
        const cycleWeeks = weekAnalyses.filter(w => w.cycleIndex === idx);
        const peakWeek = cycleWeeks.find(w => w.isLocalPeak)?.weekNumber ?? null;
        const troughWeek = cycleWeeks.find(w => w.isLocalTrough)?.weekNumber ?? null;

        detectedCycles.push({
            index: idx,
            startWeek: Math.min(...cycleWeeks.map(w => w.weekNumber)),
            endWeek: Math.max(...cycleWeeks.map(w => w.weekNumber)),
            peakWeek,
            troughWeek,
            avgFatigue: cycleWeeks.reduce((s, w) => s + w.fatigueP50, 0) / cycleWeeks.length,
            avgReadiness: cycleWeeks.reduce((s, w) => s + w.readinessP50, 0) / cycleWeeks.length
        });
    }

    // Global trend analysis
    let globalTrend: 'improving' | 'stable' | 'declining' = 'stable';
    let adaptationScore = 0;

    if (numWeeks >= 4) {
        const thirdLen = Math.max(1, Math.floor(numWeeks / 3));
        const firstThirdFatigue = fatigueP50.slice(0, thirdLen).reduce((a, b) => a + b, 0) / thirdLen;
        const lastThirdFatigue = fatigueP50.slice(-thirdLen).reduce((a, b) => a + b, 0) / thirdLen;
        const firstThirdReadiness = readinessP50.slice(0, thirdLen).reduce((a, b) => a + b, 0) / thirdLen;
        const lastThirdReadiness = readinessP50.slice(-thirdLen).reduce((a, b) => a + b, 0) / thirdLen;

        const fatigueDiff = lastThirdFatigue - firstThirdFatigue;
        const readinessDiff = lastThirdReadiness - firstThirdReadiness;

        if (fatigueDiff < -3) adaptationScore += 0.4;
        if (fatigueDiff > 3) adaptationScore -= 0.4;
        if (readinessDiff > 3) adaptationScore += 0.6;
        if (readinessDiff < -3) adaptationScore -= 0.6;

        if (adaptationScore > 0.3) globalTrend = 'improving';
        if (adaptationScore < -0.3) globalTrend = 'declining';
    }

    return {
        weekAnalyses,
        detectedCycles,
        globalTrend,
        adaptationScore: Math.max(-1, Math.min(1, adaptationScore)),
        adaptiveWindows
    };
}

// ============================================================================
// MODIFIER GENERATION WITH cyclePhase AND phaseName FILTERS
// ============================================================================

function generateSmartModifiers(analysis: TrendAnalysis, weeks: WeekDefinition[]): FatigueModifier[] {
    const modifiers: FatigueModifier[] = [];
    let priority = 10;

    const { weekAnalyses, globalTrend, adaptationScore } = analysis;
    if (weekAnalyses.length === 0) return modifiers;

    // =========================================================================
    // DETECT SESSION TYPES IN PROGRAM
    // Analyze weeks to understand what session types the program uses
    // =========================================================================
    const sessionTypes = new Set<string>();
    for (const week of weeks) {
        if (week.sessionStyle) sessionTypes.add(week.sessionStyle);
        // Check for interval/steady-state blocks in custom sessions
        if (week.blocks) {
            for (const block of week.blocks) {
                if (block.type === 'interval') sessionTypes.add('interval');
                if (block.type === 'steady-state') sessionTypes.add('steady-state');
            }
        }
    }
    const hasIntervals = sessionTypes.has('interval');
    const hasSteadyState = sessionTypes.has('steady-state');
    const hasCustom = sessionTypes.has('custom');

    // Group by cycle phase
    const phaseGroups = new Map<CyclePhase, WeekAnalysis[]>();
    for (const week of weekAnalyses) {
        if (!phaseGroups.has(week.cyclePhase)) {
            phaseGroups.set(week.cyclePhase, []);
        }
        phaseGroups.get(week.cyclePhase)!.push(week);
    }

    // Also group by phaseName for block-based programs
    const nameGroups = new Map<string, WeekAnalysis[]>();
    for (const week of weekAnalyses) {
        if (week.phaseName) {
            if (!nameGroups.has(week.phaseName)) {
                nameGroups.set(week.phaseName, []);
            }
            nameGroups.get(week.phaseName)!.push(week);
        }
    }

    // Generate modifiers per cycle phase - TWO TIERS
    for (const [phase, phaseWeeks] of phaseGroups) {
        // Standard tier thresholds (P30/P70)
        const avgP30Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP30, 0) / phaseWeeks.length);
        const avgP70Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP70, 0) / phaseWeeks.length);
        const avgP30Readiness = Math.round(phaseWeeks.reduce((s, w) => s + w.readinessP30, 0) / phaseWeeks.length);
        const avgP70Readiness = Math.round(phaseWeeks.reduce((s, w) => s + w.readinessP70, 0) / phaseWeeks.length);

        // Extreme tier thresholds (P15/P85)
        const avgP15Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP15, 0) / phaseWeeks.length);
        const avgP85Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP85, 0) / phaseWeeks.length);
        const avgP15Readiness = Math.round(phaseWeeks.reduce((s, w) => s + w.readinessP15, 0) / phaseWeeks.length);
        const avgP85Readiness = Math.round(phaseWeeks.reduce((s, w) => s + w.readinessP85, 0) / phaseWeeks.length);

        const phaseLabel = getPhaseLabel(phase);

        // === EXTREME TIER (P85/P15) - Higher priority, stronger adjustments ===

        // EXTREME HIGH FATIGUE (above 85th percentile)
        if (avgP85Fatigue <= 95 && avgP85Fatigue > avgP70Fatigue) {
            const adj = getFatigueExtremeHighAdjustments(phase);
            modifiers.push({
                condition: { fatigue: `>${avgP85Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    ...adj,
                    message: `Very high fatigue for ${phaseLabel} (>${avgP85Fatigue}%). ${formatAdjustments(adj)}`
                },
                priority: priority++,
                cyclePhase: phase
            });
        }

        // EXTREME LOW READINESS (below 15th percentile)
        if (avgP15Readiness >= 5 && avgP15Readiness < avgP30Readiness) {
            const adj = getReadinessExtremeLowAdjustments(phase);
            modifiers.push({
                condition: { readiness: `<${avgP15Readiness}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    ...adj,
                    message: `Very low readiness for ${phaseLabel} (<${avgP15Readiness}%). ${formatAdjustments(adj)}`
                },
                priority: priority++,
                cyclePhase: phase
            });
        }

        // EXTREME LOW FATIGUE (below 15th percentile - can push significantly harder)
        if (avgP15Fatigue >= 5 && avgP15Fatigue < avgP30Fatigue && phase !== 'trough' && phase !== 'descending') {
            const adj = getFatigueExtremeLowAdjustments(phase);
            const adjStr = formatAdjustments(adj);
            if (adjStr) {
                modifiers.push({
                    condition: { fatigue: `<${avgP15Fatigue}`, logic: 'and' } as FlexibleCondition,
                    adjustments: {
                        ...adj,
                        message: `Very low fatigue for ${phaseLabel} (<${avgP15Fatigue}%). ${adjStr}`
                    },
                    priority: priority++,
                    cyclePhase: phase
                });
            }
        }

        // EXTREME HIGH READINESS (above 85th percentile - can push significantly)
        if (avgP85Readiness <= 95 && avgP85Readiness > avgP70Readiness && phase !== 'trough' && phase !== 'descending') {
            const adj = getReadinessExtremeHighAdjustments(phase);
            const adjStr = formatAdjustments(adj);
            if (adjStr) {
                modifiers.push({
                    condition: { readiness: `>${avgP85Readiness}`, logic: 'and' } as FlexibleCondition,
                    adjustments: {
                        ...adj,
                        message: `Very high readiness for ${phaseLabel} (>${avgP85Readiness}%). ${adjStr}`
                    },
                    priority: priority++,
                    cyclePhase: phase
                });
            }
        }

        // === STANDARD TIER (P70/P30) - Normal deviations ===

        // HIGH FATIGUE (above 70th percentile for this cycle phase)
        if (avgP70Fatigue <= 95) {
            const adj = getFatigueHighAdjustments(phase);
            modifiers.push({
                condition: { fatigue: `>${avgP70Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    ...adj,
                    message: `High fatigue for ${phaseLabel} (>${avgP70Fatigue}%). ${formatAdjustments(adj)}`
                },
                priority: priority++,
                cyclePhase: phase
            });
        }

        // LOW FATIGUE (below 30th percentile - can push harder)
        // Skip for descending/trough phases - don't push during recovery!
        if (avgP30Fatigue >= 5 && phase !== 'trough' && phase !== 'descending') {
            const adj = getFatigueLowAdjustments(phase);
            const adjStr = formatAdjustments(adj);
            // Only add if there's actually an adjustment to make
            if (adjStr) {
                modifiers.push({
                    condition: { fatigue: `<${avgP30Fatigue}`, logic: 'and' } as FlexibleCondition,
                    adjustments: {
                        ...adj,
                        message: `Low fatigue for ${phaseLabel} (<${avgP30Fatigue}%). ${adjStr}`
                    },
                    priority: priority++,
                    cyclePhase: phase
                });
            }
        }

        // LOW READINESS (below 30th percentile)
        if (avgP30Readiness >= 10) {
            const adj = getReadinessLowAdjustments(phase);
            modifiers.push({
                condition: { readiness: `<${avgP30Readiness}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    ...adj,
                    message: `Low readiness for ${phaseLabel} (<${avgP30Readiness}%). ${formatAdjustments(adj)}`
                },
                priority: priority++,
                cyclePhase: phase
            });
        }

        // HIGH READINESS (above 70th percentile - can push)
        // Skip for descending/trough phases
        if (avgP70Readiness <= 95 && phase !== 'trough' && phase !== 'descending') {
            const adj = getReadinessHighAdjustments(phase);
            const adjStr = formatAdjustments(adj);
            if (adjStr) {
                modifiers.push({
                    condition: { readiness: `>${avgP70Readiness}`, logic: 'and' } as FlexibleCondition,
                    adjustments: {
                        ...adj,
                        message: `High readiness for ${phaseLabel} (>${avgP70Readiness}%). ${adjStr}`
                    },
                    priority: priority++,
                    cyclePhase: phase
                });
            }
        }
    }

    // Generate modifiers per named phase (for block-based programs) - TWO TIERS
    for (const [phaseName, phaseWeeks] of nameGroups) {
        if (phaseWeeks.length < 2) continue;

        // Standard tier
        const avgP30Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP30, 0) / phaseWeeks.length);
        const avgP70Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP70, 0) / phaseWeeks.length);

        // Extreme tier
        const avgP15Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP15, 0) / phaseWeeks.length);
        const avgP85Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP85, 0) / phaseWeeks.length);

        // === EXTREME TIER for named phases ===

        // Extreme high fatigue during phase
        if (avgP85Fatigue <= 95 && avgP85Fatigue > avgP70Fatigue) {
            modifiers.push({
                condition: { fatigue: `>${avgP85Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    powerMultiplier: 0.85,
                    rpeAdjust: -2,
                    restMultiplier: 1.3,
                    message: `Very high fatigue during ${phaseName} (>${avgP85Fatigue}%). Power -15%, RPE -2, Rest +30%`
                },
                priority: priority++,
                phaseName: phaseName
            });
        }

        // Extreme low fatigue during phase
        if (avgP15Fatigue >= 5 && avgP15Fatigue < avgP30Fatigue) {
            modifiers.push({
                condition: { fatigue: `<${avgP15Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    powerMultiplier: 1.12,
                    volumeMultiplier: 1.15,
                    message: `Very low fatigue during ${phaseName} (<${avgP15Fatigue}%). Power +12%, Volume +15%`
                },
                priority: priority++,
                phaseName: phaseName
            });
        }

        // === STANDARD TIER for named phases ===

        // Standard high fatigue during phase
        if (avgP70Fatigue <= 95) {
            modifiers.push({
                condition: { fatigue: `>${avgP70Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    powerMultiplier: 0.90,
                    rpeAdjust: -1,
                    message: `High fatigue during ${phaseName} (>${avgP70Fatigue}%). Power -10%, RPE -1`
                },
                priority: priority++,
                phaseName: phaseName
            });
        }

        // Standard low fatigue during phase
        if (avgP30Fatigue >= 5) {
            modifiers.push({
                condition: { fatigue: `<${avgP30Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    powerMultiplier: 1.08,
                    message: `Low fatigue during ${phaseName} (<${avgP30Fatigue}%). Power +8%`
                },
                priority: priority++,
                phaseName: phaseName
            });
        }
    }

    // =========================================================================
    // COMBINED CONDITION MODIFIERS
    // These trigger when BOTH fatigue AND readiness meet certain thresholds
    // =========================================================================

    // Calculate overall program averages for dynamic thresholds
    const avgFatigue = Math.round(weekAnalyses.reduce((s, w) => s + w.fatigueP50, 0) / weekAnalyses.length);
    const avgReadiness = Math.round(weekAnalyses.reduce((s, w) => s + w.readinessP50, 0) / weekAnalyses.length);

    // HIGH FATIGUE + LOW READINESS = Maximum intervention needed
    // This is the most concerning state - athlete is both tired AND not recovering
    modifiers.push({
        condition: { fatigue: `>${Math.max(60, avgFatigue + 15)}`, readiness: `<${Math.min(40, avgReadiness - 10)}`, logic: 'and' } as FlexibleCondition,
        adjustments: {
            powerMultiplier: 0.75,
            rpeAdjust: -2,
            volumeMultiplier: 0.70,
            restMultiplier: 1.5,
            message: `High fatigue with low readiness. Reduce power to 75%, lower RPE by 2, cut volume by 30%. Focus on completing the session, not intensity.`
        },
        priority: 2 // Very high priority
    });

    // HIGH FATIGUE + MODERATE READINESS = Moderate intervention
    modifiers.push({
        condition: { fatigue: `>${Math.max(55, avgFatigue + 10)}`, readiness: `<${Math.min(55, avgReadiness)}`, logic: 'and' } as FlexibleCondition,
        adjustments: {
            powerMultiplier: 0.88,
            rpeAdjust: -1,
            restMultiplier: 1.25,
            message: `Elevated fatigue with below-average readiness. Reduce power to 88%, target 1 RPE lower. Allow extra rest between intervals.`
        },
        priority: 8
    });

    // LOW FATIGUE + HIGH READINESS = Can push harder (avoid during recovery phases)
    modifiers.push({
        condition: { fatigue: `<${Math.min(35, avgFatigue - 10)}`, readiness: `>${Math.max(65, avgReadiness + 10)}`, logic: 'and' } as FlexibleCondition,
        adjustments: {
            powerMultiplier: 1.12,
            volumeMultiplier: 1.15,
            message: `Low fatigue with high readiness - excellent state for pushing harder. Increase power by 12%, extend session by 15%.`
        },
        priority: 15,
        cyclePhase: ['ascending', 'peak'] // Only during build phases
    });

    // MODERATE FATIGUE + HIGH READINESS = Good state, slight push okay
    modifiers.push({
        condition: { fatigue: `<${avgFatigue + 5}`, readiness: `>${Math.max(60, avgReadiness + 5)}`, logic: 'and' } as FlexibleCondition,
        adjustments: {
            powerMultiplier: 1.05,
            message: `Good recovery despite moderate training load. Consider increasing power by 5% if form feels good.`
        },
        priority: 20,
        cyclePhase: ['ascending', 'peak']
    });

    // =========================================================================
    // OVERLOAD PROTECTION MODIFIERS (Critical safety nets)
    // These have highest priority to prevent non-functional overreaching
    // =========================================================================

    // CRITICAL: Very high fatigue threshold (85%+) - forced deload
    modifiers.push({
        condition: { fatigue: '>85', logic: 'and' } as FlexibleCondition,
        adjustments: {
            powerMultiplier: 0.70,
            rpeAdjust: -3,
            volumeMultiplier: 0.50,
            restMultiplier: 2.0,
            message: `Critical fatigue level detected (>85%). Mandatory deload: power at 70%, volume halved, double rest. Consider taking a complete rest day.`
        },
        priority: 1 // Highest priority
    });

    // CRITICAL: Very low readiness (<25%) - active recovery only
    modifiers.push({
        condition: { readiness: '<25', logic: 'and' } as FlexibleCondition,
        adjustments: {
            powerMultiplier: 0.60,
            rpeAdjust: -3,
            volumeMultiplier: 0.40,
            message: `Very low readiness (<25%). Active recovery only: power at 60%, RPE should feel easy. Skip any high-intensity work today.`
        },
        priority: 1
    });

    // WARNING: Sustained high fatigue (>75%) - proactive intervention
    modifiers.push({
        condition: { fatigue: '>75', logic: 'and' } as FlexibleCondition,
        adjustments: {
            powerMultiplier: 0.82,
            rpeAdjust: -2,
            volumeMultiplier: 0.75,
            restMultiplier: 1.5,
            message: `Sustained high fatigue (>75%). Pre-emptive load reduction: power at 82%, volume at 75%. Monitor recovery closely.`
        },
        priority: 4
    });

    // Global trend modifiers
    if (globalTrend === 'declining' || adaptationScore < -0.3) {
        modifiers.push({
            condition: { readiness: '<40', logic: 'and' } as FlexibleCondition,
            adjustments: {
                powerMultiplier: 0.75,
                rpeAdjust: -2,
                volumeMultiplier: 0.7,
                restMultiplier: 1.5,
                message: 'Declining adaptation trend detected. Significant load reduction needed: power at 75%, volume at 70%, extra rest.'
            },
            priority: 3
        });
    }

    if (globalTrend === 'improving' && adaptationScore > 0.5) {
        modifiers.push({
            condition: { readiness: '>75', fatigue: '<50', logic: 'and' } as FlexibleCondition,
            adjustments: {
                powerMultiplier: 1.12,
                volumeMultiplier: 1.15,
                message: 'Excellent adaptation trend. Push harder today: power +12%, volume +15%.'
            },
            priority: priority++
        });
    }

    // =========================================================================
    // SESSION-TYPE-SPECIFIC MODIFIERS
    // Generate modifiers tailored to the session types in this program
    // =========================================================================

    // For programs with INTERVAL sessions: use restMultiplier for recovery
    if (hasIntervals || hasCustom) {
        // High fatigue → longer rest between intervals
        modifiers.push({
            condition: { fatigue: `>${Math.max(60, avgFatigue + 10)}`, logic: 'and' } as FlexibleCondition,
            adjustments: {
                powerMultiplier: 0.92,
                restMultiplier: 1.3,
                message: `High fatigue for intervals. Target 92% power, take 30% longer rest between sets.`
            },
            sessionType: hasCustom ? 'custom' : 'interval',
            priority: priority++
        });

        // Very high fatigue → much longer rest
        modifiers.push({
            condition: { fatigue: '>75', logic: 'and' } as FlexibleCondition,
            adjustments: {
                powerMultiplier: 0.85,
                restMultiplier: 1.5,
                message: `Very high fatigue for intervals. Target 85% power, 50% longer rest between sets.`
            },
            sessionType: hasCustom ? 'custom' : 'interval',
            priority: 6
        });
    }

    // For programs with STEADY-STATE sessions: use durationMultiplier
    if (hasSteadyState || hasCustom) {
        // High fatigue → shorter session
        modifiers.push({
            condition: { fatigue: `>${Math.max(60, avgFatigue + 10)}`, logic: 'and' } as FlexibleCondition,
            adjustments: {
                powerMultiplier: 0.92,
                durationMultiplier: 0.85,
                message: `High fatigue for steady-state. Target 92% power, reduce duration by 15%.`
            },
            sessionType: hasCustom ? 'custom' : 'steady-state',
            priority: priority++
        });

        // Very high fatigue → much shorter session
        modifiers.push({
            condition: { fatigue: '>75', logic: 'and' } as FlexibleCondition,
            adjustments: {
                powerMultiplier: 0.85,
                durationMultiplier: 0.70,
                message: `Very high fatigue for steady-state. Target 85% power, reduce session to 70% duration.`
            },
            sessionType: hasCustom ? 'custom' : 'steady-state',
            priority: 6
        });
    }

    return modifiers;
}

// ============================================================================
// HELPERS
// ============================================================================

function getPhaseLabel(phase: CyclePhase): string {
    const labels: Record<CyclePhase, string> = {
        ascending: 'ascending/build phases',
        peak: 'peak intensity weeks',
        descending: 'descending/consolidation phases',
        trough: 'recovery periods'
    };
    return labels[phase];
}

/**
 * Format adjustments into an actionable, athlete-friendly string.
 * Uses clear directives like "Target power at X%" instead of technical "Power -Y%".
 */
function formatAdjustments(adj: Partial<FatigueModifier['adjustments']>): string {
    const parts: string[] = [];

    if (adj.powerMultiplier !== undefined) {
        const pct = Math.round(adj.powerMultiplier * 100);
        if (adj.powerMultiplier < 1) {
            parts.push(`Target power at ${pct}%`);
        } else if (adj.powerMultiplier > 1) {
            parts.push(`Push power to ${pct}%`);
        }
    }

    if (adj.rpeAdjust !== undefined && adj.rpeAdjust !== 0) {
        if (adj.rpeAdjust < 0) {
            parts.push(`aim for ${Math.abs(adj.rpeAdjust)} RPE lower than planned`);
        } else {
            parts.push(`push RPE ${adj.rpeAdjust} higher`);
        }
    }

    if (adj.volumeMultiplier !== undefined && adj.volumeMultiplier !== 1) {
        const pct = Math.round(adj.volumeMultiplier * 100);
        if (adj.volumeMultiplier < 1) {
            parts.push(`reduce volume to ${pct}%`);
        } else {
            parts.push(`extend session to ${pct}% duration`);
        }
    }

    if (adj.restMultiplier !== undefined && adj.restMultiplier > 1) {
        const extra = Math.round((adj.restMultiplier - 1) * 100);
        parts.push(`take ${extra}% longer rest intervals`);
    }

    if (parts.length === 0) return '';

    // Capitalize first letter and join with commas
    const result = parts.join(', ');
    return result.charAt(0).toUpperCase() + result.slice(1) + '.';
}

function getFatigueHighAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 0.92, rpeAdjust: -1 },
        peak: { powerMultiplier: 0.88, rpeAdjust: -1, restMultiplier: 1.3 },
        descending: { powerMultiplier: 0.90 },
        trough: { powerMultiplier: 0.85, restMultiplier: 1.5 }
    };
    return adjustments[phase];
}

function getFatigueLowAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    // For descending/trough phases, DON'T suggest intensity increases - that defeats the purpose
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 1.08, volumeMultiplier: 1.1 },
        peak: { powerMultiplier: 1.05 },
        descending: { powerMultiplier: 1.0 },  // Maintain, don't increase
        trough: { powerMultiplier: 1.0 }       // Maintain, don't increase
    };
    return adjustments[phase];
}

function getReadinessLowAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 0.88, rpeAdjust: -1, restMultiplier: 1.25 },
        peak: { powerMultiplier: 0.85, rpeAdjust: -2, restMultiplier: 1.5 },
        descending: { powerMultiplier: 0.90, rpeAdjust: -1, restMultiplier: 1.25 },
        trough: { powerMultiplier: 0.80, rpeAdjust: -2, restMultiplier: 1.75 }
    };
    return adjustments[phase];
}

function getReadinessHighAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    // For descending/trough phases, DON'T suggest increases
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 1.10, volumeMultiplier: 1.15 },
        peak: { powerMultiplier: 1.08 },
        descending: { powerMultiplier: 1.0 },
        trough: { powerMultiplier: 1.0 }
    };
    return adjustments[phase];
}

// === EXTREME TIER ADJUSTMENTS (for P15/P85 thresholds) ===

function getFatigueExtremeHighAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 0.85, rpeAdjust: -2, restMultiplier: 1.3 },
        peak: { powerMultiplier: 0.80, rpeAdjust: -2, restMultiplier: 1.5 },
        descending: { powerMultiplier: 0.82, rpeAdjust: -1, restMultiplier: 1.3 },
        trough: { powerMultiplier: 0.75, restMultiplier: 1.75 }
    };
    return adjustments[phase];
}

function getFatigueExtremeLowAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 1.12, volumeMultiplier: 1.15 },
        peak: { powerMultiplier: 1.10, volumeMultiplier: 1.08 },
        descending: { powerMultiplier: 1.0 },
        trough: { powerMultiplier: 1.0 }
    };
    return adjustments[phase];
}

function getReadinessExtremeLowAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 0.80, rpeAdjust: -2, restMultiplier: 1.5 },
        peak: { powerMultiplier: 0.75, rpeAdjust: -2, restMultiplier: 1.75 },
        descending: { powerMultiplier: 0.82, rpeAdjust: -2, restMultiplier: 1.5 },
        trough: { powerMultiplier: 0.70, rpeAdjust: -2, restMultiplier: 2.0 }
    };
    return adjustments[phase];
}

function getReadinessExtremeHighAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 1.15, volumeMultiplier: 1.20 },
        peak: { powerMultiplier: 1.12, volumeMultiplier: 1.10 },
        descending: { powerMultiplier: 1.0 },
        trough: { powerMultiplier: 1.0 }
    };
    return adjustments[phase];
}

// ============================================================================
// MAIN ENTRY POINTS
// ============================================================================

export function suggestModifiers(
    weeks: WeekDefinition[],
    basePower: number = 200,
    numSimulations: number = 100000
): FatigueModifier[] {
    if (weeks.length === 0) return [];

    const numWeeks = weeks.length;
    const fatigueData: number[][] = Array.from({ length: numWeeks }, () => []);
    const readinessData: number[][] = Array.from({ length: numWeeks }, () => []);

    for (let sim = 0; sim < numSimulations; sim++) {
        const { dailyFatigue, dailyReadiness } = runSingleSimulation(weeks, basePower);
        for (let w = 0; w < numWeeks; w++) {
            fatigueData[w].push(dailyFatigue[(w + 1) * 7 - 1]);
            readinessData[w].push(dailyReadiness[(w + 1) * 7 - 1]);
        }
    }

    const analysis = runFullAnalysis(weeks, basePower, numSimulations, fatigueData, readinessData);
    return generateSmartModifiers(analysis, weeks);
}

export async function suggestModifiersAsync(
    weeks: WeekDefinition[],
    basePower: number = 200,
    numSimulations: number = 100000,
    onProgress?: (progress: number) => void
): Promise<FatigueModifier[]> {
    if (weeks.length === 0) return [];

    const numWeeks = weeks.length;
    const BATCH_SIZE = 5000;

    const fatigueData: number[][] = Array.from({ length: numWeeks }, () => []);
    const readinessData: number[][] = Array.from({ length: numWeeks }, () => []);

    for (let batchStart = 0; batchStart < numSimulations; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, numSimulations);

        for (let sim = batchStart; sim < batchEnd; sim++) {
            const { dailyFatigue, dailyReadiness } = runSingleSimulation(weeks, basePower);
            for (let w = 0; w < numWeeks; w++) {
                fatigueData[w].push(dailyFatigue[(w + 1) * 7 - 1]);
                readinessData[w].push(dailyReadiness[(w + 1) * 7 - 1]);
            }
        }

        if (onProgress) onProgress(batchEnd / numSimulations);
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    const analysis = runFullAnalysis(weeks, basePower, numSimulations, fatigueData, readinessData);
    return generateSmartModifiers(analysis, weeks);
}
