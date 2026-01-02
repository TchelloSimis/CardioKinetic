import { ProgramPreset } from './types';
import { ProgramTemplate } from './programTemplate';
import { templateToPreset } from './utils/templateUtils';

// ============================================================================
// DEFAULT PROGRAM TEMPLATES
// ============================================================================

/**
 * Template 1: Aerobic Base Builder
 * Research: Section 5 - Time-Progression Models, Section 2.1 - Central/Peripheral Dichotomy
 * - Pure steady-state with duration progression (20→35 min)
 * - Zone 2 endurance building via mitochondrial volume density
 * - Low-impact, high-adherence for general population
 */
const AEROBIC_BASE_TEMPLATE: ProgramTemplate = {
    templateVersion: '1.0',
    id: 'aerobic-base-builder',
    name: 'Aerobic Base Builder',
    description: 'A foundational steady-state program emphasizing duration progression at comfortable intensity. Based on traditional endurance periodization, this program increases session length from 20 to 35 minutes while maintaining Zone 2 power output. Ideal for building mitochondrial volume density, capillarization, and fuel efficiency. The gradual time progression allows connective tissue adaptation while developing aerobic base.',
    author: 'CardioKinetic',
    tags: ['steady-state', 'endurance', 'base-building', 'beginner-friendly', 'low-impact'],
    weekConfig: {
        type: 'variable',
        range: { min: 4, max: 12, step: 4 }
    },
    defaultSessionStyle: 'steady-state',
    progressionMode: 'duration',
    defaultSessionDurationMinutes: 20,
    weeks: [
        {
            position: 'first',
            phaseName: 'Foundation',
            focus: 'Volume',
            description: 'Establish aerobic base at comfortable, conversational pace.',
            powerMultiplier: 1.0,
            workRestRatio: 'steady',
            targetRPE: 4,
            durationMinutes: '100%'
        },
        {
            position: '33%',
            phaseName: 'Build I',
            focus: 'Volume',
            description: 'Extend duration while maintaining sustainable effort.',
            powerMultiplier: 1.0,
            workRestRatio: 'steady',
            targetRPE: 5,
            durationMinutes: '125%'
        },
        {
            position: '66%',
            phaseName: 'Build II',
            focus: 'Volume',
            description: 'Continue duration progression. Focus on relaxed efficiency.',
            powerMultiplier: 1.0,
            workRestRatio: 'steady',
            targetRPE: 5,
            durationMinutes: '150%'
        },
        {
            position: 'last',
            phaseName: 'Consolidation',
            focus: 'Volume',
            description: 'Peak duration achieved. Consolidate aerobic adaptations.',
            powerMultiplier: 1.0,
            workRestRatio: 'steady',
            targetRPE: 6,
            durationMinutes: '175%'
        }
    ],
    fatigueModifiers: [
        {
            condition: 'overreached',
            priority: 0,
            adjustments: {
                durationMultiplier: 0.5,
                powerMultiplier: 0.8,
                message: 'Overreaching detected. Halving session duration for recovery.'
            }
        },
        {
            condition: 'very_high_fatigue',
            priority: 1,
            adjustments: {
                durationMultiplier: 0.7,
                message: 'High fatigue. Reducing session length to protect adaptation.'
            }
        },
        {
            condition: 'high_fatigue',
            weekPosition: 'late',
            priority: 10,
            adjustments: {
                durationMultiplier: 0.85,
                message: 'Late-program fatigue accumulation. Modest duration reduction.'
            }
        },
        {
            condition: 'moderate_fatigue',
            weekPosition: '>50%',
            priority: 20,
            adjustments: {
                durationMultiplier: 0.92,
                rpeAdjust: -1,
                message: 'Managing mid-program fatigue. Slight reduction.'
            }
        },
        {
            condition: 'tired',
            priority: 30,
            adjustments: {
                rpeAdjust: -1,
                message: 'Feeling tired. Keep effort conversational today.'
            }
        },
        {
            condition: 'fresh',
            weekPosition: ['mid', 'late'],
            priority: 40,
            adjustments: {
                durationMultiplier: 1.10,
                message: 'Well recovered. Extending session to maximize base building.'
            }
        },
        {
            condition: { fatigue: '<25', readiness: '>70', logic: 'and' },
            weekPosition: 'early',
            priority: 42,
            adjustments: {
                durationMultiplier: 1.15,
                message: 'Excellent recovery state. Bonus duration today.'
            }
        }
    ]
};

/**
 * Template 2: Threshold Development (Block-Based)
 * Research: Section 8 Program D - Critical Power, Section 4.2 - 30-Minute Domain
 * - Block-based structure with 3-week build + 1-week absorption cycles
 * - Custom sessions with warmup/threshold work/cooldown
 * - Steady-state main sets at progressing threshold power
 */
const THRESHOLD_DEVELOPMENT_TEMPLATE: ProgramTemplate = {
    templateVersion: '1.0',
    id: 'threshold-development',
    name: 'Threshold Development',
    description: 'A block-based threshold training program using structured sessions with warmup, main set, and cooldown. Each 4-week cycle includes 3 weeks of progressive threshold work followed by 1 week of absorption. Based on Critical Power research, main sets target intensities just below threshold to maximize metabolic stability adaptations.',
    author: 'CardioKinetic',
    tags: ['threshold', 'block-based', 'steady-state', 'intermediate', 'structured'],

    structureType: 'block-based',
    weekConfig: {
        type: 'variable',
        customDurations: [4, 8, 12, 16]
    },
    defaultSessionStyle: 'custom',
    progressionMode: 'power',
    defaultSessionDurationMinutes: 30,

    fixedFirstWeek: {
        position: 'first',
        phaseName: 'Introduction',
        focus: 'Volume',
        description: 'Assessment week. Find sustainable threshold pace.',
        powerMultiplier: 0.90,
        workRestRatio: 'steady',
        targetRPE: 5,
        durationMinutes: 30,
        blocks: [
            { type: 'steady-state', durationExpression: 5, powerExpression: 0.6 },
            { type: 'steady-state', durationExpression: 20, powerExpression: 0.90 },
            { type: 'steady-state', durationExpression: 5, powerExpression: 0.5 }
        ]
    },

    fixedLastWeek: {
        position: 'last',
        phaseName: 'Consolidation',
        focus: 'Recovery',
        description: 'Final week consolidation. Maintain gains at reduced stress.',
        powerMultiplier: 0.95,
        workRestRatio: 'steady',
        targetRPE: 5,
        durationMinutes: 25,
        blocks: [
            { type: 'steady-state', durationExpression: 5, powerExpression: 0.6 },
            { type: 'steady-state', durationExpression: 15, powerExpression: 0.95 },
            { type: 'steady-state', durationExpression: 5, powerExpression: 0.5 }
        ]
    },

    programBlocks: [
        {
            id: 'threshold-build',
            name: 'Threshold Build',
            weekCount: 3,
            powerReference: 'base',
            powerProgression: [1.0, 1.05, 1.10],
            focus: 'Intensity',
            phaseName: 'Threshold Phase',
            description: 'Week {weekInBlock}/3: Progressive threshold development',
            workRestRatio: 'steady',
            targetRPE: [6, 7, 7],
            followedBy: 'absorption',
            weekSessions: [
                {
                    sessionStyle: 'custom',
                    blocks: [
                        { type: 'steady-state', durationExpression: 5, powerExpression: 0.6 },
                        { type: 'steady-state', durationExpression: 20, powerExpression: 1.0 },
                        { type: 'steady-state', durationExpression: 5, powerExpression: 0.5 }
                    ]
                },
                {
                    sessionStyle: 'custom',
                    blocks: [
                        { type: 'steady-state', durationExpression: 5, powerExpression: 0.6 },
                        { type: 'steady-state', durationExpression: 22, powerExpression: 1.0 },
                        { type: 'steady-state', durationExpression: 5, powerExpression: 0.5 }
                    ]
                },
                {
                    sessionStyle: 'custom',
                    blocks: [
                        { type: 'steady-state', durationExpression: 5, powerExpression: 0.65 },
                        { type: 'steady-state', durationExpression: 25, powerExpression: 1.0 },
                        { type: 'steady-state', durationExpression: 5, powerExpression: 0.5 }
                    ]
                }
            ]
        },
        {
            id: 'absorption',
            name: 'Absorption',
            weekCount: 1,
            powerReference: 'base',
            powerProgression: [0.85],
            focus: 'Recovery',
            phaseName: 'Absorption Week',
            description: 'Recovery week: Consolidate threshold adaptations',
            workRestRatio: 'steady',
            targetRPE: 4,
            followedBy: 'threshold-build',
            weekSessions: [
                {
                    sessionStyle: 'steady-state',
                    durationMinutes: 25,
                    targetRPE: 4
                }
            ]
        }
    ],

    weeks: [],

    fatigueModifiers: [
        {
            condition: 'overreached',
            priority: 0,
            adjustments: {
                powerMultiplier: 0.70,
                durationMultiplier: 0.6,
                message: 'Overreaching. Converting to easy recovery session.'
            }
        },
        {
            condition: 'very_high_fatigue',
            priority: 1,
            adjustments: {
                powerMultiplier: 0.80,
                message: 'High fatigue. Reducing threshold intensity significantly.'
            }
        },
        {
            condition: 'high_fatigue',
            phaseName: 'Threshold Phase',
            priority: 10,
            adjustments: {
                powerMultiplier: 0.90,
                message: 'Fatigue during threshold work. Backing off to protect quality.'
            }
        },
        {
            condition: 'moderate_fatigue',
            sessionType: 'custom',
            priority: 20,
            adjustments: {
                durationMultiplier: 0.90,
                message: 'Moderate fatigue. Shortening main set slightly.'
            }
        },
        {
            condition: 'tired',
            priority: 30,
            adjustments: {
                rpeAdjust: -1,
                message: 'Tired today. Keep threshold effort controlled.'
            }
        },
        {
            condition: 'fresh',
            phaseName: 'Threshold Phase',
            priority: 40,
            adjustments: {
                powerMultiplier: 1.03,
                message: 'Well recovered. Small threshold boost today.'
            }
        },
        {
            condition: { fatigue: '<30', readiness: '>65', logic: 'and' },
            phaseName: 'Threshold Phase',
            priority: 42,
            adjustments: {
                powerMultiplier: 1.05,
                durationMultiplier: 1.10,
                message: 'Excellent condition. Pushing threshold limits.'
            }
        }
    ]
};

/**
 * Template 3: Billat vVO2max Protocol (Block-Based)
 * Research: Section 4.2.1 - Billat 30-30 Protocol
 * - Block-based with 3-week build + 1-week recovery cycles  
 * - Custom sessions: warmup, 30s/30s intervals at vVO2max, cooldown
 * - Double progression: power and cycles increase together
 */
const BILLAT_VO2MAX_TEMPLATE: ProgramTemplate = {
    templateVersion: '1.0',
    id: 'billat-vo2max-protocol',
    name: 'Billat vVO2max Protocol',
    description: 'A block-based VO2max development program implementing the Billat 30-30 protocol. Each session includes warmup, 30-second intervals at 100% vVO2max with 30-second active recovery at 50%, and cooldown. This research-proven method maximizes time spent at VO2max while managing acidosis through strategic recovery intervals.',
    author: 'CardioKinetic',
    tags: ['vo2max', 'intervals', 'block-based', 'advanced', 'billat'],

    structureType: 'block-based',
    weekConfig: {
        type: 'variable',
        customDurations: [4, 8, 12]
    },
    defaultSessionStyle: 'custom',
    progressionMode: 'double',
    defaultSessionDurationMinutes: 25,

    fixedFirstWeek: {
        position: 'first',
        phaseName: 'Assessment',
        focus: 'Volume',
        description: 'Establish vVO2max baseline. Conservative interval count.',
        powerMultiplier: 0.95,
        workRestRatio: '1:1',
        targetRPE: 6,
        blocks: [
            { type: 'steady-state', durationExpression: 5, powerExpression: 0.6 },
            { type: 'interval', powerExpression: 0.95, cycles: 10, workDurationSeconds: 30, restDurationSeconds: 30 },
            { type: 'steady-state', durationExpression: 3, powerExpression: 0.5 }
        ]
    },

    fixedLastWeek: {
        position: 'last',
        phaseName: 'Realization',
        focus: 'Recovery',
        description: 'Final week: reduced volume, maintain gains.',
        powerMultiplier: 1.0,
        workRestRatio: '1:1',
        targetRPE: 6,
        blocks: [
            { type: 'steady-state', durationExpression: 5, powerExpression: 0.6 },
            { type: 'interval', powerExpression: 1.0, cycles: 12, workDurationSeconds: 30, restDurationSeconds: 30 },
            { type: 'steady-state', durationExpression: 3, powerExpression: 0.5 }
        ]
    },

    programBlocks: [
        {
            id: 'vo2max-build',
            name: 'VO2max Build',
            weekCount: 3,
            powerReference: 'base',
            progressionType: 'double',
            powerProgression: [1.0, 1.03, 1.05],
            durationProgression: [1.0, 1.15, 1.30],
            focus: 'Intensity',
            phaseName: 'VO2max Phase',
            description: 'Week {weekInBlock}/3: Billat 30-30 intervals',
            workRestRatio: '1:1',
            targetRPE: [7, 8, 8],
            followedBy: 'recovery',
            weekSessions: [
                {
                    sessionStyle: 'custom',
                    cycles: 12,
                    workDurationSeconds: 30,
                    restDurationSeconds: 30,
                    blocks: [
                        { type: 'steady-state', durationExpression: 5, powerExpression: 0.6 },
                        { type: 'interval', powerExpression: 1.0, cycles: 12, workDurationSeconds: 30, restDurationSeconds: 30 },
                        { type: 'steady-state', durationExpression: 3, powerExpression: 0.5 }
                    ]
                },
                {
                    sessionStyle: 'custom',
                    cycles: 14,
                    workDurationSeconds: 30,
                    restDurationSeconds: 30,
                    blocks: [
                        { type: 'steady-state', durationExpression: 5, powerExpression: 0.6 },
                        { type: 'interval', powerExpression: 1.0, cycles: 14, workDurationSeconds: 30, restDurationSeconds: 30 },
                        { type: 'steady-state', durationExpression: 3, powerExpression: 0.5 }
                    ]
                },
                {
                    sessionStyle: 'custom',
                    cycles: 16,
                    workDurationSeconds: 30,
                    restDurationSeconds: 30,
                    blocks: [
                        { type: 'steady-state', durationExpression: 5, powerExpression: 0.6 },
                        { type: 'interval', powerExpression: 1.0, cycles: 16, workDurationSeconds: 30, restDurationSeconds: 30 },
                        { type: 'steady-state', durationExpression: 3, powerExpression: 0.5 }
                    ]
                }
            ]
        },
        {
            id: 'recovery',
            name: 'Recovery',
            weekCount: 1,
            powerReference: 'base',
            powerProgression: [0.80],
            focus: 'Recovery',
            phaseName: 'Recovery Week',
            description: 'Active recovery: steady-state only',
            workRestRatio: 'steady',
            targetRPE: 4,
            followedBy: 'vo2max-build',
            weekSessions: [
                {
                    sessionStyle: 'steady-state',
                    durationMinutes: 25,
                    targetRPE: 4
                }
            ]
        }
    ],

    weeks: [],

    fatigueModifiers: [
        {
            condition: 'overreached',
            priority: 0,
            adjustments: {
                powerMultiplier: 0.70,
                volumeMultiplier: 0.50,
                restMultiplier: 2.0,
                message: 'Overreaching. Converting to recovery session.'
            }
        },
        {
            condition: 'very_high_fatigue',
            priority: 1,
            adjustments: {
                powerMultiplier: 0.80,
                restMultiplier: 1.5,
                message: 'High fatigue. Reducing VO2max intensity, extending recovery.'
            }
        },
        {
            condition: { fatigue: '>70', readiness: '<40', logic: 'and' },
            priority: 5,
            adjustments: {
                powerMultiplier: 0.75,
                volumeMultiplier: 0.70,
                message: 'Critical fatigue during build. Emergency reduction.'
            }
        },
        {
            condition: 'high_fatigue',
            phaseName: 'VO2max Phase',
            priority: 10,
            adjustments: {
                restMultiplier: 1.3,
                volumeMultiplier: 0.85,
                message: 'High fatigue. Fewer intervals with longer recovery.'
            }
        },
        {
            condition: 'moderate_fatigue',
            sessionType: 'custom',
            priority: 20,
            adjustments: {
                restMultiplier: 1.15,
                message: 'Moderate fatigue. Extending interval rest periods.'
            }
        },
        {
            condition: 'tired',
            priority: 30,
            adjustments: {
                rpeAdjust: -1,
                message: 'Tired today. Focus on quality over quantity.'
            }
        },
        {
            condition: 'fresh',
            phaseName: 'VO2max Phase',
            priority: 40,
            adjustments: {
                powerMultiplier: 1.03,
                message: 'Well recovered. Pushing VO2max intensity.'
            }
        },
        {
            condition: { fatigue: '<25', readiness: '>70', logic: 'and' },
            phaseName: 'VO2max Phase',
            priority: 42,
            adjustments: {
                powerMultiplier: 1.05,
                volumeMultiplier: 1.10,
                message: 'Optimal condition. Maximizing VO2max stimulus.'
            }
        }
    ]
};

/**
 * Template 4: Gibala Sprint Intervals (Week-Based)
 * Research: Section 4.1.1 - Gibala Protocols, Section 4.1.3 - EDT
 * - Classic week-based HIIT with work:rest ratio progression
 * - Fixed 15-minute sessions (EDT concept)
 * - Power progression with density increase via ratio changes
 */
const GIBALA_HIIT_TEMPLATE: ProgramTemplate = {
    templateVersion: '1.0',
    id: 'gibala-sprint-intervals',
    name: 'Gibala Sprint Intervals',
    description: 'A time-efficient HIIT program based on Martin Gibala research demonstrating that short, intense intervals can match endurance adaptations from much longer sessions. Uses fixed 15-minute sessions with progressive work:rest ratios (1:2 → 1:1 → 2:1) and explicit interval parameters. Ideal for maximizing metabolic adaptation with minimal time investment.',
    author: 'CardioKinetic',
    tags: ['hiit', 'intervals', 'gibala', 'time-efficient', 'power'],
    weekConfig: {
        type: 'variable',
        range: { min: 4, max: 12, step: 4 }
    },
    defaultSessionStyle: 'interval',
    progressionMode: 'power',
    defaultSessionDurationMinutes: 15,
    weeks: [
        {
            position: 'first',
            phaseName: 'Activation',
            focus: 'Volume',
            description: 'Neural activation with conservative intervals. Build movement patterns.',
            powerMultiplier: 0.95,
            workRestRatio: '1:2',
            targetRPE: 6,
            cycles: 10,
            workDurationSeconds: 30,
            restDurationSeconds: 60
        },
        {
            position: '25%',
            phaseName: 'Base',
            focus: 'Volume',
            description: 'Aerobic base with work capacity development.',
            powerMultiplier: 1.0,
            workRestRatio: '1:2',
            targetRPE: 7,
            cycles: 10,
            workDurationSeconds: 30,
            restDurationSeconds: 60
        },
        {
            position: '50%',
            phaseName: 'Density',
            focus: 'Density',
            description: 'Increased density with equal work:rest. Lactate management training.',
            powerMultiplier: 1.05,
            workRestRatio: '1:1',
            targetRPE: 7,
            cycles: 12,
            workDurationSeconds: 30,
            restDurationSeconds: 30
        },
        {
            position: '75%',
            phaseName: 'Intensity',
            focus: 'Intensity',
            description: 'Peak intensity phase. Work longer than rest periods.',
            powerMultiplier: 1.12,
            workRestRatio: '2:1',
            targetRPE: 8,
            cycles: 10,
            workDurationSeconds: 40,
            restDurationSeconds: 20
        },
        {
            position: 'last',
            phaseName: 'Peak',
            focus: 'Intensity',
            description: 'Maximum power output. Quality over quantity.',
            powerMultiplier: 1.15,
            workRestRatio: '2:1',
            targetRPE: 9,
            cycles: 8,
            workDurationSeconds: 40,
            restDurationSeconds: 20
        }
    ],
    fatigueModifiers: [
        {
            condition: 'overreached',
            priority: 0,
            adjustments: {
                powerMultiplier: 0.70,
                volumeMultiplier: 0.50,
                restMultiplier: 2.0,
                message: 'Overreaching. Major reduction with extended recovery.'
            }
        },
        {
            condition: 'very_high_fatigue',
            priority: 1,
            adjustments: {
                powerMultiplier: 0.80,
                restMultiplier: 1.5,
                message: 'High fatigue. Reducing power, extending rest intervals.'
            }
        },
        {
            condition: { fatigue: '>70', readiness: '<40', logic: 'and' },
            phase: 'Intensity',
            priority: 5,
            adjustments: {
                powerMultiplier: 0.75,
                restMultiplier: 1.5,
                volumeMultiplier: 0.70,
                message: 'Critical fatigue during intensity phase. Emergency protocol.'
            }
        },
        {
            condition: 'high_fatigue',
            phase: 'Intensity',
            weekPosition: 'late',
            priority: 10,
            adjustments: {
                powerMultiplier: 0.88,
                restMultiplier: 1.3,
                message: 'Late-program intensity fatigue. Backing off for safety.'
            }
        },
        {
            condition: 'high_fatigue',
            phase: 'Density',
            priority: 11,
            adjustments: {
                restMultiplier: 1.25,
                message: 'High fatigue during density phase. Extending rest periods.'
            }
        },
        {
            condition: 'moderate_fatigue',
            sessionType: 'interval',
            weekPosition: '>50%',
            priority: 20,
            adjustments: {
                restMultiplier: 1.15,
                message: 'Moderate fatigue. Slightly longer rest between intervals.'
            }
        },
        {
            condition: 'tired',
            priority: 30,
            adjustments: {
                rpeAdjust: -1,
                message: 'Tired today. Focus on movement quality.'
            }
        },
        {
            condition: 'fresh',
            phase: 'Intensity',
            weekPosition: ['mid', 'late'],
            priority: 40,
            adjustments: {
                powerMultiplier: 1.05,
                message: 'Fresh during intensity! Pushing harder.'
            }
        },
        {
            condition: 'fresh',
            phase: ['Volume', 'Density'],
            weekPosition: 'early',
            priority: 41,
            adjustments: {
                volumeMultiplier: 1.10,
                message: 'Well recovered early. Adding extra intervals.'
            }
        },
        {
            condition: { fatigue: '<30', readiness: '>70', logic: 'and' },
            phase: 'Intensity',
            weekPosition: 'late',
            priority: 42,
            adjustments: {
                powerMultiplier: 1.08,
                message: 'Peak condition at peak phase! Maximum output.'
            }
        }
    ]
};

/**
 * Template 5: Builder/Deload Block-Based Periodization
 * - Block-based structure with repeating 4-week builder + 2-week deload cycles
 * - Power accumulates through builder phases using block_start reference
 * - Deload blocks reduce to 80% of previous power for recovery
 * - Custom durations: 8, 14, 20, 26 weeks (fixed first/last + n×6 block weeks)
 */
const BUILDER_DELOAD_TEMPLATE: ProgramTemplate = {
    templateVersion: '1.0',
    id: 'builder-deload-blocks',
    name: 'Builder/Deload Periodization',
    description: 'A periodized program using 4-week builder blocks followed by 2-week deload blocks. Power accumulates through each builder phase and reduces during deloads for sustainable long-term progression.',
    author: 'CardioKinetic',

    structureType: 'block-based',

    weekConfig: {
        type: 'variable',
        customDurations: [8, 14, 20, 26]  // 2 fixed + n×6 block weeks
    },

    defaultSessionStyle: 'interval',
    progressionMode: 'power',
    defaultSessionDurationMinutes: 15,

    fixedFirstWeek: {
        position: 'first',
        phaseName: 'Introduction',
        focus: 'Volume',
        description: 'Establish baseline at comfortable intensity.',
        powerMultiplier: 1.0,
        workRestRatio: '1:2',
        targetRPE: 5,
        workDurationSeconds: 30,
        restDurationSeconds: 60,
        cycles: 10
    },

    fixedLastWeek: {
        position: 'last',
        phaseName: 'Conclusion',
        focus: 'Recovery',
        description: 'Final week at baseline power for adaptation consolidation.',
        powerMultiplier: 1.0,
        workRestRatio: '1:2',
        targetRPE: 5,
        workDurationSeconds: 30,
        restDurationSeconds: 60,
        cycles: 10
    },

    programBlocks: [
        {
            id: 'builder',
            name: 'Builder',
            weekCount: 4,
            powerReference: 'block_start',
            powerProgression: [1.1, 1.2, 1.3, 1.4],
            followedBy: 'deload',
            focus: 'Intensity',
            phaseName: 'Build Phase',
            description: 'Progressive overload week {weekInBlock}/4 of {blockName} block',
            workRestRatio: '2:1',
            targetRPE: [7, 7, 8, 8]
        },
        {
            id: 'deload',
            name: 'Deload',
            weekCount: 2,
            powerReference: 'block_start',
            powerProgression: [0.8, 0.8],
            followedBy: 'builder',
            focus: 'Recovery',
            phaseName: 'Deload Phase',
            description: 'Active recovery week {weekInBlock}/2',
            workRestRatio: '1:2',
            targetRPE: 5
        }
    ],

    weeks: [],  // Empty for block-based templates

    fatigueModifiers: [
        {
            condition: 'overreached',
            priority: 0,
            adjustments: {
                powerMultiplier: 0.70,
                volumeMultiplier: 0.50,
                message: 'STOP: You are overreached. Mandatory recovery session.'
            }
        },
        {
            condition: 'high_fatigue',
            phase: 'Intensity',
            priority: 10,
            adjustments: {
                powerMultiplier: 0.85,
                message: 'High fatigue during build phase. Reducing intensity.'
            }
        },
        {
            condition: 'very_high_fatigue',
            priority: 5,
            adjustments: {
                powerMultiplier: 0.75,
                volumeMultiplier: 0.75,
                message: 'Very high fatigue detected. Switching to recovery mode.'
            }
        },
        {
            condition: 'fresh',
            phase: 'Intensity',
            priority: 40,
            adjustments: {
                powerMultiplier: 1.05,
                message: 'Feeling fresh! Small intensity boost.'
            }
        }
    ]
};

// Convert templates to presets for backward compatibility
export const DEFAULT_PRESETS: ProgramPreset[] = [
    templateToPreset(AEROBIC_BASE_TEMPLATE),
    templateToPreset(THRESHOLD_DEVELOPMENT_TEMPLATE),
    templateToPreset(BILLAT_VO2MAX_TEMPLATE),
    templateToPreset(GIBALA_HIIT_TEMPLATE),
    templateToPreset(BUILDER_DELOAD_TEMPLATE)
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
