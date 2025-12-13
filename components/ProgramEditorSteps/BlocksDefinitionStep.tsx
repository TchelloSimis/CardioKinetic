import React, { useState } from 'react';
import {
    Plus, Trash2, ChevronUp, ChevronDown, Layers, Info, Calendar,
    Activity, Timer, Minus
} from 'lucide-react';
import { EditorState, FOCUS_OPTIONS } from '../ProgramEditor';
import { ProgramBlock, WeekDefinition, WeekFocus, PowerReference, TemplateBlock, BlockWeekSession, BlockProgressionType } from '../../programTemplate';
import { NumberInput, SelectInput } from '../ProgramInputs';
import { SessionStyle } from '../../types';

interface BlocksDefinitionStepProps {
    editorState: EditorState;
    setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
}

const POWER_REFERENCE_OPTIONS: { value: PowerReference; label: string }[] = [
    { value: 'base', label: 'Base Power' },
    { value: 'previous', label: 'Previous Week' },
    { value: 'block_start', label: 'Block Start' },
];

const PROGRESSION_TYPE_OPTIONS: { value: BlockProgressionType; label: string }[] = [
    { value: 'power', label: 'Power Only' },
    { value: 'duration', label: 'Duration Only' },
    { value: 'double', label: 'Power + Duration' },
];

const SESSION_STYLE_OPTIONS: { value: SessionStyle; label: string }[] = [
    { value: 'interval', label: 'Interval' },
    { value: 'steady-state', label: 'Steady State' },
    { value: 'custom', label: 'Custom' },
];

// Generate a unique ID from block name
const generateBlockId = (name: string, existingIds: string[]): string => {
    const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'block';
    let id = baseId;
    let counter = 1;
    while (existingIds.includes(id)) {
        id = `${baseId}-${counter}`;
        counter++;
    }
    return id;
};

// Create default week session
const createDefaultWeekSession = (defaultSessionStyle: SessionStyle, defaultRPE: number = 7): BlockWeekSession => {
    const isInterval = defaultSessionStyle === 'interval';
    const isCustom = defaultSessionStyle === 'custom';

    return {
        sessionStyle: defaultSessionStyle,
        durationMinutes: isInterval ? 10 : 15,
        targetRPE: defaultRPE,
        ...(isInterval ? { cycles: 10, workDurationSeconds: 30, restDurationSeconds: 30 } : {}),
        ...(isCustom ? { blocks: [{ type: 'steady-state' as const, durationExpression: 5, powerExpression: 1.0 }] } : {}),
    };
};

// Create a default block with per-week sessions
const createDefaultBlock = (existingIds: string[], defaultSessionStyle: SessionStyle): ProgramBlock => {
    const weekCount = 4;
    const weekSessions: BlockWeekSession[] = Array(weekCount).fill(null).map((_, i) =>
        createDefaultWeekSession(defaultSessionStyle, 6 + i) // RPE increases each week
    );

    return {
        id: generateBlockId('New Block', existingIds),
        name: 'New Block',
        weekCount,
        powerReference: 'block_start',
        progressionType: 'power',
        powerProgression: [1.0, 1.05, 1.1, 1.15],
        durationProgression: [1.0, 1.0, 1.0, 1.0],
        focus: 'Intensity',
        phaseName: 'Training Phase',
        description: 'Week {weekInBlock}/{weekCount}',
        workRestRatio: '1:1',
        targetRPE: 7,
        weekSessions,
    };
};

// Create a default fixed week
const createDefaultFixedWeek = (position: 'first' | 'last'): WeekDefinition => ({
    position,
    phaseName: position === 'first' ? 'Introduction' : 'Conclusion',
    focus: position === 'first' ? 'Volume' : 'Recovery',
    description: position === 'first' ? 'Establish baseline at comfortable intensity.' : 'Final week for adaptation consolidation.',
    powerMultiplier: 1.0,
    workRestRatio: '1:2',
    targetRPE: 5,
});

const BlocksDefinitionStep: React.FC<BlocksDefinitionStepProps> = ({ editorState, setEditorState }) => {
    const [expandedBlockIndex, setExpandedBlockIndex] = useState<number | null>(0);

    // Add a new block
    const addBlock = () => {
        const existingIds = editorState.programBlocks.map(b => b.id);
        const newBlock = createDefaultBlock(existingIds, editorState.defaultSessionStyle);
        setEditorState(prev => ({
            ...prev,
            programBlocks: [...prev.programBlocks, newBlock]
        }));
        setExpandedBlockIndex(editorState.programBlocks.length);
    };

    // Remove a block
    const removeBlock = (index: number) => {
        setEditorState(prev => ({
            ...prev,
            programBlocks: prev.programBlocks.filter((_, i) => i !== index)
        }));
        if (expandedBlockIndex === index) {
            setExpandedBlockIndex(null);
        } else if (expandedBlockIndex !== null && expandedBlockIndex > index) {
            setExpandedBlockIndex(expandedBlockIndex - 1);
        }
    };

    // Move block up/down
    const moveBlock = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= editorState.programBlocks.length) return;

        const newBlocks = [...editorState.programBlocks];
        [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
        setEditorState(prev => ({ ...prev, programBlocks: newBlocks }));
        setExpandedBlockIndex(newIndex);
    };

    // Update a block field
    const updateBlock = (index: number, updates: Partial<ProgramBlock>) => {
        setEditorState(prev => ({
            ...prev,
            programBlocks: prev.programBlocks.map((block, i) =>
                i === index ? { ...block, ...updates } : block
            )
        }));
    };

    // Update block weekCount and adjust arrays
    const updateBlockWeekCount = (index: number, weekCount: number) => {
        const block = editorState.programBlocks[index];
        const oldPowerProg = block.powerProgression;
        const oldDurationProg = block.durationProgression || [];
        const oldSessions = block.weekSessions || [];

        let newPowerProg: number[];
        let newDurationProg: number[];
        let newSessions: BlockWeekSession[];

        if (weekCount > oldPowerProg.length) {
            // Extend
            newPowerProg = [...oldPowerProg];
            newDurationProg = [...oldDurationProg];
            newSessions = [...oldSessions];
            while (newPowerProg.length < weekCount) {
                const lastPower = newPowerProg[newPowerProg.length - 1] || 1.0;
                newPowerProg.push(Math.round((lastPower + 0.05) * 100) / 100);
                const lastDur = newDurationProg[newDurationProg.length - 1] || 1.0;
                newDurationProg.push(lastDur);
                const lastRPE = newSessions[newSessions.length - 1]?.targetRPE ?? 7;
                newSessions.push(createDefaultWeekSession(editorState.defaultSessionStyle, Math.min(10, lastRPE + 1)));
            }
        } else {
            // Trim
            newPowerProg = oldPowerProg.slice(0, weekCount);
            newDurationProg = oldDurationProg.slice(0, weekCount);
            newSessions = oldSessions.slice(0, weekCount);
        }

        updateBlock(index, { weekCount, powerProgression: newPowerProg, durationProgression: newDurationProg, weekSessions: newSessions });
    };

    // Update a week session within a block
    const updateWeekSession = (blockIndex: number, weekIndex: number, updates: Partial<BlockWeekSession>) => {
        setEditorState(prev => ({
            ...prev,
            programBlocks: prev.programBlocks.map((block, bi) => {
                if (bi !== blockIndex) return block;

                const sessions = [...(block.weekSessions || [])];
                const currentSession = sessions[weekIndex] || createDefaultWeekSession(editorState.defaultSessionStyle);
                const newSession = { ...currentSession, ...updates };

                // When changing to custom, initialize blocks
                if (updates.sessionStyle === 'custom' && (!newSession.blocks || newSession.blocks.length === 0)) {
                    newSession.blocks = [{ type: 'steady-state', durationExpression: 5, powerExpression: 1.0 }];
                }

                // When changing to interval, initialize
                if (updates.sessionStyle === 'interval' && !newSession.cycles) {
                    newSession.cycles = 10;
                    newSession.workDurationSeconds = 30;
                    newSession.restDurationSeconds = 30;
                    newSession.durationMinutes = 10;
                }

                // Recalculate duration for interval
                if (newSession.sessionStyle === 'interval' &&
                    ('cycles' in updates || 'workDurationSeconds' in updates || 'restDurationSeconds' in updates)) {
                    const cycles = newSession.cycles ?? 10;
                    const work = newSession.workDurationSeconds ?? 30;
                    const rest = newSession.restDurationSeconds ?? 30;
                    newSession.durationMinutes = Math.round((cycles * (work + rest) / 60) * 100) / 100;
                }

                sessions[weekIndex] = newSession;
                return { ...block, weekSessions: sessions };
            })
        }));
    };

    // Toggle fixed first/last week
    const toggleFixedWeek = (which: 'first' | 'last') => {
        const key = which === 'first' ? 'fixedFirstWeek' : 'fixedLastWeek';
        const current = editorState[key];
        setEditorState(prev => ({
            ...prev,
            [key]: current ? null : createDefaultFixedWeek(which)
        }));
    };

    // Update fixed week
    const updateFixedWeek = (which: 'first' | 'last', updates: Partial<WeekDefinition>) => {
        const key = which === 'first' ? 'fixedFirstWeek' : 'fixedLastWeek';
        setEditorState(prev => ({
            ...prev,
            [key]: prev[key] ? { ...prev[key]!, ...updates } : null
        }));
    };

    // Get available block IDs for followedBy dropdown
    const blockIdOptions = editorState.programBlocks.map(b => ({ value: b.id, label: b.name }));

    return (
        <>
            {/* Info Banner */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                    <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-medium">Block-Based Structure</p>
                        <p className="text-blue-600 dark:text-blue-400 mt-1">
                            Define training blocks that repeat to fill your program duration.
                            Each week can have its own session style, duration, and target RPE.
                        </p>
                    </div>
                </div>
            </div>

            {/* Fixed First Week */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                        <Calendar size={14} style={{ color: 'var(--accent)' }} />
                        Fixed First Week
                    </h3>
                    <button
                        onClick={() => toggleFixedWeek('first')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${editorState.fixedFirstWeek
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            : 'text-white'
                            }`}
                        style={!editorState.fixedFirstWeek ? { backgroundColor: 'var(--accent)' } : {}}
                    >
                        {editorState.fixedFirstWeek ? 'Remove' : 'Add Fixed First Week'}
                    </button>
                </div>
                {editorState.fixedFirstWeek && (
                    <FixedWeekEditor
                        week={editorState.fixedFirstWeek}
                        onChange={(updates) => updateFixedWeek('first', updates)}
                    />
                )}
                {!editorState.fixedFirstWeek && (
                    <p className="text-sm text-neutral-400">No fixed first week. Blocks will start from week 1.</p>
                )}
            </div>

            {/* Program Blocks */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                        <Layers size={14} style={{ color: 'var(--accent)' }} />
                        Program Blocks ({editorState.programBlocks.length})
                    </h3>
                    <button
                        onClick={addBlock}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1"
                        style={{ backgroundColor: 'var(--accent)' }}
                    >
                        <Plus size={14} />
                        Add Block
                    </button>
                </div>

                {editorState.programBlocks.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-neutral-400 mb-4">No blocks defined yet.</p>
                        <button
                            onClick={addBlock}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                            style={{ backgroundColor: 'var(--accent)' }}
                        >
                            Add Your First Block
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {editorState.programBlocks.map((block, index) => (
                            <BlockEditor
                                key={block.id}
                                block={block}
                                index={index}
                                isExpanded={expandedBlockIndex === index}
                                onToggle={() => setExpandedBlockIndex(expandedBlockIndex === index ? null : index)}
                                onUpdate={(updates) => updateBlock(index, updates)}
                                onUpdateWeekCount={(wc) => updateBlockWeekCount(index, wc)}
                                onUpdateWeekSession={(weekIndex, updates) => updateWeekSession(index, weekIndex, updates)}
                                onRemove={() => removeBlock(index)}
                                onMoveUp={() => moveBlock(index, 'up')}
                                onMoveDown={() => moveBlock(index, 'down')}
                                canMoveUp={index > 0}
                                canMoveDown={index < editorState.programBlocks.length - 1}
                                blockIdOptions={blockIdOptions.filter(o => o.value !== block.id)}
                                defaultSessionStyle={editorState.defaultSessionStyle}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Fixed Last Week */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                        <Calendar size={14} style={{ color: 'var(--accent)' }} />
                        Fixed Last Week
                    </h3>
                    <button
                        onClick={() => toggleFixedWeek('last')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${editorState.fixedLastWeek
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            : 'text-white'
                            }`}
                        style={!editorState.fixedLastWeek ? { backgroundColor: 'var(--accent)' } : {}}
                    >
                        {editorState.fixedLastWeek ? 'Remove' : 'Add Fixed Last Week'}
                    </button>
                </div>
                {editorState.fixedLastWeek && (
                    <FixedWeekEditor
                        week={editorState.fixedLastWeek}
                        onChange={(updates) => updateFixedWeek('last', updates)}
                    />
                )}
                {!editorState.fixedLastWeek && (
                    <p className="text-sm text-neutral-400">No fixed last week. Blocks will fill to the end.</p>
                )}
            </div>
        </>
    );
};

// Block Editor Component
interface BlockEditorProps {
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

const BlockEditor: React.FC<BlockEditorProps> = ({
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

                    {/* Row 1b: Power Reference (if power/double), Duration Reference (if duration/double) */}
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

                    {/* Row 3: Followed By (full width) */}
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

                    {/* Row 3: Description */}
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

// Week Session Editor Component
interface WeekSessionEditorProps {
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

                    {/* Row 2: Power and Duration multipliers (if applicable) */}
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

                    {/* Interval Controls - 2x2 grid */}
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

// Fixed Week Editor Component
interface FixedWeekEditorProps {
    week: WeekDefinition;
    onChange: (updates: Partial<WeekDefinition>) => void;
}

const FixedWeekEditor: React.FC<FixedWeekEditorProps> = ({ week, onChange }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
                <label className="text-xs font-medium text-neutral-500 mb-1 block">Phase Name</label>
                <input
                    type="text"
                    value={week.phaseName}
                    onChange={(e) => onChange({ phaseName: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm"
                />
            </div>
            <div>
                <label className="text-xs font-medium text-neutral-500 mb-1 block">Focus</label>
                <SelectInput
                    value={week.focus}
                    options={FOCUS_OPTIONS.map(f => ({ value: f, label: f }))}
                    onChange={(val) => onChange({ focus: val as WeekFocus })}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm"
                />
            </div>
            <div>
                <label className="text-xs font-medium text-neutral-500 mb-1 block">Power Multiplier</label>
                <input
                    type="number"
                    step="0.05"
                    value={week.powerMultiplier}
                    onChange={(e) => onChange({ powerMultiplier: parseFloat(e.target.value) || 1.0 })}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono"
                />
            </div>
            <div>
                <label className="text-xs font-medium text-neutral-500 mb-1 block">Target RPE</label>
                <NumberInput
                    value={week.targetRPE}
                    onChange={(val) => onChange({ targetRPE: val ?? 5 })}
                    min={1}
                    max={10}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono"
                />
            </div>
            <div className="col-span-2 md:col-span-4">
                <label className="text-xs font-medium text-neutral-500 mb-1 block">Description</label>
                <input
                    type="text"
                    value={week.description}
                    onChange={(e) => onChange({ description: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm"
                />
            </div>
        </div>
    );
};

export default BlocksDefinitionStep;
