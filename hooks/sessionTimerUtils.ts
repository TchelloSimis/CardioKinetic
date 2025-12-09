import { Capacitor } from '@capacitor/core';
import { SessionSetupParams, SessionBlock } from '../types';

/**
 * Check if running on Android native platform
 */
export const isAndroid = (): boolean => {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

/**
 * Compute weighted average from history entries
 */
export const computeWeightedAvg = (
    history: Array<{ value: number; startTime: number }>,
    endTime: number = Date.now()
): number => {
    if (history.length === 0) return 0;
    let totalWeight = 0;
    let weightedSum = 0;
    for (let i = 0; i < history.length; i++) {
        const end = i < history.length - 1 ? history[i + 1].startTime : endTime;
        const duration = end - history[i].startTime;
        weightedSum += history[i].value * duration;
        totalWeight += duration;
    }
    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : history[0].value;
};

/**
 * Compute actual work:rest ratio from time spent
 */
export const computeActualRatio = (workSecs: number, restSecs: number): string => {
    if (restSecs === 0) return 'steady';
    const total = workSecs + restSecs;
    if (total === 0) return '1:1';
    const workPct = Math.round((workSecs / total) * 10);
    const restPct = 10 - workPct;
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const d = gcd(workPct, restPct) || 1;
    return `${workPct / d}:${restPct / d}`;
};

/**
 * Calculate total intervals based on session duration and interval lengths
 */
export const calculateTotalIntervals = (params: SessionSetupParams): number => {
    if (params.sessionStyle === 'steady-state') {
        return 1;
    }

    const totalSeconds = params.totalDurationMinutes * 60;
    const cycleLength = params.workDurationSeconds + params.restDurationSeconds;

    if (cycleLength <= 0) return 1;

    return Math.floor(totalSeconds / cycleLength);
};

/**
 * Calculate work/rest power based on target power and durations
 */
export const calculatePhasePowers = (params: SessionSetupParams): { workPower: number; restPower: number } => {
    const totalCycle = params.workDurationSeconds + params.restDurationSeconds;
    const recoveryRatio = 0.5;

    if (params.sessionStyle === 'interval' && totalCycle > 0) {
        const workPower = Math.round(
            (params.targetPower * totalCycle) /
            (params.workDurationSeconds + recoveryRatio * params.restDurationSeconds)
        );
        const restPower = Math.round(workPower * recoveryRatio);
        return { workPower, restPower };
    }

    return { workPower: params.targetPower, restPower: params.targetPower };
};

// Timer constants
export const TICK_INTERVAL = 100; // milliseconds - 100ms for smooth countdown
export const STEADY_REMINDER_INTERVAL = 60; // seconds

// ============================================================================
// CUSTOM SESSION BLOCK UTILITIES
// ============================================================================

/**
 * Parse work:rest ratio string into parts
 */
export const parseRatio = (ratio: string): { work: number; rest: number } => {
    if (ratio === 'steady' || ratio === '1:0') {
        return { work: 1, rest: 0 };
    }
    const parts = ratio.split(':').map(Number);
    return {
        work: parts[0] || 1,
        rest: parts[1] || 1
    };
};

/**
 * Calculate the total duration of a custom session from its blocks
 */
export const calculateCustomSessionDuration = (blocks: SessionBlock[]): number => {
    return blocks.reduce((total, block) => total + block.durationMinutes, 0);
};

/**
 * Calculate projected average power for a custom session
 * Weights power by duration of each block
 */
export const calculateProjectedAveragePower = (
    blocks: SessionBlock[],
    targetPower: number
): number => {
    if (blocks.length === 0) return targetPower;

    let totalPowerMinutes = 0;
    let totalMinutes = 0;

    for (const block of blocks) {
        const blockPower = targetPower * block.powerMultiplier;
        totalPowerMinutes += blockPower * block.durationMinutes;
        totalMinutes += block.durationMinutes;
    }

    if (totalMinutes === 0) return targetPower;
    return Math.round(totalPowerMinutes / totalMinutes);
};

/**
 * Calculate projected total work (in Wh) for a custom session
 */
export const calculateProjectedTotalWork = (
    blocks: SessionBlock[],
    targetPower: number
): number => {
    const avgPower = calculateProjectedAveragePower(blocks, targetPower);
    const totalMinutes = calculateCustomSessionDuration(blocks);
    // Work (Wh) = Power (W) × Time (hours)
    return Math.round(avgPower * (totalMinutes / 60) * 100) / 100;
};

/**
 * Calculate intervals for a single block based on its duration and work/rest settings
 */
export const calculateBlockIntervals = (block: SessionBlock): number => {
    if (block.type === 'steady-state') {
        return 1;
    }

    const totalSeconds = block.durationMinutes * 60;
    const ratio = parseRatio(block.workRestRatio || '1:1');
    const totalParts = ratio.work + ratio.rest;

    // Default to 30s base cycle if no explicit durations
    const workSeconds = block.workDurationSeconds || Math.round((ratio.work / totalParts) * 60);
    const restSeconds = block.restDurationSeconds || Math.round((ratio.rest / totalParts) * 60);
    const cycleLength = workSeconds + restSeconds;

    if (cycleLength <= 0) return 1;

    // If explicit cycles are defined, use that
    if (block.cycles) {
        return block.cycles;
    }

    return Math.floor(totalSeconds / cycleLength);
};

/**
 * Calculate work/rest power for a specific block
 */
export const calculateBlockPhasePowers = (
    block: SessionBlock,
    targetPower: number,
    recoveryRatio: number = 0.5
): { workPower: number; restPower: number } => {
    const blockTargetPower = Math.round(targetPower * block.powerMultiplier);

    if (block.type === 'steady-state') {
        return { workPower: blockTargetPower, restPower: blockTargetPower };
    }

    // For interval blocks
    const ratio = parseRatio(block.workRestRatio || '1:1');
    const totalParts = ratio.work + ratio.rest;
    const workSeconds = block.workDurationSeconds || Math.round((ratio.work / totalParts) * 60);
    const restSeconds = block.restDurationSeconds || Math.round((ratio.rest / totalParts) * 60);
    const cycleLength = workSeconds + restSeconds;

    if (cycleLength > 0) {
        const workPower = Math.round(
            (blockTargetPower * cycleLength) /
            (workSeconds + recoveryRatio * restSeconds)
        );
        const restPower = Math.round(workPower * recoveryRatio);
        return { workPower, restPower };
    }

    return { workPower: blockTargetPower, restPower: blockTargetPower };
};

/**
 * Get work and rest durations for a block
 */
export const getBlockDurations = (block: SessionBlock): { workSeconds: number; restSeconds: number } => {
    if (block.type === 'steady-state') {
        return { workSeconds: block.durationMinutes * 60, restSeconds: 0 };
    }

    const ratio = parseRatio(block.workRestRatio || '1:1');
    const totalParts = ratio.work + ratio.rest;

    return {
        workSeconds: block.workDurationSeconds || Math.round((ratio.work / totalParts) * 60),
        restSeconds: block.restDurationSeconds || Math.round((ratio.rest / totalParts) * 60)
    };
};

/**
 * Generate a unique ID for a new block
 */
export const generateBlockId = (): string => {
    return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

