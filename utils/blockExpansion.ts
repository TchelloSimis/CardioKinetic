/**
 * Block Expansion Utilities
 * 
 * Functions for converting block-based program definitions into week arrays
 * with properly calculated power values based on relative power references.
 */

import {
    ProgramTemplate,
    ProgramBlock,
    WeekDefinition,
    PowerReference,
    WeekFocus
} from '../programTemplate';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of block sequence generation
 */
interface BlockAssignment {
    blockId: string;
    blockName: string;
    startWeek: number;  // 1-indexed week number in the program
    weekInBlock: number; // Position within this block instance (1-indexed)
}

/**
 * Expanded week with calculated absolute power
 */
interface ExpandedWeek extends WeekDefinition {
    /** The calculated power value (not multiplier) */
    calculatedPower: number;
    /** Which block instance this week belongs to (null for fixed first/last) */
    blockInstance?: {
        blockId: string;
        blockName: string;
        instanceNumber: number; // 1st occurrence, 2nd occurrence, etc.
        weekInBlock: number;
    };
}

// ============================================================================
// BLOCK COUNTING
// ============================================================================

/**
 * Counts how many times each block appears for a given duration.
 * Used for displaying "Builder ×2, Deload ×1" in the UI.
 */
export function countBlockOccurrences(
    template: ProgramTemplate,
    weekCount: number
): Map<string, number> {
    const counts = new Map<string, number>();

    if (template.structureType !== 'block-based' || !template.programBlocks?.length) {
        return counts;
    }

    // Calculate available slots (excluding fixed first/last weeks)
    const fixedWeeks = (template.fixedFirstWeek ? 1 : 0) + (template.fixedLastWeek ? 1 : 0);
    const availableSlots = weekCount - fixedWeeks;

    if (availableSlots <= 0) {
        return counts;
    }

    // Generate block sequence
    const sequence = generateBlockSequence(template.programBlocks, availableSlots);

    // Count occurrences
    for (const assignment of sequence) {
        const current = counts.get(assignment.blockId) || 0;
        // Only count each block instance once (not each week)
        if (assignment.weekInBlock === 1) {
            counts.set(assignment.blockId, current + 1);
        }
    }

    return counts;
}

/**
 * Formats block counts for UI display.
 * Returns string like "Builder ×2, Deload ×1"
 */
export function formatBlockCounts(
    template: ProgramTemplate,
    weekCount: number
): string {
    const counts = countBlockOccurrences(template, weekCount);

    if (counts.size === 0) {
        return '';
    }

    // Build display string using block names
    const parts: string[] = [];

    // Use programBlocks order for consistent display
    for (const block of template.programBlocks || []) {
        const count = counts.get(block.id);
        if (count && count > 0) {
            parts.push(`${block.name} ×${count}`);
        }
    }

    return parts.join(', ');
}

// ============================================================================
// BLOCK SEQUENCE GENERATION
// ============================================================================

/**
 * Generates the block sequence for a given number of available slots.
 * Follows the block chaining rules defined by followedBy.
 * 
 * @param blocks - Array of ProgramBlock definitions
 * @param availableSlots - Number of weeks to fill (excludes fixed first/last)
 * @returns Array of BlockAssignment for each week
 */
export function generateBlockSequence(
    blocks: ProgramBlock[],
    availableSlots: number
): BlockAssignment[] {
    if (blocks.length === 0 || availableSlots <= 0) {
        return [];
    }

    const assignments: BlockAssignment[] = [];
    let currentWeek = 1; // Relative to available slots (1-indexed)

    // Build a map for quick lookups
    const blockMap = new Map<string, ProgramBlock>();
    for (const block of blocks) {
        blockMap.set(block.id, block);
    }

    // Use the first block in the array as the starting point.
    // Users control block order in the editor, so the first block is always the start.
    // (Previous logic tried to find "blocks not followed by others" but this breaks
    // in cyclic chains like Build → Consolidate → Deload → Build)
    const startBlockId = blocks[0].id;

    let currentBlockId: string | undefined = startBlockId;

    while (currentWeek <= availableSlots && currentBlockId) {
        const block = blockMap.get(currentBlockId);
        if (!block) break;

        // Add weeks for this block
        for (let weekInBlock = 1; weekInBlock <= block.weekCount && currentWeek <= availableSlots; weekInBlock++) {
            assignments.push({
                blockId: block.id,
                blockName: block.name,
                startWeek: currentWeek,
                weekInBlock,
            });
            currentWeek++;
        }

        // Move to next block in chain
        currentBlockId = block.followedBy;

        // If no followedBy, cycle back to start block
        if (!currentBlockId && currentWeek <= availableSlots) {
            currentBlockId = startBlockId;
        }
    }

    return assignments;
}

// ============================================================================
// POWER CALCULATION
// ============================================================================

/**
 * Calculates power for a week within a block based on its power reference mode.
 * 
 * @param reference - The power reference mode
 * @param multiplier - The multiplier from powerProgression
 * @param basePower - The program's base power (in watts)
 * @param previousWeekPower - Power from the immediately preceding week (in watts)
 * @param blockStartPower - Power from the week before this block started (in watts)
 * @returns The calculated power in watts
 */
export function calculateBlockPower(
    reference: PowerReference,
    multiplier: number,
    basePower: number,
    previousWeekPower: number,
    blockStartPower: number
): number {
    switch (reference) {
        case 'base':
            return Math.round(basePower * multiplier);
        case 'previous':
            return Math.round(previousWeekPower * multiplier);
        case 'block_start':
            return Math.round(blockStartPower * multiplier);
        default:
            return Math.round(basePower * multiplier);
    }
}

/**
 * Calculates duration for a week within a block based on its duration reference mode.
 * 
 * @param reference - The duration reference mode
 * @param multiplier - The multiplier from durationProgression
 * @param baseDuration - The program's base duration (in minutes)
 * @param previousWeekDuration - Duration from the immediately preceding week (in minutes)
 * @param blockStartDuration - Duration from the week before this block started (in minutes)
 * @returns The calculated duration in minutes (not rounded to preserve precision)
 */
export function calculateBlockDuration(
    reference: PowerReference,
    multiplier: number,
    baseDuration: number,
    previousWeekDuration: number,
    blockStartDuration: number
): number {
    switch (reference) {
        case 'base':
            return baseDuration * multiplier;
        case 'previous':
            return previousWeekDuration * multiplier;
        case 'block_start':
            return blockStartDuration * multiplier;
        default:
            return baseDuration * multiplier;
    }
}

// ============================================================================
// BLOCK EXPANSION
// ============================================================================

/**
 * Expands blocks into week definitions for a given program length.
 * 
 * Algorithm:
 * 1. Place fixedFirstWeek at week 1 (if defined)
 * 2. Place fixedLastWeek at week N (if defined)
 * 3. Fill weeks in between with block chains
 * 4. Calculate power for each week based on its block's powerReference
 * 
 * @param template - The block-based program template
 * @param weekCount - Total number of weeks to generate
 * @param basePower - The base power in watts
 * @returns Array of WeekDefinition with calculated power values
 */
export function expandBlocksToWeeks(
    template: ProgramTemplate,
    weekCount: number,
    basePower: number
): WeekDefinition[] {
    if (!template.programBlocks?.length) {
        return [];
    }

    const weeks: WeekDefinition[] = [];
    const hasFirstWeek = !!template.fixedFirstWeek;
    const hasLastWeek = !!template.fixedLastWeek;
    const baseDuration = template.defaultSessionDurationMinutes || 15;

    // Track power for relative calculations
    let previousWeekPower = basePower;
    let blockStartPower = basePower;

    // Track duration for relative calculations
    let previousWeekDuration = baseDuration;
    let blockStartDuration = baseDuration;

    let blockInstanceCounts = new Map<string, number>();

    // Week 1: Fixed first week (if defined)
    if (hasFirstWeek && template.fixedFirstWeek) {
        const firstWeek: WeekDefinition = {
            ...template.fixedFirstWeek,
            position: 1,
        };
        const calculatedPower = Math.round(basePower * (template.fixedFirstWeek.powerMultiplier || 1.0));
        previousWeekPower = calculatedPower;

        // Track duration from fixed first week
        const firstWeekDuration = typeof template.fixedFirstWeek.durationMinutes === 'number'
            ? template.fixedFirstWeek.durationMinutes
            : baseDuration;
        previousWeekDuration = firstWeekDuration;

        weeks.push(firstWeek);
    }

    // Calculate available slots for blocks
    const fixedWeeks = (hasFirstWeek ? 1 : 0) + (hasLastWeek ? 1 : 0);
    const availableSlots = weekCount - fixedWeeks;
    const blockStartWeek = hasFirstWeek ? 2 : 1;

    // Generate block sequence
    const blockAssignments = generateBlockSequence(template.programBlocks, availableSlots);

    // Build block map for lookups
    const blockMap = new Map<string, ProgramBlock>();
    for (const block of template.programBlocks) {
        blockMap.set(block.id, block);
    }

    // Track current block for block_start reference
    let currentBlockId: string | null = null;

    // Expand blocks into weeks
    for (const assignment of blockAssignments) {
        const block = blockMap.get(assignment.blockId);
        if (!block) continue;

        const weekNum = blockStartWeek + assignment.startWeek - 1;
        const weekIndex = assignment.weekInBlock - 1;

        // Update block_start references when entering a new block
        if (currentBlockId !== assignment.blockId && assignment.weekInBlock === 1) {
            blockStartPower = previousWeekPower;
            blockStartDuration = previousWeekDuration;
            currentBlockId = assignment.blockId;

            // Track instance count
            const instanceCount = (blockInstanceCounts.get(block.id) || 0) + 1;
            blockInstanceCounts.set(block.id, instanceCount);
        }

        // Get per-week session configuration (if available)
        const weekSession = block.weekSessions?.[weekIndex];

        // Determine progression type
        const progressionType = block.progressionType || 'power';
        const hasPowerProgression = progressionType === 'power' || progressionType === 'double';
        const hasDurationProgression = progressionType === 'duration' || progressionType === 'double';

        // Get power multiplier for this week in the block
        const powerMultiplier = hasPowerProgression
            ? (block.powerProgression[weekIndex] ?? 1.0)
            : 1.0;

        // Calculate power based on reference mode
        const calculatedPower = calculateBlockPower(
            block.powerReference,
            powerMultiplier,
            basePower,
            previousWeekPower,
            blockStartPower
        );

        // Get duration multiplier for this week in the block
        const durationMultiplier = hasDurationProgression
            ? (block.durationProgression?.[weekIndex] ?? 1.0)
            : 1.0;

        // Get base duration for this week from weekSession or block or template default
        const weekBaseDuration = weekSession?.durationMinutes
            ?? (typeof block.durationMinutes === 'number' ? block.durationMinutes : baseDuration);

        // Calculate duration based on reference mode
        const durationReference = block.durationReference || 'block_start';
        const calculatedDuration = hasDurationProgression
            ? calculateBlockDuration(
                durationReference,
                durationMultiplier,
                baseDuration,
                previousWeekDuration,
                blockStartDuration
            )
            : weekBaseDuration;

        // Get RPE for this week (from weekSession or block)
        const targetRPE = weekSession?.targetRPE
            ?? (Array.isArray(block.targetRPE)
                ? (block.targetRPE[weekIndex] ?? block.targetRPE[0] ?? 7)
                : block.targetRPE);

        // Build description with placeholder replacement
        const description = block.description
            .replace('{weekInBlock}', String(assignment.weekInBlock))
            .replace('{weekCount}', String(block.weekCount))
            .replace('{blockName}', block.name);

        // Determine session style (from weekSession or block or template default)
        const sessionStyle = weekSession?.sessionStyle ?? block.sessionStyle;

        // Create week definition with all session configuration
        const weekDef: WeekDefinition = {
            position: weekNum,
            phaseName: block.phaseName,
            focus: block.focus,
            description,
            powerMultiplier: calculatedPower / basePower, // Store as multiplier for compatibility
            workRestRatio: block.workRestRatio,
            targetRPE,
            sessionStyle,
            durationMinutes: Math.round(calculatedDuration * 100) / 100, // Keep 2 decimal precision
            // Propagate interval-specific fields from weekSession
            workDurationSeconds: weekSession?.workDurationSeconds,
            restDurationSeconds: weekSession?.restDurationSeconds,
            cycles: weekSession?.cycles,
            // Propagate custom session blocks
            blocks: weekSession?.blocks ?? block.blocks,
        };

        weeks.push(weekDef);
        previousWeekPower = calculatedPower;
        previousWeekDuration = calculatedDuration;
    }

    // Last week: Fixed last week (if defined)
    if (hasLastWeek && template.fixedLastWeek) {
        const lastWeek: WeekDefinition = {
            ...template.fixedLastWeek,
            position: weekCount,
        };
        weeks.push(lastWeek);
    }

    return weeks;
}
