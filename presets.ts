import { ProgramPreset } from './types';
import { ProgramTemplate } from './programTemplate';
import { templateToPreset } from './utils/templateUtils';

// ============================================================================
// DEFAULT PROGRAM TEMPLATES
// ============================================================================

/**
 * Template 1: Fixed-Time Steady State Power Progression
 * - Steady-state sessions with constant duration
 * - Power increases progressively throughout the program
 * - Suitable for aerobic base building with gradual intensity increases
 */
const FIXED_TIME_POWER_TEMPLATE: ProgramTemplate = {
    templateVersion: '1.0',
    id: 'fixed-time-power-progression',
    name: 'Fixed-Time Power Progression',
    description: 'A steady-state endurance program where session time stays constant while power output increases progressively. Ideal for building aerobic capacity while systematically improving power at a sustainable pace. The program maintains consistent training volume while focusing purely on power adaptation.',
    author: 'CardioKinetic',
    tags: ['steady-state', 'power-progression', 'endurance', 'beginner-friendly'],
    weekConfig: {
        type: 'variable',
        range: { min: 4, max: 16, step: 4 }
    },
    defaultSessionStyle: 'steady-state',
    progressionMode: 'power',
    defaultSessionDurationMinutes: 20,
    weeks: [
        {
            position: 'first',
            phaseName: 'Foundation',
            focus: 'Volume',
            description: 'Establish aerobic base with comfortable, sustainable effort.',
            powerMultiplier: 1.0,
            workRestRatio: 'steady',
            targetRPE: 5,
            durationMinutes: '100%'
        },
        {
            position: '33%',
            phaseName: 'Build I',
            focus: 'Volume',
            description: 'Begin gradual power increase while maintaining steady effort.',
            powerMultiplier: 1.05,
            workRestRatio: 'steady',
            targetRPE: 6,
            durationMinutes: '100%'
        },
        {
            position: '66%',
            phaseName: 'Build II',
            focus: 'Intensity',
            description: 'Continue power progression with increased metabolic demand.',
            powerMultiplier: 1.10,
            workRestRatio: 'steady',
            targetRPE: 7,
            durationMinutes: '100%'
        },
        {
            position: 'last',
            phaseName: 'Peak',
            focus: 'Intensity',
            description: 'Maximum power output at sustainable duration.',
            powerMultiplier: 1.15,
            workRestRatio: 'steady',
            targetRPE: 8,
            durationMinutes: '100%'
        }
    ],
    fatigueModifiers: [
        // Critical safety modifiers
        {
            condition: 'overreached',
            adjustments: {
                powerMultiplier: 0.75,
                volumeMultiplier: 0.5,
                message: 'Overreaching detected. Major reduction for safety and recovery.'
            }
        },
        {
            condition: 'very_high_fatigue',
            adjustments: {
                powerMultiplier: 0.85,
                volumeMultiplier: 0.8,
                message: 'High fatigue accumulation. Reducing intensity and volume.'
            }
        },
        // Phase-specific high fatigue
        {
            condition: 'high_fatigue',
            phase: 'Intensity',
            weekPosition: 'late',
            adjustments: {
                powerMultiplier: 0.90,
                message: 'Late-program fatigue during intensity phase. Backing off power.'
            }
        },
        {
            condition: 'high_fatigue',
            phase: 'Volume',
            adjustments: {
                volumeMultiplier: 0.90,
                message: 'High fatigue during volume phase. Slightly reducing duration.'
            }
        },
        // Moderate fatigue handling
        {
            condition: 'moderate_fatigue',
            phase: 'Intensity',
            weekPosition: ['mid', 'late'],
            adjustments: {
                powerMultiplier: 0.95,
                message: 'Moderate fatigue in intensity phase. Small power reduction.'
            }
        },
        {
            condition: 'tired',
            adjustments: {
                rpeAdjust: -1,
                message: 'Feeling tired. Targeting lower effort today.'
            }
        },
        {
            condition: 'tired',
            phase: 'Intensity',
            weekPosition: 'last',
            adjustments: {
                powerMultiplier: 0.90,
                rpeAdjust: -1,
                message: 'Tired at peak week. Significant reduction to preserve quality.'
            }
        },
        // Fresh/recovered bonuses
        {
            condition: 'fresh',
            phase: 'Intensity',
            weekPosition: ['mid', 'late'],
            adjustments: {
                powerMultiplier: 1.05,
                message: 'Feeling fresh! Adding 5% power boost.'
            }
        },
        {
            condition: 'fresh',
            phase: 'Volume',
            weekPosition: 'early',
            adjustments: {
                volumeMultiplier: 1.10,
                message: 'Well recovered early in program. Extending session 10%.'
            }
        },
        {
            condition: 'low_fatigue',
            weekPosition: '>50%',
            adjustments: {
                powerMultiplier: 1.03,
                message: 'Low fatigue in second half. Small intensity boost.'
            }
        },
        // Compound condition
        {
            condition: { fatigue: '>70', readiness: '<40', logic: 'and' },
            phase: 'Intensity',
            adjustments: {
                powerMultiplier: 0.80,
                volumeMultiplier: 0.70,
                message: 'High fatigue + low readiness. Strong reduction recommended.'
            }
        }
    ]
};

/**
 * Template 2: Double Intercalated Progression
 * - Cyclical pattern alternating between compressed (shorter, harder) and extended phases
 * - Duration decreases while power increases, then duration resets for next cycle
 * - Suitable for breaking plateaus and building both efficiency and power
 */
const DOUBLE_INTERCALATED_TEMPLATE: ProgramTemplate = {
    templateVersion: '1.0',
    id: 'double-intercalated-progression',
    name: 'Double Intercalated Progression',
    description: 'An advanced steady-state program using cyclical progression. Each cycle starts with normal duration at baseline power, compresses to shorter/harder sessions, then expands back to full duration at higher power. This wave-loading pattern helps break plateaus by alternating metabolic stress and recovery while continuously progressing power.',
    author: 'CardioKinetic',
    tags: ['steady-state', 'wave-loading', 'intermediate', 'plateau-breaker'],
    weekConfig: {
        type: 'variable',
        range: { min: 6, max: 15, step: 3 }
    },
    defaultSessionStyle: 'steady-state',
    progressionMode: 'double',
    defaultSessionDurationMinutes: 25,
    weeks: [
        // Cycle 1: Baseline
        {
            position: 'first',
            phaseName: 'Cycle 1: Base',
            focus: 'Volume',
            description: 'Full duration at baseline power. Establish rhythm.',
            powerMultiplier: 1.0,
            workRestRatio: 'steady',
            targetRPE: 5,
            durationMinutes: '100%'
        },
        // Cycle 1: Compression
        {
            position: '17%',
            phaseName: 'Cycle 1: Compress',
            focus: 'Intensity',
            description: 'Shorter sessions, higher power. Build efficiency.',
            powerMultiplier: 1.08,
            workRestRatio: 'steady',
            targetRPE: 7,
            durationMinutes: '70%'
        },
        // Cycle 1: Expansion
        {
            position: '33%',
            phaseName: 'Cycle 1: Expand',
            focus: 'Volume',
            description: 'Return to full duration with elevated power.',
            powerMultiplier: 1.10,
            workRestRatio: 'steady',
            targetRPE: 6,
            durationMinutes: '100%'
        },
        // Cycle 2: New baseline (at higher power)
        {
            position: '50%',
            phaseName: 'Cycle 2: Base',
            focus: 'Volume',
            description: 'New baseline established. Prepare for next compression.',
            powerMultiplier: 1.10,
            workRestRatio: 'steady',
            targetRPE: 6,
            durationMinutes: '100%'
        },
        // Cycle 2: Compression
        {
            position: '66%',
            phaseName: 'Cycle 2: Compress',
            focus: 'Intensity',
            description: 'Second compression phase. Push harder.',
            powerMultiplier: 1.18,
            workRestRatio: 'steady',
            targetRPE: 8,
            durationMinutes: '65%'
        },
        // Cycle 2: Final expansion
        {
            position: '83%',
            phaseName: 'Cycle 2: Expand',
            focus: 'Intensity',
            description: 'Final expansion with peak power.',
            powerMultiplier: 1.20,
            workRestRatio: 'steady',
            targetRPE: 7,
            durationMinutes: '90%'
        },
        // Peak week
        {
            position: 'last',
            phaseName: 'Peak Performance',
            focus: 'Intensity',
            description: 'Peak week: maintained power with full duration.',
            powerMultiplier: 1.20,
            workRestRatio: 'steady',
            targetRPE: 8,
            durationMinutes: '100%'
        }
    ],
    fatigueModifiers: [
        // Critical safety
        {
            condition: 'overreached',
            adjustments: {
                powerMultiplier: 0.70,
                volumeMultiplier: 0.50,
                message: 'Overreaching! Wave-loading stress requires immediate recovery.'
            }
        },
        {
            condition: 'very_high_fatigue',
            adjustments: {
                powerMultiplier: 0.80,
                volumeMultiplier: 0.75,
                message: 'High fatigue from wave-loading. Major reduction applied.'
            }
        },
        // Compression phase protection
        {
            condition: 'high_fatigue',
            phase: 'Intensity',
            adjustments: {
                powerMultiplier: 0.88,
                message: 'High fatigue during compression. Reducing power demand.'
            }
        },
        {
            condition: 'moderate_fatigue',
            phase: 'Intensity',
            adjustments: {
                powerMultiplier: 0.93,
                message: 'Moderate fatigue in hard phase. Slight power reduction.'
            }
        },
        // Expansion phase protection
        {
            condition: 'high_fatigue',
            phase: 'Volume',
            adjustments: {
                volumeMultiplier: 0.85,
                message: 'High fatigue during expansion. Cutting duration.'
            }
        },
        {
            condition: 'moderate_fatigue',
            phase: 'Volume',
            adjustments: {
                volumeMultiplier: 0.92,
                message: 'Moderate fatigue. Slightly shorter expansion.'
            }
        },
        // General tired handling
        {
            condition: 'tired',
            adjustments: {
                rpeAdjust: -1,
                message: 'Tired today. Lower effort target.'
            }
        },
        {
            condition: 'tired',
            weekPosition: 'late',
            adjustments: {
                powerMultiplier: 0.88,
                rpeAdjust: -1,
                message: 'Late-program fatigue. Backing off significantly.'
            }
        },
        // Fresh bonuses
        {
            condition: 'fresh',
            phase: 'Intensity',
            adjustments: {
                powerMultiplier: 1.05,
                message: 'Fresh during compression! Pushing harder.'
            }
        },
        {
            condition: 'fresh',
            phase: 'Volume',
            adjustments: {
                volumeMultiplier: 1.08,
                message: 'Well recovered. Extending expansion phase.'
            }
        },
        {
            condition: 'low_fatigue',
            weekPosition: ['mid', 'late'],
            adjustments: {
                powerMultiplier: 1.03,
                message: 'Low fatigue mid-program. Small boost applied.'
            }
        },
        // Compound: worst case during compression
        {
            condition: { fatigue: '>75', readiness: '<35', logic: 'and' },
            phase: 'Intensity',
            adjustments: {
                powerMultiplier: 0.75,
                volumeMultiplier: 0.65,
                message: 'Critical fatigue during compression. Emergency reduction.'
            }
        },
        // Compound: great shape during expansion
        {
            condition: { fatigue: '<25', readiness: '>70', logic: 'and' },
            phase: 'Volume',
            adjustments: {
                volumeMultiplier: 1.15,
                powerMultiplier: 1.03,
                message: 'Excellent recovery! Maximizing expansion gains.'
            }
        }
    ]
};

/**
 * Template 3: Standard HIIT Protocol
 * - Classic high-intensity interval training structure
 * - Work/rest ratios progress from conservative to aggressive
 * - Power increases throughout program phases
 */
const STANDARD_HIIT_TEMPLATE: ProgramTemplate = {
    templateVersion: '1.0',
    id: 'standard-hiit-protocol',
    name: 'Standard HIIT Protocol',
    description: 'A classic high-intensity interval training program progressing from conservative work-rest ratios to aggressive intervals. Starts with a base phase emphasizing movement patterns, builds through density phases reducing rest periods, peaks with high power output, and optionally tapers for adaptation. Based on proven HIIT periodization principles.',
    author: 'CardioKinetic',
    tags: ['hiit', 'interval', 'power', 'all-levels'],
    weekConfig: {
        type: 'variable',
        range: { min: 4, max: 16, step: 4 }
    },
    defaultSessionStyle: 'interval',
    progressionMode: 'power',
    defaultSessionDurationMinutes: 15,
    weeks: [
        {
            position: 'first',
            phaseName: 'Activation',
            focus: 'Volume',
            description: 'Neural activation and movement patterns. Conservative intensity.',
            powerMultiplier: 0.95,
            workRestRatio: '1:2',
            targetRPE: 5,
            durationMinutes: '100%'
        },
        {
            position: '20%',
            phaseName: 'Base Building',
            focus: 'Volume',
            description: 'Aerobic base development. Building work capacity.',
            powerMultiplier: 1.0,
            workRestRatio: '1:2',
            targetRPE: 6,
            durationMinutes: '100%'
        },
        {
            position: '40%',
            phaseName: 'Density I',
            focus: 'Density',
            description: 'Increasing work density. Reducing rest between intervals.',
            powerMultiplier: 1.0,
            workRestRatio: '1:1',
            targetRPE: 7,
            durationMinutes: '100%'
        },
        {
            position: '55%',
            phaseName: 'Density II',
            focus: 'Density',
            description: 'Peak density phase. Minimal rest, sustained power.',
            powerMultiplier: 1.05,
            workRestRatio: '1:1',
            targetRPE: 7,
            durationMinutes: '105%'
        },
        {
            position: '70%',
            phaseName: 'Intensity I',
            focus: 'Intensity',
            description: 'Power progression begins. Work longer than rest.',
            powerMultiplier: 1.10,
            workRestRatio: '2:1',
            targetRPE: 8,
            durationMinutes: '100%'
        },
        {
            position: '85%',
            phaseName: 'Intensity II',
            focus: 'Intensity',
            description: 'Peak power development. Maximum sustainable output.',
            powerMultiplier: 1.15,
            workRestRatio: '2:1',
            targetRPE: 9,
            durationMinutes: '95%'
        },
        {
            position: 'last',
            phaseName: 'Peak/Taper',
            focus: 'Recovery',
            description: 'Final week: maintain power gains, reduce volume for adaptation.',
            powerMultiplier: 1.10,
            workRestRatio: '1:1',
            targetRPE: 7,
            durationMinutes: '80%'
        }
    ],
    fatigueModifiers: [
        // Critical safety
        {
            condition: 'overreached',
            adjustments: {
                powerMultiplier: 0.75,
                volumeMultiplier: 0.50,
                restMultiplier: 2.0,
                message: 'Overreaching detected. Major reduction + extra rest.'
            }
        },
        {
            condition: 'very_high_fatigue',
            adjustments: {
                powerMultiplier: 0.85,
                restMultiplier: 1.5,
                message: 'High fatigue. Reducing power, extending rest intervals.'
            }
        },
        // Phase-specific high fatigue
        {
            condition: 'high_fatigue',
            phase: 'Intensity',
            weekPosition: 'late',
            adjustments: {
                powerMultiplier: 0.90,
                restMultiplier: 1.3,
                message: 'High fatigue in late intensity phase. Protecting recovery.'
            }
        },
        {
            condition: 'high_fatigue',
            phase: 'Density',
            adjustments: {
                restMultiplier: 1.25,
                message: 'High fatigue during density phase. Extending rest periods.'
            }
        },
        {
            condition: 'high_fatigue',
            phase: 'Volume',
            adjustments: {
                volumeMultiplier: 0.85,
                message: 'High fatigue early. Reducing session volume.'
            }
        },
        // Moderate fatigue
        {
            condition: 'moderate_fatigue',
            phase: 'Intensity',
            adjustments: {
                restMultiplier: 1.15,
                message: 'Moderate fatigue. Slightly longer rest between intervals.'
            }
        },
        {
            condition: 'moderate_fatigue',
            phase: 'Density',
            adjustments: {
                restMultiplier: 1.10,
                message: 'Managing fatigue with extended rest.'
            }
        },
        // Tired handling
        {
            condition: 'tired',
            adjustments: {
                rpeAdjust: -1,
                message: 'Tired today. Targeting lower RPE.'
            }
        },
        {
            condition: 'tired',
            phase: 'Intensity',
            weekPosition: 'late',
            adjustments: {
                powerMultiplier: 0.90,
                rpeAdjust: -1,
                restMultiplier: 1.2,
                message: 'Tired at peak weeks. Full recovery protocol.'
            }
        },
        // Fresh bonuses
        {
            condition: 'fresh',
            phase: 'Intensity',
            weekPosition: ['mid', 'late'],
            adjustments: {
                powerMultiplier: 1.05,
                message: 'Fresh during intensity! Pushing harder.'
            }
        },
        {
            condition: 'fresh',
            phase: ['Volume', 'Density'],
            weekPosition: 'early',
            adjustments: {
                volumeMultiplier: 1.10,
                message: 'Well recovered early. Extending session.'
            }
        },
        {
            condition: 'low_fatigue',
            weekPosition: '>50%',
            phase: 'Intensity',
            adjustments: {
                powerMultiplier: 1.03,
                message: 'Low fatigue in intensity phase. Small boost!'
            }
        },
        // Compound conditions
        {
            condition: { fatigue: '>70', readiness: '<40', logic: 'and' },
            phase: 'Intensity',
            adjustments: {
                powerMultiplier: 0.80,
                restMultiplier: 1.5,
                volumeMultiplier: 0.75,
                message: 'Critical fatigue state. Emergency adjustments active.'
            }
        },
        {
            condition: { fatigue: '<30', readiness: '>65', logic: 'and' },
            phase: 'Intensity',
            weekPosition: 'late',
            adjustments: {
                powerMultiplier: 1.07,
                message: 'Peak condition at peak phase! Maximizing output.'
            }
        },
        // Recovery phase special handling
        {
            condition: 'high_fatigue',
            phase: 'Recovery',
            adjustments: {
                powerMultiplier: 0.85,
                volumeMultiplier: 0.70,
                restMultiplier: 1.4,
                message: 'Prioritizing recovery. Heavy reductions applied.'
            }
        }
    ]
};

// Convert templates to presets for backward compatibility
export const DEFAULT_PRESETS: ProgramPreset[] = [
    templateToPreset(FIXED_TIME_POWER_TEMPLATE),
    templateToPreset(DOUBLE_INTERCALATED_TEMPLATE),
    templateToPreset(STANDARD_HIIT_TEMPLATE)
];


// Accent color type and options
export type AccentColor = 'mono' | 'red' | 'orange' | 'green' | 'blue' | 'purple' | 'pink' | 'material';

export interface AccentColorConfig {
    id: AccentColor;
    name: string;
    light: string;
    dark: string;
    lightAlt: string;
    darkAlt: string;
    displayLight: string;
    displayDark: string;
    logoLight: string;
    logoDark: string;
}

export const ACCENT_COLORS: AccentColorConfig[] = [
    { id: 'mono', name: 'Monochrome', light: '#525252', dark: '#a3a3a3', lightAlt: '#a3a3a3', darkAlt: '#404040', displayLight: '#404040', displayDark: '#9a9a9a', logoLight: '#1a1a1a', logoDark: '#e5e5e5' },
    { id: 'red', name: 'Rose', light: '#f472b6', dark: '#f472b6', lightAlt: '#db2777', darkAlt: '#831337', displayLight: '#ec4899', displayDark: '#f43f5e', logoLight: '#4a0519', logoDark: '#fecdd3' },
    { id: 'orange', name: 'Peach', light: '#fdba74', dark: '#fb923c', lightAlt: '#ea580c', darkAlt: '#7c2d12', displayLight: '#fb923c', displayDark: '#f97316', logoLight: '#431407', logoDark: '#fed7aa' },
    { id: 'green', name: 'Mint', light: '#6ee7b7', dark: '#34d399', lightAlt: '#059669', darkAlt: '#064e3b', displayLight: '#34d399', displayDark: '#10b981', logoLight: '#022c22', logoDark: '#a7f3d0' },
    { id: 'blue', name: 'Sky', light: '#7dd3fc', dark: '#38bdf8', lightAlt: '#0284c7', darkAlt: '#0c4a6e', displayLight: '#38bdf8', displayDark: '#0ea5e9', logoLight: '#082f49', logoDark: '#bae6fd' },
    { id: 'purple', name: 'Lavender', light: '#c4b5fd', dark: '#a78bfa', lightAlt: '#8b5cf6', darkAlt: '#4c1d95', displayLight: '#a78bfa', displayDark: '#8b5cf6', logoLight: '#2e1065', logoDark: '#ddd6fe' },
    { id: 'pink', name: 'Blush', light: '#f9a8d4', dark: '#f472b6', lightAlt: '#db2777', darkAlt: '#831843', displayLight: '#f472b6', displayDark: '#ec4899', logoLight: '#500724', logoDark: '#fbcfe8' },
];

// Tab type for navigation
export type Tab = 'dashboard' | 'plan' | 'chart' | 'settings';
export type ThemePreference = 'light' | 'dark' | 'system';

// Color Modifier Types
export type ColorRole = 'primary' | 'secondary' | 'ui' | 'logo';
export type ThemeVariant = 'light' | 'dark';

export interface ModifierParams {
    saturation: number; // Absolute HSL saturation value (0-100). When set, replaces base color's saturation.
    brightness: number; // Absolute HSL lightness value (0-100). When set, replaces base color's lightness.
}

export type RoleModifiers = Record<ColorRole, ModifierParams>;
export type ThemeModifiers = Record<ThemeVariant, RoleModifiers>;
export type AccentModifierState = Record<string, ThemeModifiers>;
