import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Timer, Activity, Clock, Minus, Plus, Layers, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { PlanWeek, SessionSetupParams, SessionStyle, SessionBlock } from '../../types';
import {
    generateBlockId,
    calculateProjectedAveragePower,
    calculateProjectedTotalWork,
    calculateCustomSessionDuration,
} from '../../hooks/sessionTimerUtils';

interface SessionSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (params: SessionSetupParams) => void;
    currentWeekPlan: PlanWeek;
    initialParams?: SessionSetupParams | null; // Used to restore settings when coming back from live session
    accentColor?: string;    // Primary accent (e.g., #6ee7b7 in light, #34d399 in dark)
    accentAltColor?: string; // Alt accent (e.g., #059669 in light, #064e3b in dark) - darker variant
    isDarkMode?: boolean;
}

// Fallback colors
const DEFAULT_WORK_LIGHT = '#059669';  // darker green for work
const DEFAULT_WORK_DARK = '#34d399';   // brighter green for work in dark
const DEFAULT_REST_LIGHT = '#0284c7';  // blue for rest
const DEFAULT_REST_DARK = '#38bdf8';   // bright blue for rest in dark

// RPE descriptions
const RPE_DESCRIPTIONS: Record<number, string> = {
    1: 'Very light - minimal effort',
    2: 'Light - easy conversation',
    3: 'Light - comfortable pace',
    4: 'Moderate - mild effort',
    5: 'Moderate - sustainable',
    6: 'Somewhat hard - working',
    7: 'Hard - challenging',
    8: 'Very hard - difficult',
    9: 'Extremely hard - near max',
    10: 'Maximum - all-out effort',
};

/**
 * Parse work:rest ratio string into parts
 */
const parseRatio = (ratio: string): { work: number; rest: number } => {
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
 * Round to nearest multiple of 5
 */
const roundTo5 = (n: number): number => Math.round(n / 5) * 5;

/**
 * Interpolate between two colors based on a 0-1 factor
 */
const interpolateColor = (color1: string, color2: string, factor: number): string => {
    try {
        const hex = (c: string) => parseInt(c, 16);
        const r1 = hex(color1.slice(1, 3)), g1 = hex(color1.slice(3, 5)), b1 = hex(color1.slice(5, 7));
        const r2 = hex(color2.slice(1, 3)), g2 = hex(color2.slice(3, 5)), b2 = hex(color2.slice(5, 7));

        const r = Math.round(r1 + (r2 - r1) * factor);
        const g = Math.round(g1 + (g2 - g1) * factor);
        const b = Math.round(b1 + (b2 - b1) * factor);

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    } catch {
        return color1;
    }
};

/**
 * Adjust work/rest pair to meet a target cycle time change
 * Enforces 10s steps, 5s minimums, and balanced distribution
 */
const adjustWorkRestPair = (work: number, rest: number, direction: 1 | -1): { work: number, rest: number } => {
    const currentTotal = work + rest;

    // Determine target total (snap to next 10s increment)
    // If direction is 1 (up), go to next multiple of 10
    // If direction is -1 (down), go to prev multiple of 10
    let targetTotal;
    if (direction === 1) {
        targetTotal = Math.floor(currentTotal / 10) * 10 + 10;
    } else {
        targetTotal = Math.ceil(currentTotal / 10) * 10 - 10;
    }

    // Clamp range 10s - 600s
    targetTotal = Math.min(600, Math.max(10, targetTotal));

    if (targetTotal === currentTotal) return { work, rest };

    let diff = targetTotal - currentTotal;
    let newWork = work;
    let newRest = rest;

    // Distribute difference
    // We deal in 5s chunks
    while (diff !== 0) {
        const step = diff > 0 ? 5 : -5;

        // If we can distribute to both (diff is 10, -10, 20 etc)
        if (Math.abs(diff) >= 10) {
            // Try to add/sub from both
            // Check constraints if reducing
            if (step < 0) {
                if (newWork + step >= 5 && newRest + step >= 5) {
                    newWork += step;
                    newRest += step;
                    diff -= step * 2;
                    continue;
                }
                // If we can't reduce both, fall through to single reduction
            } else {
                newWork += step;
                newRest += step;
                diff -= step * 2;
                continue;
            }
        }

        // Single 5s adjustment needed (or fallback from above)
        // If increasing (+5): Add to smaller to balance
        if (step > 0) {
            if (newWork <= newRest) newWork += step;
            else newRest += step;
        }
        // If decreasing (-5): Subtract from larger to balance
        else {
            if (newWork > newRest && newWork + step >= 5) newWork += step;
            else if (newRest + step >= 5) newRest += step;
            else if (newWork + step >= 5) newWork += step; // Fallback if rest was somehow chosen but hit limit
            else {
                // Cannot reduce further (both at 5s)
                break;
            }
        }
        diff -= step;
    }

    return { work: newWork, rest: newRest };
};

/**
 * Determine if a color is light (needs dark text) or dark (needs light text)
 */
const isLightColor = (color: string): boolean => {
    try {
        const hex = color.replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        // Using relative luminance formula - threshold at 0.55 for better contrast
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.55;
    } catch {
        return false;
    }
};

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

    // Block management functions for custom sessions
    const addBlock = (type: 'steady-state' | 'interval') => {
        const newBlock: SessionBlock = {
            id: generateBlockId(),
            type,
            durationMinutes: 5,
            powerMultiplier: 1.0,
            workRestRatio: type === 'interval' ? '2:1' : undefined,
            ...(type === 'interval' ? {
                cycles: 5,
                workDurationSeconds: 40,
                restDurationSeconds: 20
            } : {})
        };
        setBlocks(prev => [...prev, newBlock]);
    };

    const removeBlock = (id: string) => {
        setBlocks(prev => prev.filter(b => b.id !== id));
    };

    const updateBlock = (id: string, updates: Partial<SessionBlock>) => {
        setBlocks(prev => prev.map(b => {
            if (b.id !== id) return b;
            const newBlock = { ...b, ...updates };

            // Sync logic for interval blocks
            if (newBlock.type === 'interval') {
                const cycles = newBlock.cycles ?? 1;
                const work = newBlock.workDurationSeconds ?? 30;
                const rest = newBlock.restDurationSeconds ?? 30;

                // Sync duration if relevant fields changed
                if (updates.cycles !== undefined || updates.workDurationSeconds !== undefined || updates.restDurationSeconds !== undefined) {
                    newBlock.durationMinutes = Math.round((cycles * (work + rest) / 60) * 100) / 100;
                }
            }
            return newBlock;
        }));
    };

    const moveBlock = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === blocks.length - 1) return;

        setBlocks(prev => {
            const newBlocks = [...prev];
            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
            return newBlocks;
        });
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
                    <div className="space-y-4">
                        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400">Training Blocks</label>

                        {/* Block List */}
                        {blocks.length === 0 ? (
                            <div className={`rounded-3xl p-8 text-center border-2 border-dashed ${isDarkMode ? 'border-neutral-800 bg-neutral-900/50' : 'border-neutral-200 bg-neutral-50'}`}>
                                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${readinessColor}20` }}>
                                    <Layers size={32} style={{ color: readinessColor }} />
                                </div>
                                <h3 className="font-bold text-lg mb-2">Create Custom Session</h3>
                                <p className="text-neutral-500 text-sm mb-6 max-w-xs mx-auto">Add training blocks to build a session tailored to your specific goals.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {blocks.map((block, index) => {
                                    const blockColor = block.type === 'steady-state' ? readinessColor : fatigueColor;
                                    return (
                                        <div
                                            key={block.id}
                                            className="rounded-3xl p-2 relative overflow-hidden transition-all"
                                            style={{
                                                backgroundColor: `${blockColor}10`,
                                                borderLeft: `6px solid ${blockColor}`,
                                            }}
                                        >
                                            {/* Block Header */}
                                            <div className="flex items-start justify-between p-3 pb-1">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm"
                                                        style={{ backgroundColor: blockColor, color: '#ffffff' }}>
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold uppercase tracking-wider text-sm">
                                                                {block.type === 'steady-state' ? 'STEADY' : 'INTERVAL'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <div className="flex flex-col gap-1 mr-2">
                                                        <button
                                                            onClick={() => moveBlock(index, 'up')}
                                                            disabled={index === 0}
                                                            className="p-1 rounded hover:bg-black/5 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                                                        >
                                                            <ArrowUp size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => moveBlock(index, 'down')}
                                                            disabled={index === blocks.length - 1}
                                                            className="p-1 rounded hover:bg-black/5 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                                                        >
                                                            <ArrowDown size={14} />
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => removeBlock(block.id)}
                                                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/10 text-red-500 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Controls Row */}
                                            <div className="flex flex-col gap-2 px-3 pb-3">
                                                {/* STEADY STATE: Duration & Power */}
                                                {block.type === 'steady-state' && (
                                                    <div className="flex items-center gap-2">
                                                        {/* Duration */}
                                                        <div className="flex-1 rounded-2xl p-2 flex items-center gap-2" style={{ backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }}>
                                                            <button
                                                                onClick={() => updateBlock(block.id, { durationMinutes: Math.max(1, block.durationMinutes - 1) })}
                                                                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-active active:scale-95 ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-white hover:bg-neutral-100 shadow-sm'}`}
                                                            >
                                                                <Minus size={16} />
                                                            </button>
                                                            <div className="flex-1 text-center min-w-[3rem]">
                                                                <div className="font-mono font-bold text-xl leading-none">{block.durationMinutes}</div>
                                                                <div className="text-[10px] uppercase tracking-wider opacity-60">min</div>
                                                            </div>
                                                            <button
                                                                onClick={() => updateBlock(block.id, { durationMinutes: block.durationMinutes + 1 })}
                                                                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-active active:scale-95 ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-white hover:bg-neutral-100 shadow-sm'}`}
                                                            >
                                                                <Plus size={16} />
                                                            </button>
                                                        </div>

                                                        {/* Power */}
                                                        <div className="flex-1 rounded-2xl p-2 flex items-center gap-2" style={{ backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }}>
                                                            <button
                                                                onClick={() => updateBlock(block.id, { powerMultiplier: Math.max(0.5, Math.round((block.powerMultiplier - 0.05) * 100) / 100) })}
                                                                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-active active:scale-95 ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-white hover:bg-neutral-100 shadow-sm'}`}
                                                            >
                                                                <Minus size={16} />
                                                            </button>
                                                            <div className="flex-1 text-center min-w-[3rem]">
                                                                <div className="font-mono font-bold text-xl leading-none">{(block.powerMultiplier * 100).toFixed(0)}%</div>
                                                                <div className="text-[10px] uppercase tracking-wider opacity-60">FTP</div>
                                                            </div>
                                                            <button
                                                                onClick={() => updateBlock(block.id, { powerMultiplier: Math.round((block.powerMultiplier + 0.05) * 100) / 100 })}
                                                                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-active active:scale-95 ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-white hover:bg-neutral-100 shadow-sm'}`}
                                                            >
                                                                <Plus size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* INTERVAL: Cycles, Power, Cycle Time, Ratio */}
                                                {block.type === 'interval' && (
                                                    <div className="space-y-2">
                                                        {/* Row 1: Cycles & Power */}
                                                        <div className="flex items-center gap-2">
                                                            {/* Cycles */}
                                                            <div className="flex-1 rounded-2xl p-2 flex items-center gap-2" style={{ backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }}>
                                                                <button
                                                                    onClick={() => updateBlock(block.id, { cycles: Math.max(1, (block.cycles || 1) - 1) })}
                                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-active active:scale-95 ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-white hover:bg-neutral-100 shadow-sm'}`}
                                                                >
                                                                    <Minus size={16} />
                                                                </button>
                                                                <div className="flex-1 text-center min-w-[3rem]">
                                                                    <div className="font-mono font-bold text-xl leading-none">{block.cycles || 1}</div>
                                                                    <div className="text-[10px] uppercase tracking-wider opacity-60">Cycles</div>
                                                                </div>
                                                                <button
                                                                    onClick={() => updateBlock(block.id, { cycles: (block.cycles || 1) + 1 })}
                                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-active active:scale-95 ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-white hover:bg-neutral-100 shadow-sm'}`}
                                                                >
                                                                    <Plus size={16} />
                                                                </button>
                                                            </div>

                                                            {/* Power */}
                                                            <div className="flex-1 rounded-2xl p-2 flex items-center gap-2" style={{ backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }}>
                                                                <button
                                                                    onClick={() => updateBlock(block.id, { powerMultiplier: Math.max(0.5, Math.round((block.powerMultiplier - 0.05) * 100) / 100) })}
                                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-active active:scale-95 ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-white hover:bg-neutral-100 shadow-sm'}`}
                                                                >
                                                                    <Minus size={16} />
                                                                </button>
                                                                <div className="flex-1 text-center min-w-[3rem]">
                                                                    <div className="font-mono font-bold text-xl leading-none">{(block.powerMultiplier * 100).toFixed(0)}%</div>
                                                                    <div className="text-[10px] uppercase tracking-wider opacity-60">FTP</div>
                                                                </div>
                                                                <button
                                                                    onClick={() => updateBlock(block.id, { powerMultiplier: Math.round((block.powerMultiplier + 0.05) * 100) / 100 })}
                                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-active active:scale-95 ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-white hover:bg-neutral-100 shadow-sm'}`}
                                                                >
                                                                    <Plus size={16} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Row 2: Cycle Time */}
                                                        <div className="rounded-2xl p-2 flex items-center gap-2" style={{ backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }}>
                                                            <button
                                                                onClick={() => {
                                                                    const w = block.workDurationSeconds || 30;
                                                                    const r = block.restDurationSeconds || 30;
                                                                    const { work, rest } = adjustWorkRestPair(w, r, -1);
                                                                    updateBlock(block.id, {
                                                                        workDurationSeconds: work,
                                                                        restDurationSeconds: rest
                                                                    });
                                                                }}
                                                                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-active active:scale-95 ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-white hover:bg-neutral-100 shadow-sm'}`}
                                                            >
                                                                <Minus size={16} />
                                                            </button>
                                                            <div className="flex-1 text-center">
                                                                <div className="font-mono font-bold text-xl leading-none">{(block.workDurationSeconds || 0) + (block.restDurationSeconds || 0)}s</div>
                                                                <div className="text-[10px] uppercase tracking-wider opacity-60">Cycle Time</div>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    const w = block.workDurationSeconds || 30;
                                                                    const r = block.restDurationSeconds || 30;
                                                                    const { work, rest } = adjustWorkRestPair(w, r, 1);
                                                                    updateBlock(block.id, {
                                                                        workDurationSeconds: work,
                                                                        restDurationSeconds: rest
                                                                    });
                                                                }}
                                                                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-active active:scale-95 ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-white hover:bg-neutral-100 shadow-sm'}`}
                                                            >
                                                                <Plus size={16} />
                                                            </button>
                                                        </div>

                                                        {/* Row 3: Work/Rest Balance */}
                                                        <div className="rounded-2xl p-2" style={{ backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }}>
                                                            {/* Visual Display */}
                                                            <div className="flex text-center mb-2">
                                                                <div className="flex-1">
                                                                    <div className="font-mono font-bold text-lg" style={{ color: fatigueColor }}>{block.workDurationSeconds || 0}s</div>
                                                                    <div className="text-[10px] uppercase tracking-wider opacity-60">Work</div>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="font-mono font-bold text-lg" style={{ color: readinessColor }}>{block.restDurationSeconds || 0}s</div>
                                                                    <div className="text-[10px] uppercase tracking-wider opacity-60">Rest</div>
                                                                </div>
                                                            </div>
                                                            {/* Buttons */}
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        const r = block.restDurationSeconds || 30;
                                                                        if (r > 5) {
                                                                            updateBlock(block.id, {
                                                                                workDurationSeconds: (block.workDurationSeconds || 30) + 5,
                                                                                restDurationSeconds: r - 5
                                                                            });
                                                                        }
                                                                    }}
                                                                    disabled={(block.restDurationSeconds || 0) <= 5}
                                                                    className="flex-1 py-2 rounded-xl text-xs font-bold disabled:opacity-50 text-white transition-active active:scale-95"
                                                                    style={{ backgroundColor: fatigueColor }}
                                                                >
                                                                    + Work
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        const w = block.workDurationSeconds || 30;
                                                                        if (w > 5) {
                                                                            updateBlock(block.id, {
                                                                                restDurationSeconds: (block.restDurationSeconds || 30) + 5,
                                                                                workDurationSeconds: w - 5
                                                                            });
                                                                        }
                                                                    }}
                                                                    disabled={(block.workDurationSeconds || 0) <= 5}
                                                                    className="flex-1 py-2 rounded-xl text-xs font-bold disabled:opacity-50 text-white transition-active active:scale-95"
                                                                    style={{ backgroundColor: readinessColor }}
                                                                >
                                                                    + Rest
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Add Block Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => addBlock('steady-state')}
                                className="flex-1 py-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 transition-transform active:scale-95"
                                style={{ backgroundColor: `${readinessColor}20`, color: readinessColor }}
                            >
                                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/20">
                                    <Plus size={20} />
                                </div>
                                <span className="text-sm uppercase tracking-wider">Steady Block</span>
                            </button>
                            <button
                                onClick={() => addBlock('interval')}
                                className="flex-1 py-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 transition-transform active:scale-95"
                                style={{ backgroundColor: `${fatigueColor}20`, color: fatigueColor }}
                            >
                                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/20">
                                    <Plus size={20} />
                                </div>
                                <span className="text-sm uppercase tracking-wider">Interval Block</span>
                            </button>
                        </div>

                        {/* Projected Values */}
                        {/* Projected Values */}
                        {blocks.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 pt-2">
                                <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${readinessColor}10` }}>
                                    <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Duration</div>
                                    <div className="text-2xl font-mono font-bold" style={{ color: readinessColor }}>{customDuration}</div>
                                    <div className="text-[10px] text-neutral-500">min</div>
                                </div>
                                <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${readinessColor}10` }}>
                                    <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Avg Power</div>
                                    <div className="text-2xl font-mono font-bold" style={{ color: readinessColor }}>{projectedAvgPower}</div>
                                    <div className="text-[10px] text-neutral-500">W</div>
                                </div>
                                <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${readinessColor}10` }}>
                                    <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Total Work</div>
                                    <div className="text-2xl font-mono font-bold" style={{ color: readinessColor }}>{projectedTotalWork.toFixed(1)}</div>
                                    <div className="text-[10px] text-neutral-500">Wh</div>
                                </div>
                            </div>
                        )}
                    </div>
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
                    <div className="flex gap-1 mb-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rpe) => {
                            const isSelected = targetRPE === rpe;
                            const rpeColor = getRPEColor(rpe);
                            return (
                                <button
                                    key={rpe}
                                    onClick={() => setTargetRPE(rpe)}
                                    className="flex-1 py-3 rounded-lg text-sm font-bold"
                                    style={{
                                        backgroundColor: isSelected ? rpeColor : isDarkMode ? '#262626' : '#e5e5e5',
                                        color: isSelected ? '#ffffff' : undefined,
                                    }}
                                >
                                    {rpe}
                                </button>
                            );
                        })}
                    </div>
                    <div className="text-center text-sm py-2 px-4 rounded-xl" style={{ backgroundColor: `${getRPEColor(targetRPE)}20`, color: getRPEColor(targetRPE) }}>
                        {RPE_DESCRIPTIONS[targetRPE]}
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
