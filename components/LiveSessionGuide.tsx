import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
    Play, Pause, Square, SkipForward,
    ChevronUp, ChevronDown, X,
} from 'lucide-react';
import { SessionSetupParams, SessionResult } from '../types';
import { useSessionTimer } from '../hooks/useSessionTimer';
import { initAudioContext } from '../utils/audioService';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import { stopSessionNotification } from '../utils/foregroundService';
import { formatTime, calculateProgress, getAccentDarkBg, generateSessionChartData } from './liveSessionUtils';

interface LiveSessionGuideProps {
    isOpen: boolean;
    params: SessionSetupParams | null;
    onClose: () => void;
    onBackToSetup: () => void; // Called when user cancels (X) mid-session
    onComplete: (result: SessionResult) => void;
    accentColor?: string; // For the completion screen and chart
    backButtonPressed?: number; // Increment to trigger back button handling (like X button)
}



/**
 * Main Live Session Guide Component
 * Full-screen interface for guided training sessions
 */
const LiveSessionGuide: React.FC<LiveSessionGuideProps> = ({
    isOpen,
    params,
    onClose,
    onBackToSetup,
    onComplete,
    accentColor = '#34d399',
    backButtonPressed = 0,
}) => {
    const [confirmStop, setConfirmStop] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);
    const [sessionStarted, setSessionStarted] = useState(false);
    const lastBackButtonPressed = useRef(0);

    // Store initial power values at session start (won't change with harder/easier)
    const initialPowerRef = useRef<{ workPower: number; restPower: number } | null>(null);

    // Store the initial target power for chart generation (won't change with harder/easier)
    const initialTargetPowerRef = useRef<number | null>(null);

    // Store the completion result locally to prevent auto-skip
    const pendingResultRef = useRef<SessionResult | null>(null);

    const {
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
        isInitialized,
        completionResult,
    } = useSessionTimer({
        // Don't auto-complete - just store the result
        onSessionComplete: (result) => {
            pendingResultRef.current = result;
        },
    });

    // Start session when params are provided
    useEffect(() => {
        if (isOpen && params && isInitialized && !sessionStarted) {
            // Initialize audio context on user interaction
            initAudioContext();

            // Calculate and store initial power values based on session type
            if (params.sessionStyle === 'steady-state') {
                // Steady-state: power is just target power
                initialPowerRef.current = {
                    workPower: params.targetPower,
                    restPower: params.targetPower
                };
            } else if (params.sessionStyle === 'custom' && params.blocks && params.blocks.length > 0) {
                // Custom session: use the first block's calculated power
                // The actual power will be updated per-block by useSessionTimer
                // For now, initialize based on first block type
                const firstBlock = params.blocks[0];
                if (firstBlock.type === 'steady-state') {
                    const blockPower = Math.round(params.targetPower * firstBlock.powerMultiplier);
                    initialPowerRef.current = { workPower: blockPower, restPower: blockPower };
                } else {
                    // Interval block - use interval formula
                    const workSeconds = firstBlock.workDurationSeconds || 30;
                    const restSeconds = firstBlock.restDurationSeconds || 30;
                    const totalCycle = workSeconds + restSeconds;
                    const recoveryRatio = 0.5;
                    const blockTargetPower = Math.round(params.targetPower * firstBlock.powerMultiplier);
                    const workPower = Math.round((blockTargetPower * totalCycle) / (workSeconds + recoveryRatio * restSeconds));
                    const restPower = Math.round(workPower * recoveryRatio);
                    initialPowerRef.current = { workPower, restPower };
                }
            } else {
                // Interval session: use interval power formula
                const totalCycle = params.workDurationSeconds + params.restDurationSeconds;
                const recoveryRatio = 0.5;
                const workPower = Math.round((params.targetPower * totalCycle) / (params.workDurationSeconds + recoveryRatio * params.restDurationSeconds));
                const restPower = Math.round(workPower * recoveryRatio);
                initialPowerRef.current = { workPower, restPower };
            }

            // Store initial target power for chart generation
            initialTargetPowerRef.current = params.targetPower;

            // Small delay to ensure audio context is ready
            setTimeout(() => {
                start(params);
                setSessionStarted(true);
                // Note: Foreground notification is started inside useSessionTimer
            }, 100);
        }
    }, [isOpen, params, isInitialized, sessionStarted, start]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setSessionStarted(false);
            setConfirmStop(false);
            setConfirmClose(false);
            pendingResultRef.current = null;
            initialPowerRef.current = null;
            initialTargetPowerRef.current = null;
            // Stop foreground service notification (backup - useSessionTimer also handles this)
            stopSessionNotification();
        }
    }, [isOpen]);

    // Update initialPowerRef when block changes in custom sessions
    // This ensures interval blocks display correct work/rest power after block transitions
    useEffect(() => {
        if (params?.sessionStyle === 'custom' && params.blocks && state.currentBlockIndex !== undefined) {
            const currentBlock = params.blocks[state.currentBlockIndex];
            if (currentBlock) {
                const blockTargetPower = Math.round(params.targetPower * currentBlock.powerMultiplier);
                if (currentBlock.type === 'steady-state') {
                    initialPowerRef.current = { workPower: blockTargetPower, restPower: blockTargetPower };
                } else {
                    // Interval block - use interval formula
                    const workSeconds = currentBlock.workDurationSeconds || 30;
                    const restSeconds = currentBlock.restDurationSeconds || 30;
                    const totalCycle = workSeconds + restSeconds;
                    const recoveryRatio = 0.5;
                    const workPower = Math.round((blockTargetPower * totalCycle) / (workSeconds + recoveryRatio * restSeconds));
                    const restPower = Math.round(workPower * recoveryRatio);
                    initialPowerRef.current = { workPower, restPower };
                }
            }
        }
    }, [params, state.currentBlockIndex]);

    // Note: Foreground notification updates and button listeners are handled by useSessionTimer

    // Handle close (X button or back button) - go back to setup after confirmation
    const handleClose = () => {
        if (state.isActive && !state.isPaused) {
            // Session is running - need double tap to confirm
            if (confirmClose) {
                stop(); // Stop the session without logging
                onBackToSetup(); // Go back to setup modal
                setConfirmClose(false);
            } else {
                setConfirmClose(true);
                // Auto-reset confirmation after 3 seconds
                setTimeout(() => setConfirmClose(false), 3000);
            }
        } else {
            // Session not active or paused - can close directly
            onBackToSetup();
        }
    };

    // Handle external back button presses - trigger exact same behavior as X button click
    useEffect(() => {
        if (backButtonPressed > 0 && backButtonPressed !== lastBackButtonPressed.current && isOpen) {
            lastBackButtonPressed.current = backButtonPressed;
            // Call handleClose to trigger exact same behavior (including red flash on X button)
            handleClose();
        }
        // Note: handleClose is intentionally not in deps to avoid stale closure issues
        // The effect only needs to react to backButtonPressed changes
    });

    // Handle stop with confirmation - now goes to completion screen
    const handleStopClick = () => {
        if (confirmStop) {
            completeEarly(); // Goes to completion screen instead of closing
            setConfirmStop(false);
        } else {
            setConfirmStop(true);
            // Auto-reset confirmation after 3 seconds
            setTimeout(() => setConfirmStop(false), 3000);
        }
    };

    // Handle logging the session after completion
    const handleLogSession = () => {
        // Prefer completionResult from completeEarly, then pendingResultRef from natural completion
        const result: SessionResult = completionResult || pendingResultRef.current || {
            actualDurationMinutes: Math.round(state.sessionTimeElapsed / 60 * 10) / 10,
            intervalsCompleted: state.currentInterval,
            totalIntervals: state.totalIntervals,
            targetPower: state.targetPower,
            targetRPE: state.targetRPE,
            workRestRatio: params?.workRestRatio || '1:1',
            sessionStyle: state.sessionStyle,
            wasCompleted: true,
            isGuidedSession: true,
        };
        onComplete(result);
    };

    // Harder/Easier adjustments
    const handleHarder = () => {
        // For custom sessions, check current block type
        if (state.sessionStyle === 'custom') {
            if (state.currentBlockType === 'steady-state') {
                adjustTargetPower(5);
            } else {
                // Interval block in custom session
                adjustWorkDuration(5);
                adjustRestDuration(-5);
            }
        } else if (state.sessionStyle === 'steady-state') {
            // Increase target power by 5W
            adjustTargetPower(5);
        } else {
            // For intervals: increase work, decrease rest
            adjustWorkDuration(5);
            adjustRestDuration(-5);
        }
    };

    const handleEasier = () => {
        // For custom sessions, check current block type
        if (state.sessionStyle === 'custom') {
            if (state.currentBlockType === 'steady-state') {
                adjustTargetPower(-5);
            } else {
                // Interval block in custom session
                adjustWorkDuration(-5);
                adjustRestDuration(5);
            }
        } else if (state.sessionStyle === 'steady-state') {
            // Decrease target power by 5W
            adjustTargetPower(-5);
        } else {
            // For intervals: decrease work, increase rest
            adjustWorkDuration(-5);
            adjustRestDuration(5);
        }
    };

    // Chart data for completion screen (must be before early return for hooks rules)
    const { actualData, plannedData, blockBoundaries } = useMemo(() => {
        const result = completionResult || pendingResultRef.current;
        return generateSessionChartData(
            params,
            result,
            state.sessionTimeElapsed,
            state.targetPower,
            initialTargetPowerRef.current
        );
    }, [completionResult, state.sessionTimeElapsed, state.targetPower, params]);

    if (!isOpen) return null;

    const totalSessionSeconds = params ? params.totalDurationMinutes * 60 : 0;
    const sessionProgress = calculateProgress(state.sessionTimeElapsed, totalSessionSeconds);
    const phaseProgress = state.currentPhase === 'work'
        ? calculateProgress(state.workDurationSeconds - state.phaseTimeRemaining, state.workDurationSeconds)
        : state.currentPhase === 'rest'
            ? calculateProgress(state.restDurationSeconds - state.phaseTimeRemaining, state.restDurationSeconds)
            : 100;

    const isWorkPhase = state.currentPhase === 'work';
    const isRestPhase = state.currentPhase === 'rest';
    const isComplete = state.currentPhase === 'complete';
    const isSteadyState = state.sessionStyle === 'steady-state';
    const isCustomSession = state.sessionStyle === 'custom';
    const isCustomSteadyBlock = isCustomSession && state.currentBlockType === 'steady-state';
    const isCustomIntervalBlock = isCustomSession && state.currentBlockType === 'interval';

    // Phase colors
    const phaseColor = isWorkPhase
        ? 'from-green-500 to-emerald-600'
        : isRestPhase
            ? 'from-blue-500 to-indigo-600'
            : 'from-amber-500 to-orange-600';

    const phaseBgColor = isWorkPhase
        ? 'bg-green-500'
        : isRestPhase
            ? 'bg-blue-500'
            : 'bg-amber-500';



    // Phase background colors (full screen) - with solid base
    const phaseBgFull = isWorkPhase
        ? 'bg-green-950'
        : isRestPhase
            ? 'bg-blue-950'
            : ''; // Completion uses inline style



    return (
        <div
            className={`fixed inset-0 z-50 text-white flex flex-col animate-in fade-in duration-200 transition-colors duration-500 ${phaseBgFull}`}
            style={isComplete ? { backgroundColor: getAccentDarkBg(accentColor) } : undefined}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 relative z-10">
                <button
                    onClick={handleClose}
                    className={`p-2 rounded-full transition-colors ${confirmClose
                        ? 'bg-red-500 animate-pulse'
                        : 'bg-white/10 hover:bg-white/20'
                        }`}
                    title={confirmClose ? 'Tap again to exit' : 'Exit session'}
                >
                    <X size={24} />
                </button>

                <div className="text-center">
                    {isCustomSession && !isComplete ? (
                        <>
                            <div className="text-xs uppercase tracking-widest text-white/60">
                                Block {(state.currentBlockIndex ?? 0) + 1}/{state.totalBlocks ?? 0}
                            </div>
                            <div className="text-sm font-bold uppercase">
                                {state.currentBlockType === 'steady-state' ? 'Steady State' : 'Interval'}
                            </div>
                        </>
                    ) : (
                        <div className="text-xs uppercase tracking-widest text-white/60">
                            {isSteadyState ? 'Steady State' : isCustomSession ? 'Custom' : 'Interval Training'}
                        </div>
                    )}
                </div>

                {/* Spacer for symmetry */}
                <div className="w-10" />
            </div>

            {/* Harder/Easier Buttons - At top for easy access */}
            {!isComplete && (
                <div className="flex justify-center gap-4 px-6 pb-4">
                    <button
                        onClick={handleEasier}
                        className="flex-1 max-w-[140px] py-2 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                        <ChevronDown size={18} />
                        Easier
                    </button>
                    <button
                        onClick={handleHarder}
                        className="flex-1 max-w-[140px] py-2 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                        <ChevronUp size={18} />
                        Harder
                    </button>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 relative">

                {/* Phase Indicator */}
                {!isSteadyState && !isComplete && !isCustomSteadyBlock && (
                    <div
                        className={`${phaseBgColor} px-6 py-2 rounded-full text-lg font-bold uppercase tracking-widest mb-6 animate-pulse`}
                    >
                        {isWorkPhase ? 'Work' : 'Rest'}
                    </div>
                )}

                {(isSteadyState || isCustomSteadyBlock) && !isComplete && (
                    <div className="bg-white/20 px-6 py-2 rounded-full text-lg font-bold uppercase tracking-widest mb-6">
                        Keep Going
                    </div>
                )}

                {isComplete && (
                    <>
                        <div
                            className="px-6 py-2 rounded-full text-lg font-bold uppercase tracking-widest mb-4"
                            style={{ backgroundColor: accentColor }}
                        >
                            Complete!
                        </div>

                        {/* Session Power Chart */}
                        <div className="w-full max-w-md mb-4 rounded-2xl bg-white/10 p-4">
                            <div className="text-xs font-bold uppercase tracking-widest text-white/60 mb-3 text-center">
                                Session Power
                            </div>
                            <div className="h-32">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                        <XAxis
                                            dataKey="time"
                                            type="number"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                                            tickFormatter={(v) => `${v}m`}
                                            domain={['dataMin', 'dataMax']}
                                            allowDuplicatedCategory={false}
                                        />
                                        <YAxis
                                            hide
                                            domain={['dataMin - 20', 'dataMax + 20']}
                                        />
                                        {/* Block boundary lines for custom sessions */}
                                        {blockBoundaries.map((boundary, index) => (
                                            <ReferenceLine
                                                key={`block-${index}`}
                                                x={boundary.time}
                                                stroke="rgba(255,255,255,0.4)"
                                                strokeWidth={1}
                                                strokeDasharray="3 3"
                                                label={{
                                                    value: boundary.label,
                                                    position: 'top',
                                                    fill: 'rgba(255,255,255,0.5)',
                                                    fontSize: 8,
                                                }}
                                            />
                                        ))}
                                        {/* Planned line (dashed, dimmed) */}
                                        <Line
                                            data={plannedData}
                                            type="stepAfter"
                                            dataKey="plannedPower"
                                            stroke="rgba(255,255,255,0.3)"
                                            strokeWidth={2}
                                            strokeDasharray="4 4"
                                            dot={false}
                                            name="Planned"
                                        />
                                        {/* Actual line (solid, accent color) */}
                                        <Line
                                            data={actualData}
                                            type="stepAfter"
                                            dataKey="actualPower"
                                            stroke={accentColor}
                                            strokeWidth={3}
                                            dot={false}
                                            name="Actual"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-4 mt-2 text-[10px] text-white/50">
                                <span className="flex items-center gap-1">
                                    <span className="w-4 h-0.5 bg-white/30" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.3) 0 4px, transparent 4px 8px)' }}></span>
                                    Planned
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-4 h-0.5" style={{ backgroundColor: accentColor }}></span>
                                    Actual
                                </span>
                            </div>
                        </div>
                    </>
                )}

                {/* Main Timer Display */}
                <div className="text-center mb-6 relative z-10">
                    <div className="text-8xl md:text-9xl font-mono font-bold tracking-tighter">
                        {isComplete ? formatTime(state.sessionTimeElapsed) : formatTime(state.phaseTimeRemaining)}
                    </div>
                    <div className="text-white/60 text-sm uppercase tracking-widest mt-2">
                        {isComplete ? 'Total Time' : (isSteadyState || isCustomSteadyBlock) ? 'Block Time' : 'Phase Time'}
                    </div>
                </div>

                {/* Phase Progress Ring (for intervals only - not for steady-state or steady blocks in custom sessions) */}
                {!isSteadyState && !isComplete && !isCustomSteadyBlock && (
                    <div className="relative w-40 h-40 mb-6">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="80"
                                cy="80"
                                r="72"
                                stroke="currentColor"
                                strokeWidth="6"
                                fill="none"
                                className="text-white/10"
                            />
                            <circle
                                cx="80"
                                cy="80"
                                r="72"
                                stroke="currentColor"
                                strokeWidth="6"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={452}
                                strokeDashoffset={452 - (452 * phaseProgress) / 100}
                                className={isWorkPhase ? 'text-green-400' : 'text-blue-400'}
                                style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="text-3xl font-bold">
                                {state.currentInterval}/{state.totalIntervals}
                            </div>
                            <div className="text-white/60 text-xs uppercase tracking-widest">
                                Intervals
                            </div>
                        </div>
                    </div>
                )}

                {/* Session Progress Bar */}
                <div className="w-full max-w-md mb-4">
                    <div className="flex justify-between text-xs text-white/60 mb-2">
                        <span>{formatTime(state.sessionTimeElapsed)}</span>
                        <span>{formatTime(state.sessionTimeRemaining)}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-white rounded-full transition-all duration-100"
                            style={{ width: `${sessionProgress}%` }}
                        />
                    </div>
                </div>

                {/* Target Info */}
                {(() => {
                    const { currentPhase } = state;
                    const result = completionResult || pendingResultRef.current;

                    // Determine display power:
                    // - For COMPLETION screen: show INITIAL target power (what was planned)
                    // - For active session: show current power (may be adjusted)
                    let displayPower: number;
                    let powerLabel: string;

                    if (isComplete) {
                        // On completion screen, show the INITIAL (planned) target power
                        displayPower = result?.initialTargetPower || initialTargetPowerRef.current || state.targetPower;
                        powerLabel = 'Target Power';
                    } else {
                        // During active session
                        // For custom sessions, calculate block-specific power
                        if (isCustomSession && params && state.currentBlockIndex !== undefined && params.blocks) {
                            const currentBlock = params.blocks[state.currentBlockIndex];
                            if (currentBlock) {
                                // Calculate original block power + raw adjustment delta
                                // This ensures Harder/Easier adds exactly 5W, not 5W × multiplier
                                const originalBlockPower = Math.round(params.targetPower * currentBlock.powerMultiplier);
                                const powerDelta = state.targetPower - params.targetPower;
                                const blockPower = originalBlockPower + powerDelta;

                                if (currentBlock.type === 'steady-state') {
                                    // Steady-state block: show block power directly
                                    displayPower = blockPower;
                                    powerLabel = 'Target Power';


                                } else {
                                    // Interval block: show work/rest power from initialPowerRef
                                    if (initialPowerRef.current) {
                                        if (currentPhase === 'work') {
                                            displayPower = initialPowerRef.current.workPower;
                                            powerLabel = 'Work Power';
                                        } else {
                                            displayPower = initialPowerRef.current.restPower;
                                            powerLabel = 'Rest Power';
                                        }
                                    } else {
                                        displayPower = blockPower;
                                        powerLabel = 'Target Power';
                                    }
                                }
                            } else {
                                displayPower = state.targetPower;
                                powerLabel = 'Target Power';
                            }
                        } else if (!isSteadyState && initialPowerRef.current) {
                            // Standard interval session: show work/rest power
                            if (currentPhase === 'work') {
                                displayPower = initialPowerRef.current.workPower;
                                powerLabel = 'Work Power';
                            } else {
                                displayPower = initialPowerRef.current.restPower;
                                powerLabel = 'Rest Power';
                            }
                        } else {
                            // Standard steady-state session
                            displayPower = state.targetPower;
                            powerLabel = 'Target Power';
                        }
                    }

                    return (
                        <div className="flex flex-col items-center gap-2 mb-4">
                            {/* Power and Effort - always on same line */}
                            <div className="flex items-center justify-center gap-4 sm:gap-6">
                                <div className="text-center min-w-[70px]">
                                    <div className="text-xl font-bold">
                                        {displayPower}W
                                    </div>
                                    <div className="text-white/60 text-xs uppercase tracking-widest">{powerLabel}</div>
                                </div>
                                <div className="w-px h-8 bg-white/20" />
                                <div className="text-center min-w-[70px]">
                                    <div className="text-xl font-bold">
                                        RPE {state.targetRPE}
                                    </div>
                                    <div className="text-white/60 text-xs uppercase tracking-widest">Target Effort</div>
                                </div>
                            </div>
                            {/* Work/Rest timing - only for interval sessions/blocks, NOT for steady-state */}
                            {!isSteadyState && !isComplete && !isCustomSteadyBlock && (
                                <div className="text-center">
                                    <div className="text-xl font-bold font-mono whitespace-nowrap">
                                        {state.workDurationSeconds}s<span className="text-white/40 mx-1">/</span>{state.restDurationSeconds}s
                                    </div>
                                    <div className="text-white/60 text-xs uppercase tracking-widest">Work / Rest</div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* Control Buttons */}
            <div className="p-6 pb-8">
                {isComplete ? (
                    <button
                        onClick={handleLogSession}
                        className="w-full py-4 bg-white text-neutral-900 rounded-2xl font-bold text-lg flex items-center justify-center gap-3"
                    >
                        Log Session
                    </button>
                ) : (
                    <div className="flex items-center justify-center gap-4">
                        {/* Skip Button (intervals only) */}
                        {!isSteadyState && (
                            <button
                                onClick={skipToNextPhase}
                                className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                                <SkipForward size={24} />
                            </button>
                        )}

                        {/* Play/Pause Button */}
                        <button
                            onClick={() => state.isPaused ? resume() : pause()}
                            className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-neutral-900 shadow-lg hover:scale-105 transition-transform"
                        >
                            {state.isPaused ? (
                                <Play size={36} fill="currentColor" className="ml-1" />
                            ) : (
                                <Pause size={36} fill="currentColor" />
                            )}
                        </button>

                        {/* Stop Button */}
                        <button
                            onClick={handleStopClick}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${confirmStop
                                ? 'bg-red-500 animate-pulse'
                                : 'bg-white/10 hover:bg-red-500/50'
                                }`}
                        >
                            <Square size={24} fill="currentColor" />
                        </button>
                    </div>
                )}

                {confirmStop && (
                    <div className="text-center mt-3 text-red-400 text-sm animate-pulse">
                        Tap again to confirm stop
                    </div>
                )}

                {state.isPaused && !confirmStop && (
                    <div className="text-center mt-3 text-white/60 text-sm">
                        Session Paused
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveSessionGuide;
