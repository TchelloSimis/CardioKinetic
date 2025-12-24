/**
 * FixedWeekEditor Component
 * Used for configuring fixed first/last week in block-based programs
 */

import React from 'react';
import { WeekDefinition, WeekFocus } from '../../../programTemplate';
import { SelectInput, NumberInput } from '../../ProgramInputs';
import { FOCUS_OPTIONS } from '../../ProgramEditor';

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

export default FixedWeekEditor;
