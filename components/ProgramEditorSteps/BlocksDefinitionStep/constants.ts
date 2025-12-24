/**
 * BlocksDefinitionStep - Shared Types and Constants
 */

import { WeekFocus, PowerReference, BlockProgressionType } from '../../programTemplate';
import { SessionStyle } from '../../types';

// PowerReference select options
export const POWER_REFERENCE_OPTIONS: { value: PowerReference; label: string }[] = [
    { value: 'base', label: 'Base Power' },
    { value: 'previous', label: 'Previous Week' },
    { value: 'block_start', label: 'Block Start' },
];

// Block progression type options
export const PROGRESSION_TYPE_OPTIONS: { value: BlockProgressionType; label: string }[] = [
    { value: 'power', label: 'Power Only' },
    { value: 'duration', label: 'Duration Only' },
    { value: 'double', label: 'Power & Duration' },
];

// Session style options
export const SESSION_STYLE_OPTIONS: { value: SessionStyle; label: string }[] = [
    { value: 'interval', label: 'Interval' },
    { value: 'steady-state', label: 'Steady State' },
    { value: 'custom', label: 'Custom' },
];

// Generate a unique ID from block name
export const generateBlockId = (name: string, existingIds: string[]): string => {
    const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let id = baseId;
    let suffix = 1;
    while (existingIds.includes(id)) {
        id = `${baseId}-${suffix}`;
        suffix++;
    }
    return id;
};
