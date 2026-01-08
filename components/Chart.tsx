
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useChartGestures } from '../hooks/useChartGestures';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea
} from 'recharts';
import { Session, PlanWeek, ProgramRecord, QuestionnaireResponse, CriticalPowerEstimate } from '../types';
import { ZoomIn, ZoomOut, RefreshCcw, Check, Square, CheckSquare } from 'lucide-react';
import {
  calculateSessionLoad,
  calculateRecentAveragePower
} from '../utils/metricsUtils';
import {
  getWeekNumber,
  getProgramEndDateStr,
  isDateInProgramRangeStr
} from '../utils/chartUtils';
import { getLocalDateString, getDayIndex, addDays, formatDateShort, parseLocalDate } from '../utils/dateUtils';
import { applyQuestionnaireAdjustment } from '../utils/questionnaireConfig';
// Chronic Fatigue Model - for updated metrics visualization
import { calculateECP } from '../utils/criticalPowerEngine';
import { aggregateDailyLoad } from '../utils/physiologicalCostEngine';
import {
  updateMetabolicFreshness,
  updateStructuralHealth,
  calculateReadinessScore as calculateChronicReadiness,
  applyStructuralCorrection,
  applyMetabolicCorrection,
  applyDetrainingPenalty,
  DEFAULT_PHI_RECOVERY,
  DEFAULT_CAP_METABOLIC,
  DEFAULT_CAP_STRUCTURAL,
  SIGMA_IMPACT,
} from '../utils/chronicFatigueModel';


interface ChartProps {
  sessions: Session[];
  programs: ProgramRecord[]; // Changed from plan: PlanWeek[]
  isDarkMode: boolean;
  startDate?: string; // Optional now, derived from programs
  accentColor?: string; // Accent color for readiness line
  accentAltColor?: string; // Alternate accent color for fatigue line
  currentDate?: string; // Current date (supports simulated date from dev tools)
  todayQuestionnaireResponse?: QuestionnaireResponse; // Today's questionnaire for adjustment
  recentQuestionnaireResponses?: QuestionnaireResponse[]; // Last 7 days for trend analysis
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number | string | null;
    name: string;
    stroke?: string;
    fill?: string;
  }>;
  label?: string;
  viewMode?: 'week' | 'day';
}

const CustomTooltip = React.memo(({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-xl z-50 pointer-events-none">
        <p className="text-neutral-900 dark:text-white font-bold mb-2 text-[10px] tracking-widest uppercase">
          {label}
        </p>
        {payload.map((entry, index: number) => {
          if (entry.value === null || entry.value === undefined) return null;
          return (
            <div key={index} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.stroke || entry.fill }}></div>
                <span className="text-[10px] uppercase text-neutral-500 dark:text-neutral-400">{entry.name}</span>
              </div>
              <span className="font-mono font-bold text-xs text-neutral-900 dark:text-white">
                {typeof entry.value === 'number' ? Math.round(entry.value) : entry.value}
                {entry.name.includes('Planned') || entry.name.includes('Actual') ? ' W' : ''}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
});

const Chart: React.FC<ChartProps> = ({ sessions, programs, isDarkMode, accentColor, accentAltColor, currentDate: currentDateProp, todayQuestionnaireResponse, recentQuestionnaireResponses }) => {
  // Use ref to track if we've initialized from localStorage to prevent re-init on re-renders
  const initializedRef = useRef(false);

  // Initialize viewMode from localStorage
  const [viewMode, setViewMode] = useState<'week' | 'day'>(() => {
    try {
      const saved = localStorage.getItem('cardiokinetic_chart_viewMode');
      if (saved === 'week' || saved === 'day') return saved;
    } catch (e) { }
    return 'week';
  });

  // Initialize metricMode from localStorage
  const [metricMode, setMetricMode] = useState<'power' | 'work'>(() => {
    try {
      const saved = localStorage.getItem('cardiokinetic_chart_metricMode');
      if (saved === 'power' || saved === 'work') return saved;
    } catch (e) { }
    return 'power';
  });

  // Initialize selectedProgramIds from localStorage
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('cardiokinetic_chart_programs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Only include IDs that still exist in programs
          const validIds = parsed.filter((id: string) => programs.some(p => p.id === id));
          if (validIds.length > 0) {
            initializedRef.current = true;
            return new Set(validIds);
          }
        }
      }
    } catch (e) { }
    // Default to all programs
    return new Set(programs.map(p => p.id));
  });

  // Persist viewMode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cardiokinetic_chart_viewMode', viewMode);
    } catch (e) { }
  }, [viewMode]);

  // Persist metricMode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cardiokinetic_chart_metricMode', metricMode);
    } catch (e) { }
  }, [metricMode]);

  // Persist selectedProgramIds to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cardiokinetic_chart_programs', JSON.stringify([...selectedProgramIds]));
    } catch (e) { }
  }, [selectedProgramIds]);

  // Only auto-add NEW programs if user hasn't explicitly made a selection
  // Track known program IDs to detect truly new programs
  const knownProgramIdsRef = useRef<Set<string>>(new Set(programs.map(p => p.id)));

  useEffect(() => {
    if (programs.length > 0) {
      const currentIds = new Set(programs.map(p => p.id));
      const newProgramIds = [...currentIds].filter(id => !knownProgramIdsRef.current.has(id));

      if (newProgramIds.length > 0) {
        // Only add truly NEW programs (that weren't known before)
        setSelectedProgramIds(prev => {
          const next = new Set(prev);
          newProgramIds.forEach(id => next.add(id));
          return next;
        });
      }

      // Update known programs
      knownProgramIdsRef.current = currentIds;

      // If somehow empty, select all
      setSelectedProgramIds(prev => {
        if (prev.size === 0) {
          return new Set(programs.map(p => p.id));
        }
        return prev;
      });
    }
  }, [programs]);

  const toggleProgram = (programId: string) => {
    setSelectedProgramIds(prev => {
      const next = new Set(prev);
      if (next.has(programId)) {
        // Don't allow deselecting all programs
        if (next.size > 1) {
          next.delete(programId);
        }
      } else {
        next.add(programId);
      }
      return next;
    });
  };

  const selectAllPrograms = () => {
    setSelectedProgramIds(new Set(programs.map(p => p.id)));
  };

  // Filter programs and sessions based on selection
  const filteredPrograms = useMemo(() =>
    programs.filter(p => selectedProgramIds.has(p.id)),
    [programs, selectedProgramIds]
  );

  const filteredSessions = useMemo(() =>
    sessions.filter(s => {
      if (s.programId) return selectedProgramIds.has(s.programId);
      // For sessions without programId, include if any matching program is selected
      // Use string-based comparison for timezone-agnostic behavior
      return filteredPrograms.some(p => isDateInProgramRangeStr(s.date, p));
    }),
    [sessions, selectedProgramIds, filteredPrograms]
  );

  // --- DATA ENGINE: CHRONIC FATIGUE MODEL (Dual-Compartment) ---
  // Uses MET (Metabolic Energy Tank) and MSK (MusculoSkeletal) instead of EWMA
  // Questionnaire adjustments are applied via recovery efficiency (φ)
  // Wellness carryover modifier decays questionnaire effects into subsequent days
  const generateMetrics = (
    totalDays: number,
    sessions: Session[],
    firstStartStr: string,
    questionnaireByDate: Map<string, QuestionnaireResponse>,
    allResponses: QuestionnaireResponse[],
    cpEstimate: CriticalPowerEstimate
  ) => {
    const metrics: Array<{ fatigue: number; readiness: number }> = [];

    // Initialize dual-compartment state
    let sMeta = 0;
    let sStruct = 0;
    const capMeta = DEFAULT_CAP_METABOLIC;
    const capStruct = DEFAULT_CAP_STRUCTURAL;

    // Wellness carryover modifier - decays questionnaire effects into subsequent days
    let wellnessModifier = 0;
    const wellnessAlpha = 2 / (3 + 1); // 3-day half-life

    // Track recent session day indices for harmonic-weighted detraining
    let recentSessionDayIndices: number[] = [];

    for (let i = 0; i < totalDays; i++) {
      const dateStr = addDays(firstStartStr, i);

      // Calculate daily load using new physiological cost engine
      const dailyLoad = aggregateDailyLoad(sessions, dateStr, cpEstimate);

      // Track sessions for detraining calculation
      const hasSession = sessions.some(s => s.date === dateStr);
      if (hasSession) {
        recentSessionDayIndices.unshift(i); // Add to front (most recent first)
        if (recentSessionDayIndices.length > 5) recentSessionDayIndices.pop(); // Keep only 5
      }

      // Calculate recovery efficiency from questionnaire
      const dayResponse = questionnaireByDate.get(dateStr);
      let phiRecovery = DEFAULT_PHI_RECOVERY;

      if (dayResponse) {
        // Use actual questionnaire field names - average sleep metrics
        const sleepHours = dayResponse.responses['sleep_hours'] || 3;
        const sleepQuality = dayResponse.responses['sleep_quality'] || 3;
        const sleep = (sleepHours + sleepQuality) / 2;
        const nutrition = dayResponse.responses['nutrition'] || 3;
        const stress = dayResponse.responses['stress'] || 3;

        // Normalize to 0-1 range and calculate phi: [0.5, 1.5]
        const sleepNorm = (sleep - 1) / 4;
        const nutritionNorm = (nutrition - 1) / 4;
        const stressNorm = (stress - 1) / 4;
        const avgFactor = (sleepNorm + nutritionNorm + stressNorm) / 3;
        phiRecovery = Math.max(0.5, Math.min(1.5, 0.5 + avgFactor));
      }

      // Update compartments with φ recovery efficiency
      sMeta = updateMetabolicFreshness(sMeta, dailyLoad, phiRecovery, capMeta);
      sStruct = updateStructuralHealth(sStruct, dailyLoad, SIGMA_IMPACT, capStruct);

      // Apply Bayesian corrections for questionnaire days (same as useMetrics)
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

      // Apply questionnaire adjustments to display values
      // This shows subjective perception influence on the chart
      if (dayResponse) {
        // Get recent responses for trend analysis (prior 7 days)
        const recentForDay = allResponses
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

      // Apply detraining penalty based on days since recent sessions
      const daysSinceRecentSessions = recentSessionDayIndices.map(idx => i - idx);
      readiness = applyDetrainingPenalty(readiness, daysSinceRecentSessions);

      metrics.push({
        fatigue,
        readiness
      });
    }
    return metrics;
  };

  // Combine all programs into a single timeline

  const timelineData = useMemo(() => {
    if (filteredPrograms.length === 0) return { weekly: [], daily: [] };

    // Sort programs by date (string comparison works for YYYY-MM-DD)
    const sortedPrograms = [...filteredPrograms].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const firstStartStr = sortedPrograms[0].startDate;
    const firstStart = parseLocalDate(firstStartStr);
    const lastProgram = sortedPrograms[sortedPrograms.length - 1];

    // End date: use actual end date for completed programs, plan length for active
    const todayStr = getLocalDateString();
    const lastPlanEndStr = getProgramEndDateStr(lastProgram);

    // Use the later of today or program end
    const endStr = todayStr > lastPlanEndStr ? todayStr : lastPlanEndStr;

    const oneDay = 24 * 60 * 60 * 1000;
    const totalDays = getDayIndex(endStr, firstStartStr) + 1;


    // Calculate the current day index for fatigue/readiness display cutoff
    // Uses currentDate prop (simulated date) or today - timezone-agnostic
    const currentDateStr = currentDateProp || getLocalDateString();
    const currentDayIndex = getDayIndex(currentDateStr, firstStartStr);

    // Get default basePower from first selected program (fallback for CP estimation)
    const defaultBasePower = sortedPrograms[0]?.basePower || 150;

    // Calculate CP estimate for the chart (used by generateMetrics)
    const cpEstimate = calculateECP(filteredSessions, new Date(), null, defaultBasePower);

    // Create date-keyed questionnaire map for O(1) lookup in generateMetrics
    const questionnaireByDate = new Map<string, QuestionnaireResponse>();
    const allQuestionnaireResponses = [
      ...(recentQuestionnaireResponses || []),
      ...(todayQuestionnaireResponse ? [todayQuestionnaireResponse] : [])
    ];
    allQuestionnaireResponses.forEach(r => questionnaireByDate.set(r.date, r));

    const dailyMetrics = generateMetrics(
      totalDays,
      filteredSessions,
      firstStartStr,
      questionnaireByDate,
      allQuestionnaireResponses,
      cpEstimate
    );

    // Generate Daily Data
    const daily = [];
    for (let i = 0; i < totalDays; i++) {
      // Calculate date string for this day index (timezone-agnostic)
      const dateStr = addDays(firstStartStr, i);
      const dateDisplay = formatDateShort(dateStr);

      // Find active program for this date using string-based range check
      const activeProgram = sortedPrograms.find(p => isDateInProgramRangeStr(dateStr, p));

      let plannedPower = null;
      let plannedDuration = 15; // Default duration in minutes
      let plannedWork = null;
      if (activeProgram && activeProgram.plan) {
        const weekNum = getWeekNumber(dateStr, activeProgram.startDate);
        const planWeek = activeProgram.plan.find(w => w.week === weekNum);
        if (planWeek) {
          plannedPower = planWeek.plannedPower;
          plannedDuration = planWeek.targetDurationMinutes || 15;
          // Work (Wh) = Power (W) × Duration (hours) = Power × (minutes / 60)
          plannedWork = Math.round(planWeek.plannedPower * plannedDuration / 60);
        }
      }

      const dailySession = filteredSessions.find(s => s.date === dateStr);

      let fatigue = null;
      let readiness = null;
      // Show fatigue/readiness up to current date (supports simulated date)
      // Questionnaire adjustments are now applied during generateMetrics for carryover
      if (i <= currentDayIndex && i < dailyMetrics.length) {
        fatigue = dailyMetrics[i].fatigue;
        readiness = dailyMetrics[i].readiness;
      }

      // Calculate actual work done
      let actualWork = null;
      if (dailySession) {
        // Work (Wh) = Power (W) × Duration (minutes) / 60
        actualWork = Math.round(dailySession.power * dailySession.duration / 60);
      }

      daily.push({
        name: dateDisplay,
        index: i,
        Planned: plannedPower,
        PlannedWork: plannedWork,
        Actual: dailySession ? dailySession.power : null,
        ActualWork: actualWork,
        Duration: dailySession ? dailySession.duration : null,
        PlannedDuration: plannedDuration,
        Fatigue: fatigue,
        Readiness: readiness
      });
    }

    // Generate Weekly Data (Aggregated)
    // This is trickier with multiple programs. We'll just aggregate by absolute week index from start.
    const weekly = [];
    const totalWeeks = Math.ceil(totalDays / 7);

    for (let w = 0; w < totalWeeks; w++) {
      const weekStartIndex = w * 7;
      const weekEndIndex = Math.min((w + 1) * 7 - 1, totalDays - 1);

      // Get average metrics for the week
      const weekMetrics = dailyMetrics[weekEndIndex]; // Use end of week metrics

      // Get sessions in this week range (using timezone-agnostic day index comparison)
      const weekSessions = filteredSessions.filter(s => {
        const sessionDayIndex = getDayIndex(s.date, firstStartStr);
        return sessionDayIndex >= weekStartIndex && sessionDayIndex <= weekEndIndex;
      });

      let avgActual = null;
      let avgActualWork = null;
      if (weekSessions.length > 0) {
        avgActual = Math.round(weekSessions.reduce((sum, s) => sum + s.power, 0) / weekSessions.length);
        // Average work per session for the week (avg of all sessions' power × duration / 60)
        avgActualWork = Math.round(weekSessions.reduce((sum, s) => sum + (s.power * s.duration / 60), 0) / weekSessions.length);
      }

      // Find planned power and work (take the values from the first day of the week)
      const day0 = daily[weekStartIndex];
      const planned = day0 ? day0.Planned : null;
      const plannedWork = day0 ? day0.PlannedWork : null;

      // Calculate AVERAGE fatigue/readiness for the week (not end-of-week value)
      // For partial weeks, only average up to the current day
      let fatigue = null;
      let readiness = null;

      // Determine the effective end index for this week (respecting current date)
      const effectiveEndIndex = Math.min(weekEndIndex, currentDayIndex);

      if (weekStartIndex <= currentDayIndex && effectiveEndIndex >= weekStartIndex) {
        // Calculate average of all days in this week up to current date
        let fatigueSum = 0;
        let readinessSum = 0;
        let daysWithMetrics = 0;

        for (let d = weekStartIndex; d <= effectiveEndIndex && d < dailyMetrics.length; d++) {
          fatigueSum += dailyMetrics[d].fatigue;
          readinessSum += dailyMetrics[d].readiness;
          daysWithMetrics++;
        }

        if (daysWithMetrics > 0) {
          fatigue = Math.round(fatigueSum / daysWithMetrics);
          readiness = Math.round(readinessSum / daysWithMetrics);
        }
      }

      weekly.push({
        name: `W${w + 1}`,
        index: w,
        Planned: planned,
        PlannedWork: plannedWork,
        Actual: avgActual,
        ActualWork: avgActualWork,
        Fatigue: fatigue,
        Readiness: readiness
      });
    }

    return { daily, weekly };
  }, [filteredSessions, filteredPrograms, currentDateProp, todayQuestionnaireResponse, recentQuestionnaireResponses]);

  const currentData = viewMode === 'week' ? timelineData.weekly : timelineData.daily;
  const containerRef = useRef<HTMLDivElement>(null);

  // Use optimized gesture handling hook (RAF throttling, ref-based state, passive listeners)
  const { zoomDomain, handlers, resetZoom, zoomIn, zoomOut } = useChartGestures({
    dataLength: currentData.length,
    containerRef,
  });

  // Memoize colors to prevent unnecessary re-renders
  const colors = useMemo(() => ({
    grid: isDarkMode ? '#262626' : '#e5e5e5',
    text: isDarkMode ? '#737373' : '#a3a3a3',
    plannedFill: isDarkMode ? '#262626' : '#f5f5f5',
    plannedStroke: isDarkMode ? '#525252' : '#d4d4d4',
    actualStroke: isDarkMode ? '#ffffff' : '#171717',
    readiness: accentColor || (isDarkMode ? '#6ee7b7' : '#10b981'),
    fatigue: accentAltColor || (isDarkMode ? '#a7f3d0' : '#047857'),
  }), [isDarkMode, accentColor, accentAltColor]);

  // Memoize renderData to prevent recomputation on every render
  const renderData = useMemo(() => {
    const sliced = currentData.slice(zoomDomain.start, zoomDomain.end + 1);
    return sliced.length > 0 ? sliced : currentData;
  }, [currentData, zoomDomain.start, zoomDomain.end]);

  return (
    <div className="h-full flex flex-col pb-16 md:pb-4">
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-light text-neutral-900 dark:text-white tracking-tight">Analytics</h2>
          <p className="text-neutral-500 text-sm mt-1">Load Modeling & Performance</p>
        </div>

        {/* Controls - wrap on small screens */}
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 p-1 rounded-lg">
            <button onClick={() => setViewMode('week')} className={`px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-md transition-all focus:outline-none ${viewMode === 'week' ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-400 active:text-neutral-600'}`}>Weeks</button>
            <button onClick={() => setViewMode('day')} className={`px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-md transition-all focus:outline-none ${viewMode === 'day' ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-400 active:text-neutral-600'}`}>Days</button>
          </div>

          {/* Metric Mode Toggle */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 p-1 rounded-lg">
            <button onClick={() => setMetricMode('power')} className={`px-2.5 md:px-3 py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-md transition-all focus:outline-none ${metricMode === 'power' ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-400 active:text-neutral-600'}`}>Power</button>
            <button onClick={() => setMetricMode('work')} className={`px-2.5 md:px-3 py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-md transition-all focus:outline-none ${metricMode === 'work' ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-400 active:text-neutral-600'}`}>Work</button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 ml-auto md:ml-0">
            <button onClick={zoomIn} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-500 active:text-neutral-900 dark:active:text-white transition-colors focus:outline-none" title="Zoom In"><ZoomIn size={14} /></button>
            <button onClick={zoomOut} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-500 active:text-neutral-900 dark:active:text-white transition-colors focus:outline-none" title="Zoom Out"><ZoomOut size={14} /></button>
            <button onClick={resetZoom} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-500 active:text-neutral-900 dark:active:text-white transition-colors focus:outline-none" title="Reset Zoom"><RefreshCcw size={14} /></button>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm rounded-3xl border border-neutral-200 dark:border-neutral-800 p-4 md:p-6 shadow-sm min-h-[calc(100vh-320px)] md:min-h-[calc(100vh-240px)] outline-none focus:outline-none focus:ring-0 ring-0 relative flex flex-col overflow-hidden touch-pan-y cursor-crosshair" style={{ WebkitTapHighlightColor: 'transparent' }} {...handlers} tabIndex={-1}>
        {/* Chart container with absolute positioning for ResponsiveContainer to fill space */}
        <div className="flex-1 min-h-[300px] relative">
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={renderData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.plannedStroke} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={colors.plannedStroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" stroke={colors.grid} vertical={false} />
                <XAxis dataKey="name" stroke={colors.text} tick={{ fill: colors.text, fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} dy={10} interval="preserveStartEnd" />
                <YAxis yAxisId="power" stroke={colors.text} tick={{ fill: colors.text, fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} dx={-5} domain={['auto', 'auto']} />
                <YAxis yAxisId="metrics" orientation="right" stroke={colors.text} tick={{ fill: colors.text, fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} domain={[0, 100]} hide={window.innerWidth < 768} />
                <Tooltip content={<CustomTooltip viewMode={viewMode} />} cursor={{ stroke: colors.text, strokeWidth: 1, strokeDasharray: '4 4' }} trigger="click" />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', left: '50%', transform: 'translateX(-50%)' }} iconType="circle" iconSize={5} formatter={(value: string) => value.length > 12 ? value.substring(0, 10) + '…' : value} />

                <Line yAxisId="metrics" type="monotone" dataKey="Readiness" stroke={colors.readiness} strokeWidth={2} dot={false} activeDot={{ r: 4 }} animationDuration={0} connectNulls={false} isAnimationActive={false} />
                <Line yAxisId="metrics" type="monotone" dataKey="Fatigue" stroke={colors.fatigue} strokeWidth={2} dot={false} activeDot={{ r: 4 }} animationDuration={0} connectNulls={false} isAnimationActive={false} />

                <Area yAxisId="power" type="monotone" dataKey={metricMode === 'power' ? 'Planned' : 'PlannedWork'} name={metricMode === 'power' ? 'Planned (W)' : 'Planned (Wh)'} stroke={colors.plannedStroke} fillOpacity={1} fill="url(#colorPlanned)" strokeWidth={2} activeDot={false} animationDuration={0} isAnimationActive={false} />

                {viewMode === 'week' ? (
                  <Line yAxisId="power" type="linear" dataKey={metricMode === 'power' ? 'Actual' : 'ActualWork'} name={metricMode === 'power' ? 'Actual (W)' : 'Actual (Wh)'} stroke={colors.actualStroke} strokeWidth={3} dot={{ r: 4, fill: colors.actualStroke, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls animationDuration={0} isAnimationActive={false} />
                ) : (
                  <Line yAxisId="power" type="monotone" dataKey={metricMode === 'power' ? 'Actual' : 'ActualWork'} name={metricMode === 'power' ? 'Actual (W)' : 'Actual (Wh)'} stroke="none" dot={{ r: 5, fill: colors.actualStroke, strokeWidth: 0 }} activeDot={{ r: 7 }} animationDuration={0} isAnimationActive={false} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Program Selection */}
      {programs.length > 1 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Programs to Chart</h3>
            {selectedProgramIds.size < programs.length && (
              <button
                onClick={selectAllPrograms}
                className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 focus:outline-none"
              >
                Select All
              </button>
            )}
          </div>
          <div className="space-y-2 pb-16">
            {[...programs].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).map(program => {
              const isSelected = selectedProgramIds.has(program.id);
              return (
                <button
                  key={program.id}
                  onClick={() => toggleProgram(program.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors focus:outline-none ${isSelected
                    ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 opacity-60'
                    }`}
                >
                  <div className={`p-1 rounded ${isSelected
                    ? 'text-neutral-900 dark:text-white'
                    : 'text-neutral-400'
                    }`}>
                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <div className="flex-1 text-left">
                    <div className={`text-sm font-medium ${isSelected
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-500'
                      }`}>
                      {program.name}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {program.startDate} • {program.status}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Chart;
