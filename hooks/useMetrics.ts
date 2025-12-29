/**
 * useMetrics Hook
 * 
 * Calculates ATL, CTL, TSB, fatigue scores, readiness scores, and generates advice.
 * Applies fatigue modifiers from program templates and auto-adaptive adjustments.
 */

import { useMemo } from 'react';
import { Session, PlanWeek, ReadinessState, ProgramRecord, QuestionnaireResponse } from '../types';
import {
    calculateSessionLoad,
    calculateRecentAveragePower,
    calculateFatigueScore,
    calculateReadinessScore
} from '../utils/metricsUtils';
import { applyFatigueModifiers } from '../utils/templateUtils';
import { applyQuestionnaireAdjustment } from '../utils/questionnaireConfig';
import { parseLocalDate, getDayIndex, addDays, isDateInRange } from '../utils/dateUtils';
import { calculateAutoAdaptiveAdjustments } from '../utils/autoAdaptiveModifiers';
import type { AutoAdaptiveAdjustment } from '../utils/autoAdaptiveTypes';

export interface MetricsResult {
    fatigue: number;
    readiness: number;
    status: ReadinessState;
    tsb: number;
    advice: string | null;
    /** Whether the current advice is from auto-adaptive system vs coach modifiers */
    isAutoAdaptiveAdvice?: boolean;
    modifiedWeekPlan: PlanWeek | null;
    modifierMessages: string[];
    questionnaireAdjustment?: {
        readinessChange: number;
        fatigueChange: number;
    };
    /** Auto-adaptive adjustment details (for debugging/display) */
    autoAdaptiveAdjustment?: AutoAdaptiveAdjustment;
}

interface UseMetricsOptions {
    sessions: Session[];
    simulatedDate: string;
    startDate: string;
    basePower: number;
    currentWeekNum: number;
    programLength: number;
    currentWeekPlan: PlanWeek | undefined;
    activeProgram: ProgramRecord | null;
    todayQuestionnaireResponse?: QuestionnaireResponse;
    recentQuestionnaireResponses?: QuestionnaireResponse[];  // Last 7 days for trend analysis
    /** Whether auto-adaptive modifiers are enabled in settings */
    autoAdaptiveEnabled?: boolean;
}

/**
 * Hook for calculating training metrics (ATL, CTL, TSB) and applying fatigue modifiers
 */
export const useMetrics = (options: UseMetricsOptions): MetricsResult => {
    const {
        sessions,
        simulatedDate,
        startDate,
        basePower,
        currentWeekNum,
        programLength,
        currentWeekPlan,
        activeProgram,
        todayQuestionnaireResponse,
        recentQuestionnaireResponses,
        autoAdaptiveEnabled = false
    } = options;

    // Filter sessions to active program only (matching Chart behavior)
    const filteredSessions = useMemo(() => {
        if (!activeProgram) return sessions;

        // Calculate program end date string
        const programWeeks = activeProgram.plan?.length || 12;
        const programEndStr = addDays(activeProgram.startDate, (programWeeks * 7));

        return sessions.filter(s => {
            // Include if session has matching programId
            if (s.programId === activeProgram.id) return true;

            // For legacy sessions without programId, include if within program date range
            if (!s.programId) {
                return isDateInRange(s.date, activeProgram.startDate, programEndStr);
            }

            return false;
        });
    }, [sessions, activeProgram]);

    return useMemo(() => {
        // Use timezone-agnostic day calculations
        const daysToSim = getDayIndex(simulatedDate, startDate);
        const totalCalcDays = Math.max(1, daysToSim + 1);

        // Build daily load array
        const dailyLoads = new Float32Array(totalCalcDays).fill(0);
        filteredSessions.forEach(s => {
            const dayIndex = getDayIndex(s.date, startDate);
            if (dayIndex >= 0 && dayIndex < totalCalcDays) {
                const sessionDate = parseLocalDate(s.date);
                const recentAvgPower = calculateRecentAveragePower(filteredSessions, sessionDate, basePower);
                const powerRatio = s.power / recentAvgPower;
                dailyLoads[dayIndex] += calculateSessionLoad(s.rpe, s.duration, powerRatio);
            }
        });

        // Calculate exponential moving averages
        let atl = 0;
        let ctl = 10;
        const atlAlpha = 2 / (7 + 1);
        const ctlAlpha = 2 / (42 + 1);

        for (let i = 0; i < totalCalcDays; i++) {
            const load = dailyLoads[i];
            atl = atl * (1 - atlAlpha) + load * atlAlpha;
            ctl = ctl * (1 - ctlAlpha) + load * ctlAlpha;
        }

        const tsb = ctl - atl;
        let fatigueScore = calculateFatigueScore(atl, ctl);
        let readinessScore = calculateReadinessScore(tsb);

        // Apply questionnaire adjustments if available
        let questionnaireAdjustment: { readinessChange: number; fatigueChange: number } | undefined;
        if (todayQuestionnaireResponse) {
            const adjustment = applyQuestionnaireAdjustment(
                readinessScore,
                fatigueScore,
                todayQuestionnaireResponse,
                recentQuestionnaireResponses  // Last 7 days for trend analysis
            );
            questionnaireAdjustment = {
                readinessChange: adjustment.readinessChange,
                fatigueChange: adjustment.fatigueChange
            };
            readinessScore = adjustment.readiness;
            fatigueScore = adjustment.fatigue;
        }

        // Handle missing week plan
        if (!currentWeekPlan) {
            return {
                fatigue: fatigueScore,
                readiness: readinessScore,
                status: ReadinessState.MAINTAIN,
                tsb: Math.round(tsb),
                advice: null,
                modifiedWeekPlan: null,
                modifierMessages: [],
                questionnaireAdjustment
            };
        }

        // Apply fatigue modifiers from program template
        const programModifiers = activeProgram?.fatigueModifiers || [];
        const fatigueContext = {
            fatigueScore,
            readinessScore,
            tsbValue: tsb,
            weekNumber: currentWeekNum,
            totalWeeks: programLength,
            phase: currentWeekPlan.focus,
            phaseName: currentWeekPlan.phaseName,
            expectedCyclePhase: currentWeekPlan.expectedCyclePhase,
            expectedPhasePosition: currentWeekPlan.expectedPhasePosition,
        };

        // Calculate auto-adaptive adjustment if enabled and simulation data exists
        let autoAdaptiveAdjustment: AutoAdaptiveAdjustment | undefined;

        // Debug: Log the auto-adaptive check conditions (remove before release)
        if (autoAdaptiveEnabled) {
            console.log('[useMetrics] Auto-adaptive check:', {
                autoAdaptiveEnabled,
                hasActiveProgram: !!activeProgram,
                programId: activeProgram?.id,
                hasSimulationData: !!activeProgram?.simulationData,
                simulationWeekCount: activeProgram?.simulationData?.weekCount,
                hasWeekPercentiles: !!activeProgram?.simulationData?.weekPercentiles,
                percentilesLength: activeProgram?.simulationData?.weekPercentiles?.length,
                currentWeekNum,
                weekPercentileExists: !!activeProgram?.simulationData?.weekPercentiles?.[currentWeekNum - 1]
            });
        }

        if (autoAdaptiveEnabled && activeProgram?.simulationData?.weekPercentiles?.[currentWeekNum - 1]) {
            autoAdaptiveAdjustment = calculateAutoAdaptiveAdjustments(
                fatigueContext,
                activeProgram.simulationData.weekPercentiles[currentWeekNum - 1],
                currentWeekPlan.sessionStyle || 'interval',
                currentWeekPlan.blocks
            );
        }

        const modifierResult = applyFatigueModifiers(
            currentWeekPlan,
            fatigueContext,
            programModifiers,
            autoAdaptiveAdjustment
        );
        const modifierMessages = modifierResult.messages;
        const modifiedWeekPlan = modifierResult.week;

        const phaseFocus = currentWeekPlan.focus;

        // Calculate readiness-based advice
        const isFresh = readinessScore > 75;
        const isTired = readinessScore < 50;
        const isOverloaded = fatigueScore > 60;

        let readinessText = ReadinessState.MAINTAIN;
        let advice = "";

        if (isOverloaded) {
            readinessText = ReadinessState.RECOVERY_NEEDED;
            advice = "Critical fatigue detected. Regardless of the planned phase, prioritize recovery. Reduce volume by 50% or take a complete rest day to avoid non-functional overreaching.";
        } else if (isTired) {
            readinessText = ReadinessState.MAINTAIN;
            if (phaseFocus === 'Intensity' || phaseFocus === 'Density') {
                advice = "Fatigue is high. You may struggle to hit peak power output. Focus on completing the intervals at 90% effort rather than failing at 100%. Do not add extra sets.";
            } else if (phaseFocus === 'Volume') {
                advice = "Accumulated fatigue is expected in this volume block. Keep intensity strictly in Zone 2/Low-Aerobic to allow recovery while maintaining duration.";
            } else {
                advice = "Recovery phase indicated. Respect the lower intensity caps. Your body is synthesizing recent gains.";
            }
        } else if (isFresh) {
            readinessText = ReadinessState.PROGRESS;
            if (phaseFocus === 'Intensity') {
                advice = "You are prime for high output. Attack the work intervals aggressively. Aim to exceed target wattage by 5-10 watts if RPE remains stable.";
            } else if (phaseFocus === 'Density') {
                advice = "Excellent readiness. Focus on minimizing recovery time. Strictly adhere to the rest intervals, or even shorten them by 5 seconds if the session feels easy.";
            } else if (phaseFocus === 'Volume') {
                advice = "You are well-recovered. This is a good opportunity to extend the session duration by 5-10 minutes while keeping power steady.";
            } else {
                advice = "You are fresh, but this is a recovery week. Resist the urge to go hard. Save this energy for the next block.";
            }
        } else {
            readinessText = ReadinessState.MAINTAIN;
            advice = "Training stress is balanced. Execute the session exactly as prescribed. Focus on form and breathing.";
        }

        // Use modifier messages if available, otherwise check for auto-adaptive, otherwise null
        let fullAdvice: string | null = null;
        const isAutoAdaptiveAdvice = modifierResult.isAutoAdaptive;

        if (modifierMessages.length > 0) {
            fullAdvice = modifierMessages.join(' ');
        }
        // Otherwise fullAdvice stays null (no advice shown)

        return {
            fatigue: fatigueScore,
            readiness: readinessScore,
            status: readinessText,
            tsb: Math.round(tsb),
            advice: fullAdvice,
            isAutoAdaptiveAdvice,
            modifiedWeekPlan,
            modifierMessages,
            questionnaireAdjustment,
            autoAdaptiveAdjustment
        };
    }, [filteredSessions, simulatedDate, startDate, basePower, currentWeekNum, programLength, currentWeekPlan, activeProgram, todayQuestionnaireResponse, recentQuestionnaireResponses, autoAdaptiveEnabled]);
};
