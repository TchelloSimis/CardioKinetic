import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Timer, Activity, Clock, Minus, Plus, Layers } from 'lucide-react';
import { PlanWeek, SessionSetupParams, SessionStyle, SessionBlock } from '../../types';
import {
    calculateProjectedAveragePower,
    calculateProjectedTotalWork,
    calculateCustomSessionDuration,
} from '../../hooks/sessionTimerUtils';
import {
    parseRatio,
    roundTo5,
    gcd,
    interpolateColor,
    isLightColor,
    adjustWorkRestPair,
    formatDuration,
    getRPEDescriptionWithHeartRate,
} from './sessionSetupUtils';
import BlockEditor from './BlockEditor';

interface SessionSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (params: SessionSetupParams) => void;
    currentWeekPlan: PlanWeek;
    initialParams?: SessionSetupParams | null; // Used to restore settings when coming back from live session
    accentColor?: string;    // Primary accent (e.g., #6ee7b7 in light, #34d399 in dark)
    accentAltColor?: string; // Alt accent (e.g., #059669 in light, #064e3b in dark) - darker variant
    isDarkMode?: boolean;
    userAge?: number | null;
}







/**
 * Full-screen modal for configuring session parameters before starting a guided session
 */
const SessionSetupModal: React.FC<SessionSetupModalProps> = ({
    isOpen,
    onClose,
    onStart,
    currentWeekPlan,
    initialParams,
    accentColor,
    accentAltColor,
    isDarkMode = false,
    userAge = null,
}) => {
    // Color assignments
    const fatigueColor = (typeof accentAltColor === 'string' && accentAltColor.startsWith('#')) ? accentAltColor : (isDarkMode ? '#34d399' : '#059669');
    const readinessColor = (typeof accentColor === 'string' && accentColor.startsWith('#')) ? accentColor : (isDarkMode ? '#6ee7b7' : '#34d399');

    // Determine session style from plan
    const isSteadyState =
        currentWeekPlan.sessionStyle === 'steady-state' ||
        currentWeekPlan.workRestRatio === 'steady' ||
        currentWeekPlan.workRestRatio === '1:0';

    // Parse ratio for initial calculation
    const initialRatio = parseRatio(currentWeekPlan.workRestRatio);

    // Form state
    const [totalDuration, setTotalDuration] = useState(currentWeekPlan.targetDurationMinutes || 15);
    const [workDuration, setWorkDuration] = useState(30);
    const [restDuration, setRestDuration] = useState(30);
    const [targetPower, setTargetPower] = useState(currentWeekPlan.plannedPower);
    const [targetRPE, setTargetRPE] = useState(currentWeekPlan.targetRPE);
    const [sessionStyle, setSessionStyle] = useState<SessionStyle>(isSteadyState ? 'steady-state' : 'interval');
    const [cycles, setCycles] = useState(10);

    // Custom session blocks state
    const [blocks, setBlocks] = useState<SessionBlock[]>([]);

    // Scroll-based FAB visibility
    const [showStartButton, setShowStartButton] = useState(true);
    const lastScrollY = useRef(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const currentScrollY = e.currentTarget.scrollTop;
        if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
            setShowStartButton(false);
        } else {
            setShowStartButton(true);
        }
        lastScrollY.current = currentScrollY;
    };

    // Derived values
    const baseInterval = workDuration + restDuration;
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const ratioGcd = gcd(workDuration, restDuration) || 1;
    const workRatioPart = Math.round(workDuration / ratioGcd);
    const restRatioPart = Math.round(restDuration / ratioGcd);

    useEffect(() => {
        if (isOpen) {
            // If we have initialParams (coming back from live session), use those
            if (initialParams) {
                setTotalDuration(initialParams.totalDurationMinutes);
                setTargetPower(initialParams.targetPower);
                setTargetRPE(initialParams.targetRPE);
                setSessionStyle(initialParams.sessionStyle);
                setWorkDuration(initialParams.workDurationSeconds);
                setRestDuration(initialParams.restDurationSeconds);
            } else {
                // Otherwise, initialize from currentWeekPlan
                const ratio = parseRatio(currentWeekPlan.workRestRatio);
                setTotalDuration(currentWeekPlan.targetDurationMinutes || 15);
                setTargetPower(currentWeekPlan.plannedPower);
                setTargetRPE(currentWeekPlan.targetRPE);
                setSessionStyle(isSteadyState ? 'steady-state' : 'interval');

                const planWork = currentWeekPlan.workDurationSeconds || 30;
                const planRest = currentWeekPlan.restDurationSeconds || 30;

                if (currentWeekPlan.workDurationSeconds && currentWeekPlan.restDurationSeconds) {
                    setWorkDuration(roundTo5(planWork));
                    setRestDuration(roundTo5(planRest));
                    const cycleTime = planWork + planRest;
                    setCycles(Math.floor((currentWeekPlan.targetDurationMinutes || 15) * 60 / cycleTime) || 10);
                } else {
                    const totalCycle = 60;
                    const totalParts = ratio.work + ratio.rest || 1;
                    const w = Math.max(5, roundTo5((ratio.work / totalParts) * totalCycle));
                    const r = Math.max(5, roundTo5((ratio.rest / totalParts) * totalCycle));
                    setWorkDuration(w);
                    setRestDuration(r);
                    setCycles(Math.floor((currentWeekPlan.targetDurationMinutes || 15) * 60 / (w + r)) || 10);
                }
            }
            // Reset scroll state
            setShowStartButton(true);
            lastScrollY.current = 0;

            // Initialize blocks for custom sessions from plan if available
            if (currentWeekPlan.blocks && currentWeekPlan.blocks.length > 0) {
                setBlocks(currentWeekPlan.blocks);
            } else {
                // Start with empty blocks for custom sessions
                setBlocks([]);
            }
        }
    }, [isOpen, currentWeekPlan, isSteadyState, initialParams]);

    const estimatedIntervals = sessionStyle === 'steady-state' ? 1 : cycles;
    // Calculate estimated duration for interval sessions
    const estimatedSessionDurationMin = sessionStyle === 'interval'
        ? (cycles * baseInterval) / 60
        : totalDuration;

    // Formatting helper for duration
    const formatDuration = (mins: number) => {
        const totalSeconds = Math.round(mins * 60);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return s > 0 ? `${m}m ${s}s` : `${m} min`;
    };

    // Calculate projected values for custom sessions
    const projectedAvgPower = sessionStyle === 'custom' && blocks.length > 0
        ? calculateProjectedAveragePower(blocks, targetPower)
        : targetPower;
    const projectedTotalWork = sessionStyle === 'custom' && blocks.length > 0
        ? calculateProjectedTotalWork(blocks, targetPower)
        : Math.round(targetPower * (totalDuration / 60) * 100) / 100;
    const customDuration = sessionStyle === 'custom' && blocks.length > 0
        ? calculateCustomSessionDuration(blocks)
        : totalDuration;

    const handleStart = () => {
        if (sessionStyle === 'custom') {
            // For custom sessions, use blocks and calculate total duration from them
            onStart({
                totalDurationMinutes: customDuration,
                workDurationSeconds: workDuration,
                restDurationSeconds: restDuration,
                targetPower,
                targetRPE,
                sessionStyle: 'custom',
                workRestRatio: 'custom',
                blocks: blocks,
            });
        } else {
            // For interval sessions, recalculate total duration based on cycles
            const finalDuration = sessionStyle === 'interval'
                ? (cycles * (workDuration + restDuration)) / 60
                : totalDuration;

            onStart({
                totalDurationMinutes: finalDuration,
                workDurationSeconds: workDuration,
                restDurationSeconds: restDuration,
                targetPower,
                targetRPE,
                sessionStyle,
                workRestRatio: sessionStyle === 'steady-state' ? 'steady' : `${workRatioPart}:${restRatioPart}`,
                // Pass cycles if needed by the consumer, though currently mostly implicit in duration/work/rest
            });
        }
    };

    const handleMoreWork = () => {
        if (restDuration > 5) {
            setWorkDuration(prev => prev + 5);
            setRestDuration(prev => Math.max(5, prev - 5));
        }
    };

    const handleMoreRest = () => {
        if (workDuration > 5) {
            setRestDuration(prev => prev + 5);
            setWorkDuration(prev => Math.max(5, prev - 5));
        }
    };

    const adjustCycleTime = (delta: number) => {
        const direction = delta > 0 ? 1 : -1;
        const { work, rest } = adjustWorkRestPair(workDuration, restDuration, direction);
        setWorkDuration(work);
        setRestDuration(rest);
    };

    // RPE gradient from readiness (low RPE = easy) to fatigue (high RPE = hard)
    const getRPEColor = (rpe: number): string => {
        const factor = (rpe - 1) / 9;
        return interpolateColor(readinessColor, fatigueColor, factor);
    };



    if (!isOpen) return null;

    // Determine text colors based on background luminance
    const workTextColor = isLightColor(fatigueColor) ? '#171717' : '#ffffff';
    const restTextColor = isLightColor(readinessColor) ? '#171717' : '#ffffff';

    return (
        <div className={`fixed inset-0 z-50 flex flex-col ${isDarkMode ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-neutral-800' : 'border-neutral-200'}`}>
                <button onClick={onClose} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-neutral-800' : 'hover:bg-neutral-200'}`}>
                    <X size={24} />
                </button>
                <h2 className="text-lg font-bold">Session Setup</h2>
                <div className="w-10" />
            </div>

            {/* Content */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-6 space-y-6 pb-32"
            >
                {/* Session Type */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">Session Type</label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['interval', 'steady-state', 'custom'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setSessionStyle(type)}
                                className="p-3 rounded-2xl border-2 flex flex-col items-center gap-2"
                                style={{
                                    borderColor: sessionStyle === type ? readinessColor : 'transparent',
                                    backgroundColor: sessionStyle === type ? `${readinessColor}20` : isDarkMode ? '#262626' : '#f5f5f5',
                                }}
                            >
                                {type === 'interval' ? <Activity size={24} style={{ color: sessionStyle === type ? readinessColor : undefined }} />
                                    : type === 'steady-state' ? <Timer size={24} style={{ color: sessionStyle === type ? readinessColor : undefined }} />
                                        : <Layers size={24} style={{ color: sessionStyle === type ? readinessColor : undefined }} />}
                                <span className="text-xs font-bold">{type === 'interval' ? 'Interval' : type === 'steady-state' ? 'Steady' : 'Custom'}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Total Duration - only for steady-state sessions */}
                {sessionStyle === 'steady-state' && (
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2 flex items-center gap-2">
                            <Clock size={12} /> Total Duration
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min={5} max={60} step={5}
                                value={totalDuration}
                                onChange={(e) => setTotalDuration(Number(e.target.value))}
                                className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer 
                                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full 
                                    [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0
                                    ${isDarkMode
                                        ? '[&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:bg-white bg-neutral-700'
                                        : '[&::-webkit-slider-thumb]:bg-neutral-900 [&::-moz-range-thumb]:bg-neutral-900 bg-neutral-300'
                                    }`}
                            />
                            <div className="w-24 text-right">
                                <span className="text-3xl font-mono font-bold">{totalDuration}</span>
                                <span className="text-neutral-500 ml-1">min</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Number of Cycles - only for interval sessions */}
                {sessionStyle === 'interval' && (
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2 flex items-center gap-2">
                            <Layers size={12} /> Number of Cycles
                        </label>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setCycles(c => Math.max(1, c - 1))}
                                className="w-12 h-12 rounded-xl flex items-center justify-center transition-active active:scale-95"
                                style={{ backgroundColor: isDarkMode ? '#262626' : '#e5e5e5' }}
                            >
                                <Minus size={20} />
                            </button>
                            <div className="flex-1 text-center">
                                <span className="text-4xl font-mono font-bold">{cycles}</span>
                                <span className="text-neutral-500 ml-2">cycles</span>
                            </div>
                            <button
                                onClick={() => setCycles(c => Math.min(100, c + 1))}
                                className="w-12 h-12 rounded-xl flex items-center justify-center transition-active active:scale-95"
                                style={{ backgroundColor: isDarkMode ? '#262626' : '#e5e5e5' }}
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Interval Settings */}
                {sessionStyle === 'interval' && (
                    <>
                        {/* Cycle Time */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">Cycle Time (Work + Rest)</label>
                            <div className="flex items-center gap-3">
                                <button onClick={() => adjustCycleTime(-5)} className="w-12 h-12 rounded-xl" style={{ backgroundColor: isDarkMode ? '#262626' : '#e5e5e5' }}>
                                    <Minus size={20} className="mx-auto" />
                                </button>
                                <div className="flex-1 text-center">
                                    <span className="text-4xl font-mono font-bold">{baseInterval}</span>
                                    <span className="text-neutral-500 ml-1">sec</span>
                                </div>
                                <button onClick={() => adjustCycleTime(5)} className="w-12 h-12 rounded-xl" style={{ backgroundColor: isDarkMode ? '#262626' : '#e5e5e5' }}>
                                    <Plus size={20} className="mx-auto" />
                                </button>
                            </div>
                            <div className="text-center text-xs text-neutral-500 mt-2">Range: 10s - 600s</div>
                        </div>

                        {/* Work:Rest Ratio */}
                        <div className="rounded-2xl p-4" style={{ backgroundColor: isDarkMode ? '#171717' : '#f5f5f5' }}>
                            <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3 text-center">
                                Work : Rest Ratio ({workRatioPart}:{restRatioPart})
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="text-center">
                                    <div className="text-3xl font-mono font-bold" style={{ color: fatigueColor }}>{workDuration}s</div>
                                    <div className="text-xs uppercase tracking-widest text-neutral-500 mt-1">Work</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-mono font-bold" style={{ color: readinessColor }}>{restDuration}s</div>
                                    <div className="text-xs uppercase tracking-widest text-neutral-500 mt-1">Rest</div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleMoreWork}
                                    disabled={restDuration <= 5}
                                    className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50 text-white"
                                    style={{ backgroundColor: fatigueColor }}
                                >
                                    + Work
                                </button>
                                <button
                                    onClick={handleMoreRest}
                                    disabled={workDuration <= 5}
                                    className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50 text-white"
                                    style={{ backgroundColor: readinessColor }}
                                >
                                    + Rest
                                </button>
                            </div>
                        </div>

                        {/* Estimated Session Duration (was Intervals) */}
                        <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${readinessColor}15` }}>
                            <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-1">
                                Estimated Session Duration
                            </div>
                            <div className="text-4xl font-mono font-bold" style={{ color: readinessColor }}>
                                {formatDuration(estimatedSessionDurationMin)}
                            </div>
                        </div>
                    </>
                )}

                {/* Custom Session Block Builder */}
                {sessionStyle === 'custom' && (
                    <BlockEditor
                        blocks={blocks}
                        setBlocks={setBlocks}
                        targetPower={targetPower}
                        readinessColor={readinessColor}
                        fatigueColor={fatigueColor}
                        isDarkMode={isDarkMode}
                        customDuration={customDuration}
                        projectedAvgPower={projectedAvgPower}
                        projectedTotalWork={projectedTotalWork}
                    />
                )}

                {/* Target Average Power / Base Power */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">
                        {sessionStyle === 'custom' ? 'Base Power (100%)' : 'Target Average Power'}
                    </label>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setTargetPower(Math.max(50, targetPower - 10))} className="w-12 h-12 rounded-xl" style={{ backgroundColor: isDarkMode ? '#262626' : '#e5e5e5' }}>
                            <Minus size={20} className="mx-auto" />
                        </button>
                        <div className="flex-1 text-center">
                            <span className="text-4xl font-mono font-bold">{targetPower}</span>
                            <span className="text-neutral-500 ml-1">W</span>
                        </div>
                        <button onClick={() => setTargetPower(targetPower + 10)} className="w-12 h-12 rounded-xl" style={{ backgroundColor: isDarkMode ? '#262626' : '#e5e5e5' }}>
                            <Plus size={20} className="mx-auto" />
                        </button>
                    </div>
                </div>

                {/* Target RPE */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">Target RPE</label>
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs text-neutral-500 w-6">1</span>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            step="0.5"
                            value={targetRPE}
                            onChange={(e) => setTargetRPE(Number(e.target.value))}
                            className={`flex-1 h-3 rounded-lg appearance-none cursor-pointer 
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                                [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-lg`}
                            style={{
                                background: `linear-gradient(to right, ${readinessColor}, ${fatigueColor})`,
                                // @ts-ignore - CSS custom property for thumb color
                                '--thumb-bg': getRPEColor(targetRPE),
                            } as React.CSSProperties & { '--thumb-bg': string }}
                        />
                        <span className="text-xs text-neutral-500 w-6 text-right">10</span>
                        <style>{`
                            input[type="range"]::-webkit-slider-thumb { background-color: ${getRPEColor(targetRPE)}; }
                            input[type="range"]::-moz-range-thumb { background-color: ${getRPEColor(targetRPE)}; }
                        `}</style>
                    </div>
                    <div className="flex justify-center items-center mb-3">
                        <span className="text-4xl font-mono font-bold" style={{ color: getRPEColor(targetRPE) }}>
                            {targetRPE}
                        </span>
                    </div>
                    <div className="text-center text-sm py-3 px-4 rounded-xl" style={{ backgroundColor: `${getRPEColor(targetRPE)}20`, color: getRPEColor(targetRPE) }}>
                        {getRPEDescriptionWithHeartRate(targetRPE, userAge)}
                    </div>
                </div>
            </div>

            {/* Floating Start Button (like LOG FAB) */}
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-in-out ${showStartButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
                }`}>
                <button
                    onClick={handleStart}
                    className="backdrop-blur-2xl backdrop-saturate-150 text-white border border-white/30 rounded-2xl py-3 px-8 shadow-2xl flex items-center gap-2 hover:scale-105 transition-transform active:scale-95"
                    style={{ backgroundColor: `${readinessColor}ee` }}
                >
                    <Play size={20} fill="currentColor" />
                    <span className="text-sm font-bold uppercase tracking-widest">Start Session</span>
                </button>
            </div>
        </div>
    );
};

export default SessionSetupModal;
