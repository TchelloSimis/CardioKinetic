/**
 * Auto-Adaptive Modifiers Engine
 * 
 * Calculates smart training adjustments based on current metrics vs expected percentiles.
 * Implements session-type-aware adjustments including block-by-block for custom sessions.
 */

import { SessionBlock, SessionStyle } from '../types';
import { FatigueContext } from '../programTemplate';
import {
    WeekPercentiles,
    AutoAdaptiveAdjustment,
    BlockAdjustment,
    BlockRole,
    AdaptiveState,
    DeviationTier,
    DeviationDirection,
} from './autoAdaptiveTypes';

// ============================================================================
// STATE CLASSIFICATION
// ============================================================================

/**
 * Classify deviation direction based on current value vs percentiles.
 */
function classifyDeviation(
    value: number,
    p15: number,
    p30: number,
    p70: number,
    p85: number,
    invert: boolean = false
): { direction: DeviationDirection; tier: DeviationTier } {
    // For fatigue: high = bad, low = good
    // For readiness: high = good, low = bad
    // invert=true for readiness (we want high readiness to be 'high' direction)

    if (!invert) {
        // Fatigue-style: higher values mean worse condition
        if (value >= p85) return { direction: 'high', tier: 'extreme' };
        if (value >= p70) return { direction: 'high', tier: 'moderate' };
        if (value <= p15) return { direction: 'low', tier: 'extreme' };
        if (value <= p30) return { direction: 'low', tier: 'moderate' };
    } else {
        // Readiness-style: lower values mean worse condition  
        if (value <= p15) return { direction: 'low', tier: 'extreme' };
        if (value <= p30) return { direction: 'low', tier: 'moderate' };
        if (value >= p85) return { direction: 'high', tier: 'extreme' };
        if (value >= p70) return { direction: 'high', tier: 'moderate' };
    }

    return { direction: 'normal', tier: 'none' };
}

/**
 * Classify the overall adaptive state from fatigue and readiness deviations.
 */
function classifyState(
    fatigueDir: DeviationDirection,
    readinessDir: DeviationDirection
): AdaptiveState {
    // High fatigue + Low readiness = Critical
    if (fatigueDir === 'high' && readinessDir === 'low') return 'critical';

    // High fatigue + Normal readiness = Stressed
    if (fatigueDir === 'high' && readinessDir === 'normal') return 'stressed';

    // Normal fatigue + Low readiness = Tired
    if (fatigueDir === 'normal' && readinessDir === 'low') return 'tired';

    // Low fatigue + High readiness = Primed
    if (fatigueDir === 'low' && readinessDir === 'high') return 'primed';

    // Normal fatigue + High readiness = Fresh
    if (fatigueDir === 'normal' && readinessDir === 'high') return 'fresh';

    // All other cases = Baseline
    return 'baseline';
}

// ============================================================================
// BLOCK ROLE IDENTIFICATION
// ============================================================================

/**
 * Identify the role of a block based on position and characteristics.
 */
export function identifyBlockRole(
    block: SessionBlock,
    index: number,
    totalBlocks: number,
    allBlocks: SessionBlock[]
): BlockRole {
    // Single block = main
    if (totalBlocks === 1) return 'main';

    // First block with low power = warmup
    if (index === 0 && block.powerMultiplier < 0.75) return 'warmup';

    // Last block with low power = cooldown
    if (index === totalBlocks - 1 && block.powerMultiplier < 0.7) return 'cooldown';

    // Check if this is a transition block (short duration, between main sets)
    const isShort = block.durationMinutes < 3;
    const prevBlock = index > 0 ? allBlocks[index - 1] : null;
    const nextBlock = index < totalBlocks - 1 ? allBlocks[index + 1] : null;

    if (isShort && prevBlock && nextBlock) {
        const prevIsMain = prevBlock.powerMultiplier >= 0.8;
        const nextIsMain = nextBlock.powerMultiplier >= 0.8;
        if (prevIsMain && nextIsMain) return 'transition';
    }

    // Everything else is main
    return 'main';
}

// ============================================================================
// ADJUSTMENT CALCULATIONS
// ============================================================================

interface AdjustmentParams {
    powerMultiplier: number;
    rpeAdjust: number;
    restMultiplier?: number;
    durationMultiplier?: number;
}

/**
 * Get adjustments for interval sessions.
 */
function getIntervalAdjustments(state: AdaptiveState, tier: DeviationTier): AdjustmentParams {
    const isExtreme = tier === 'extreme';

    switch (state) {
        case 'critical':
            return {
                powerMultiplier: isExtreme ? 0.80 : 0.85,
                rpeAdjust: isExtreme ? -2 : -1.5,
                restMultiplier: isExtreme ? 2.0 : 1.75,
            };
        case 'stressed':
            return {
                powerMultiplier: isExtreme ? 0.85 : 0.90,
                rpeAdjust: isExtreme ? -1.5 : -1,
                restMultiplier: isExtreme ? 1.75 : 1.5,
            };
        case 'tired':
            return {
                powerMultiplier: 0.95,
                rpeAdjust: -0.5,
                restMultiplier: 1.25,
            };
        case 'fresh':
            return {
                powerMultiplier: 1.05,
                rpeAdjust: 0,
                restMultiplier: 0.9,
            };
        case 'primed':
            return {
                powerMultiplier: isExtreme ? 1.12 : 1.10,
                rpeAdjust: 0.5,
                restMultiplier: isExtreme ? 0.7 : 0.75,
            };
        default: // baseline
            return {
                powerMultiplier: 1.0,
                rpeAdjust: 0,
            };
    }
}

/**
 * Get adjustments for steady-state sessions.
 */
function getSteadyStateAdjustments(state: AdaptiveState, tier: DeviationTier): AdjustmentParams {
    const isExtreme = tier === 'extreme';

    switch (state) {
        case 'critical':
            return {
                powerMultiplier: isExtreme ? 0.80 : 0.85,
                rpeAdjust: isExtreme ? -2 : -1.5,
                durationMultiplier: isExtreme ? 0.6 : 0.7,
            };
        case 'stressed':
            return {
                powerMultiplier: isExtreme ? 0.85 : 0.90,
                rpeAdjust: isExtreme ? -1.5 : -1,
                durationMultiplier: isExtreme ? 0.75 : 0.8,
            };
        case 'tired':
            return {
                powerMultiplier: 0.95,
                rpeAdjust: -0.5,
                durationMultiplier: 0.85,
            };
        case 'fresh':
            return {
                powerMultiplier: 1.05,
                rpeAdjust: 0,
            };
        case 'primed':
            return {
                powerMultiplier: isExtreme ? 1.12 : 1.10,
                rpeAdjust: 0.5,
                durationMultiplier: isExtreme ? 1.2 : 1.15,
            };
        default: // baseline
            return {
                powerMultiplier: 1.0,
                rpeAdjust: 0,
            };
    }
}

/**
 * Get adjustments for a specific block based on its role.
 */
function getBlockAdjustments(
    block: SessionBlock,
    role: BlockRole,
    state: AdaptiveState,
    tier: DeviationTier
): AdjustmentParams {
    // Warmup and cooldown blocks get minimal adjustments
    if (role === 'warmup' || role === 'cooldown') {
        return {
            powerMultiplier: 1.0,
            rpeAdjust: 0,
        };
    }

    // Transition blocks get minimal adjustments
    if (role === 'transition') {
        return {
            powerMultiplier: 1.0,
            rpeAdjust: 0,
        };
    }

    // Main blocks get full adjustments based on block type
    if (block.type === 'interval') {
        return getIntervalAdjustments(state, tier);
    } else {
        return getSteadyStateAdjustments(state, tier);
    }
}

// ============================================================================
// MESSAGE GENERATION
// ============================================================================

/**
 * Context for generating detailed messages with threshold values.
 */
interface MessageContext {
    currentFatigue: number;
    currentReadiness: number;
    fatigueThreshold: number;  // The P70 or P85 that was exceeded (for high fatigue)
    readinessThreshold: number; // The P30 or P15 that was not met (for low readiness)
}

function generateMessage(
    state: AdaptiveState,
    tier: DeviationTier,
    sessionType: SessionStyle,
    adjustment: AdjustmentParams,
    msgContext: MessageContext
): string {
    const tierWord = tier === 'extreme' ? 'significantly' : 'moderately';
    const { currentFatigue, currentReadiness, fatigueThreshold, readinessThreshold } = msgContext;

    // Helper to generate session-type-specific adjustment details
    const getAdjustmentDetails = (): string => {
        if (sessionType === 'interval') {
            return `, rest intervals extended by ${Math.round((adjustment.restMultiplier! - 1) * 100)}%`;
        } else if (sessionType === 'custom') {
            return `. Main blocks adjusted, warmup and cooldown preserved`;
        } else {
            return `, duration reduced by ${Math.round((1 - (adjustment.durationMultiplier || 1)) * 100)}%`;
        }
    };

    const getPositiveAdjustmentDetails = (): string => {
        if (sessionType === 'interval' && adjustment.restMultiplier) {
            return `, rest intervals shortened by ${Math.round((1 - adjustment.restMultiplier) * 100)}%`;
        } else if (sessionType === 'custom') {
            return `. Main blocks boosted, warmup and cooldown preserved`;
        } else if (adjustment.durationMultiplier) {
            return `, duration extended by ${Math.round((adjustment.durationMultiplier - 1) * 100)}%`;
        }
        return '';
    };

    switch (state) {
        case 'critical':
            return `Your fatigue is ${tierWord} above expected ` +
                `(${Math.round(currentFatigue)}% vs expected <${Math.round(fatigueThreshold)}%) ` +
                `and readiness is low (${Math.round(currentReadiness)}% vs expected >${Math.round(readinessThreshold)}%). ` +
                `Power reduced to ${Math.round(adjustment.powerMultiplier * 100)}%, ` +
                `RPE target lowered by ${Math.abs(adjustment.rpeAdjust).toFixed(1)}` +
                `${getAdjustmentDetails()}. ` +
                `Focus on form and recovery.`;

        case 'stressed':
            return `Fatigue is ${tierWord} elevated ` +
                `(${Math.round(currentFatigue)}% vs expected <${Math.round(fatigueThreshold)}%). ` +
                `Power adjusted to ${Math.round(adjustment.powerMultiplier * 100)}%, ` +
                `RPE target lowered by ${Math.abs(adjustment.rpeAdjust).toFixed(1)}` +
                `${getAdjustmentDetails()}. ` +
                `Don't push beyond the adjusted targets.`;

        case 'tired':
            return `Readiness is lower than expected ` +
                `(${Math.round(currentReadiness)}% vs expected >${Math.round(readinessThreshold)}%). ` +
                `Power reduced to ${Math.round(adjustment.powerMultiplier * 100)}%, ` +
                `RPE target lowered by ${Math.abs(adjustment.rpeAdjust).toFixed(1)}` +
                `${getAdjustmentDetails()}. ` +
                `Complete the workout but avoid extra work.`;

        case 'fresh':
            return `You're fresher than typical at this point ` +
                `(readiness ${Math.round(currentReadiness)}% vs expected <${Math.round(readinessThreshold)}%). ` +
                `Power increased to ${Math.round(adjustment.powerMultiplier * 100)}%` +
                `${getPositiveAdjustmentDetails()}. ` +
                `Take advantage of your good recovery.`;

        case 'primed':
            return `Excellent condition - ${tierWord} better than expected! ` +
                `Fatigue ${Math.round(currentFatigue)}% (expected >${Math.round(fatigueThreshold)}%), ` +
                `readiness ${Math.round(currentReadiness)}% (expected <${Math.round(readinessThreshold)}%). ` +
                `Power boosted to ${Math.round(adjustment.powerMultiplier * 100)}%, ` +
                `RPE target raised by ${adjustment.rpeAdjust.toFixed(1)}` +
                `${getPositiveAdjustmentDetails()}. ` +
                `Great opportunity for a breakthrough session.`;

        default:
            return '';
    }
}


// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Calculate automatic adjustments based on current metrics vs expected percentiles.
 * 
 * @param context - Current fatigue/readiness context
 * @param weekPercentiles - Expected percentiles from simulation
 * @param sessionType - Type of session (interval, steady-state, custom)
 * @param blocks - Session blocks (required for custom sessions)
 */
export function calculateAutoAdaptiveAdjustments(
    context: FatigueContext,
    weekPercentiles: WeekPercentiles,
    sessionType: SessionStyle,
    blocks?: SessionBlock[]
): AutoAdaptiveAdjustment {
    // Classify deviations
    const fatigueResult = classifyDeviation(
        context.fatigueScore,
        weekPercentiles.fatigueP15,
        weekPercentiles.fatigueP30,
        weekPercentiles.fatigueP70,
        weekPercentiles.fatigueP85,
        false // fatigue: high is bad
    );

    const readinessResult = classifyDeviation(
        context.readinessScore,
        weekPercentiles.readinessP15,
        weekPercentiles.readinessP30,
        weekPercentiles.readinessP70,
        weekPercentiles.readinessP85,
        true // readiness: low is bad
    );

    // Determine overall state and tier
    const state = classifyState(fatigueResult.direction, readinessResult.direction);
    const tier: DeviationTier = fatigueResult.tier === 'extreme' || readinessResult.tier === 'extreme'
        ? 'extreme'
        : (fatigueResult.tier === 'moderate' || readinessResult.tier === 'moderate' ? 'moderate' : 'none');

    // No adjustment needed for baseline state
    if (state === 'baseline') {
        return {
            isActive: false,
            state,
            tier: 'none',
            fatigueDeviation: fatigueResult.direction,
            readinessDeviation: readinessResult.direction,
            powerMultiplier: 1.0,
            rpeAdjust: 0,
            message: '',
        };
    }

    // Calculate adjustments based on session type
    let adjustment: AdjustmentParams;
    let blockAdjustments: BlockAdjustment[] | undefined;

    if (sessionType === 'custom' && blocks && blocks.length > 0) {
        // Custom sessions get per-block adjustments
        blockAdjustments = blocks.map((block, index) => {
            const role = identifyBlockRole(block, index, blocks.length, blocks);
            const blockAdj = getBlockAdjustments(block, role, state, tier);

            return {
                blockIndex: index,
                role,
                originalType: block.type,
                powerMultiplier: blockAdj.powerMultiplier,
                restMultiplier: block.type === 'interval' ? blockAdj.restMultiplier : undefined,
                durationMultiplier: block.type === 'steady-state' ? blockAdj.durationMultiplier : undefined,
            };
        });

        // Session-level adjustment is average of main block adjustments
        const mainBlocks = blockAdjustments.filter(b => b.role === 'main');
        const avgPower = mainBlocks.length > 0
            ? mainBlocks.reduce((sum, b) => sum + b.powerMultiplier, 0) / mainBlocks.length
            : 1.0;

        adjustment = {
            powerMultiplier: avgPower,
            rpeAdjust: getIntervalAdjustments(state, tier).rpeAdjust, // Use interval RPE adjust as default
        };
    } else if (sessionType === 'interval') {
        adjustment = getIntervalAdjustments(state, tier);
    } else {
        adjustment = getSteadyStateAdjustments(state, tier);
    }

    // Determine threshold values for message context
    const fatigueThreshold = fatigueResult.direction === 'high'
        ? (fatigueResult.tier === 'extreme' ? weekPercentiles.fatigueP85 : weekPercentiles.fatigueP70)
        : (fatigueResult.tier === 'extreme' ? weekPercentiles.fatigueP15 : weekPercentiles.fatigueP30);

    const readinessThreshold = readinessResult.direction === 'low'
        ? (readinessResult.tier === 'extreme' ? weekPercentiles.readinessP15 : weekPercentiles.readinessP30)
        : (readinessResult.tier === 'extreme' ? weekPercentiles.readinessP85 : weekPercentiles.readinessP70);

    const message = generateMessage(state, tier, sessionType, adjustment, {
        currentFatigue: context.fatigueScore,
        currentReadiness: context.readinessScore,
        fatigueThreshold,
        readinessThreshold
    });

    return {
        isActive: true,
        state,
        tier,
        fatigueDeviation: fatigueResult.direction,
        readinessDeviation: readinessResult.direction,
        powerMultiplier: adjustment.powerMultiplier,
        rpeAdjust: adjustment.rpeAdjust,
        restMultiplier: adjustment.restMultiplier,
        durationMultiplier: adjustment.durationMultiplier,
        blockAdjustments,
        message,
    };
}
