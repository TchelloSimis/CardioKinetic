/**
 * BlockEditor Component
 * 
 * Renders the custom session block editor for SessionSetupModal.
 * Allows adding, editing, reordering, and removing training blocks.
 */

import React from 'react';
import { Minus, Plus, Layers, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { SessionBlock } from '../../types';
import { generateBlockId } from '../../hooks/sessionTimerUtils';
import { adjustWorkRestPair } from './sessionSetupUtils';

export interface BlockEditorProps {
    blocks: SessionBlock[];
    setBlocks: React.Dispatch<React.SetStateAction<SessionBlock[]>>;
    targetPower: number;
    readinessColor: string;
    fatigueColor: string;
    isDarkMode: boolean;
    customDuration: number;
    projectedAvgPower: number;
    projectedTotalWork: number;
}

const BlockEditor: React.FC<BlockEditorProps> = ({
    blocks,
    setBlocks,
    targetPower,
    readinessColor,
    fatigueColor,
    isDarkMode,
    customDuration,
    projectedAvgPower,
    projectedTotalWork,
}) => {
    // Block management functions
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

    return (
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
                                                        updateBlock(block.id, { workDurationSeconds: work, restDurationSeconds: rest });
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
                                                        updateBlock(block.id, { workDurationSeconds: work, restDurationSeconds: rest });
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
    );
};

export default BlockEditor;
