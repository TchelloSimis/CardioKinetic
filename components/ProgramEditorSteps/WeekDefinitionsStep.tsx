import React, { useState } from 'react';
import {
    ChevronRight, Plus, Trash2, Layers, ChevronDown, ChevronUp,
    Activity, Minus, Timer
} from 'lucide-react';
import { WeekDefinition, WeekFocus, TemplateBlock } from '../../programTemplate';
import { NumberInput, WeekPositionInput, DurationInput, SelectInput } from '../ProgramInputs';
import { EditorState, FOCUS_OPTIONS, WORK_REST_OPTIONS } from '../ProgramEditor';
import { SessionStyle } from '../../types';

interface WeekDefinitionsStepProps {
    editorState: EditorState;
    setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
}

const SESSION_STYLE_OPTIONS: { value: SessionStyle; label: string }[] = [
    { value: 'interval', label: 'Interval' },
    { value: 'steady-state', label: 'Steady State' },
    { value: 'custom', label: 'Custom' },
];

const WeekDefinitionsStep: React.FC<WeekDefinitionsStepProps> = ({ editorState, setEditorState }) => {
    // Track which weeks have expanded block editors
    const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

    const toggleWeekExpanded = (index: number) => {
        setExpandedWeeks(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const addWeek = () => {
        const isSteadyState = editorState.defaultSessionStyle === 'steady-state';
        const isCustom = editorState.defaultSessionStyle === 'custom';
        const isInterval = editorState.defaultSessionStyle === 'interval';
        const newWeek: WeekDefinition = {
            position: editorState.weeks.length + 1,
            phaseName: 'New Phase',
            focus: 'Volume',
            description: 'Week description',
            powerMultiplier: 1.0,
            workRestRatio: isSteadyState ? 'steady' : '1:1',
            targetRPE: 6,
            sessionStyle: editorState.defaultSessionStyle,
            // For interval sessions: initialize cycles/work/rest
            ...(isInterval ? {
                cycles: 10,
                workDurationSeconds: 30,
                restDurationSeconds: 30,
                durationMinutes: 10 // 10 cycles × (30 + 30) / 60 = 10 min
            } : {}),
            blocks: isCustom ? [{
                type: 'steady-state',
                durationExpression: 5,
                powerExpression: 1.0
            }] : undefined,
        };
        setEditorState(prev => ({ ...prev, weeks: [...prev.weeks, newWeek] }));
    };

    const updateWeek = (index: number, field: keyof WeekDefinition, value: any) => {
        setEditorState(prev => ({
            ...prev,
            weeks: prev.weeks.map((w, i) => {
                if (i !== index) return w;

                // When changing to custom, initialize blocks if empty
                if (field === 'sessionStyle' && value === 'custom' && !w.blocks?.length) {
                    return {
                        ...w,
                        [field]: value,
                        blocks: [{ type: 'steady-state', durationExpression: 5, powerExpression: 1.0 }]
                    };
                }

                // When changing to interval, initialize cycles/work/rest if not set
                if (field === 'sessionStyle' && value === 'interval' && !w.cycles) {
                    return {
                        ...w,
                        [field]: value,
                        cycles: 10,
                        workDurationSeconds: 30,
                        restDurationSeconds: 30,
                        durationMinutes: 10
                    };
                }

                const updated = { ...w, [field]: value };

                // For interval sessions: recalculate duration when cycles/work/rest changes
                if ((updated.sessionStyle === 'interval' || (!updated.sessionStyle && prev.defaultSessionStyle === 'interval')) &&
                    (field === 'cycles' || field === 'workDurationSeconds' || field === 'restDurationSeconds')) {
                    const cycles = updated.cycles ?? 10;
                    const work = updated.workDurationSeconds ?? 30;
                    const rest = updated.restDurationSeconds ?? 30;
                    updated.durationMinutes = Math.round((cycles * (work + rest) / 60) * 100) / 100;
                }

                return updated;
            })
        }));
    };

    const removeWeek = (index: number) => {
        setEditorState(prev => ({
            ...prev,
            weeks: prev.weeks.filter((_, i) => i !== index)
        }));
    };

    const moveWeek = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= editorState.weeks.length) return;

        setEditorState(prev => {
            const weeks = [...prev.weeks];
            [weeks[index], weeks[newIndex]] = [weeks[newIndex], weeks[index]];
            return { ...prev, weeks };
        });
    };

    // Block management functions
    const addBlock = (weekIndex: number, type: 'steady-state' | 'interval') => {
        setEditorState(prev => ({
            ...prev,
            weeks: prev.weeks.map((w, i) => {
                if (i !== weekIndex) return w;
                const newBlock: TemplateBlock = type === 'steady-state'
                    ? {
                        type: 'steady-state',
                        durationExpression: 5,
                        powerExpression: 1.0
                    }
                    : {
                        type: 'interval',
                        durationExpression: 5, // Will be calculated from cycles
                        powerExpression: 1.0,
                        cycles: 5,
                        workDurationSeconds: 30,
                        restDurationSeconds: 30
                    };
                return { ...w, blocks: [...(w.blocks || []), newBlock] };
            })
        }));
    };

    const updateBlock = (weekIndex: number, blockIndex: number, updates: Partial<TemplateBlock>) => {
        setEditorState(prev => ({
            ...prev,
            weeks: prev.weeks.map((w, i) => {
                if (i !== weekIndex) return w;
                const blocks = [...(w.blocks || [])];
                const currentBlock = blocks[blockIndex];
                const newBlock = { ...currentBlock, ...updates };

                // For interval blocks, recalculate duration when cycles/work/rest changes
                if (newBlock.type === 'interval' && (
                    updates.cycles !== undefined ||
                    updates.workDurationSeconds !== undefined ||
                    updates.restDurationSeconds !== undefined
                )) {
                    const cycles = newBlock.cycles ?? 5;
                    const work = newBlock.workDurationSeconds ?? 30;
                    const rest = newBlock.restDurationSeconds ?? 30;
                    newBlock.durationExpression = Math.round((cycles * (work + rest) / 60) * 100) / 100;
                }

                blocks[blockIndex] = newBlock;
                return { ...w, blocks };
            })
        }));
    };

    const removeBlock = (weekIndex: number, blockIndex: number) => {
        setEditorState(prev => ({
            ...prev,
            weeks: prev.weeks.map((w, i) => {
                if (i !== weekIndex) return w;
                return { ...w, blocks: (w.blocks || []).filter((_, bi) => bi !== blockIndex) };
            })
        }));
    };

    const moveBlock = (weekIndex: number, blockIndex: number, direction: 'up' | 'down') => {
        const week = editorState.weeks[weekIndex];
        const blocks = week.blocks || [];
        const newIndex = direction === 'up' ? blockIndex - 1 : blockIndex + 1;
        if (newIndex < 0 || newIndex >= blocks.length) return;

        setEditorState(prev => ({
            ...prev,
            weeks: prev.weeks.map((w, i) => {
                if (i !== weekIndex) return w;
                const newBlocks = [...(w.blocks || [])];
                [newBlocks[blockIndex], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[blockIndex]];
                return { ...w, blocks: newBlocks };
            })
        }));
    };

    // Calculate block summary for display
    const getBlockSummary = (block: TemplateBlock): string => {
        if (block.type === 'steady-state') {
            const dur = typeof block.durationExpression === 'number'
                ? block.durationExpression
                : block.durationExpression;
            const pwr = typeof block.powerExpression === 'number'
                ? `${Math.round(block.powerExpression * 100)}%`
                : block.powerExpression;
            return `${dur}min @ ${pwr}`;
        } else {
            const cycles = block.cycles ?? 5;
            const work = block.workDurationSeconds ?? 30;
            const rest = block.restDurationSeconds ?? 30;
            return `${cycles}×(${work}s/${rest}s)`;
        }
    };

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                    <Layers size={14} style={{ color: 'var(--accent)' }} />
                    Week Definitions ({editorState.weeks.length})
                </h3>
                <button
                    onClick={addWeek}
                    className="px-4 py-2 rounded-xl text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-accent/20"
                    style={{ backgroundColor: 'var(--accent)' }}
                >
                    <Plus size={14} />
                    Add Week
                </button>
            </div>

            {editorState.weeks.length === 0 ? (
                <div className="text-center py-12 text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl border-2 border-dashed border-neutral-200 dark:border-neutral-800">
                    <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                        <Layers size={32} className="opacity-50" />
                    </div>
                    <p className="font-medium mb-1">No weeks defined yet</p>
                    <p className="text-xs opacity-60">Click "Add Week" to start building your program</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {editorState.weeks.map((week, index) => {
                        const effectiveStyle = week.sessionStyle || editorState.defaultSessionStyle;
                        const isCustom = effectiveStyle === 'custom';
                        const isInterval = effectiveStyle === 'interval';
                        const isSteadyState = effectiveStyle === 'steady-state';
                        const isExpanded = expandedWeeks.has(index);

                        return (
                            <div key={index} className="p-4 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md relative">
                                <div className="flex items-start gap-4">
                                    <div className="flex flex-col gap-1 pt-2">
                                        <button onClick={() => moveWeek(index, 'up')} disabled={index === 0} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 disabled:opacity-20 disabled:hover:bg-transparent transition-colors">
                                            <ChevronRight size={14} className="rotate-[-90deg]" />
                                        </button>
                                        <div className="w-6 h-6 flex items-center justify-center font-mono text-xs font-bold text-neutral-300">
                                            {index + 1}
                                        </div>
                                        <button onClick={() => moveWeek(index, 'down')} disabled={index === editorState.weeks.length - 1} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 disabled:opacity-20 disabled:hover:bg-transparent transition-colors">
                                            <ChevronRight size={14} className="rotate-90" />
                                        </button>
                                    </div>

                                    <div className="flex-1 space-y-4 pr-8">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">Position</label>
                                                <WeekPositionInput
                                                    value={week.position}
                                                    onChange={(pos) => updateWeek(index, 'position', pos)}
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">Session Style</label>
                                                <SelectInput
                                                    value={week.sessionStyle || editorState.defaultSessionStyle}
                                                    options={SESSION_STYLE_OPTIONS}
                                                    onChange={(val) => updateWeek(index, 'sessionStyle', val as SessionStyle)}
                                                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl px-3 py-2 text-xs font-medium outline-none hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">Phase Name</label>
                                                <input
                                                    type="text"
                                                    value={week.phaseName}
                                                    onChange={(e) => updateWeek(index, 'phaseName', e.target.value)}
                                                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-accent/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">Focus</label>
                                                <SelectInput
                                                    value={week.focus}
                                                    options={FOCUS_OPTIONS}
                                                    onChange={(val) => updateWeek(index, 'focus', val as WeekFocus)}
                                                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl px-3 py-2 text-xs font-medium outline-none hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                                />
                                            </div>

                                            {/* Steady-state: show Work:Rest dropdown */}
                                            {isSteadyState && (
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">Work:Rest</label>
                                                    <SelectInput
                                                        value={week.workRestRatio}
                                                        options={WORK_REST_OPTIONS}
                                                        onChange={(val) => updateWeek(index, 'workRestRatio', val as string)}
                                                        className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl px-3 py-2 text-xs font-medium outline-none hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                                    />
                                                </div>
                                            )}

                                            {/* Interval: show Cycles, Work, Rest controls */}
                                            {isInterval && (
                                                <>
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">Cycles</label>
                                                        <div className="flex items-center gap-1 bg-neutral-50 dark:bg-neutral-800 rounded-xl px-2 py-1">
                                                            <button
                                                                onClick={() => updateWeek(index, 'cycles', Math.max(1, (week.cycles || 10) - 1))}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                                            >
                                                                <Minus size={12} />
                                                            </button>
                                                            <span className="flex-1 text-center font-mono text-sm font-bold">{week.cycles || 10}</span>
                                                            <button
                                                                onClick={() => updateWeek(index, 'cycles', (week.cycles || 10) + 1)}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                                            >
                                                                <Plus size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">Work (s)</label>
                                                        <div className="flex items-center gap-1 bg-neutral-50 dark:bg-neutral-800 rounded-xl px-2 py-1">
                                                            <button
                                                                onClick={() => updateWeek(index, 'workDurationSeconds', Math.max(5, (week.workDurationSeconds || 30) - 5))}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                                            >
                                                                <Minus size={12} />
                                                            </button>
                                                            <span className="flex-1 text-center font-mono text-sm font-bold">{week.workDurationSeconds || 30}</span>
                                                            <button
                                                                onClick={() => updateWeek(index, 'workDurationSeconds', (week.workDurationSeconds || 30) + 5)}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                                            >
                                                                <Plus size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">Rest (s)</label>
                                                        <div className="flex items-center gap-1 bg-neutral-50 dark:bg-neutral-800 rounded-xl px-2 py-1">
                                                            <button
                                                                onClick={() => updateWeek(index, 'restDurationSeconds', Math.max(5, (week.restDurationSeconds || 30) - 5))}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                                            >
                                                                <Minus size={12} />
                                                            </button>
                                                            <span className="flex-1 text-center font-mono text-sm font-bold">{week.restDurationSeconds || 30}</span>
                                                            <button
                                                                onClick={() => updateWeek(index, 'restDurationSeconds', (week.restDurationSeconds || 30) + 5)}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                                            >
                                                                <Plus size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">Duration</label>
                                                        <div className="bg-neutral-100 dark:bg-neutral-700 rounded-xl px-3 py-2 text-center">
                                                            <span className="font-mono text-sm font-bold">
                                                                {Math.round(((week.cycles || 10) * ((week.workDurationSeconds || 30) + (week.restDurationSeconds || 30)) / 60) * 10) / 10}
                                                            </span>
                                                            <span className="text-[10px] text-neutral-500 ml-1">min</span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {/* Progression fields - center when only one is shown */}
                                            {(editorState.progressionMode === 'power' || editorState.progressionMode === 'double') && (
                                                <div className={editorState.progressionMode !== 'double' ? 'md:col-span-2' : ''}>
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                                                        Power Mult.
                                                    </label>
                                                    <NumberInput
                                                        value={week.powerMultiplier}
                                                        onChange={(val) => updateWeek(index, 'powerMultiplier', val ?? 1)}
                                                        min={0.1}
                                                        max={5}
                                                        step={0.05}
                                                        placeholder="1.0"
                                                        className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl px-3 py-2 text-xs font-medium outline-none"
                                                    />
                                                </div>
                                            )}
                                            {(editorState.progressionMode === 'duration' || editorState.progressionMode === 'double') && (
                                                <div className={editorState.progressionMode !== 'double' ? 'md:col-span-2' : ''}>
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                                                        Duration
                                                    </label>
                                                    <DurationInput
                                                        value={week.durationMinutes}
                                                        defaultMinutes={editorState.defaultDurationMinutes}
                                                        onChange={(val) => updateWeek(index, 'durationMinutes', val)}
                                                    />
                                                </div>
                                            )}

                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">Target RPE</label>
                                                <NumberInput
                                                    value={week.targetRPE}
                                                    onChange={(val) => updateWeek(index, 'targetRPE', val ?? 6)}
                                                    min={1}
                                                    max={10}
                                                    placeholder="1-10"
                                                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl px-3 py-2 text-xs font-medium outline-none"
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">Description</label>
                                                <input
                                                    type="text"
                                                    value={week.description}
                                                    onChange={(e) => updateWeek(index, 'description', e.target.value)}
                                                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-accent/50"
                                                />
                                            </div>
                                        </div>

                                        {/* Custom session block builder */}
                                        {isCustom && (
                                            <div className="pt-2">
                                                <div className="flex items-center justify-between mb-3 cursor-pointer select-none" onClick={() => toggleWeekExpanded(index)}>
                                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
                                                        <Activity size={14} style={{ color: 'var(--accent)' }} />
                                                        <span>Training Blocks ({week.blocks?.length || 0})</span>
                                                    </div>
                                                    <div className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="space-y-4 pl-0 sm:pl-2">
                                                        <div className={`rounded-3xl p-4 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 ${week.blocks?.length === 0 ? 'block' : 'hidden'}`}>
                                                            <div className="text-center text-emerald-600/60 dark:text-emerald-400/60 text-xs py-2">
                                                                No blocks added yet
                                                            </div>
                                                        </div>

                                                        {(week.blocks || []).map((block, blockIndex) => {
                                                            const isSteady = block.type === 'steady-state';

                                                            // Use accent-alt for Steady State (Fatigue) and accent for Interval (Readiness)
                                                            // Color-mix lets us use CSS variables for background opacity
                                                            const backgroundStyle = isSteady
                                                                ? { backgroundColor: 'color-mix(in srgb, var(--accent-alt) 10%, transparent)' }
                                                                : { backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)' };

                                                            const borderStyle = isSteady
                                                                ? { borderLeft: '6px solid var(--accent-alt)' }
                                                                : { borderLeft: '6px solid var(--accent)' };

                                                            const iconColor = isSteady ? 'var(--accent-alt)' : 'var(--accent)';


                                                            return (
                                                                <div
                                                                    key={blockIndex}
                                                                    className="rounded-3xl p-2 relative overflow-hidden transition-all"
                                                                    style={{
                                                                        ...backgroundStyle,
                                                                        ...borderStyle
                                                                    }}
                                                                >
                                                                    {/* Block Header */}
                                                                    <div className="flex items-start justify-between p-3 pb-2">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm"
                                                                                style={{ backgroundColor: iconColor, color: '#ffffff' }}>
                                                                                {blockIndex + 1}
                                                                            </div>
                                                                            <div>
                                                                                <div className="flex items-center gap-2">
                                                                                    {isSteady ? (
                                                                                        <Timer size={14} style={{ color: iconColor }} />
                                                                                    ) : (
                                                                                        <Activity size={14} style={{ color: iconColor }} />
                                                                                    )}
                                                                                    <span className="font-bold uppercase tracking-wider text-sm" style={{ color: iconColor }}>
                                                                                        {isSteady ? 'STEADY STATE' : 'INTERVAL'}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="text-[10px] text-neutral-500 font-medium ml-6">
                                                                                    {getBlockSummary(block)}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1">
                                                                            <div className="flex flex-col gap-1 mr-2">
                                                                                <button
                                                                                    onClick={() => moveBlock(index, blockIndex, 'up')}
                                                                                    disabled={blockIndex === 0}
                                                                                    className="p-1 rounded hover:bg-black/5 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                                                                                >
                                                                                    <ChevronUp size={12} />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => moveBlock(index, blockIndex, 'down')}
                                                                                    disabled={blockIndex === (week.blocks?.length || 0) - 1}
                                                                                    className="p-1 rounded hover:bg-black/5 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                                                                                >
                                                                                    <ChevronDown size={12} />
                                                                                </button>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => removeBlock(index, blockIndex)}
                                                                                disabled={(week.blocks?.length || 0) <= 1}
                                                                                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/10 text-red-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {/* Block Controls */}
                                                                    <div className="flex flex-col gap-2 px-3 pb-3">
                                                                        {isSteady ? (
                                                                            /* Steady State: Duration & Power */
                                                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                                                {/* Duration */}
                                                                                <div className="flex-1 rounded-2xl p-2 flex items-center gap-2 bg-white/50 dark:bg-black/20">
                                                                                    <button
                                                                                        onClick={() => updateBlock(index, blockIndex, {
                                                                                            durationExpression: Math.max(1, (typeof block.durationExpression === 'number' ? block.durationExpression : 5) - 1)
                                                                                        })}
                                                                                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-neutral-800 shadow-sm hover:scale-105 transition-transform"
                                                                                    >
                                                                                        <Minus size={14} />
                                                                                    </button>
                                                                                    <div className="flex-1 text-center min-w-[3rem]">
                                                                                        <input
                                                                                            type="number"
                                                                                            value={typeof block.durationExpression === 'number' ? block.durationExpression : ''}
                                                                                            onChange={(e) => updateBlock(index, blockIndex, { durationExpression: parseFloat(e.target.value) || 5 })}
                                                                                            className="w-full text-center bg-transparent font-mono font-bold text-lg leading-none outline-none"
                                                                                        />
                                                                                        <div className="text-[9px] uppercase tracking-wider opacity-60">min</div>
                                                                                    </div>
                                                                                    <button
                                                                                        onClick={() => updateBlock(index, blockIndex, {
                                                                                            durationExpression: (typeof block.durationExpression === 'number' ? block.durationExpression : 5) + 1
                                                                                        })}
                                                                                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-neutral-800 shadow-sm hover:scale-105 transition-transform"
                                                                                    >
                                                                                        <Plus size={14} />
                                                                                    </button>
                                                                                </div>

                                                                                {/* Power */}
                                                                                <div className="flex-1 rounded-2xl p-2 flex items-center gap-2 bg-white/50 dark:bg-black/20">
                                                                                    <button
                                                                                        onClick={() => updateBlock(index, blockIndex, {
                                                                                            powerExpression: Math.max(0.5, Math.round(((typeof block.powerExpression === 'number' ? block.powerExpression : 1) - 0.05) * 100) / 100)
                                                                                        })}
                                                                                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-neutral-800 shadow-sm hover:scale-105 transition-transform"
                                                                                    >
                                                                                        <Minus size={14} />
                                                                                    </button>
                                                                                    <div className="flex-1 text-center min-w-[3rem]">
                                                                                        <div className="font-mono font-bold text-lg leading-none">
                                                                                            {Math.round((typeof block.powerExpression === 'number' ? block.powerExpression : 1) * 100)}%
                                                                                        </div>
                                                                                        <div className="text-[9px] uppercase tracking-wider opacity-60">FTP</div>
                                                                                    </div>
                                                                                    <button
                                                                                        onClick={() => updateBlock(index, blockIndex, {
                                                                                            powerExpression: Math.round(((typeof block.powerExpression === 'number' ? block.powerExpression : 1) + 0.05) * 100) / 100
                                                                                        })}
                                                                                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-neutral-800 shadow-sm hover:scale-105 transition-transform"
                                                                                    >
                                                                                        <Plus size={14} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            /* Interval: Cycles, Power, Work, Rest */
                                                                            <div className="space-y-2">
                                                                                {/* Row 1: Cycles & Power */}
                                                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                                                    <div className="flex-1 rounded-2xl p-2 flex items-center gap-2 bg-white/50 dark:bg-black/20">
                                                                                        <button
                                                                                            onClick={() => updateBlock(index, blockIndex, { cycles: Math.max(1, (block.cycles || 5) - 1) })}
                                                                                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-neutral-800 shadow-sm hover:scale-105 transition-transform"
                                                                                        >
                                                                                            <Minus size={14} />
                                                                                        </button>
                                                                                        <div className="flex-1 text-center min-w-[3rem]">
                                                                                            <div className="font-mono font-bold text-lg leading-none">{block.cycles || 5}</div>
                                                                                            <div className="text-[9px] uppercase tracking-wider opacity-60">Cycles</div>
                                                                                        </div>
                                                                                        <button
                                                                                            onClick={() => updateBlock(index, blockIndex, { cycles: (block.cycles || 5) + 1 })}
                                                                                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-neutral-800 shadow-sm hover:scale-105 transition-transform"
                                                                                        >
                                                                                            <Plus size={14} />
                                                                                        </button>
                                                                                    </div>

                                                                                    <div className="flex-1 rounded-2xl p-2 flex items-center gap-2 bg-white/50 dark:bg-black/20">
                                                                                        <button
                                                                                            onClick={() => updateBlock(index, blockIndex, {
                                                                                                powerExpression: Math.max(0.5, Math.round(((typeof block.powerExpression === 'number' ? block.powerExpression : 1) - 0.05) * 100) / 100)
                                                                                            })}
                                                                                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-neutral-800 shadow-sm hover:scale-105 transition-transform"
                                                                                        >
                                                                                            <Minus size={14} />
                                                                                        </button>
                                                                                        <div className="flex-1 text-center min-w-[3rem]">
                                                                                            <div className="font-mono font-bold text-lg leading-none">
                                                                                                {Math.round((typeof block.powerExpression === 'number' ? block.powerExpression : 1) * 100)}%
                                                                                            </div>
                                                                                            <div className="text-[9px] uppercase tracking-wider opacity-60">FTP</div>
                                                                                        </div>
                                                                                        <button
                                                                                            onClick={() => updateBlock(index, blockIndex, {
                                                                                                powerExpression: Math.round(((typeof block.powerExpression === 'number' ? block.powerExpression : 1) + 0.05) * 100) / 100
                                                                                            })}
                                                                                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-neutral-800 shadow-sm hover:scale-105 transition-transform"
                                                                                        >
                                                                                            <Plus size={14} />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Row 2: Work & Rest */}
                                                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                                                    <div className="flex-1 rounded-2xl p-2 flex items-center gap-2 bg-white/50 dark:bg-black/20">
                                                                                        <button
                                                                                            onClick={() => updateBlock(index, blockIndex, {
                                                                                                workDurationSeconds: Math.max(5, (block.workDurationSeconds || 30) - 5)
                                                                                            })}
                                                                                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-neutral-800 shadow-sm hover:scale-105 transition-transform"
                                                                                        >
                                                                                            <Minus size={14} />
                                                                                        </button>
                                                                                        <div className="flex-1 text-center min-w-[3rem]">
                                                                                            <div className="font-mono font-bold text-lg leading-none text-neutral-900 dark:text-neutral-100">
                                                                                                {block.workDurationSeconds || 30}
                                                                                            </div>
                                                                                            <div className="text-[9px] uppercase tracking-wider opacity-60">Work (s)</div>
                                                                                        </div>
                                                                                        <button
                                                                                            onClick={() => updateBlock(index, blockIndex, {
                                                                                                workDurationSeconds: (block.workDurationSeconds || 30) + 5
                                                                                            })}
                                                                                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-neutral-800 shadow-sm hover:scale-105 transition-transform"
                                                                                        >
                                                                                            <Plus size={14} />
                                                                                        </button>
                                                                                    </div>

                                                                                    <div className="flex-1 rounded-2xl p-2 flex items-center gap-2 bg-white/50 dark:bg-black/20">
                                                                                        <button
                                                                                            onClick={() => updateBlock(index, blockIndex, {
                                                                                                restDurationSeconds: Math.max(5, (block.restDurationSeconds || 30) - 5)
                                                                                            })}
                                                                                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-neutral-800 shadow-sm hover:scale-105 transition-transform"
                                                                                        >
                                                                                            <Minus size={14} />
                                                                                        </button>
                                                                                        <div className="flex-1 text-center min-w-[3rem]">
                                                                                            <div className="font-mono font-bold text-lg leading-none text-neutral-900 dark:text-neutral-100">
                                                                                                {block.restDurationSeconds || 30}
                                                                                            </div>
                                                                                            <div className="text-[9px] uppercase tracking-wider opacity-60">Rest (s)</div>
                                                                                        </div>
                                                                                        <button
                                                                                            onClick={() => updateBlock(index, blockIndex, {
                                                                                                restDurationSeconds: (block.restDurationSeconds || 30) + 5
                                                                                            })}
                                                                                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-neutral-800 shadow-sm hover:scale-105 transition-transform"
                                                                                        >
                                                                                            <Plus size={14} />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}

                                                        {/* Add Block Buttons */}
                                                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                                            <button
                                                                onClick={() => addBlock(index, 'steady-state')}
                                                                className="flex-1 py-3 rounded-2xl border-2 border-dashed text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                                                style={{ color: 'var(--accent-alt)', borderColor: 'color-mix(in srgb, var(--accent-alt) 30%, transparent)', backgroundColor: 'color-mix(in srgb, var(--accent-alt) 5%, transparent)' }}
                                                            >
                                                                <Timer size={14} />
                                                                + Steady Block
                                                            </button>
                                                            <button
                                                                onClick={() => addBlock(index, 'interval')}
                                                                className="flex-1 py-3 rounded-2xl border-2 border-dashed text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                                                style={{ color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)', backgroundColor: 'color-mix(in srgb, var(--accent) 5%, transparent)' }}
                                                            >
                                                                <Activity size={14} />
                                                                + Interval Block
                                                            </button>
                                                        </div>
                                                        <div className="h-2"></div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => removeWeek(index)}
                                        className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors absolute top-3 right-3"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WeekDefinitionsStep;
