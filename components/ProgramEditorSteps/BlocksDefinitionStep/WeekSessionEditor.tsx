/**
 * WeekSessionEditor Component
 * 
 * Editor for individual week sessions within a program block
 */

import React from 'react';
import { ChevronUp, ChevronDown, Plus, Minus, Trash2, Timer, Activity } from 'lucide-react';
import { BlockWeekSession, TemplateBlock } from '../../../programTemplate';
import { NumberInput, SelectInput } from '../../ProgramInputs';
import { SessionStyle } from '../../../types';
import { SESSION_STYLE_OPTIONS } from './constants';

export interface WeekSessionEditorProps {
    weekIndex: number;
    session: BlockWeekSession;
    powerMult: number;
    durationMult: number;
    showPower: boolean;
    showDuration: boolean;
    isExpanded: boolean;
    onToggle: () => void;
    onUpdateSession: (updates: Partial<BlockWeekSession>) => void;
    onUpdatePower: (power: number) => void;
    onUpdateDuration: (duration: number) => void;
}

const WeekSessionEditor: React.FC<WeekSessionEditorProps> = ({
    weekIndex, session, powerMult, durationMult, showPower, showDuration, isExpanded, onToggle, onUpdateSession, onUpdatePower, onUpdateDuration
}) => {
    const isInterval = session.sessionStyle === 'interval';
    const isSteadyState = session.sessionStyle === 'steady-state';
    const isCustom = session.sessionStyle === 'custom';
    const rpe = session.targetRPE ?? 7;

    // Get session summary
    const getSessionSummary = (): string => {
        if (isInterval) {
            const cycles = session.cycles ?? 10;
            const work = session.workDurationSeconds ?? 30;
            const rest = session.restDurationSeconds ?? 30;
            return `${cycles}×(${work}s/${rest}s)`;
        } else if (isSteadyState) {
            const dur = session.durationMinutes ?? 15;
            return `${dur}min`;
        } else {
            return `${session.blocks?.length || 0} blocks`;
        }
    };

    // Training block management for custom sessions
    const addTrainingBlock = (type: 'steady-state' | 'interval') => {
        const newBlock: TemplateBlock = type === 'steady-state'
            ? { type: 'steady-state', durationExpression: 5, powerExpression: 1.0 }
            : { type: 'interval', durationExpression: 5, powerExpression: 1.0, cycles: 5, workDurationSeconds: 30, restDurationSeconds: 30 };
        onUpdateSession({ blocks: [...(session.blocks || []), newBlock] });
    };

    const updateTrainingBlock = (tbIndex: number, updates: Partial<TemplateBlock>) => {
        const blocks = [...(session.blocks || [])];
        const current = blocks[tbIndex];
        const updated = { ...current, ...updates };

        if (updated.type === 'interval' && ('cycles' in updates || 'workDurationSeconds' in updates || 'restDurationSeconds' in updates)) {
            const cycles = updated.cycles ?? 5;
            const work = updated.workDurationSeconds ?? 30;
            const rest = updated.restDurationSeconds ?? 30;
            updated.durationExpression = Math.round((cycles * (work + rest) / 60) * 100) / 100;
        }

        blocks[tbIndex] = updated;
        onUpdateSession({ blocks });
    };

    const removeTrainingBlock = (tbIndex: number) => {
        onUpdateSession({ blocks: (session.blocks || []).filter((_, i) => i !== tbIndex) });
    };

    return (
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            {/* Week Header */}
            <div
                className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 cursor-pointer"
                onClick={onToggle}
            >
                <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
                        W{weekIndex + 1}
                    </span>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold capitalize">{session.sessionStyle}</span>
                        <span className="text-xs text-neutral-500">{getSessionSummary()}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-400 hidden sm:inline">
                        {showPower && `${powerMult}× pwr`}
                        {showPower && showDuration && ' · '}
                        {showDuration && `${durationMult}× dur`}
                        {(showPower || showDuration) && ' · '}
                        RPE {rpe}
                    </span>
                    <div className="p-1">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                </div>
            </div>

            {/* Week Details */}
            {isExpanded && (
                <div className="p-3 space-y-3 border-t border-neutral-200 dark:border-neutral-700">
                    {/* Row 1: Session Style and RPE */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Session Style</label>
                            <SelectInput
                                value={session.sessionStyle}
                                options={SESSION_STYLE_OPTIONS}
                                onChange={(val) => onUpdateSession({ sessionStyle: val as SessionStyle })}
                                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Target RPE</label>
                            <NumberInput
                                value={rpe}
                                onChange={(val) => onUpdateSession({ targetRPE: val ?? 7 })}
                                min={1}
                                max={10}
                                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono"
                            />
                        </div>
                    </div>

                    {/* Row 2: Power and Duration multipliers */}
                    {(showPower || showDuration) && (
                        <div className="grid grid-cols-2 gap-3">
                            {showPower && (
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Power Multiplier</label>
                                    <input
                                        type="number"
                                        step="0.05"
                                        value={powerMult}
                                        onChange={(e) => onUpdatePower(parseFloat(e.target.value) || 1.0)}
                                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono"
                                    />
                                </div>
                            )}
                            {showDuration && (
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Duration Multiplier</label>
                                    <input
                                        type="number"
                                        step="0.05"
                                        value={durationMult}
                                        onChange={(e) => onUpdateDuration(parseFloat(e.target.value) || 1.0)}
                                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Interval Controls */}
                    {isInterval && (
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Cycles</label>
                                    <div className="flex items-center gap-1 bg-neutral-50 dark:bg-neutral-800 rounded-lg px-2 py-1.5">
                                        <button onClick={() => onUpdateSession({ cycles: Math.max(1, (session.cycles || 10) - 1) })} className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700">
                                            <Minus size={12} />
                                        </button>
                                        <span className="flex-1 text-center font-mono text-sm font-bold">{session.cycles || 10}</span>
                                        <button onClick={() => onUpdateSession({ cycles: (session.cycles || 10) + 1 })} className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700">
                                            <Plus size={12} />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Duration</label>
                                    <div className="bg-neutral-100 dark:bg-neutral-700 rounded-lg px-3 py-2 text-center">
                                        <span className="font-mono text-sm font-bold">
                                            {Math.round(((session.cycles || 10) * ((session.workDurationSeconds || 30) + (session.restDurationSeconds || 30)) / 60) * 10) / 10}
                                        </span>
                                        <span className="text-xs text-neutral-500 ml-1">min</span>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Work (seconds)</label>
                                    <div className="flex items-center gap-1 bg-neutral-50 dark:bg-neutral-800 rounded-lg px-2 py-1.5">
                                        <button onClick={() => onUpdateSession({ workDurationSeconds: Math.max(5, (session.workDurationSeconds || 30) - 5) })} className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700">
                                            <Minus size={12} />
                                        </button>
                                        <span className="flex-1 text-center font-mono text-sm font-bold">{session.workDurationSeconds || 30}</span>
                                        <button onClick={() => onUpdateSession({ workDurationSeconds: (session.workDurationSeconds || 30) + 5 })} className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700">
                                            <Plus size={12} />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Rest (seconds)</label>
                                    <div className="flex items-center gap-1 bg-neutral-50 dark:bg-neutral-800 rounded-lg px-2 py-1.5">
                                        <button onClick={() => onUpdateSession({ restDurationSeconds: Math.max(5, (session.restDurationSeconds || 30) - 5) })} className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700">
                                            <Minus size={12} />
                                        </button>
                                        <span className="flex-1 text-center font-mono text-sm font-bold">{session.restDurationSeconds || 30}</span>
                                        <button onClick={() => onUpdateSession({ restDurationSeconds: (session.restDurationSeconds || 30) + 5 })} className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700">
                                            <Plus size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Steady-State Controls */}
                    {isSteadyState && (
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Duration (minutes)</label>
                            <NumberInput
                                value={session.durationMinutes ?? 15}
                                onChange={(val) => onUpdateSession({ durationMinutes: val ?? 15 })}
                                min={1}
                                max={300}
                                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono"
                            />
                        </div>
                    )}

                    {/* Custom Session Training Blocks */}
                    {isCustom && (
                        <div className="space-y-3">
                            {(session.blocks || []).map((tb, tbIndex) => {
                                const isSteady = tb.type === 'steady-state';
                                const bgColor = isSteady ? 'color-mix(in srgb, var(--accent-alt) 10%, transparent)' : 'color-mix(in srgb, var(--accent) 10%, transparent)';
                                const borderColor = isSteady ? 'var(--accent-alt)' : 'var(--accent)';

                                return (
                                    <div key={tbIndex} className="rounded-lg p-3 relative" style={{ backgroundColor: bgColor, borderLeft: `4px solid ${borderColor}` }}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                {isSteady ? <Timer size={14} style={{ color: borderColor }} /> : <Activity size={14} style={{ color: borderColor }} />}
                                                <span className="text-xs font-bold uppercase" style={{ color: borderColor }}>
                                                    {isSteady ? 'Steady Block' : 'Interval Block'}
                                                </span>
                                            </div>
                                            <button onClick={() => removeTrainingBlock(tbIndex)} disabled={(session.blocks?.length || 0) <= 1} className="p-1.5 rounded text-red-500 hover:bg-red-100 disabled:opacity-30">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        {isSteady ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Duration</label>
                                                    <div className="flex items-center gap-1 bg-white/70 dark:bg-black/30 rounded-lg px-2 py-1.5">
                                                        <button onClick={() => updateTrainingBlock(tbIndex, { durationExpression: Math.max(1, (typeof tb.durationExpression === 'number' ? tb.durationExpression : 5) - 1) })} className="w-7 h-7 rounded flex items-center justify-center bg-white dark:bg-neutral-800 shadow-sm">
                                                            <Minus size={12} />
                                                        </button>
                                                        <span className="flex-1 text-center text-sm font-mono font-bold">{typeof tb.durationExpression === 'number' ? tb.durationExpression : 5} min</span>
                                                        <button onClick={() => updateTrainingBlock(tbIndex, { durationExpression: (typeof tb.durationExpression === 'number' ? tb.durationExpression : 5) + 1 })} className="w-7 h-7 rounded flex items-center justify-center bg-white dark:bg-neutral-800 shadow-sm">
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Power (%FTP)</label>
                                                    <div className="flex items-center gap-1 bg-white/70 dark:bg-black/30 rounded-lg px-2 py-1.5">
                                                        <button onClick={() => updateTrainingBlock(tbIndex, { powerExpression: Math.max(0.5, Math.round(((typeof tb.powerExpression === 'number' ? tb.powerExpression : 1) - 0.05) * 100) / 100) })} className="w-7 h-7 rounded flex items-center justify-center bg-white dark:bg-neutral-800 shadow-sm">
                                                            <Minus size={12} />
                                                        </button>
                                                        <span className="flex-1 text-center text-sm font-mono font-bold">{Math.round((typeof tb.powerExpression === 'number' ? tb.powerExpression : 1) * 100)}%</span>
                                                        <button onClick={() => updateTrainingBlock(tbIndex, { powerExpression: Math.round(((typeof tb.powerExpression === 'number' ? tb.powerExpression : 1) + 0.05) * 100) / 100 })} className="w-7 h-7 rounded flex items-center justify-center bg-white dark:bg-neutral-800 shadow-sm">
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Cycles</label>
                                                        <div className="flex items-center gap-1 bg-white/70 dark:bg-black/30 rounded-lg px-2 py-1.5">
                                                            <button onClick={() => updateTrainingBlock(tbIndex, { cycles: Math.max(1, (tb.cycles || 5) - 1) })} className="w-7 h-7 rounded flex items-center justify-center bg-white dark:bg-neutral-800 shadow-sm">
                                                                <Minus size={12} />
                                                            </button>
                                                            <span className="flex-1 text-center text-sm font-mono font-bold">{tb.cycles || 5}</span>
                                                            <button onClick={() => updateTrainingBlock(tbIndex, { cycles: (tb.cycles || 5) + 1 })} className="w-7 h-7 rounded flex items-center justify-center bg-white dark:bg-neutral-800 shadow-sm">
                                                                <Plus size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Power (%FTP)</label>
                                                        <div className="flex items-center gap-1 bg-white/70 dark:bg-black/30 rounded-lg px-2 py-1.5">
                                                            <button onClick={() => updateTrainingBlock(tbIndex, { powerExpression: Math.max(0.5, Math.round(((typeof tb.powerExpression === 'number' ? tb.powerExpression : 1) - 0.05) * 100) / 100) })} className="w-7 h-7 rounded flex items-center justify-center bg-white dark:bg-neutral-800 shadow-sm">
                                                                <Minus size={12} />
                                                            </button>
                                                            <span className="flex-1 text-center text-sm font-mono font-bold">{Math.round((typeof tb.powerExpression === 'number' ? tb.powerExpression : 1) * 100)}%</span>
                                                            <button onClick={() => updateTrainingBlock(tbIndex, { powerExpression: Math.round(((typeof tb.powerExpression === 'number' ? tb.powerExpression : 1) + 0.05) * 100) / 100 })} className="w-7 h-7 rounded flex items-center justify-center bg-white dark:bg-neutral-800 shadow-sm">
                                                                <Plus size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Work (seconds)</label>
                                                        <div className="flex items-center gap-1 bg-white/70 dark:bg-black/30 rounded-lg px-2 py-1.5">
                                                            <button onClick={() => updateTrainingBlock(tbIndex, { workDurationSeconds: Math.max(5, (tb.workDurationSeconds || 30) - 5) })} className="w-7 h-7 rounded flex items-center justify-center bg-white dark:bg-neutral-800 shadow-sm">
                                                                <Minus size={12} />
                                                            </button>
                                                            <span className="flex-1 text-center text-sm font-mono font-bold">{tb.workDurationSeconds || 30}s</span>
                                                            <button onClick={() => updateTrainingBlock(tbIndex, { workDurationSeconds: (tb.workDurationSeconds || 30) + 5 })} className="w-7 h-7 rounded flex items-center justify-center bg-white dark:bg-neutral-800 shadow-sm">
                                                                <Plus size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">Rest (seconds)</label>
                                                        <div className="flex items-center gap-1 bg-white/70 dark:bg-black/30 rounded-lg px-2 py-1.5">
                                                            <button onClick={() => updateTrainingBlock(tbIndex, { restDurationSeconds: Math.max(5, (tb.restDurationSeconds || 30) - 5) })} className="w-7 h-7 rounded flex items-center justify-center bg-white dark:bg-neutral-800 shadow-sm">
                                                                <Minus size={12} />
                                                            </button>
                                                            <span className="flex-1 text-center text-sm font-mono font-bold">{tb.restDurationSeconds || 30}s</span>
                                                            <button onClick={() => updateTrainingBlock(tbIndex, { restDurationSeconds: (tb.restDurationSeconds || 30) + 5 })} className="w-7 h-7 rounded flex items-center justify-center bg-white dark:bg-neutral-800 shadow-sm">
                                                                <Plus size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <div className="flex gap-3">
                                <button onClick={() => addTrainingBlock('steady-state')} className="flex-1 py-2.5 rounded-lg border-2 border-dashed text-xs font-bold uppercase flex items-center justify-center gap-1.5" style={{ color: 'var(--accent-alt)', borderColor: 'color-mix(in srgb, var(--accent-alt) 30%, transparent)' }}>
                                    <Timer size={12} /> + Steady
                                </button>
                                <button onClick={() => addTrainingBlock('interval')} className="flex-1 py-2.5 rounded-lg border-2 border-dashed text-xs font-bold uppercase flex items-center justify-center gap-1.5" style={{ color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' }}>
                                    <Activity size={12} /> + Interval
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default WeekSessionEditor;
