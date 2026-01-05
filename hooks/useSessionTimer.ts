import { useState, useCallback, useRef, useEffect } from 'react';
import { LiveSessionState, SessionSetupParams, SessionResult, SessionBlock, BlockResult } from '../types';
import { playAudioCue, initAudioContext, preloadAudio } from '../utils/audioService';
import {
    isAndroid,
    computeWeightedAvg,
    computeActualRatio,
    calculateTotalIntervals,
    calculatePhasePowers,
    TICK_INTERVAL,
    STEADY_REMINDER_INTERVAL,
    // Custom session utilities
    calculateCustomSessionDuration,
    calculateBlockIntervals,
    calculateBlockPhasePowers,
    getBlockDurations,
} from './sessionTimerUtils';
import {
    startNotification,
    updateNotification,
    pauseNotification,
    resumeNotification,
    stopNotification,
    setupNotificationListener,
    BlockInfo,
} from './sessionNotificationService';

interface UseSessionTimerOptions {
    onPhaseChange?: (phase: 'work' | 'rest' | 'complete') => void;
    onIntervalComplete?: (intervalNumber: number) => void;
    onSessionComplete?: (result: SessionResult) => void;
    onTick?: (state: LiveSessionState) => void;
    onBlockChange?: (blockIndex: number, totalBlocks: number) => void; // For custom sessions
}

interface UseSessionTimerReturn {
    state: LiveSessionState;
    start: (params: SessionSetupParams) => void;
    pause: () => void;
    resume: () => void;
    stop: () => SessionResult;
    completeEarly: () => void;
    skipToNextPhase: () => void;
    adjustWorkDuration: (deltaSeconds: number) => void;
    adjustRestDuration: (deltaSeconds: number) => void;
    adjustTargetPower: (deltaWatts: number) => void;
    logRpe: (rpe: number) => void;
    currentRpe: number | null;
    isInitialized: boolean;
    completionResult: SessionResult | null;
}

// Debounce interval for RPE logging (5 seconds)
const RPE_DEBOUNCE_MS = 5000;

const INITIAL_STATE: LiveSessionState = {
    isActive: false,
    isPaused: false,
    sessionStyle: 'interval',
    currentPhase: 'work',
    currentInterval: 0,
    totalIntervals: 0,
    phaseTimeRemaining: 0,
    sessionTimeElapsed: 0,
    sessionTimeRemaining: 0,
    workDurationSeconds: 30,
    restDurationSeconds: 30,
    targetPower: 0,
    targetRPE: 6,
    // Custom session block tracking
    currentBlockIndex: undefined,
    totalBlocks: undefined,
    blockTimeRemaining: undefined,
    blockTimeElapsed: undefined,
    currentBlockType: undefined,
    blocks: undefined,
};

export const useSessionTimer = (
    options: UseSessionTimerOptions = {}
): UseSessionTimerReturn => {
    const { onPhaseChange, onIntervalComplete, onSessionComplete, onTick, onBlockChange } = options;

    const [state, setState] = useState<LiveSessionState>(INITIAL_STATE);
    const [isInitialized, setIsInitialized] = useState(false);

    // Refs for timer management
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);
    const pausedTimeRef = useRef<number>(0);
    const setupParamsRef = useRef<SessionSetupParams | null>(null);
    const lastSteadyReminderRef = useRef<number>(0);
    const halfwayPlayedRef = useRef<boolean>(false);
    const lastCountdownSecondRef = useRef<number>(-1);
    const sessionCompleteRef = useRef<boolean>(false);

    // Weighted average tracking
    const powerHistoryRef = useRef<Array<{ value: number; startTime: number }>>([]);
    const workDurationHistoryRef = useRef<Array<{ value: number; startTime: number }>>([]);
    const restDurationHistoryRef = useRef<Array<{ value: number; startTime: number }>>([]);
    const wasAdjustedRef = useRef<boolean>(false);

    // Track actual time spent in each phase
    const workPhaseTimeRef = useRef<number>(0);
    const restPhaseTimeRef = useRef<number>(0);

    // Phase power log for completion chart
    const phaseLogRef = useRef<Array<{ timeSeconds: number; power: number; phase: 'work' | 'rest' }>>([]);

    // Initial power values
    const initialWorkPowerRef = useRef<number>(0);
    const initialRestPowerRef = useRef<number>(0);
    const initialTargetPowerRef = useRef<number>(0);

    // Completion result
    const completionResultRef = useRef<SessionResult | null>(null);

    // Notification listener cleanup
    const notificationListenerCleanupRef = useRef<(() => void) | null>(null);
    const notificationEndSessionRef = useRef<boolean>(false);

    // Custom session block tracking refs
    const blocksRef = useRef<SessionBlock[]>([]);
    const currentBlockIndexRef = useRef<number>(0);
    const blockStartTimeRef = useRef<number>(0);
    const blockElapsedRef = useRef<number>(0);
    const blockIntervalsCompletedRef = useRef<number>(0);
    const blockResultsRef = useRef<BlockResult[]>([]);
    const currentBlockPowersRef = useRef<{ workPower: number; restPower: number }>({ workPower: 0, restPower: 0 });

    // RPE logging with debounce
    const rpeHistoryRef = useRef<Array<{ timeSeconds: number; rpe: number }>>([]);
    const pendingRpeRef = useRef<{ value: number; timestamp: number } | null>(null);
    const [currentRpe, setCurrentRpe] = useState<number | null>(null);

    // Initialize audio on mount
    useEffect(() => {
        const init = async () => {
            initAudioContext();
            await preloadAudio();
            setIsInitialized(true);
        };
        init();
    }, []);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    /**
     * Build session result object
     */
    const buildResult = useCallback((
        sessionState: LiveSessionState,
        wasCompleted: boolean
    ): SessionResult => {
        const params = setupParamsRef.current;
        const endTime = Date.now();

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
            averagePower: computeWeightedAvg(powerHistoryRef.current, endTime),
            averageWorkDuration: computeWeightedAvg(workDurationHistoryRef.current, endTime),
            averageRestDuration: computeWeightedAvg(restDurationHistoryRef.current, endTime),
            wasAdjusted: wasAdjustedRef.current,
            actualWorkSeconds: Math.round(workPhaseTimeRef.current),
            actualRestSeconds: Math.round(restPhaseTimeRef.current),
            actualWorkRestRatio: computeActualRatio(workPhaseTimeRef.current, restPhaseTimeRef.current),
            powerHistory: [...phaseLogRef.current],
            initialTargetPower: initialTargetPowerRef.current,
        };

        // Add custom session block data
        if (params?.sessionStyle === 'custom' && params.blocks && params.blocks.length > 0) {
            result.blocks = params.blocks;
            result.blockResults = [...blockResultsRef.current];
        }

        // Commit any pending RPE before building result
        if (pendingRpeRef.current) {
            const commitElapsed = (pendingRpeRef.current.timestamp - startTimeRef.current - pausedTimeRef.current) / 1000;
            rpeHistoryRef.current.push({
                timeSeconds: Math.round(commitElapsed),
                rpe: pendingRpeRef.current.value
            });
            pendingRpeRef.current = null;
        }

        // Add RPE history if any entries exist
        if (rpeHistoryRef.current.length > 0) {
            result.rpeHistory = [...rpeHistoryRef.current];
        }

        return result;
    }, []);

    /**
     * Handle session completion
     */
    const handleSessionComplete = useCallback((sessionState: LiveSessionState, wasCompleted: boolean) => {
        sessionCompleteRef.current = true;

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        playAudioCue('session_complete');
        stopNotification();

        if (notificationListenerCleanupRef.current) {
            notificationListenerCleanupRef.current();
            notificationListenerCleanupRef.current = null;
        }

        const result = buildResult(sessionState, wasCompleted);
        completionResultRef.current = result;
        onSessionComplete?.(result);
    }, [buildResult, onSessionComplete]);

    /**
     * Start a new session
     */
    const start = useCallback((params: SessionSetupParams) => {
        // IMPORTANT: Clear any existing timer before starting a new one
        // This prevents the double-speed bug when a previous session wasn't fully cleaned up
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        setupParamsRef.current = params;
        startTimeRef.current = Date.now();
        pausedTimeRef.current = 0;
        halfwayPlayedRef.current = false;
        lastSteadyReminderRef.current = 0;
        lastCountdownSecondRef.current = -1;
        sessionCompleteRef.current = false;
        wasAdjustedRef.current = false;
        notificationEndSessionRef.current = false;

        // Initialize tracking
        const now = Date.now();
        powerHistoryRef.current = [{ value: params.targetPower, startTime: now }];
        workDurationHistoryRef.current = [{ value: params.workDurationSeconds, startTime: now }];
        restDurationHistoryRef.current = [{ value: params.restDurationSeconds, startTime: now }];
        workPhaseTimeRef.current = 0;
        restPhaseTimeRef.current = 0;

        // Calculate phase powers
        const { workPower, restPower } = calculatePhasePowers(params);
        initialWorkPowerRef.current = workPower;
        initialRestPowerRef.current = restPower;
        initialTargetPowerRef.current = params.targetPower;

        // Initialize phase log
        phaseLogRef.current = [{ timeSeconds: 0, power: workPower, phase: 'work' }];
        completionResultRef.current = null;

        // Initialize RPE tracking
        rpeHistoryRef.current = [];
        pendingRpeRef.current = null;
        setCurrentRpe(null);

        // Handle custom sessions with blocks
        if (params.sessionStyle === 'custom' && params.blocks && params.blocks.length > 0) {
            // Initialize block tracking
            blocksRef.current = params.blocks;
            currentBlockIndexRef.current = 0;
            blockResultsRef.current = [];
            blockStartTimeRef.current = 0;
            blockElapsedRef.current = 0;
            blockIntervalsCompletedRef.current = 0;

            // Calculate total session duration from blocks
            const totalDuration = calculateCustomSessionDuration(params.blocks);
            const totalSessionSeconds = totalDuration * 60;

            // DEBUG: Log block details
            console.log('[CustomSession] Starting custom session with blocks:', params.blocks);
            console.log('[CustomSession] Total duration from blocks:', totalDuration, 'min =', totalSessionSeconds, 'sec');
            params.blocks.forEach((b, i) => {
                console.log(`[CustomSession] Block ${i}: type=${b.type}, durationMinutes=${b.durationMinutes}, cycles=${b.cycles}, work=${b.workDurationSeconds}s, rest=${b.restDurationSeconds}s`);
            });

            // Get first block and calculate its parameters
            const firstBlock = params.blocks[0];
            const firstBlockPowers = calculateBlockPhasePowers(firstBlock, params.targetPower);
            const firstBlockDurations = getBlockDurations(firstBlock);
            const firstBlockIntervals = calculateBlockIntervals(firstBlock);
            const firstBlockDurationSeconds = firstBlock.durationMinutes * 60;

            console.log(`[CustomSession] First block powers: workPower=${firstBlockPowers.workPower}, restPower=${firstBlockPowers.restPower}, targetPower=${params.targetPower}, blockType=${firstBlock.type}`);

            currentBlockPowersRef.current = firstBlockPowers;
            initialWorkPowerRef.current = firstBlockPowers.workPower;
            initialRestPowerRef.current = firstBlockPowers.restPower;

            // Update phase log with first block's work power
            phaseLogRef.current = [{ timeSeconds: 0, power: firstBlockPowers.workPower, phase: 'work' }];

            // Set state for custom session
            setState({
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
                // Custom session specific
                currentBlockIndex: 0,
                totalBlocks: params.blocks.length,
                blockTimeRemaining: firstBlockDurationSeconds,
                blockTimeElapsed: 0,
                currentBlockType: firstBlock.type,
                blocks: params.blocks,
            });

            playAudioCue('work_start');
            onPhaseChange?.('work');
            onBlockChange?.(0, params.blocks.length);

            // Start notification for custom session with block info
            startNotification(
                firstBlockPowers.workPower,
                totalSessionSeconds,
                firstBlock.type === 'steady-state' ? firstBlockDurationSeconds : firstBlockDurations.workSeconds,
                firstBlock.type === 'interval',
                { blockIndex: 0, totalBlocks: params.blocks.length, blockType: firstBlock.type }
            );
        } else {
            // Standard (non-custom) session initialization
            const totalIntervals = calculateTotalIntervals(params);
            const totalSessionSeconds = params.totalDurationMinutes * 60;
            const initialPhaseTime = params.sessionStyle === 'steady-state'
                ? totalSessionSeconds
                : params.workDurationSeconds;

            // Clear custom session refs for non-custom sessions
            blocksRef.current = [];
            currentBlockIndexRef.current = 0;
            blockResultsRef.current = [];

            setState({
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
            });

            playAudioCue('work_start');
            onPhaseChange?.('work');

            // Start notification
            const initialPower = params.sessionStyle === 'interval' ? workPower : params.targetPower;
            startNotification(initialPower, totalSessionSeconds, initialPhaseTime, params.sessionStyle === 'interval');
        }

        // Setup notification button listener
        setupNotificationListener(
            // onPause
            () => {
                pausedTimeRef.current = Date.now();
                setState(prev => {
                    const displayPower = params.sessionStyle === 'interval'
                        ? (prev.currentPhase === 'work' ? initialWorkPowerRef.current : initialRestPowerRef.current)
                        : params.sessionStyle === 'custom'
                            ? currentBlockPowersRef.current.workPower
                            : prev.targetPower;
                    // Build block info for custom sessions
                    const blockInfo: BlockInfo | undefined = params.sessionStyle === 'custom' && params.blocks
                        ? {
                            blockIndex: currentBlockIndexRef.current,
                            totalBlocks: params.blocks.length,
                            blockType: params.blocks[currentBlockIndexRef.current]?.type || 'steady-state'
                        }
                        : undefined;
                    pauseNotification(displayPower, prev.sessionTimeRemaining, prev.currentPhase as 'work' | 'rest', blockInfo);
                    return { ...prev, isPaused: true };
                });
            },
            // onResume
            () => {
                if (pausedTimeRef.current > 0) {
                    const pauseDuration = Date.now() - pausedTimeRef.current;
                    startTimeRef.current += pauseDuration;
                }
                pausedTimeRef.current = 0;
                setState(prev => {
                    const displayPower = params.sessionStyle === 'interval'
                        ? (prev.currentPhase === 'work' ? initialWorkPowerRef.current : initialRestPowerRef.current)
                        : params.sessionStyle === 'custom'
                            ? (prev.currentPhase === 'work' ? currentBlockPowersRef.current.workPower : currentBlockPowersRef.current.restPower)
                            : prev.targetPower;
                    // Build block info for custom sessions
                    const blockInfo: BlockInfo | undefined = params.sessionStyle === 'custom' && params.blocks
                        ? {
                            blockIndex: currentBlockIndexRef.current,
                            totalBlocks: params.blocks.length,
                            blockType: params.blocks[currentBlockIndexRef.current]?.type || 'steady-state'
                        }
                        : undefined;
                    const isInterval = params.sessionStyle === 'interval' ||
                        (params.sessionStyle === 'custom' && params.blocks?.[currentBlockIndexRef.current]?.type === 'interval');
                    resumeNotification(
                        displayPower,
                        prev.sessionTimeRemaining,
                        prev.phaseTimeRemaining,
                        prev.currentPhase as 'work' | 'rest',
                        isInterval,
                        blockInfo
                    );
                    return { ...prev, isPaused: false };
                });
            },
            // onStop
            () => {
                notificationEndSessionRef.current = true;
            }
        ).then(cleanup => {
            notificationListenerCleanupRef.current = cleanup;
        });

        // Start timer
        timerRef.current = setInterval(() => {
            // Check notification-triggered end
            if (notificationEndSessionRef.current) {
                notificationEndSessionRef.current = false;
                setState(prev => {
                    handleSessionComplete(prev, false);
                    return { ...prev, isActive: false, currentPhase: 'complete' };
                });
                return;
            }

            setState(prev => {
                if (!prev.isActive || prev.isPaused) return prev;

                const tickSeconds = TICK_INTERVAL / 1000;
                const newState = { ...prev };

                newState.sessionTimeElapsed = prev.sessionTimeElapsed + tickSeconds;
                newState.sessionTimeRemaining = prev.sessionTimeRemaining - tickSeconds;
                newState.phaseTimeRemaining = prev.phaseTimeRemaining - tickSeconds;

                // Track phase time
                if (prev.currentPhase === 'work') {
                    workPhaseTimeRef.current += tickSeconds;
                } else if (prev.currentPhase === 'rest') {
                    restPhaseTimeRef.current += tickSeconds;
                }

                // Update block time for custom sessions
                if (params.sessionStyle === 'custom' && newState.blockTimeRemaining !== undefined) {
                    newState.blockTimeRemaining = (prev.blockTimeRemaining ?? 0) - tickSeconds;
                    newState.blockTimeElapsed = (prev.blockTimeElapsed ?? 0) + tickSeconds;
                    blockElapsedRef.current += tickSeconds;
                }

                // Calculate total session duration for halfway point (differs for custom sessions)
                const totalDurationSeconds = params.sessionStyle === 'custom' && params.blocks
                    ? calculateCustomSessionDuration(params.blocks) * 60
                    : params.totalDurationMinutes * 60;

                // Halfway point
                if (!halfwayPlayedRef.current && newState.sessionTimeElapsed >= totalDurationSeconds / 2) {
                    halfwayPlayedRef.current = true;
                    playAudioCue('halfway');
                }

                // Steady-state reminders (also for steady-state blocks in custom sessions)
                const isInSteadyBlock = params.sessionStyle === 'steady-state' ||
                    (params.sessionStyle === 'custom' && prev.currentBlockType === 'steady-state');
                if (isInSteadyBlock) {
                    const elapsed = Math.floor(newState.blockTimeElapsed ?? newState.sessionTimeElapsed);
                    if (elapsed > 0 && elapsed % STEADY_REMINDER_INTERVAL === 0 && elapsed !== lastSteadyReminderRef.current) {
                        lastSteadyReminderRef.current = elapsed;
                        playAudioCue('steady_reminder');
                    }
                }

                // Countdown audio - handles multiple scenarios:
                // 1. Block countdown for custom sessions (last 3 seconds before next block or session end)
                // 2. Phase countdown for interval blocks in custom sessions (work/rest transitions)
                // 3. Phase countdown for non-custom interval sessions

                if (params.sessionStyle === 'custom' && newState.blockTimeRemaining !== undefined) {
                    const blockTimeRemaining = newState.blockTimeRemaining;
                    const isIntervalBlock = prev.currentBlockType === 'interval';

                    // For interval blocks: use BOTH block and phase countdowns
                    // Phase countdown happens at work/rest transitions (mid-block)
                    // Block countdown happens when block is ending
                    if (isIntervalBlock) {
                        // Check if we're near a phase transition (not block end)
                        const nearPhaseEnd = newState.phaseTimeRemaining <= 3 && newState.phaseTimeRemaining > 0;
                        const nearBlockEnd = blockTimeRemaining <= 3 && blockTimeRemaining > 0;

                        if (nearBlockEnd && !sessionCompleteRef.current) {
                            // Block ending countdown takes priority
                            const second = Math.ceil(blockTimeRemaining);
                            if (second !== lastCountdownSecondRef.current && second <= 3) {
                                lastCountdownSecondRef.current = second;
                                playAudioCue('countdown');
                            }
                        } else if (nearPhaseEnd && !nearBlockEnd && !sessionCompleteRef.current) {
                            // Phase transition countdown (work->rest or rest->work within block)
                            const second = Math.ceil(newState.phaseTimeRemaining);
                            if (second !== lastCountdownSecondRef.current && second <= 3) {
                                lastCountdownSecondRef.current = second;
                                playAudioCue('countdown');
                            }
                        }
                    } else {
                        // Steady-state block: only block-level countdown
                        if (blockTimeRemaining <= 3 && blockTimeRemaining > 0 && !sessionCompleteRef.current) {
                            const second = Math.ceil(blockTimeRemaining);
                            if (second !== lastCountdownSecondRef.current && second <= 3) {
                                lastCountdownSecondRef.current = second;
                                playAudioCue('countdown');
                            }
                        }
                    }
                } else {
                    // For non-custom sessions: phase countdown for interval sessions
                    const isInIntervalMode = params.sessionStyle === 'interval';
                    if (isInIntervalMode &&
                        newState.phaseTimeRemaining <= 3 &&
                        newState.phaseTimeRemaining > 0 &&
                        !sessionCompleteRef.current) {
                        const second = Math.ceil(newState.phaseTimeRemaining);
                        if (second !== lastCountdownSecondRef.current && second <= 3) {
                            lastCountdownSecondRef.current = second;
                            playAudioCue('countdown');
                        }
                    }
                }

                // Session complete
                if (newState.sessionTimeRemaining <= 0) {
                    console.log('[CustomSession] Session complete - sessionTimeRemaining <= 0');
                    newState.isActive = false;
                    newState.currentPhase = 'complete';
                    newState.sessionTimeRemaining = 0;
                    newState.phaseTimeRemaining = 0;
                    handleSessionComplete(newState, true);
                    return newState;
                }

                // Handle Custom Sessions with Block Transitions
                if (params.sessionStyle === 'custom' && params.blocks && params.blocks.length > 0) {
                    // IMPORTANT: Use currentBlockIndex from STATE, not from ref!
                    // React StrictMode calls setState twice, and refs persist between calls,
                    // causing incorrect block transitions if we use the ref.
                    const currentBlockIdx = prev.currentBlockIndex ?? 0;
                    const currentBlock = params.blocks[currentBlockIdx];

                    // DEBUG: Log block state periodically
                    if (Math.floor(newState.sessionTimeElapsed) % 2 === 0 && Math.floor(newState.sessionTimeElapsed) !== Math.floor(prev.sessionTimeElapsed)) {
                        console.log(`[CustomSession] Tick: blockIdx=${currentBlockIdx}, blockTimeRemaining=${newState.blockTimeRemaining?.toFixed(2)}, sessionTimeRemaining=${newState.sessionTimeRemaining.toFixed(2)}, phaseTimeRemaining=${newState.phaseTimeRemaining.toFixed(2)}, phase=${newState.currentPhase}`);
                    }

                    // Check if current block is complete (block time ran out)
                    if ((newState.blockTimeRemaining ?? 0) <= 0) {
                        console.log(`[CustomSession] Block ${currentBlockIdx} complete! blockTimeRemaining=${newState.blockTimeRemaining}`);

                        // Save current block result
                        const blockResult: BlockResult = {
                            blockId: currentBlock.id,
                            blockIndex: currentBlockIdx,
                            type: currentBlock.type,
                            plannedDurationSeconds: currentBlock.durationMinutes * 60,
                            actualDurationSeconds: blockElapsedRef.current,
                            plannedPower: Math.round(params.targetPower * currentBlock.powerMultiplier),
                            averagePower: currentBlockPowersRef.current.workPower,
                            intervalsCompleted: blockIntervalsCompletedRef.current,
                            totalIntervals: currentBlock.type === 'interval' ? calculateBlockIntervals(currentBlock) : undefined,
                        };
                        blockResultsRef.current.push(blockResult);

                        // Move to next block
                        const nextBlockIdx = currentBlockIdx + 1;
                        console.log(`[CustomSession] Moving to next block: ${nextBlockIdx} of ${params.blocks.length}`);

                        if (nextBlockIdx >= params.blocks.length) {
                            // All blocks complete - end session
                            console.log('[CustomSession] All blocks complete - ending session');
                            newState.isActive = false;
                            newState.currentPhase = 'complete';
                            handleSessionComplete(newState, true);
                            return newState;
                        }

                        // Initialize next block
                        blockElapsedRef.current = 0;
                        blockIntervalsCompletedRef.current = 0;
                        const nextBlock = params.blocks[nextBlockIdx];
                        const nextBlockPowers = calculateBlockPhasePowers(nextBlock, params.targetPower);
                        const nextBlockDurations = getBlockDurations(nextBlock);
                        const nextBlockIntervals = calculateBlockIntervals(nextBlock);
                        const nextBlockDurationSeconds = nextBlock.durationMinutes * 60;

                        console.log(`[CustomSession] Initializing block ${nextBlockIdx}: durationMinutes=${nextBlock.durationMinutes}, durationSeconds=${nextBlockDurationSeconds}`);

                        currentBlockPowersRef.current = nextBlockPowers;
                        initialWorkPowerRef.current = nextBlockPowers.workPower;
                        initialRestPowerRef.current = nextBlockPowers.restPower;

                        // Log block transition
                        phaseLogRef.current.push({
                            timeSeconds: newState.sessionTimeElapsed,
                            power: nextBlockPowers.workPower,
                            phase: 'work'
                        });

                        // Update state for next block
                        newState.currentBlockIndex = nextBlockIdx;
                        newState.blockTimeRemaining = nextBlockDurationSeconds;
                        newState.blockTimeElapsed = 0;
                        newState.currentBlockType = nextBlock.type;
                        newState.currentPhase = 'work';
                        newState.currentInterval = 1;
                        newState.totalIntervals = nextBlockIntervals;
                        newState.workDurationSeconds = nextBlockDurations.workSeconds;
                        newState.restDurationSeconds = nextBlockDurations.restSeconds;
                        newState.phaseTimeRemaining = nextBlock.type === 'steady-state'
                            ? nextBlockDurationSeconds
                            : nextBlockDurations.workSeconds;

                        // Reset targetPower to original so harder/easier adjustments don't carry over
                        newState.targetPower = params.targetPower;


                        // Reset countdown tracking for new block
                        lastCountdownSecondRef.current = -1;
                        lastSteadyReminderRef.current = 0;

                        // Update the ref LAST, just before returning
                        currentBlockIndexRef.current = nextBlockIdx;

                        console.log(`[CustomSession] Block ${nextBlockIdx} initialized. New blockTimeRemaining=${newState.blockTimeRemaining}`);

                        playAudioCue('work_start');
                        onPhaseChange?.('work');
                        onBlockChange?.(nextBlockIdx, params.blocks.length);

                        updateNotification(
                            newState.sessionTimeRemaining,
                            newState.phaseTimeRemaining,
                            'work',
                            nextBlockPowers.workPower,
                            nextBlock.type === 'interval',
                            { blockIndex: nextBlockIdx, totalBlocks: params.blocks.length, blockType: nextBlock.type }
                        );

                        onTick?.(newState);
                        return newState;
                    }

                    // Handle phase transitions within interval blocks for custom sessions
                    if (currentBlock.type === 'interval' && newState.phaseTimeRemaining <= 0) {
                        lastCountdownSecondRef.current = -1;

                        if (prev.currentPhase === 'work') {
                            // Work -> Rest
                            newState.currentPhase = 'rest';
                            newState.phaseTimeRemaining = prev.restDurationSeconds;
                            phaseLogRef.current.push({
                                timeSeconds: newState.sessionTimeElapsed,
                                power: currentBlockPowersRef.current.restPower,
                                phase: 'rest'
                            });
                            updateNotification(
                                newState.sessionTimeRemaining,
                                newState.phaseTimeRemaining,
                                'rest',
                                currentBlockPowersRef.current.restPower,
                                true,
                                { blockIndex: currentBlockIdx, totalBlocks: params.blocks.length, blockType: currentBlock.type }
                            );
                            playAudioCue('rest_start');
                            onPhaseChange?.('rest');
                        } else {
                            // Rest -> Work (next interval)
                            const nextInterval = prev.currentInterval + 1;
                            blockIntervalsCompletedRef.current++;
                            onIntervalComplete?.(prev.currentInterval);

                            newState.currentInterval = nextInterval;
                            newState.currentPhase = 'work';
                            newState.phaseTimeRemaining = prev.workDurationSeconds;
                            phaseLogRef.current.push({
                                timeSeconds: newState.sessionTimeElapsed,
                                power: currentBlockPowersRef.current.workPower,
                                phase: 'work'
                            });
                            updateNotification(
                                newState.sessionTimeRemaining,
                                newState.phaseTimeRemaining,
                                'work',
                                currentBlockPowersRef.current.workPower,
                                true,
                                { blockIndex: currentBlockIdx, totalBlocks: params.blocks.length, blockType: currentBlock.type }
                            );
                            playAudioCue('work_start');
                            onPhaseChange?.('work');
                        }
                    }

                    // For steady-state blocks in custom sessions:
                    // Keep phaseTimeRemaining in sync with blockTimeRemaining
                    // (since there's no work/rest cycle, just continuous effort)
                    if (currentBlock.type === 'steady-state') {
                        // Update the phase time to match block time for steady state
                        newState.phaseTimeRemaining = newState.blockTimeRemaining ?? 0;

                        // Update notification periodically (every 5 seconds) for steady-state blocks
                        if (Math.floor(newState.sessionTimeElapsed) % 5 === 0) {
                            updateNotification(
                                newState.sessionTimeRemaining,
                                newState.phaseTimeRemaining,
                                'work',
                                currentBlockPowersRef.current.workPower,
                                false, // steady-state is NOT interval
                                { blockIndex: currentBlockIdx, totalBlocks: params.blocks.length, blockType: currentBlock.type }
                            );
                        }
                    }

                    onTick?.(newState);
                    return newState;
                }

                // Phase complete (standard interval sessions - non-custom)
                if (params.sessionStyle === 'interval' && newState.phaseTimeRemaining <= 0) {
                    lastCountdownSecondRef.current = -1;

                    if (prev.currentPhase === 'work') {
                        newState.currentPhase = 'rest';
                        newState.phaseTimeRemaining = prev.restDurationSeconds;
                        phaseLogRef.current.push({
                            timeSeconds: newState.sessionTimeElapsed,
                            power: initialRestPowerRef.current,
                            phase: 'rest'
                        });
                        updateNotification(
                            newState.sessionTimeRemaining,
                            newState.phaseTimeRemaining,
                            'rest',
                            initialRestPowerRef.current,
                            true
                        );
                        playAudioCue('rest_start');
                        onPhaseChange?.('rest');
                    } else {
                        const nextInterval = prev.currentInterval + 1;
                        onIntervalComplete?.(prev.currentInterval);

                        if (nextInterval > prev.totalIntervals) {
                            newState.isActive = false;
                            newState.currentPhase = 'complete';
                            handleSessionComplete(newState, true);
                        } else {
                            newState.currentInterval = nextInterval;
                            newState.currentPhase = 'work';
                            newState.phaseTimeRemaining = prev.workDurationSeconds;
                            phaseLogRef.current.push({
                                timeSeconds: newState.sessionTimeElapsed,
                                power: initialWorkPowerRef.current,
                                phase: 'work'
                            });
                            updateNotification(
                                newState.sessionTimeRemaining,
                                newState.phaseTimeRemaining,
                                'work',
                                initialWorkPowerRef.current,
                                true
                            );
                            playAudioCue('work_start');
                            onPhaseChange?.('work');
                        }
                    }
                }

                onTick?.(newState);
                return newState;
            });
        }, TICK_INTERVAL);
    }, [handleSessionComplete, onPhaseChange, onIntervalComplete, onTick, onBlockChange]);

    /**
     * Pause the session
     */
    const pause = useCallback(() => {
        pausedTimeRef.current = Date.now();
        setState(prev => {
            if (setupParamsRef.current) {
                const params = setupParamsRef.current;
                const displayPower = params.sessionStyle === 'interval'
                    ? (prev.currentPhase === 'work' ? initialWorkPowerRef.current : initialRestPowerRef.current)
                    : params.sessionStyle === 'custom'
                        ? currentBlockPowersRef.current.workPower
                        : prev.targetPower;
                // Build block info for custom sessions
                const blockInfo: BlockInfo | undefined = params.sessionStyle === 'custom' && params.blocks
                    ? {
                        blockIndex: currentBlockIndexRef.current,
                        totalBlocks: params.blocks.length,
                        blockType: params.blocks[currentBlockIndexRef.current]?.type || 'steady-state'
                    }
                    : undefined;
                pauseNotification(displayPower, prev.sessionTimeRemaining, prev.currentPhase as 'work' | 'rest', blockInfo);
            }
            return { ...prev, isPaused: true };
        });
    }, []);

    /**
     * Resume the session
     */
    const resume = useCallback(() => {
        if (pausedTimeRef.current > 0) {
            const pauseDuration = Date.now() - pausedTimeRef.current;
            startTimeRef.current += pauseDuration;
        }
        pausedTimeRef.current = 0;
        setState(prev => {
            if (setupParamsRef.current) {
                const params = setupParamsRef.current;
                const displayPower = params.sessionStyle === 'interval'
                    ? (prev.currentPhase === 'work' ? initialWorkPowerRef.current : initialRestPowerRef.current)
                    : params.sessionStyle === 'custom'
                        ? (prev.currentPhase === 'work' ? currentBlockPowersRef.current.workPower : currentBlockPowersRef.current.restPower)
                        : prev.targetPower;
                // Build block info for custom sessions
                const blockInfo: BlockInfo | undefined = params.sessionStyle === 'custom' && params.blocks
                    ? {
                        blockIndex: currentBlockIndexRef.current,
                        totalBlocks: params.blocks.length,
                        blockType: params.blocks[currentBlockIndexRef.current]?.type || 'steady-state'
                    }
                    : undefined;
                const isInterval = params.sessionStyle === 'interval' ||
                    (params.sessionStyle === 'custom' && params.blocks?.[currentBlockIndexRef.current]?.type === 'interval');
                resumeNotification(
                    displayPower,
                    prev.sessionTimeRemaining,
                    prev.phaseTimeRemaining,
                    prev.currentPhase as 'work' | 'rest',
                    isInterval,
                    blockInfo
                );
            }
            return { ...prev, isPaused: false };
        });
    }, []);

    /**
     * Stop the session and return results
     */
    const stop = useCallback((): SessionResult => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        stopNotification();
        if (notificationListenerCleanupRef.current) {
            notificationListenerCleanupRef.current();
            notificationListenerCleanupRef.current = null;
        }

        const result = buildResult(state, false);
        setState(INITIAL_STATE);
        return result;
    }, [state, buildResult]);

    /**
     * Complete session early (go to completion screen)
     */
    const completeEarly = useCallback(() => {
        // Log final phase
        phaseLogRef.current.push({
            timeSeconds: state.sessionTimeElapsed,
            power: state.currentPhase === 'work' ? initialWorkPowerRef.current : initialRestPowerRef.current,
            phase: state.currentPhase as 'work' | 'rest'
        });

        handleSessionComplete(state, false);
        setState(prev => ({
            ...prev,
            isActive: false,
            currentPhase: 'complete',
        }));
    }, [state, handleSessionComplete]);

    /**
     * Skip to next phase
     */
    const skipToNextPhase = useCallback(() => {
        setState(prev => {
            if (!prev.isActive || prev.isPaused || prev.sessionStyle === 'steady-state') {
                return prev;
            }

            lastCountdownSecondRef.current = -1;

            if (prev.currentPhase === 'work') {
                phaseLogRef.current.push({
                    timeSeconds: prev.sessionTimeElapsed,
                    power: initialRestPowerRef.current,
                    phase: 'rest'
                });
                updateNotification(
                    prev.sessionTimeRemaining,
                    prev.restDurationSeconds,
                    'rest',
                    initialRestPowerRef.current,
                    true
                );
                onPhaseChange?.('rest');
                return {
                    ...prev,
                    currentPhase: 'rest' as const,
                    phaseTimeRemaining: prev.restDurationSeconds,
                };
            } else {
                const nextInterval = prev.currentInterval + 1;
                if (nextInterval > prev.totalIntervals) {
                    return prev;
                }
                phaseLogRef.current.push({
                    timeSeconds: prev.sessionTimeElapsed,
                    power: initialWorkPowerRef.current,
                    phase: 'work'
                });
                updateNotification(
                    prev.sessionTimeRemaining,
                    prev.workDurationSeconds,
                    'work',
                    initialWorkPowerRef.current,
                    true
                );
                onPhaseChange?.('work');
                return {
                    ...prev,
                    currentInterval: nextInterval,
                    currentPhase: 'work' as const,
                    phaseTimeRemaining: prev.workDurationSeconds,
                };
            }
        });
    }, [onPhaseChange]);

    /**
     * Adjust work duration
     */
    const adjustWorkDuration = useCallback((deltaSeconds: number) => {
        setState(prev => {
            const newDuration = Math.max(5, prev.workDurationSeconds + deltaSeconds);
            wasAdjustedRef.current = true;
            workDurationHistoryRef.current.push({ value: newDuration, startTime: Date.now() });

            let newPhaseTime = prev.phaseTimeRemaining;
            if (prev.currentPhase === 'work') {
                newPhaseTime = Math.max(1, prev.phaseTimeRemaining + deltaSeconds);
            }

            return {
                ...prev,
                workDurationSeconds: newDuration,
                phaseTimeRemaining: newPhaseTime,
            };
        });
    }, []);

    /**
     * Adjust rest duration
     */
    const adjustRestDuration = useCallback((deltaSeconds: number) => {
        setState(prev => {
            const newDuration = Math.max(5, prev.restDurationSeconds + deltaSeconds);
            wasAdjustedRef.current = true;
            restDurationHistoryRef.current.push({ value: newDuration, startTime: Date.now() });

            let newPhaseTime = prev.phaseTimeRemaining;
            if (prev.currentPhase === 'rest') {
                newPhaseTime = Math.max(1, prev.phaseTimeRemaining + deltaSeconds);
            }

            return {
                ...prev,
                restDurationSeconds: newDuration,
                phaseTimeRemaining: newPhaseTime,
            };
        });
    }, []);

    /**
     * Adjust target power
     */
    const adjustTargetPower = useCallback((deltaWatts: number) => {
        setState(prev => {
            const newPower = Math.max(10, prev.targetPower + deltaWatts);
            wasAdjustedRef.current = true;
            powerHistoryRef.current.push({ value: newPower, startTime: Date.now() });

            // For custom sessions, log the block-adjusted power (what user sees)
            // For non-custom sessions, log the raw targetPower
            let logPower = newPower;
            const params = setupParamsRef.current;
            if (params?.sessionStyle === 'custom' && params.blocks && prev.currentBlockIndex !== undefined) {
                const currentBlock = params.blocks[prev.currentBlockIndex];
                if (currentBlock) {
                    // Calculate display power: originalBlockPower + adjustment delta
                    const originalBlockPower = Math.round(params.targetPower * currentBlock.powerMultiplier);
                    const powerDelta = newPower - params.targetPower;
                    logPower = originalBlockPower + powerDelta;
                }
            }

            phaseLogRef.current.push({
                timeSeconds: prev.sessionTimeElapsed,
                power: logPower,
                phase: prev.currentPhase as 'work' | 'rest'
            });
            return { ...prev, targetPower: newPower };
        });
    }, []);

    /**
     * Log RPE with debounce (5-second tolerance for rapid adjustments)
     */
    const logRpe = useCallback((rpe: number) => {
        const now = Date.now();

        // Set pending RPE (will be committed after debounce period)
        pendingRpeRef.current = { value: rpe, timestamp: now };
        setCurrentRpe(rpe);

        // Schedule commit after debounce period
        setTimeout(() => {
            const pending = pendingRpeRef.current;
            // Only commit if this is still the pending value (no newer input)
            if (pending && pending.timestamp === now) {
                // Calculate elapsed time at the moment of the ORIGINAL input
                const commitElapsed = (pending.timestamp - startTimeRef.current - pausedTimeRef.current) / 1000;
                rpeHistoryRef.current.push({
                    timeSeconds: Math.round(commitElapsed),
                    rpe: pending.value
                });
                pendingRpeRef.current = null;
            }
        }, RPE_DEBOUNCE_MS);
    }, []);


    return {
        state,
        start,
        pause,
        resume,
        stop,
        completeEarly,
        skipToNextPhase,
        adjustWorkDuration,
        adjustRestDuration,
        adjustTargetPower,
        logRpe,
        currentRpe,
        isInitialized,
        completionResult: completionResultRef.current,
    };
};
