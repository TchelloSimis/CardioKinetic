/**
 * Program Template Types
 * 
 * This module defines the types for importing/exporting program templates.
 * Templates are JSON files that define training program structures with:
 * - Variable or fixed week lengths
 * - Fatigue/readiness-based dynamic modifications
 * - Complete program metadata and descriptions
 */

import { SessionStyle, ProgressionMode, PlanWeek, ProgramPreset } from './types';

// ============================================================================
// CORE TEMPLATE TYPES
// ============================================================================

/**
 * Week position can be:
 * - A number (1, 2, 3...) for absolute week position
 * - 'first' or 'last' for relative positioning
 * - A percentage string like '50%' for interpolation
 */
export type WeekPosition = number | 'first' | 'last' | `${number}%`;

/**
 * Focus types for training weeks
 */
export type WeekFocus = 'Density' | 'Intensity' | 'Volume' | 'Recovery';

/**
 * Threshold condition format: ">30", "<80", ">=50", "<=70"
 */
export type ThresholdCondition = `${'>' | '<' | '>=' | '<='}${number}`;

/**
 * Flexible condition format with separate fatigue and readiness thresholds
 */
export interface FlexibleCondition {
    fatigue?: ThresholdCondition;
    readiness?: ThresholdCondition;
    logic: 'and' | 'or';
}

/**
 * Conditions that trigger fatigue modifications
 * Can be a preset string OR a flexible condition object
 */
export type FatigueCondition =
    // Preset conditions (legacy/convenience)
    | 'low_fatigue'      // Fatigue score < 30
    | 'moderate_fatigue' // Fatigue score 30-60
    | 'high_fatigue'     // Fatigue score 60-80
    | 'very_high_fatigue'// Fatigue score > 80
    | 'fresh'            // Readiness > 65
    | 'recovered'        // Readiness 50-65
    | 'tired'            // Readiness 35-50
    | 'overreached'      // Readiness < 35
    // Flexible condition object
    | FlexibleCondition;


// ============================================================================
// TEMPLATE STRUCTURE
// ============================================================================

/**
 * Configuration for program length
 */
export interface WeekConfig {
    /** 'fixed' = exact week count, 'variable' = range of options */
    type: 'fixed' | 'variable';

    /** For fixed-length programs: the exact number of weeks */
    fixed?: number;

    /** For variable-length programs: the allowed range */
    range?: {
        min: number;   // Minimum weeks (e.g., 4)
        max: number;   // Maximum weeks (e.g., 6)
        step: number;  // Increment (e.g., 1 means 4,5,6 are valid)
    };
}

/**
 * Definition for a single training week
 */
export interface WeekDefinition {
    /**
     * Position in the program:
     * - Number (1, 2, 3...): Absolute week number
     * - 'first': Always the first week
     * - 'last': Always the last week  
     * - '50%': Halfway point (interpolated based on program length)
     * - '25%', '75%', etc: Other percentage positions
     */
    position: WeekPosition;

    /** Phase name displayed in the UI (e.g., "Foundation", "Build", "Peak") */
    phaseName: string;

    /** Training focus for this week */
    focus: WeekFocus;

    /** Description of the week's goals and approach */
    description: string;

    /**
     * Power multiplier relative to basePower
     * - 1.0 = basePower (100%)
     * - 1.1 = basePower + 10%
     * - 0.9 = basePower - 10%
     */
    powerMultiplier: number;

    /** Work-to-rest ratio (e.g., "1:2", "1:1", "2:1") */
    workRestRatio: string;

    /** Target RPE for sessions in this week (1-10) */
    targetRPE: number;

    // Optional overrides for specific weeks

    /** Override the default session style for this week */
    sessionStyle?: SessionStyle;

    /** Override the default session duration (minutes or percentage like '110%') */
    durationMinutes?: number | string;

    /** Explicit work interval duration in seconds */
    workDurationSeconds?: number;

    /** Explicit rest interval duration in seconds */
    restDurationSeconds?: number;

    /**
     * For custom sessions (sessionStyle === 'custom'): array of training blocks.
     * Each block can be steady-state or interval type with dynamic expressions.
     */
    blocks?: TemplateBlock[];
}

/**
 * A block definition within a custom session template.
 * Supports expression syntax for dynamic values.
 */
export interface TemplateBlock {
    type: 'steady-state' | 'interval';

    /**
     * Duration as absolute minutes (number) or expression string.
     * Expressions can reference: power, duration, week, totalWeeks
     * Examples: 5, "duration * 0.25", "5"
     */
    durationExpression: string | number;

    /**
     * Power as multiplier (number) or expression string.
     * Examples: 0.8, "power * 0.8", "0.8"
     */
    powerExpression: string | number;

    /** For interval blocks: work:rest ratio (e.g., "2:1") */
    workRestRatio?: string;

    /** Optional explicit work duration in seconds (for interval blocks) */
    workDurationSeconds?: number;

    /** Optional explicit rest duration in seconds (for interval blocks) */
    restDurationSeconds?: number;

    /** Optional explicit cycle count (for interval blocks) */
    cycles?: number;
}


/**
 * Adjustments applied when a fatigue condition is met
 */
export interface FatigueAdjustments {
    /** Multiply power target (e.g., 0.9 = reduce by 10%) */
    powerMultiplier?: number;

    /** Add/subtract from target RPE (e.g., -1 to make easier) */
    rpeAdjust?: number;

    /** Multiply rest duration (e.g., 1.5 = 50% more rest) */
    restMultiplier?: number;

    /** Multiply volume/duration (e.g., 0.5 = half the session) */
    volumeMultiplier?: number;

    /** Message to display in Coach's Advice */
    message?: string;
}

/**
 * A rule that modifies training when certain fatigue/readiness conditions are met
 */
export interface FatigueModifier {
    /** The condition that triggers this modifier */
    condition: FatigueCondition;

    /** The adjustments to apply when condition is true */
    adjustments: FatigueAdjustments;

    /**
     * Priority for modifier selection when multiple conditions match.
     * Lower numbers = higher priority (applied first).
     * Only one modifier triggers per session - the highest priority (lowest number) matching modifier wins.
     * Default: 0
     */
    priority?: number;

    /** Optional: Only apply to specific phase(s) - e.g., "Build", "Peak", ["Base", "Build"] */
    phase?: WeekFocus | WeekFocus[];

    /**
     * Optional: Only apply to specific week position(s). Uses relative positioning for variable-length programs.
     * - 'first' = first week only
     * - 'last' = last week only
     * - '25%' / '50%' / '75%' = percentage through program (±1 week)
     * - 'early' = first 33% of program
     * - 'mid' = middle 33% of program
     * - 'late' = last 33% of program
     * - '>50%' / '<33%' = comparison operators for percentages
     * - '>5' / '<10' = comparison operators for week numbers
     */
    weekPosition?: 'first' | 'last' | 'early' | 'mid' | 'late' | `${number}%` | `>${number}%` | `<${number}%` | `>${number}` | `<${number}` | ('first' | 'last' | 'early' | 'mid' | 'late' | `${number}%` | `>${number}%` | `<${number}%` | `>${number}` | `<${number}`)[];
}

/**
 * Complete program template structure
 * This is what gets exported/imported as JSON
 */
export interface ProgramTemplate {
    // ---- Metadata ----

    /** Schema version for forward compatibility */
    templateVersion: '1.0';

    /** Unique identifier for this template */
    id: string;

    /** Display name */
    name: string;

    /** Full description of the program (can include scientific basis) */
    description: string;

    /** Optional: Template author */
    author?: string;

    /** Optional: Tags for categorization */
    tags?: string[];

    // ---- Week Configuration ----

    /** Defines whether the program has fixed or variable length */
    weekConfig: WeekConfig;

    // ---- Program Defaults ----

    /** Default session style for all weeks */
    defaultSessionStyle: SessionStyle;

    /** How the program progresses (power or duration) */
    progressionMode: ProgressionMode;

    /** Default session duration in minutes */
    defaultSessionDurationMinutes: number;

    // ---- Week Definitions ----

    /**
     * Array of week definitions.
     * For variable-length programs, weeks are interpolated to fit the selected length.
     * Use relative positions ('first', 'last', '50%') for adaptive placement.
     */
    weeks: WeekDefinition[];

    // ---- Dynamic Modifiers ----

    /**
     * Optional rules that adjust training based on fatigue/readiness.
     * Applied at session time based on current athlete state.
     */
    fatigueModifiers?: FatigueModifier[];
}

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface ValidationError {
    field: string;
    message: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    template?: ProgramTemplate;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Runtime context for applying fatigue modifiers
 */
export interface FatigueContext {
    fatigueScore: number;   // 0-100
    readinessScore: number; // 0-100
    tsbValue: number;       // Training Stress Balance
    weekNumber?: number;    // Current week in the program (1-indexed)
    totalWeeks?: number;    // Total weeks in the program (for relative position calculations)
    phase?: WeekFocus;      // Current phase focus (Density, Intensity, Volume, Recovery)
}

/**
 * Options for generating a plan from a template
 */
export interface GeneratePlanOptions {
    template: ProgramTemplate;
    basePower: number;
    weekCount: number;
    startDate?: string;
}
