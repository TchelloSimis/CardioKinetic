/**
 * useMetrics Hook
 * 
 * Calculates ATL, CTL, TSB, fatigue scores, readiness scores, and generates advice.
 * Applies fatigue modifiers from program templates.
 */

import { useMemo } from 'react';
import { Session, PlanWeek, ReadinessState, ProgramRecord } from '../types';
import {
    calculateSessionLoad,
    calculateRecentAveragePower,
    calculateFatigueScore,
    calculateReadinessScore
} from '../utils/metricsUtils';
import { applyFatigueModifiers } from '../utils/templateUtils';

export interface MetricsResult {
    fatigue: number;
    readiness: number;
    status: ReadinessState;
    tsb: number;
    advice: string | null;
    modifiedWeekPlan: PlanWeek | null;
    modifierMessages: string[];
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
        activeProgram
    } = options;

    return useMemo(() => {
        const oneDay = 24 * 60 * 60 * 1000;
        const start = new Date(startDate);
        const simDate = new Date(simulatedDate);
        simDate.setHours(0, 0, 0, 0);

        const daysToSim = Math.floor((simDate.getTime() - start.getTime()) / oneDay);
        const totalCalcDays = Math.max(1, daysToSim + 1);

        // Build daily load array
        const dailyLoads = new Float32Array(totalCalcDays).fill(0);
        sessions.forEach(s => {
            const d = new Date(s.date);
            d.setHours(0, 0, 0, 0);
            const dayIndex = Math.floor((d.getTime() - start.getTime()) / oneDay);
            if (dayIndex >= 0 && dayIndex < totalCalcDays) {
                const recentAvgPower = calculateRecentAveragePower(sessions, d, basePower);
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
        const fatigueScore = calculateFatigueScore(atl, ctl);
        const readinessScore = calculateReadinessScore(tsb);

        // Handle missing week plan
        if (!currentWeekPlan) {
            return {
                fatigue: fatigueScore,
                readiness: readinessScore,
                status: ReadinessState.MAINTAIN,
                tsb: Math.round(tsb),
                advice: null,
                modifiedWeekPlan: null,
                modifierMessages: []
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
            phase: currentWeekPlan.focus
        };
        const modifierResult = applyFatigueModifiers(currentWeekPlan, fatigueContext, programModifiers);
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

        // Use modifier messages if available, otherwise use calculated advice
        const fullAdvice = modifierMessages.length > 0
            ? modifierMessages.join(' ')
            : null; // Only show Coach's Advice when the program template has specific messages

        return {
            fatigue: fatigueScore,
            readiness: readinessScore,
            status: readinessText,
            tsb: Math.round(tsb),
            advice: fullAdvice,
            modifiedWeekPlan,
            modifierMessages
        };
    }, [sessions, simulatedDate, startDate, basePower, currentWeekNum, programLength, currentWeekPlan, activeProgram]);
};
