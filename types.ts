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

/**
 * A single RPE log entry during a session
 */
export interface RpeLogEntry {
  timeSeconds: number;  // Session time when RPE was logged
  rpe: number;          // RPE value (1-10, supports 0.5 increments)
}

// ============================================================================
// CHRONIC FATIGUE MODEL TYPES
// ============================================================================

/**
 * Mean Maximal Power record for Critical Power estimation.
 * Stores the best average power achieved for a specific duration.
 */
export interface MMPRecord {
  /** Duration in seconds (e.g., 180 for 3 min, 1200 for 20 min) */
  duration: number;
  /** Best average power in watts for this duration */
  power: number;
  /** Date when this best effort was achieved (YYYY-MM-DD) */
  date: string;
  /** Session RPE when this effort was achieved */
  rpe: number;
  /** True if this was a maximal effort (RPE >= 9) */
  isMaximalEffort: boolean;
}

/**
 * Estimated Critical Power (eCP) and W' values.
 * Auto-estimated from training history using MMP curve fitting.
 */
export interface CriticalPowerEstimate {
  /** Critical Power in watts - the power at which W' is neither depleted nor recovered */
  cp: number;
  /** W' (W-prime) in joules - the finite work capacity above CP */
  wPrime: number;
  /** Confidence in estimate (0-1), based on data quality and quantity */
  confidence: number;
  /** ISO timestamp of last update */
  lastUpdated: string;
  /** Number of MMP data points used in the regression */
  dataPoints: number;
  /** True if decay has been applied due to inactivity */
  decayApplied: boolean;
}

/**
 * Dual-compartment chronic fatigue state.
 * Tracks metabolic freshness (fast recovery) and structural health (slow recovery).
 */
export interface ChronicFatigueState {
  /** Metabolic Freshness (MET) - glycogen, hormones, acute energy status */
  sMetabolic: number;
  /** Structural Health (MSK) - muscle fiber integrity, inflammation, joint stress */
  sStructural: number;
  /** Metabolic capacity - maximum MET value */
  capMetabolic: number;
  /** Structural capacity - maximum MSK value */
  capStructural: number;
  /** ISO timestamp of last update */
  lastUpdated: string;
}

/**
 * Recovery efficiency derived from questionnaire inputs.
 * Modulates the time constant (τ) for metabolic recovery.
 */
export interface RecoveryEfficiency {
  /** Combined recovery efficiency scalar [0.5, 1.5] */
  phi: number;
  /** Sleep contribution to recovery efficiency */
  sleepFactor: number;
  /** Nutrition contribution to recovery efficiency */
  nutritionFactor: number;
  /** Stress contribution (inverse - high stress = lower efficiency) */
  stressFactor: number;
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
  /** Stored chart data for historical viewing */
  chartData?: {
    powerHistory: Array<{ timeSeconds: number; power: number; phase: 'work' | 'rest' }>;
    rpeHistory: RpeLogEntry[];
    targetRPE: number;
    initialTargetPower: number;
  };

  // ---- Chronic Fatigue Model Fields ----

  /** Power data sampled at 5-second intervals for physiological cost calculation */
  secondBySecondPower?: number[];
  /** Best efforts extracted from this session for MMP curve */
  mmpBests?: MMPRecord[];
  /** Calculated physiological cost for this session */
  physiologicalCost?: number;
  /** Session style used for cost calculation fallback */
  sessionStyle?: SessionStyle;
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
  /** Pre-computed Monte Carlo simulation data for ALL possible week counts */
  simulationDataByWeekCount?: Record<number, import('./utils/autoAdaptiveTypes').SimulationDataSet>;
  /** Current week count's simulation data (convenience reference) */
  simulationData?: import('./utils/autoAdaptiveTypes').SimulationDataSet;

  // ---- Chronic Fatigue Model Fields ----

  /** Estimated Critical Power and W' from MMP curve fitting */
  criticalPowerEstimate?: CriticalPowerEstimate;
  /** Current dual-compartment chronic fatigue state */
  chronicFatigueState?: ChronicFatigueState;
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

  // RPE history for completion chart
  rpeHistory?: RpeLogEntry[];           // Logged RPE values during session
}

// ============================================================================
// READINESS QUESTIONNAIRE TYPES
// ============================================================================

/**
 * A single day's questionnaire response
 */
export interface QuestionnaireResponse {
  date: string;                       // YYYY-MM-DD
  responses: Record<string, number>;  // questionId -> 1-5 value
  timestamp: string;                  // ISO timestamp of submission
}

/**
 * Definition of a questionnaire question
 */
export interface QuestionnaireQuestion {
  id: string;
  category: 'sleep' | 'nutrition' | 'stress' | 'physical' | 'motivation';
  question: string;
  tooltips: { 1: string; 2: string; 3: string; 4: string; 5: string };
  weight: number;                     // Influence on adjustment (default: 1)
  optional?: boolean;                 // If true, user can skip this question
}