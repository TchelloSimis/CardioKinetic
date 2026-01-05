/**
 * useSessionTimer - Session State Management
 * 
 * Handles building session results and state calculations.
 */

import { LiveSessionState, SessionSetupParams, SessionResult, BlockResult } from '../../types';
import { computeWeightedAvg, computeActualRatio, calculateBlockIntervals } from '../sessionTimerUtils';
import { SessionRefs, PhaseLogEntry } from './types';

// ============================================================================
// RESULT BUILDING
// ============================================================================

/**
 * Build session result object from current state and refs
 */
export function buildSessionResult(
    sessionState: LiveSessionState,
    refs: SessionRefs,
    wasCompleted: boolean
): SessionResult {
    const params = refs.setupParams;
    const endTime = Date.now();

    // Commit any pending RPE before building result
    if (refs.pendingRpe) {
        const commitElapsed = (refs.pendingRpe.timestamp - refs.startTime - refs.pausedTime) / 1000;
        refs.rpeHistory.push({
            timeSeconds: Math.round(commitElapsed),
            rpe: refs.pendingRpe.value
        });
        refs.pendingRpe = null;
    }

    const result: SessionResult = {
        actualDurationMinutes: Math.round(sessionState.sessionTimeElapsed / 60 * 10) / 10,
        intervalsCompleted: sessionState.currentInterval,
        totalIntervals: sessionState.totalIntervals,
        targetPower: sessionState.targetPower,
        targetRPE: sessionState.targetRPE,
        workRestRatio: params?.workRestRatio || '1:1',
        sessionStyle: params?.sessionStyle || 'interval',
        wasCompleted,
        isGuidedSession: true,
        averagePower: computeWeightedAvg(refs.powerHistory, endTime),
        averageWorkDuration: computeWeightedAvg(refs.workDurationHistory, endTime),
        averageRestDuration: computeWeightedAvg(refs.restDurationHistory, endTime),
        wasAdjusted: refs.wasAdjusted,
        actualWorkSeconds: Math.round(refs.workPhaseTime),
        actualRestSeconds: Math.round(refs.restPhaseTime),
        actualWorkRestRatio: computeActualRatio(refs.workPhaseTime, refs.restPhaseTime),
        powerHistory: [...refs.phaseLog],
        initialTargetPower: refs.initialTargetPower,
        rpeHistory: refs.rpeHistory.length > 0 ? [...refs.rpeHistory] : undefined,
    };

    // Add custom session block data
    if (params?.sessionStyle === 'custom' && params.blocks && params.blocks.length > 0) {
        result.blocks = params.blocks;
        result.blockResults = [...refs.blockResults];
    }

    return result;
}

/**
 * Create a block result from current block state
 */
export function createBlockResult(
    params: SessionSetupParams,
    refs: SessionRefs,
    blockIndex: number
): BlockResult {
    const block = params.blocks![blockIndex];

    return {
        blockId: block.id,
        blockIndex: blockIndex,
        type: block.type,
        plannedDurationSeconds: block.durationMinutes * 60,
        actualDurationSeconds: refs.blockElapsed,
        plannedPower: Math.round(params.targetPower * block.powerMultiplier),
        averagePower: refs.currentBlockPowers.workPower,
        intervalsCompleted: refs.blockIntervalsCompleted,
        totalIntervals: block.type === 'interval' ? calculateBlockIntervals(block) : undefined,
    };
}

/**
 * Add phase log entry
 */
export function addPhaseLogEntry(
    refs: SessionRefs,
    timeSeconds: number,
    power: number,
    phase: 'work' | 'rest'
): void {
    refs.phaseLog.push({ timeSeconds, power, phase });
}
