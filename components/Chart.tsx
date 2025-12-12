
import React, { useMemo, useState, useRef, useEffect } from 'react';
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
import { Session, PlanWeek, ProgramRecord } from '../types';
import { ZoomIn, ZoomOut, RefreshCcw, Check, Square, CheckSquare } from 'lucide-react';
import {
  calculateSessionLoad,
  calculateRecentAveragePower,
  calculateFatigueScore,
  calculateReadinessScore
} from '../utils/metricsUtils';

interface ChartProps {
  sessions: Session[];
  programs: ProgramRecord[]; // Changed from plan: PlanWeek[]
  isDarkMode: boolean;
  startDate?: string; // Optional now, derived from programs
  accentColor?: string; // Accent color for readiness line
  accentAltColor?: string; // Alternate accent color for fatigue line
}

const getWeekNumber = (dateStr: string, startStr: string) => {
  const d = new Date(dateStr);
  const s = new Date(startStr);
  d.setHours(0, 0, 0, 0);
  s.setHours(0, 0, 0, 0);
  const diffTime = d.getTime() - s.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 0;
  return Math.floor(diffDays / 7) + 1;
};

const CustomTooltip = ({ active, payload, label, viewMode }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-xl z-50 pointer-events-none">
        <p className="text-neutral-900 dark:text-white font-bold mb-2 text-[10px] tracking-widest uppercase">
          {label}
        </p>
        {payload.map((entry: any, index: number) => {
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
};

const Chart: React.FC<ChartProps> = ({ sessions, programs, isDarkMode, accentColor, accentAltColor }) => {
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
      return filteredPrograms.some(p => {
        const sessionDate = new Date(s.date);
        const startDate = new Date(p.startDate);
        const endDate = p.endDate ? new Date(p.endDate) : new Date();
        endDate.setDate(endDate.getDate() + 84);
        return sessionDate >= startDate && sessionDate <= endDate;
      });
    }),
    [sessions, selectedProgramIds, filteredPrograms]
  );

  // --- DATA ENGINE: EWMA SMOOTHING ---
  // Uses new ACWR Sigmoid (fatigue) and TSB Gaussian (readiness) scoring
  const generateMetrics = (totalDays: number, dailyLoads: Float32Array) => {
    const metrics = [];
    let atl = 0;
    let ctl = 10; // Seed baseline

    const atlAlpha = 2 / (7 + 1);
    const ctlAlpha = 2 / (42 + 1);

    for (let i = 0; i < totalDays; i++) {
      const load = dailyLoads[i];

      atl = atl * (1 - atlAlpha) + load * atlAlpha;
      ctl = ctl * (1 - ctlAlpha) + load * ctlAlpha;

      const tsb = ctl - atl;

      metrics.push({
        // NEW: ACWR Sigmoid for fatigue (sensitive to injury-risk thresholds)
        fatigue: calculateFatigueScore(atl, ctl),
        // NEW: TSB Gaussian for readiness (peaks at TSB +20, penalizes detraining)
        readiness: calculateReadinessScore(tsb)
      });
    }
    return metrics;
  };

  // Combine all programs into a single timeline
  const timelineData = useMemo(() => {
    if (filteredPrograms.length === 0) return { weekly: [], daily: [] };

    // Sort programs by date
    const sortedPrograms = [...filteredPrograms].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const firstStart = new Date(sortedPrograms[0].startDate);
    const lastProgram = sortedPrograms[sortedPrograms.length - 1];
    // End date is either today or end of last program plan (use actual plan length)
    const today = new Date();
    const lastProgramWeeks = lastProgram.plan?.length || 12;
    const lastPlanEnd = new Date(lastProgram.startDate);
    lastPlanEnd.setDate(lastPlanEnd.getDate() + (lastProgramWeeks * 7) - 1); // -1 to end on last day, not day after

    // Use the later of today or program end, but only if we have data for it
    const end = today > lastPlanEnd ? today : lastPlanEnd;

    const oneDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.ceil((end.getTime() - firstStart.getTime()) / oneDay) + 1;

    // Calculate Daily Loads
    const dailyLoads = new Float32Array(totalDays).fill(0);
    let lastSessionDayIndex = -1;

    // Get default basePower from first selected program (fallback for power ratio)
    const defaultBasePower = sortedPrograms[0]?.basePower || 150;

    filteredSessions.forEach(s => {
      const d = new Date(s.date);
      d.setHours(0, 0, 0, 0);
      const dayIndex = Math.floor((d.getTime() - firstStart.getTime()) / oneDay);
      if (dayIndex >= 0 && dayIndex < totalDays) {
        // Calculate recent average power up to this session's date for power ratio
        const recentAvgPower = calculateRecentAveragePower(filteredSessions, d, defaultBasePower);
        const powerRatio = s.power / recentAvgPower;
        dailyLoads[dayIndex] += calculateSessionLoad(s.rpe, s.duration, powerRatio);
        if (dayIndex > lastSessionDayIndex) lastSessionDayIndex = dayIndex;
      }
    });

    const dailyMetrics = generateMetrics(totalDays, dailyLoads);

    // Generate Daily Data
    const daily = [];
    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(firstStart.getTime() + (i * oneDay));
      const dateStr = currentDate.toISOString().split('T')[0];
      const dateDisplay = currentDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      // Find active program for this date
      const activeProgram = sortedPrograms.find(p => {
        const pStart = new Date(p.startDate);
        const pEnd = new Date(pStart);
        const programWeeks = p.plan?.length || 12;
        pEnd.setDate(pEnd.getDate() + (programWeeks * 7));
        return currentDate >= pStart && currentDate < pEnd;
      });

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
      if (i <= lastSessionDayIndex) {
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

      // Get sessions in this week range
      const weekStartMs = firstStart.getTime() + (weekStartIndex * oneDay);
      const weekEndMs = firstStart.getTime() + (weekEndIndex * oneDay);

      const weekSessions = filteredSessions.filter(s => {
        const t = new Date(s.date).getTime();
        return t >= weekStartMs && t <= weekEndMs;
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

      let fatigue = null;
      let readiness = null;
      // Show fatigue/readiness if we have any data up to this week's start
      if (weekStartIndex <= lastSessionDayIndex) {
        fatigue = weekMetrics.fatigue;
        readiness = weekMetrics.readiness;
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
  }, [filteredSessions, filteredPrograms]); // Updated dependencies

  const currentData = viewMode === 'week' ? timelineData.weekly : timelineData.daily;
  const [zoomDomain, setZoomDomain] = useState({ start: 0, end: Math.max(0, currentData.length - 1) });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setZoomDomain({ start: 0, end: Math.max(0, currentData.length - 1) });
  }, [viewMode, currentData.length]);

  const isDragging = useRef(false);
  const lastX = useRef(0);
  const lastDist = useRef<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => { isDragging.current = true; lastX.current = e.clientX; };
  const handleMouseUp = () => { isDragging.current = false; };
  const handleMouseMove = (e: React.MouseEvent) => { if (!isDragging.current) return; e.preventDefault(); const deltaX = lastX.current - e.clientX; lastX.current = e.clientX; pan(deltaX); };

  // Track touch state to determine if gesture is horizontal or vertical
  const touchStartY = useRef(0);
  const isHorizontalPan = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      lastX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isHorizontalPan.current = false; // Reset on new touch
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      lastDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging.current) {
      const deltaX = lastX.current - e.touches[0].clientX;
      const deltaY = touchStartY.current - e.touches[0].clientY;

      // Determine if this is a horizontal or vertical gesture on first significant move
      if (!isHorizontalPan.current && Math.abs(deltaX) > 10) {
        // If horizontal movement is dominant, it's a pan
        if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
          isHorizontalPan.current = true;
        }
      }

      // Only pan horizontally if we've determined this is a horizontal gesture
      if (isHorizontalPan.current) {
        e.preventDefault(); // Only prevent default for horizontal pan
        lastX.current = e.touches[0].clientX;
        pan(deltaX * 2);
      }
      // If not horizontal pan, let the browser handle vertical scroll naturally
    } else if (e.touches.length === 2 && lastDist.current !== null) {
      // Pinch to zoom - prevent scrolling during this gesture
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist - lastDist.current;
      lastDist.current = dist;
      zoom(delta * 0.1);
    }
  };

  const handleTouchEnd = () => { isDragging.current = false; lastDist.current = null; isHorizontalPan.current = false; };
  const handleWheel = (e: React.WheelEvent) => { e.stopPropagation(); zoom(e.deltaY > 0 ? -1 : 1); };
  const pan = (deltaPixels: number) => { const chartWidth = containerRef.current?.clientWidth || 500; const totalPoints = zoomDomain.end - zoomDomain.start; const sensitivity = totalPoints / chartWidth; let deltaIndex = Math.round(deltaPixels * sensitivity * 3); if (deltaIndex === 0) return; let newStart = zoomDomain.start + deltaIndex; let newEnd = zoomDomain.end + deltaIndex; if (newStart < 0) { newEnd -= newStart; newStart = 0; } if (newEnd >= currentData.length) { const diff = newEnd - (currentData.length - 1); newStart -= diff; newEnd = currentData.length - 1; } if (newStart < 0) newStart = 0; setZoomDomain({ start: newStart, end: newEnd }); };
  const zoom = (factor: number) => {
    const currentRange = zoomDomain.end - zoomDomain.start;
    const minRange = Math.min(3, Math.max(1, currentData.length - 1));
    const maxRange = currentData.length - 1;

    // factor > 0 = zoom in (shrink range), factor < 0 = zoom out (expand range)
    const changeAmount = Math.max(1, Math.round(currentRange * 0.2));
    let newRange = factor > 0
      ? Math.max(minRange, currentRange - changeAmount)
      : Math.min(maxRange, currentRange + changeAmount);

    const mid = Math.floor((zoomDomain.start + zoomDomain.end) / 2);
    let newStart = Math.max(0, mid - Math.floor(newRange / 2));
    let newEnd = newStart + newRange;

    // Clamp to data bounds
    if (newEnd >= currentData.length) {
      newEnd = currentData.length - 1;
      newStart = Math.max(0, newEnd - newRange);
    }

    setZoomDomain({ start: newStart, end: newEnd });
  };
  const resetZoom = () => { setZoomDomain({ start: 0, end: Math.max(0, currentData.length - 1) }); };
  const handleZoomIn = () => zoom(1);
  const handleZoomOut = () => zoom(-1);

  // Use accent colors for readiness/fatigue lines
  const colors = {
    grid: isDarkMode ? '#262626' : '#e5e5e5',
    text: isDarkMode ? '#737373' : '#a3a3a3',
    plannedFill: isDarkMode ? '#262626' : '#f5f5f5',
    plannedStroke: isDarkMode ? '#525252' : '#d4d4d4',
    actualStroke: isDarkMode ? '#ffffff' : '#171717',
    readiness: accentColor || (isDarkMode ? '#6ee7b7' : '#10b981'),
    fatigue: accentAltColor || (isDarkMode ? '#a7f3d0' : '#047857'),
  };

  // Ensure renderData has data - fallback to full dataset if slice is empty
  const slicedData = currentData.slice(zoomDomain.start, zoomDomain.end + 1);
  const renderData = slicedData.length > 0 ? slicedData : currentData;

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
            <button onClick={handleZoomIn} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-500 active:text-neutral-900 dark:active:text-white transition-colors focus:outline-none" title="Zoom In"><ZoomIn size={14} /></button>
            <button onClick={handleZoomOut} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-500 active:text-neutral-900 dark:active:text-white transition-colors focus:outline-none" title="Zoom Out"><ZoomOut size={14} /></button>
            <button onClick={resetZoom} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-500 active:text-neutral-900 dark:active:text-white transition-colors focus:outline-none" title="Reset Zoom"><RefreshCcw size={14} /></button>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm rounded-3xl border border-neutral-200 dark:border-neutral-800 p-4 md:p-6 shadow-sm min-h-[calc(100vh-320px)] md:min-h-[calc(100vh-240px)] outline-none focus:outline-none focus:ring-0 ring-0 relative flex flex-col overflow-hidden touch-pan-y cursor-crosshair" style={{ WebkitTapHighlightColor: 'transparent' }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onWheel={handleWheel} tabIndex={-1}>
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
