// Session training style - interval (work/rest cycles), steady-state (continuous effort), or custom (blocks)
export type SessionStyle = 'interval' | 'steady-state' | 'custom';

// ============================================================================
// CUSTOM SESSION BLOCK TYPES
// ============================================================================

/**
 * A single block within a custom session.
 * Custom sessions are composed of multiple blocks, each block can be either
 * steady-state (continuous effort) or interval (work/rest cycles).
 */
export interface SessionBlock {
  id: string;
  type: 'steady-state' | 'interval';
  durationMinutes: number;
  /** Power multiplier relative to session targetPower (e.g., 0.8 = 80%) */
  powerMultiplier: number;
  /** For interval blocks: work:rest ratio (e.g., "2:1") */
  workRestRatio?: string;
  /** For interval blocks: explicit work duration in seconds (overrides ratio) */
  workDurationSeconds?: number;
  /** For interval blocks: explicit rest duration in seconds (overrides ratio) */
  restDurationSeconds?: number;
  /** For interval blocks: number of cycles (overrides durationMinutes) */
  cycles?: number;
}

/**
 * Result of a completed block within a custom session
 */
export interface BlockResult {
  blockId: string;
  blockIndex: number;
  type: 'steady-state' | 'interval';
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  plannedPower: number;
  averagePower: number;
  intervalsCompleted?: number;
  totalIntervals?: number;
}

// How the program progresses over time - by increasing power, duration, or both
export type ProgressionMode = 'power' | 'duration' | 'double';

// Re-export FatigueModifier for use in other files
export type { FatigueModifier } from './programTemplate';

export interface Session {
  id: string;
  date: string;
  duration: number; // in minutes
  power: number; // Average Power in Watts
  workPower?: number; // Watts during work interval
  restPower?: number; // Watts during rest interval
  distance: number; // arbitrary units or km/miles
  rpe: number; // Rating of Perceived Exertion (1-10)
  notes?: string;
  workRestRatio?: string; // e.g., "1:2", "1:1"
  weekNum?: number; // The week this session belongs to
  programId?: string; // Link to specific program instance
}

export interface ProgramRecord {
  id: string;
  presetId: string;
  name: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'archived';
  basePower: number;
  plan: PlanWeek[];
  fatigueModifiers?: import('./programTemplate').FatigueModifier[];
}

export interface PlanWeek {
  week: number;
  phaseName: string;
  focus: 'Density' | 'Intensity' | 'Volume' | 'Recovery';
  workRestRatio: string;
  targetRPE: number; // The target RPE for the session
  plannedPower: number; // The target average power output
  description: string;

  // Optional fields for flexible program types
  sessionStyle?: SessionStyle;          // Default: 'interval' - type of training session
  targetDurationMinutes?: number;       // For steady-state or duration-based progression
  workDurationSeconds?: number;         // Explicit work interval duration (alternative to ratio)
  restDurationSeconds?: number;         // Explicit rest interval duration (alternative to ratio)
  cycles?: number;                      // For interval sessions: number of work/rest cycles

  // For custom sessions (sessionStyle === 'custom')
  blocks?: SessionBlock[];              // Array of blocks for custom sessions
}

export enum ReadinessState {
  RECOVERY_NEEDED = 'Recovery Needed',
  MAINTAIN = 'Maintain Load',
  PROGRESS = 'Increase Intensity',
  UNKNOWN = 'No Data'
}

export interface ProgramPreset {
  id: string;
  name: string;
  description: string;
  generator: (basePower?: number, weekCount?: number) => PlanWeek[];

  // Optional metadata for flexible programs
  weekCount?: number;                   // Default number of weeks
  weekOptions?: number[];               // Available week lengths for variable programs (e.g. [4, 5, 6])
  minWeeks?: number;                    // Minimum allowed weeks (default: 4)
  maxWeeks?: number;                    // Maximum allowed weeks (default: 24)
  progressionMode?: ProgressionMode;    // Default: 'power' - how the program progresses
  defaultSessionStyle?: SessionStyle;   // Default: 'interval' - default training style
  supportsCustomDuration?: boolean;     // Whether session duration can be customized
  fatigueModifiers?: import('./programTemplate').FatigueModifier[];  // Dynamic training adjustments
}

export interface Stats {
  lastSessionDate: string | null;
  currentWeek: number;
  readiness: ReadinessState;
  fatigueScore: number;
  projectedPower: number;
}

// ============================================================================
// LIVE SESSION GUIDE TYPES
// ============================================================================

/**
 * Current state of an active guided session
 */
export interface LiveSessionState {
  isActive: boolean;
  isPaused: boolean;
  sessionStyle: SessionStyle;
  currentPhase: 'work' | 'rest' | 'warmup' | 'complete';
  currentInterval: number;
  totalIntervals: number;
  phaseTimeRemaining: number; // seconds remaining in current phase
  sessionTimeElapsed: number; // total seconds elapsed
  sessionTimeRemaining: number; // total seconds remaining
  workDurationSeconds: number;
  restDurationSeconds: number;
  targetPower: number;
  targetRPE: number;

  // For custom sessions (sessionStyle === 'custom')
  currentBlockIndex?: number;           // Current block (0-indexed)
  totalBlocks?: number;                 // Total number of blocks
  blockTimeRemaining?: number;          // Seconds remaining in current block
  blockTimeElapsed?: number;            // Seconds elapsed in current block
  currentBlockType?: 'steady-state' | 'interval'; // Type of current block
  blocks?: SessionBlock[];              // Original block definitions
}

/**
 * Parameters for setting up a new guided session
 */
export interface SessionSetupParams {
  totalDurationMinutes: number;
  workDurationSeconds: number;
  restDurationSeconds: number;
  targetPower: number;
  targetRPE: number;
  sessionStyle: SessionStyle;
  workRestRatio: string;

  // For custom sessions (sessionStyle === 'custom')
  blocks?: SessionBlock[];              // Array of blocks for custom sessions
}

/**
 * Result of a completed guided session for logging
 */
export interface SessionResult {
  actualDurationMinutes: number;
  intervalsCompleted: number;
  totalIntervals: number;
  targetPower: number;
  targetRPE: number;
  workRestRatio: string;
  sessionStyle: SessionStyle;
  wasCompleted: boolean; // true if ran to completion, false if stopped early
  isGuidedSession: boolean; // marker for session history

  // Weighted averages based on time spent at each setting
  averagePower?: number; // Time-weighted average power
  averageWorkDuration?: number; // Average work interval (if adjusted)
  averageRestDuration?: number; // Average rest interval (if adjusted)
  wasAdjusted?: boolean; // true if user made adjustments during session

  // Actual time spent in each phase (for intervals)
  actualWorkSeconds?: number; // Total seconds spent in work phases
  actualRestSeconds?: number; // Total seconds spent in rest phases
  actualWorkRestRatio?: string; // Computed ratio based on actual time (e.g., "4:6")

  // Power history for completion chart
  powerHistory?: Array<{ timeSeconds: number; power: number; phase: 'work' | 'rest' }>;
  plannedPower?: number; // The originally planned average power
  initialTargetPower?: number; // The initial target power before any adjustments

  // For custom sessions (sessionStyle === 'custom')
  blocks?: SessionBlock[];              // Original block definitions
  blockResults?: BlockResult[];         // Results per block
}