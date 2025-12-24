/**
 * useSessionTimer - Timer Core
 * 
 * Core timer logic and interval management.
 */

import { LiveSessionState, SessionSetupParams, SessionBlock } from '../../types';
import {
    TICK_INTERVAL,
    STEADY_REMINDER_INTERVAL,
    calculateTotalIntervals,
    calculatePhasePowers,
    calculateCustomSessionDuration,
    calculateBlockIntervals,
    calculateBlockPhasePowers,
    getBlockDurations
} from '../sessionTimerUtils';
import { playAudioCue } from '../../utils/audioService';
import { SessionRefs, INITIAL_STATE } from './types';

// ============================================================================
// COUNTDOWN AUDIO
// ============================================================================

/**
 * Handle countdown audio for phase/block transitions
 */
export function handleCountdownAudio(
    params: SessionSetupParams,
    newState: LiveSessionState,
    refs: SessionRefs
): void {
    if (refs.sessionComplete) return;

    if (params.sessionStyle === 'custom' && newState.blockTimeRemaining !== undefined) {
        const blockTimeRemaining = newState.blockTimeRemaining;
        const isIntervalBlock = newState.currentBlockType === 'interval';

        if (isIntervalBlock) {
            const nearPhaseEnd = newState.phaseTimeRemaining <= 3 && newState.phaseTimeRemaining > 0;
            const nearBlockEnd = blockTimeRemaining <= 3 && blockTimeRemaining > 0;

            if (nearBlockEnd) {
                const second = Math.ceil(blockTimeRemaining);
                if (second !== refs.lastCountdownSecond && second <= 3) {
                    refs.lastCountdownSecond = second;
                    playAudioCue('countdown');
                }
            } else if (nearPhaseEnd && !nearBlockEnd) {
                const second = Math.ceil(newState.phaseTimeRemaining);
                if (second !== refs.lastCountdownSecond && second <= 3) {
                    refs.lastCountdownSecond = second;
                    playAudioCue('countdown');
                }
            }
        } else {
            if (blockTimeRemaining <= 3 && blockTimeRemaining > 0) {
                const second = Math.ceil(blockTimeRemaining);
                if (second !== refs.lastCountdownSecond && second <= 3) {
                    refs.lastCountdownSecond = second;
                    playAudioCue('countdown');
                }
            }
        }
    } else {
        const isInIntervalMode = params.sessionStyle === 'interval';
        if (isInIntervalMode &&
            newState.phaseTimeRemaining <= 3 &&
            newState.phaseTimeRemaining > 0) {
            const second = Math.ceil(newState.phaseTimeRemaining);
            if (second !== refs.lastCountdownSecond && second <= 3) {
                refs.lastCountdownSecond = second;
                playAudioCue('countdown');
            }
        }
    }
}

/**
 * Handle halfway point audio
 */
export function handleHalfwayAudio(
    params: SessionSetupParams,
    newState: LiveSessionState,
    refs: SessionRefs
): void {
    if (refs.halfwayPlayed) return;

    const totalDurationSeconds = params.sessionStyle === 'custom' && params.blocks
        ? calculateCustomSessionDuration(params.blocks) * 60
        : params.totalDurationMinutes * 60;

    if (newState.sessionTimeElapsed >= totalDurationSeconds / 2) {
        refs.halfwayPlayed = true;
        playAudioCue('halfway');
    }
}

/**
 * Handle steady-state reminders
 */
export function handleSteadyReminder(
    params: SessionSetupParams,
    newState: LiveSessionState,
    refs: SessionRefs
): void {
    const isInSteadyBlock = params.sessionStyle === 'steady-state' ||
        (params.sessionStyle === 'custom' && newState.currentBlockType === 'steady-state');

    if (isInSteadyBlock) {
        const elapsed = Math.floor(newState.blockTimeElapsed ?? newState.sessionTimeElapsed);
        if (elapsed > 0 && elapsed % STEADY_REMINDER_INTERVAL === 0 && elapsed !== refs.lastSteadyReminder) {
            refs.lastSteadyReminder = elapsed;
            playAudioCue('steady_reminder');
        }
    }
}

// ============================================================================
// STATE INITIALIZATION
// ============================================================================

/**
 * Initialize state for a custom session
 */
export function initCustomSessionState(
    params: SessionSetupParams,
    refs: SessionRefs
): LiveSessionState {
    const blocks = params.blocks!;
    const totalDuration = calculateCustomSessionDuration(blocks);
    const totalSessionSeconds = totalDuration * 60;

    const firstBlock = blocks[0];
    const firstBlockPowers = calculateBlockPhasePowers(firstBlock, params.targetPower);
    const firstBlockDurations = getBlockDurations(firstBlock);
    const firstBlockIntervals = calculateBlockIntervals(firstBlock);
    const firstBlockDurationSeconds = firstBlock.durationMinutes * 60;

    // Update refs
    refs.currentBlockPowers = firstBlockPowers;
    refs.initialWorkPower = firstBlockPowers.workPower;
    refs.initialRestPower = firstBlockPowers.restPower;
    refs.phaseLog = [{ timeSeconds: 0, power: firstBlockPowers.workPower, phase: 'work' }];

    return {
        isActive: true,
        isPaused: false,
        sessionStyle: 'custom',
        currentPhase: 'work',
        currentInterval: 1,
        totalIntervals: firstBlockIntervals,
        phaseTimeRemaining: firstBlock.type === 'steady-state'
            ? firstBlockDurationSeconds
            : firstBlockDurations.workSeconds,
        sessionTimeElapsed: 0,
        sessionTimeRemaining: totalSessionSeconds,
        workDurationSeconds: firstBlockDurations.workSeconds,
        restDurationSeconds: firstBlockDurations.restSeconds,
        targetPower: params.targetPower,
        targetRPE: params.targetRPE,
        currentBlockIndex: 0,
        totalBlocks: blocks.length,
        blockTimeRemaining: firstBlockDurationSeconds,
        blockTimeElapsed: 0,
        currentBlockType: firstBlock.type,
        blocks: blocks,
    };
}

/**
 * Initialize state for a standard session
 */
export function initStandardSessionState(
    params: SessionSetupParams,
    refs: SessionRefs
): LiveSessionState {
    const totalIntervals = calculateTotalIntervals(params);
    const totalSessionSeconds = params.totalDurationMinutes * 60;
    const initialPhaseTime = params.sessionStyle === 'steady-state'
        ? totalSessionSeconds
        : params.workDurationSeconds;

    const { workPower, restPower } = calculatePhasePowers(params);
    refs.initialWorkPower = workPower;
    refs.initialRestPower = restPower;
    refs.phaseLog = [{ timeSeconds: 0, power: workPower, phase: 'work' }];

    return {
        isActive: true,
        isPaused: false,
        sessionStyle: params.sessionStyle,
        currentPhase: 'work',
        currentInterval: 1,
        totalIntervals,
        phaseTimeRemaining: initialPhaseTime,
        sessionTimeElapsed: 0,
        sessionTimeRemaining: totalSessionSeconds,
        workDurationSeconds: params.workDurationSeconds,
        restDurationSeconds: params.restDurationSeconds,
        targetPower: params.targetPower,
        targetRPE: params.targetRPE,
    };
}

// Re-export constants
export { TICK_INTERVAL, STEADY_REMINDER_INTERVAL };
