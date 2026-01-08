/**
 * useMetrics Hook - Revised Chronic Fatigue Model
 * 
 * Calculates metrics using the dual-compartment fatigue model:
 * - MET (Metabolic Energy Tank): Fast recovery τ ≈ 2 days
 * - MSK (MusculoSkeletal): Slow recovery τ ≈ 15 days
 * 
 * Also estimates Critical Power (eCP) from training history.
 * 
 * Legacy ATL/CTL/TSB/ACWR values are still calculated for backward compatibility.
 */

import { useMemo, useEffect } from 'react';
import {
    Session, PlanWeek, ReadinessState, ProgramRecord,
    QuestionnaireResponse, CriticalPowerEstimate, ChronicFatigueState
} from '../types';
import {
    calculateSessionLoad,
    calculateRecentAveragePower,
    calculateFatigueScore as calculateLegacyFatigueScore,
    calculateReadinessScore as calculateLegacyReadinessScore
} from '../utils/metricsUtils';
import { applyFatigueModifiers } from '../utils/templateUtils';
import { applyQuestionnaireAdjustment } from '../utils/questionnaireConfig';
import { parseLocalDate, getDayIndex, addDays, isDateInRange, getLocalDateString } from '../utils/dateUtils';
import { calculateAutoAdaptiveAdjustments } from '../utils/autoAdaptiveModifiers';
import type { AutoAdaptiveAdjustment } from '../utils/autoAdaptiveTypes';

// New chronic fatigue model imports
import { calculateECP, shouldRecalculateECP } from '../utils/criticalPowerEngine';
import { calculateSessionCost, aggregateDailyLoad } from '../utils/physiologicalCostEngine';
import {
    updateMetabolicFreshness,
    updateStructuralHealth,
    calculateReadinessScore as calculateChronicReadiness,
    interpretReadinessState,
    initializeChronicState,
    createDefaultChronicState,
    applyStructuralCorrection,
    applyMetabolicCorrection,
    applyDetrainingPenalty,
    DEFAULT_PHI_RECOVERY,
    DEFAULT_CAP_METABOLIC,
    DEFAULT_CAP_STRUCTURAL,
    SIGMA_IMPACT,
} from '../utils/chronicFatigueModel';
import { analyzeSessionForCorrections } from '../utils/rpeCorrectionLoop';

// ============================================================================
// INTERFACES
// ============================================================================

export interface MetricsResult {
    // NEW: Chronic fatigue model values
    sMetabolic: number;
    sStructural: number;
    eCP: number;
    wPrime: number;
    readinessInterpretation: {
        status: 'green_light' | 'metabolic_fatigue' | 'structural_fatigue' | 'both_fatigued' | 'recovering';
        recommendation: string;
        sessionSuggestion: 'high_intensity' | 'endurance' | 'active_recovery' | 'rest';
    };

    // LEGACY: Kept for backward compatibility during transition
    fatigue: number;        // Mapped from avg(MET, MSK) normalized
    readiness: number;      // From new readiness calculation
    tsb: number;            // Approximated from legacy EWMA
    acwr: number;           // Approximated from legacy EWMA

    // Unchanged
    status: ReadinessState;
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
    /** Recovery efficiency (φ) from today's questionnaire: 0.5 (poor) to 1.5 (excellent), 1.0 is baseline */
    recoveryEfficiency: number;
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
    /** Global CP estimate from app state */
    globalCPEstimate?: CriticalPowerEstimate | null;
    /** Global chronic state from app state */
    globalChronicState?: ChronicFatigueState | null;
    /** Callback to update global CP estimate */
    onCPEstimateUpdate?: (estimate: CriticalPowerEstimate) => void;
    /** Callback to update global chronic state */
    onChronicStateUpdate?: (state: ChronicFatigueState) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate recovery efficiency (φ) from questionnaire response.
 */
function calculatePhiRecovery(response: QuestionnaireResponse | undefined): number {
    if (!response) return DEFAULT_PHI_RECOVERY;

    const { responses } = response;
    // Use actual questionnaire field names - average sleep metrics
    const sleepHours = responses['sleep_hours'] || 3;
    const sleepQuality = responses['sleep_quality'] || 3;
    const sleep = (sleepHours + sleepQuality) / 2;
    const nutrition = responses['nutrition'] || 3;
    const stress = responses['stress'] || 3;

    // Normalize to 0-1 range
    const sleepNorm = (sleep - 1) / 4;
    const nutritionNorm = (nutrition - 1) / 4;
    const stressNorm = (stress - 1) / 4;

    // Calculate phi: 0.5 at worst, 1.5 at best
    const avgFactor = (sleepNorm + nutritionNorm + stressNorm) / 3;
    return Math.max(0.5, Math.min(1.5, 0.5 + avgFactor));
}

/**
 * Map chronic model readiness to legacy ReadinessState enum.
 */
function mapToLegacyReadinessState(
    interpretation: ReturnType<typeof interpretReadinessState>
): ReadinessState {
    switch (interpretation.status) {
        case 'green_light':
            return ReadinessState.PROGRESS;
        case 'metabolic_fatigue':
        case 'recovering':
            return ReadinessState.MAINTAIN;
        case 'structural_fatigue':
        case 'both_fatigued':
            return ReadinessState.RECOVERY_NEEDED;
        default:
            return ReadinessState.MAINTAIN;
    }
}

/**
 * Convert chronic state to legacy fatigue score (0-100).
 * Higher state values = higher fatigue.
 */
function chronicStateToLegacyFatigue(
    sMeta: number,
    sStruct: number,
    capMeta: number,
    capStruct: number
): number {
    const metaRatio = sMeta / capMeta;
    const structRatio = sStruct / capStruct;
    const avgRatio = (metaRatio * 0.6 + structRatio * 0.4);
    return Math.round(Math.min(100, Math.max(0, avgRatio * 100)));
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Hook for calculating training metrics using the Revised Chronic Fatigue Model.
 * Provides both new dual-compartment metrics and legacy compatibility values.
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
        autoAdaptiveEnabled = false,
        globalCPEstimate,
        globalChronicState,
        onCPEstimateUpdate,
        onChronicStateUpdate,
    } = options;

    // Filter sessions to active program only
    const filteredSessions = useMemo(() => {
        if (!activeProgram) return sessions;

        const programWeeks = activeProgram.plan?.length || 12;
        const programEndStr = addDays(activeProgram.startDate, (programWeeks * 7));

        return sessions.filter(s => {
            if (s.programId === activeProgram.id) return true;
            if (!s.programId) {
                return isDateInRange(s.date, activeProgram.startDate, programEndStr);
            }
            return false;
        });
    }, [sessions, activeProgram]);

    // Calculate or use existing CP estimate
    const cpEstimate = useMemo(() => {
        if (globalCPEstimate && globalCPEstimate.confidence > 0) {
            return globalCPEstimate;
        }
        // Calculate from session history
        return calculateECP(filteredSessions, new Date(), globalCPEstimate, basePower);
    }, [filteredSessions, globalCPEstimate, basePower]);

    // Update CP estimate if needed (side effect)
    useEffect(() => {
        if (onCPEstimateUpdate && cpEstimate &&
            (!globalCPEstimate || cpEstimate.lastUpdated !== globalCPEstimate.lastUpdated)) {
            onCPEstimateUpdate(cpEstimate);
        }
    }, [cpEstimate, globalCPEstimate, onCPEstimateUpdate]);

    return useMemo(() => {
        // ================================================================
        // LEGACY CALCULATIONS (for backward compatibility)
        // ================================================================
        const daysToSim = getDayIndex(simulatedDate, startDate);
        const totalCalcDays = Math.max(1, daysToSim + 1);

        // Build daily load array (legacy method)
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

        // Calculate legacy EWMA for TSB/ACWR (still needed for some displays)
        let atl = 0;
        let ctl = 10;
        const atlAlpha = 2 / (7 + 1);
        const ctlAlpha = 2 / (42 + 1);

        for (let i = 0; i < totalCalcDays; i++) {
            const load = dailyLoads[i];
            atl = atl * (1 - atlAlpha) + load * atlAlpha;
            ctl = ctl * (1 - ctlAlpha) + load * ctlAlpha;
        }

        const legacyTsb = ctl - atl;
        const legacyAcwr = ctl > 0 ? atl / ctl : 0;

        // ================================================================
        // NEW CHRONIC FATIGUE MODEL CALCULATIONS
        // ================================================================

        // Calculate chronic state from program startDate to simulatedDate
        // This matches Chart.tsx approach exactly for consistency
        let sMeta = 0;
        let sStruct = 0;
        const capMeta = DEFAULT_CAP_METABOLIC;
        const capStruct = DEFAULT_CAP_STRUCTURAL;

        // Build questionnaire lookup map (includes all available responses)
        const questionnaireByDate = new Map<string, QuestionnaireResponse>();
        if (recentQuestionnaireResponses) {
            recentQuestionnaireResponses.forEach(r => questionnaireByDate.set(r.date, r));
        }
        if (todayQuestionnaireResponse) {
            questionnaireByDate.set(todayQuestionnaireResponse.date, todayQuestionnaireResponse);
        }

        // Build complete list for trend analysis (same as Chart.tsx)
        const allQuestionnaireResponses = [
            ...(recentQuestionnaireResponses || []),
            ...(todayQuestionnaireResponse ? [todayQuestionnaireResponse] : [])
        ];

        // Wellness carryover modifier - decays questionnaire effects into subsequent days
        // This matches Chart.tsx exactly for consistency
        let wellnessModifier = 0;
        const wellnessAlpha = 2 / (3 + 1); // 3-day half-life

        // Track daily metrics for final day extraction
        let finalReadiness = 50;
        let finalFatigue = 50;

        // Iterate from program start to simulated date
        for (let i = 0; i <= daysToSim; i++) {
            const dateStr = addDays(startDate, i);

            // Calculate daily load using physiological cost engine
            const dailyLoad = aggregateDailyLoad(filteredSessions, dateStr, cpEstimate);

            // Get recovery efficiency from questionnaire
            const dayResponse = questionnaireByDate.get(dateStr);
            const phiRecovery = calculatePhiRecovery(dayResponse);

            // Update compartments with φ recovery efficiency
            sMeta = updateMetabolicFreshness(sMeta, dailyLoad, phiRecovery, capMeta);
            sStruct = updateStructuralHealth(sStruct, dailyLoad, SIGMA_IMPACT, capStruct);

            // Apply Bayesian corrections for questionnaire days (same as Chart.tsx)
            // This injects hidden fatigue when user reports issues but model shows fresh
            if (dayResponse) {
                const soreness = dayResponse.responses['soreness'];
                const energy = dayResponse.responses['energy'];

                if (soreness && soreness <= 2) {
                    const correction = applyStructuralCorrection(
                        { sMetabolic: sMeta, sStructural: sStruct, capMetabolic: capMeta, capStructural: capStruct, lastUpdated: '' },
                        soreness
                    );
                    sStruct = correction.sStructural;
                }
                if (energy && energy <= 2) {
                    const correction = applyMetabolicCorrection(
                        { sMetabolic: sMeta, sStructural: sStruct, capMetabolic: capMeta, capStructural: capStruct, lastUpdated: '' },
                        energy
                    );
                    sMeta = correction.sMetabolic;
                }
            }

            // Calculate base readiness from chronic model (after Bayesian corrections)
            let readiness = calculateChronicReadiness(sMeta, sStruct, capMeta, capStruct);

            // Convert chronic state to fatigue score (higher state = higher fatigue)
            const metaRatio = sMeta / capMeta;
            const structRatio = sStruct / capStruct;
            const avgRatio = (metaRatio * 0.6 + structRatio * 0.4);
            let fatigue = Math.round(Math.min(100, Math.max(0, avgRatio * 100)));

            // Apply questionnaire adjustments to display values (same as Chart.tsx)
            // This shows subjective perception influence
            if (dayResponse) {
                // Get recent responses for trend analysis (prior 7 days)
                const recentForDay = allQuestionnaireResponses
                    .filter(r => r.date < dateStr)
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 7);

                const adjustment = applyQuestionnaireAdjustment(
                    readiness,
                    fatigue,
                    dayResponse,
                    recentForDay
                );

                // Track wellness modifier for carryover to subsequent days
                const fatigueImpact = adjustment.fatigue - fatigue;
                const readinessImpact = adjustment.readiness - readiness;
                wellnessModifier = wellnessModifier * (1 - wellnessAlpha) +
                    ((readinessImpact - fatigueImpact) / 2) * wellnessAlpha;

                // Apply adjustments to final display values
                readiness = adjustment.readiness;
                fatigue = adjustment.fatigue;
            } else {
                // Decay wellness modifier on non-questionnaire days
                wellnessModifier = wellnessModifier * (1 - wellnessAlpha);

                // Apply carryover if significant (threshold of 0.5)
                if (Math.abs(wellnessModifier) > 0.5) {
                    readiness = Math.max(0, Math.min(100, Math.round(readiness + wellnessModifier)));
                    fatigue = Math.max(0, Math.min(100, Math.round(fatigue - wellnessModifier)));
                }
            }

            // Store for final day (this will be overwritten each iteration, ending with simulatedDate)
            finalReadiness = readiness;
            finalFatigue = fatigue;
        }

        // Build final chronic state
        const chronicState: ChronicFatigueState = {
            sMetabolic: sMeta,
            sStructural: sStruct,
            capMetabolic: capMeta,
            capStructural: capStruct,
            lastUpdated: new Date().toISOString(),
        };

        // Calculate BASE readiness for interpretation (before questionnaire adjustment)
        const baseChronicReadiness = calculateChronicReadiness(
            chronicState.sMetabolic,
            chronicState.sStructural,
            chronicState.capMetabolic,
            chronicState.capStructural
        );

        const readinessInterpretation = interpretReadinessState(
            baseChronicReadiness,
            chronicState.sMetabolic,
            chronicState.sStructural,
            chronicState.capMetabolic,
            chronicState.capStructural
        );

        // Map to legacy fatigue score (base, before questionnaire adjustment)
        const baseLegacyFatigue = chronicStateToLegacyFatigue(
            chronicState.sMetabolic,
            chronicState.sStructural,
            chronicState.capMetabolic,
            chronicState.capStructural
        );

        // Update chronic state in app state
        if (onChronicStateUpdate && chronicState.lastUpdated !== globalChronicState?.lastUpdated) {
            // Defer to avoid state update during render
            setTimeout(() => onChronicStateUpdate(chronicState), 0);
        }

        // ================================================================
        // DISPLAY VALUES (with questionnaire adjustment from historical iteration)
        // finalReadiness and finalFatigue already have questionnaire adjustments
        // and wellnessModifier carryover applied from the iteration loop above
        // ================================================================

        // Calculate days since recent sessions for harmonic-weighted detraining
        const simulatedDateTime = parseLocalDate(simulatedDate).getTime();
        const daysSinceRecentSessions = filteredSessions
            .map(s => parseLocalDate(s.date).getTime())
            .sort((a, b) => b - a) // Most recent first
            .slice(0, 5) // Take up to 5 most recent
            .map(sessionTime => Math.max(0, Math.floor((simulatedDateTime - sessionTime) / (1000 * 60 * 60 * 24))));

        // Apply detraining penalty: readiness decays with extended rest
        const displayReadiness = applyDetrainingPenalty(finalReadiness, daysSinceRecentSessions);
        const displayFatigue = finalFatigue;

        // Compute questionnaire adjustment badge values by comparing to base
        let questionnaireAdjustment: { readinessChange: number; fatigueChange: number } | undefined;
        if (todayQuestionnaireResponse) {
            questionnaireAdjustment = {
                readinessChange: displayReadiness - baseChronicReadiness,
                fatigueChange: displayFatigue - baseLegacyFatigue
            };
        }

        // ================================================================
        // HANDLE MISSING WEEK PLAN
        // ================================================================
        if (!currentWeekPlan) {
            return {
                sMetabolic: chronicState.sMetabolic,
                sStructural: chronicState.sStructural,
                eCP: cpEstimate.cp,
                wPrime: cpEstimate.wPrime,
                readinessInterpretation,
                fatigue: displayFatigue,
                readiness: displayReadiness,
                status: mapToLegacyReadinessState(readinessInterpretation),
                tsb: Math.round(legacyTsb),
                acwr: Math.round(legacyAcwr * 100) / 100,
                advice: readinessInterpretation.recommendation,
                modifiedWeekPlan: null,
                modifierMessages: [],
                questionnaireAdjustment,
                recoveryEfficiency: calculatePhiRecovery(todayQuestionnaireResponse)
            };
        }

        // ================================================================
        // APPLY FATIGUE MODIFIERS
        // Use questionnaire-adjusted display values for consistent behavior
        // ================================================================
        const programModifiers = activeProgram?.fatigueModifiers || [];
        const fatigueContext = {
            fatigueScore: displayFatigue,
            readinessScore: displayReadiness,
            tsbValue: legacyTsb,
            weekNumber: currentWeekNum,
            totalWeeks: programLength,
            phase: currentWeekPlan.focus,
            phaseName: currentWeekPlan.phaseName,
        };

        // Calculate auto-adaptive adjustment if enabled
        let autoAdaptiveAdjustment: AutoAdaptiveAdjustment | undefined;

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

        // ================================================================
        // GENERATE ADVICE
        // ================================================================
        let fullAdvice: string | null = null;
        const isAutoAdaptiveAdvice = modifierResult.isAutoAdaptive;

        if (modifierMessages.length > 0) {
            fullAdvice = modifierMessages.join(' ');
        }
        // No fallback - only auto-adaptive or coach modifier messages are shown

        return {
            sMetabolic: chronicState.sMetabolic,
            sStructural: chronicState.sStructural,
            eCP: cpEstimate.cp,
            wPrime: cpEstimate.wPrime,
            readinessInterpretation,
            fatigue: displayFatigue,
            readiness: displayReadiness,
            status: mapToLegacyReadinessState(readinessInterpretation),
            tsb: Math.round(legacyTsb),
            acwr: Math.round(legacyAcwr * 100) / 100,
            advice: fullAdvice,
            isAutoAdaptiveAdvice,
            modifiedWeekPlan,
            modifierMessages,
            questionnaireAdjustment,
            autoAdaptiveAdjustment,
            recoveryEfficiency: calculatePhiRecovery(todayQuestionnaireResponse)
        };
    }, [
        filteredSessions, simulatedDate, startDate, basePower,
        currentWeekNum, programLength, currentWeekPlan, activeProgram,
        todayQuestionnaireResponse, recentQuestionnaireResponses,
        autoAdaptiveEnabled, cpEstimate, globalChronicState, onChronicStateUpdate
    ]);
};
