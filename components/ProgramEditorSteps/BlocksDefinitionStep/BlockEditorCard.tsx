/**
 * BlockEditorCard Component
 * 
 * Editor card for configuring a single program block within BlocksDefinitionStep
 */

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, Activity } from 'lucide-react';
import { ProgramBlock, WeekFocus, PowerReference, BlockWeekSession, BlockProgressionType } from '../../../programTemplate';
import { NumberInput, SelectInput } from '../../ProgramInputs';
import { FOCUS_OPTIONS } from '../../ProgramEditor';
import { SessionStyle } from '../../../types';
import { POWER_REFERENCE_OPTIONS, PROGRESSION_TYPE_OPTIONS, generateBlockId } from './constants';
import WeekSessionEditor from './WeekSessionEditor';

export interface BlockEditorCardProps {
    block: ProgramBlock;
    index: number;
    isExpanded: boolean;
    onToggle: () => void;
    onUpdate: (updates: Partial<ProgramBlock>) => void;
    onUpdateWeekCount: (weekCount: number) => void;
    onUpdateWeekSession: (weekIndex: number, updates: Partial<BlockWeekSession>) => void;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
    blockIdOptions: { value: string; label: string }[];
    defaultSessionStyle: SessionStyle;
}

const BlockEditorCard: React.FC<BlockEditorCardProps> = ({
    block, index, isExpanded, onToggle, onUpdate, onUpdateWeekCount, onUpdateWeekSession,
    onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown, blockIdOptions, defaultSessionStyle
}) => {
    const [expandedWeekIndex, setExpandedWeekIndex] = useState<number | null>(null);

    const progressionType = block.progressionType || 'power';
    const showPower = progressionType === 'power' || progressionType === 'double';
    const showDuration = progressionType === 'duration' || progressionType === 'double';

    return (
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 cursor-pointer"
                onClick={onToggle}
            >
                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-neutral-400">#{index + 1}</span>
                    <span className="font-medium text-neutral-900 dark:text-white">{block.name}</span>
                    <span className="text-xs text-neutral-500">{block.weekCount} weeks</span>
                    {block.followedBy && (
                        <span className="text-xs text-neutral-400">→ {block.followedBy}</span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={!canMoveUp} className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30">
                        <ChevronUp size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={!canMoveDown} className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30">
                        <ChevronDown size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="p-4 space-y-4 border-t border-neutral-200 dark:border-neutral-700">
                    {/* Row 1: Name, Week Count, Progression Type */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-medium text-neutral-500 mb-1 block">Block Name</label>
                            <input
                                type="text"
                                value={block.name}
                                onChange={(e) => onUpdate({ name: e.target.value, id: generateBlockId(e.target.value, []) })}
                                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-neutral-400 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-neutral-500 mb-1 block">Week Count</label>
                            <NumberInput
                                value={block.weekCount}
                                onChange={(val) => onUpdateWeekCount(val ?? 1)}
                                min={1}
                                max={12}
                                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-neutral-400 outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-neutral-500 mb-1 block">Progression</label>
                            <SelectInput
                                value={progressionType}
                                options={PROGRESSION_TYPE_OPTIONS}
                                onChange={(val) => onUpdate({ progressionType: val as BlockProgressionType })}
                                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-neutral-400 outline-none"
                            />
                        </div>
                    </div>

                    {/* Row 1b: Power/Duration References */}
                    {(showPower || showDuration) && (
                        <div className="grid grid-cols-2 gap-3">
                            {showPower && (
                                <div>
                                    <label className="text-xs font-medium text-neutral-500 mb-1 block">Power Reference</label>
                                    <SelectInput
                                        value={block.powerReference}
                                        options={POWER_REFERENCE_OPTIONS}
                                        onChange={(val) => onUpdate({ powerReference: val as PowerReference })}
                                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-neutral-400 outline-none"
                                    />
                                </div>
                            )}
                            {showDuration && (
                                <div>
                                    <label className="text-xs font-medium text-neutral-500 mb-1 block">Duration Reference</label>
                                    <SelectInput
                                        value={block.durationReference || 'block_start'}
                                        options={POWER_REFERENCE_OPTIONS.map(o => ({
                                            value: o.value,
                                            label: o.label.replace('Power', 'Duration')
                                        }))}
                                        onChange={(val) => onUpdate({ durationReference: val as PowerReference })}
                                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-neutral-400 outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Row 2: Focus and Phase Name */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-neutral-500 mb-1 block">Focus</label>
                            <SelectInput
                                value={block.focus}
                                options={FOCUS_OPTIONS.map(f => ({ value: f, label: f }))}
                                onChange={(val) => onUpdate({ focus: val as WeekFocus })}
                                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-neutral-400 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-neutral-500 mb-1 block">Phase Name</label>
                            <input
                                type="text"
                                value={block.phaseName}
                                onChange={(e) => onUpdate({ phaseName: e.target.value })}
                                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-neutral-400 outline-none"
                            />
                        </div>
                    </div>

                    {/* Row 3: Followed By */}
                    <div>
                        <label className="text-xs font-medium text-neutral-500 mb-1 block">Followed By</label>
                        <select
                            value={block.followedBy || ''}
                            onChange={(e) => onUpdate({ followedBy: e.target.value || undefined })}
                            className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-neutral-400 outline-none"
                        >
                            <option value="">None (end chain)</option>
                            {blockIdOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Row 4: Description */}
                    <div>
                        <label className="text-xs font-medium text-neutral-500 mb-1 block">Description</label>
                        <input
                            type="text"
                            value={block.description}
                            onChange={(e) => onUpdate({ description: e.target.value })}
                            placeholder="Use {weekInBlock}"
                            className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-neutral-400 outline-none"
                        />
                    </div>

                    {/* Per-Week Configuration */}
                    <div className="pt-2">
                        <div className="flex items-center gap-2 mb-3">
                            <Activity size={14} style={{ color: 'var(--accent)' }} />
                            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                                Week Sessions
                            </span>
                        </div>

                        <div className="space-y-2">
                            {Array.from({ length: block.weekCount }).map((_, weekIndex) => {
                                const session = block.weekSessions?.[weekIndex] || { sessionStyle: defaultSessionStyle };
                                const powerMult = block.powerProgression[weekIndex] ?? 1.0;
                                const durationMult = block.durationProgression?.[weekIndex] ?? 1.0;
                                const isWeekExpanded = expandedWeekIndex === weekIndex;

                                return (
                                    <WeekSessionEditor
                                        key={weekIndex}
                                        weekIndex={weekIndex}
                                        session={session}
                                        powerMult={powerMult}
                                        durationMult={durationMult}
                                        showPower={showPower}
                                        showDuration={showDuration}
                                        isExpanded={isWeekExpanded}
                                        onToggle={() => setExpandedWeekIndex(isWeekExpanded ? null : weekIndex)}
                                        onUpdateSession={(updates) => onUpdateWeekSession(weekIndex, updates)}
                                        onUpdatePower={(val) => {
                                            const newProg = [...block.powerProgression];
                                            newProg[weekIndex] = val;
                                            onUpdate({ powerProgression: newProg });
                                        }}
                                        onUpdateDuration={(val) => {
                                            const newProg = [...(block.durationProgression || Array(block.weekCount).fill(1.0))];
                                            newProg[weekIndex] = val;
                                            onUpdate({ durationProgression: newProg });
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BlockEditorCard;
