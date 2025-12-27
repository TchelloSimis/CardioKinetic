
import React, { useState, useEffect, useMemo } from 'react';
import { Session, PlanWeek, SessionBlock } from '../types';
import { Calculator, ArrowRight, RefreshCw, X, Layers } from 'lucide-react';
import { getLocalDateString, getWeekNumber } from '../utils/dateUtils';

interface SessionLogProps {
  onAddSession: (session: Session) => void;
  onCancel: () => void;
  currentWeekPlan: PlanWeek;
  allPlans: PlanWeek[];
  currentWeekNum: number;
  startDate: string;
  initialData?: Session;
  restRecoveryPercentage?: number; // Optional to support legacy usage, but expected
}

const RPE_GUIDE: Record<number, string> = {
  1: "Very Light - Little to no effort, like watching TV.",
  2: "Light - Easy to breathe and carry on a conversation.",
  3: "Light/Moderate - Can talk easily, warming up.",
  4: "Moderate - Breaking a sweat, can talk in short sentences.",
  5: "Moderate - Comfortable but somewhat challenging.",
  6: "Moderate/Hard - Breathing heavier, can still talk.",
  7: "Hard - Uncomfortable, can speak a few words.",
  8: "Very Hard - Difficult to maintain, heavy breathing.",
  9: "Extremely Hard - Mental toughness required, can hardly speak.",
  10: "Max Effort - Exhaustion, gasping for air, cannot speak."
};

const SessionLog: React.FC<SessionLogProps> = ({ onAddSession, onCancel, currentWeekPlan, allPlans, currentWeekNum, startDate, initialData, restRecoveryPercentage = 50 }) => {
  // Determine if this is a steady-state session based on the plan
  // Check for sessionStyle or various steady-state ratio formats (steady, 1:0)
  const isSteadyState = currentWeekPlan.sessionStyle === 'steady-state' ||
    currentWeekPlan.workRestRatio === 'steady' ||
    currentWeekPlan.workRestRatio === '1:0';

  // Check if this is a custom session (mixed blocks)
  const isCustomSession = currentWeekPlan.sessionStyle === 'custom';

  const [formData, setFormData] = useState({
    date: getLocalDateString(),
    duration: currentWeekPlan.targetDurationMinutes || 15,
    workPower: '' as number | string,
    restPower: '' as number | string,
    avgPower: '' as number | string,
    distance: '' as number | string,
    rpe: 8,
    notes: '',
    workRestRatio: isSteadyState ? 'steady' : (currentWeekPlan.workRestRatio || '1:1')
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        date: initialData.date,
        duration: initialData.duration,
        workPower: initialData.workPower || '',
        restPower: initialData.restPower || '',
        avgPower: initialData.power,
        distance: initialData.distance || '',
        rpe: initialData.rpe,
        notes: initialData.notes || '',
        workRestRatio: initialData.workRestRatio || '1:1'
      });
    }
  }, [initialData]);

  const getWeekForDate = (dateStr: string) => {
    // Use timezone-agnostic week calculation
    const w = getWeekNumber(dateStr, startDate);
    // Legacy behavior: clamp to 1-12 range
    return w === 0 ? 1 : Math.min(w, 12);
  };

  const [calculatedWeek, setCalculatedWeek] = useState(currentWeekNum);

  useEffect(() => {
    const w = getWeekForDate(formData.date);
    setCalculatedWeek(w);
  }, [formData.date, startDate]);

  const activePlan = allPlans.find(p => p.week === calculatedWeek) || currentWeekPlan;

  const getRatioParts = (ratioStr: string) => {
    if (ratioStr === 'steady') return { work: 1, rest: 0 }; // Steady state: all work, no rest intervals
    const parts = ratioStr.split(':').map(Number);
    if (parts.length !== 2) return { work: 1, rest: 1 };
    return { work: parts[0], rest: parts[1] };
  };

  // Check if the active plan is a custom session
  const isActivePlanCustom = activePlan?.sessionStyle === 'custom';

  // Generate block summary for custom sessions
  const blockSummary = useMemo(() => {
    if (!isActivePlanCustom || !activePlan?.blocks) return null;
    const blocks = activePlan.blocks;
    return blocks.map((block: SessionBlock, index: number) => {
      const type = block.type === 'steady-state' ? 'SS' : 'INT';
      return `${Math.round(block.durationMinutes)}min ${type}`;
    }).join(' → ');
  }, [isActivePlanCustom, activePlan]);

  // Check if currently in steady state mode (or custom which uses similar simplified input)
  const isCurrentlySteadyState = formData.workRestRatio === 'steady' || formData.workRestRatio === '1:0';

  // For custom sessions, use simplified power input (like steady state)
  const useSimplifiedPowerInput = isCurrentlySteadyState || isActivePlanCustom;

  // Suggest values on mount if new session
  useEffect(() => {
    if (!initialData && activePlan) {
      const targetAvg = activePlan.plannedPower;
      const plannedDuration = activePlan.targetDurationMinutes || 15;
      const isActivePlanSteadyState = activePlan.sessionStyle === 'steady-state' ||
        activePlan.workRestRatio === 'steady' ||
        activePlan.workRestRatio === '1:0';
      const isActivePlanCustom = activePlan.sessionStyle === 'custom';

      // Calculate total duration for custom sessions from blocks
      let sessionDuration = plannedDuration;
      if (isActivePlanCustom && activePlan.blocks) {
        sessionDuration = activePlan.blocks.reduce((total: number, block: SessionBlock) => total + block.durationMinutes, 0);
      }

      if (isActivePlanSteadyState || isActivePlanCustom) {
        // For steady state and custom, just set average power directly
        setFormData(prev => ({
          ...prev,
          duration: sessionDuration,
          workRestRatio: isActivePlanSteadyState ? 'steady' : (activePlan.workRestRatio || '1:1'),
          workPower: targetAvg,
          restPower: 0,
          avgPower: targetAvg,
          rpe: activePlan.targetRPE
        }));
      } else {
        // For interval training, calculate work/rest powers
        const { work, rest } = getRatioParts(activePlan.workRestRatio);
        const ratio = restRecoveryPercentage / 100;
        const totalParts = work + rest;
        const estimatedWork = Math.round((targetAvg * totalParts) / (work + ratio * rest));
        const estimatedRest = Math.round(estimatedWork * ratio);

        setFormData(prev => ({
          ...prev,
          duration: sessionDuration,
          workRestRatio: activePlan.workRestRatio,
          workPower: estimatedWork,
          restPower: estimatedRest,
          avgPower: targetAvg,
          rpe: activePlan.targetRPE
        }));
      }
    }
  }, [activePlan, initialData, restRecoveryPercentage]);

  useEffect(() => {
    const { work, rest } = getRatioParts(formData.workRestRatio);
    const wp = Number(formData.workPower);
    const rp = Number(formData.restPower);

    if (!isNaN(wp) && !isNaN(rp) && wp > 0 && rp >= 0) {
      const totalParts = work + rest;
      const avg = Math.round(((work * wp) + (rest * rp)) / totalParts);
      setFormData(prev => ({ ...prev, avgPower: avg }));
    }
  }, [formData.workPower, formData.restPower, formData.workRestRatio]);

  const suggestWorkPower = () => {
    const targetAvg = activePlan.plannedPower;
    const rp = Number(formData.restPower);
    const { work, rest } = getRatioParts(formData.workRestRatio);

    if (!isNaN(rp) && targetAvg > 0) {
      const totalParts = work + rest;
      const suggestedWP = Math.round(((targetAvg * totalParts) - (rest * rp)) / work);
      if (suggestedWP > 0) {
        setFormData(prev => ({ ...prev, workPower: suggestedWP }));
      }
    }
  };

  const suggestRestPower = () => {
    const targetAvg = activePlan.plannedPower;
    const wp = Number(formData.workPower);
    const { work, rest } = getRatioParts(formData.workRestRatio);

    if (!isNaN(wp) && targetAvg > 0) {
      const totalParts = work + rest;
      const suggestedRP = Math.round(((targetAvg * totalParts) - (work * wp)) / rest);
      if (suggestedRP >= 0) {
        setFormData(prev => ({ ...prev, restPower: suggestedRP }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddSession({
      id: initialData ? initialData.id : Date.now().toString(),
      ...formData,
      duration: Number(formData.duration),
      power: Number(formData.avgPower) || Number(formData.workPower),
      workPower: Number(formData.workPower),
      restPower: Number(formData.restPower),
      distance: Number(formData.distance) || 0,
      rpe: Number(formData.rpe),
      weekNum: calculatedWeek
    });
    setFormData(prev => ({ ...prev, notes: '' }));
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black md:bg-transparent md:dark:bg-transparent">

      {/* Header / Toolbar */}
      <div className="flex items-center justify-between mb-6 md:mb-8 sticky top-0 bg-white dark:bg-black md:bg-transparent z-20 py-2 md:py-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-light text-neutral-900 dark:text-white tracking-tight">
            {initialData ? 'Edit Session' : 'Log Session'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-neutral-500 text-sm">Target: {activePlan.plannedPower}W</span>
            <span className="text-neutral-300 dark:text-neutral-700 text-xs">•</span>
            <span className="text-neutral-900 dark:text-white font-bold text-sm">Week {calculatedWeek}</span>
            {isActivePlanCustom && (
              <>
                <span className="text-neutral-300 dark:text-neutral-700 text-xs">•</span>
                <span className="text-neutral-500 text-sm flex items-center gap-1">
                  <Layers size={12} />
                  Custom
                </span>
              </>
            )}
          </div>
          {/* Block summary for custom sessions */}
          {blockSummary && (
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-neutral-400 uppercase tracking-wider">
              <Layers size={10} />
              <span>{blockSummary}</span>
            </div>
          )}
        </div>
        <button onClick={onCancel} className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-500">
          <X size={24} />
        </button>
      </div>

      {/* Scrollable Form Area */}
      <div className="flex-1 overflow-y-auto -mx-4 px-4 md:mx-0 md:px-0 pb-32 md:pb-0">
        <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto">

          {/* Essential Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-neutral-100 dark:bg-neutral-900 border-none rounded-xl p-3 text-neutral-900 dark:text-white focus:ring-1 focus:ring-neutral-400 outline-none font-mono text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Duration</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                  className="w-full bg-neutral-100 dark:bg-neutral-900 border-none rounded-xl p-3 text-neutral-900 dark:text-white focus:ring-1 focus:ring-neutral-400 outline-none font-mono text-sm"
                />
                <span className="absolute right-3 top-3 text-xs text-neutral-400 pointer-events-none">min</span>
              </div>
            </div>
            <div className="col-span-2 md:col-span-1 space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Ratio</label>
              <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-900 rounded-xl p-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={(() => {
                    if (formData.workRestRatio === 'steady') return '1';
                    const parts = formData.workRestRatio.split(':');
                    return parts[0] || '';
                  })()}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    const restPart = formData.workRestRatio === 'steady' ? '0' : (formData.workRestRatio.split(':')[1] || '0');
                    if (val === '') {
                      // Empty work part - keep editing mode with empty
                      setFormData({ ...formData, workRestRatio: `:${restPart}` });
                    } else if (restPart === '' || restPart === '0') {
                      // Has work but no rest = steady
                      setFormData({ ...formData, workRestRatio: 'steady' });
                    } else {
                      setFormData({ ...formData, workRestRatio: `${val}:${restPart}` });
                    }
                  }}
                  placeholder="1"
                  className="w-14 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 text-center text-neutral-900 dark:text-white focus:border-neutral-900 dark:focus:border-white outline-none font-mono text-sm"
                />
                <span className="text-neutral-400 font-mono">:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={(() => {
                    if (formData.workRestRatio === 'steady') return '';
                    const parts = formData.workRestRatio.split(':');
                    return parts[1] || '';
                  })()}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    const workPart = formData.workRestRatio === 'steady' ? '1' : (formData.workRestRatio.split(':')[0] || '1');
                    if (val === '') {
                      // Empty rest = steady state
                      setFormData({ ...formData, workRestRatio: 'steady' });
                    } else {
                      setFormData({ ...formData, workRestRatio: `${workPart}:${val}` });
                    }
                  }}
                  placeholder="0"
                  className="w-14 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 text-center text-neutral-900 dark:text-white focus:border-neutral-900 dark:focus:border-white outline-none font-mono text-sm"
                />
                <span className="text-[10px] text-neutral-400 ml-1 whitespace-nowrap">
                  {formData.workRestRatio === 'steady' ? 'Steady' : 'Work : Rest'}
                </span>
              </div>
            </div>
          </div>

          {/* Power Input Section - Different UI for steady state vs interval */}
          <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50">
            <div className="flex items-center gap-2 text-neutral-900 dark:text-white mb-4">
              <Calculator size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">
                {isActivePlanCustom ? 'Average Power' : useSimplifiedPowerInput ? 'Target Power' : 'Interval Power'}
              </span>
            </div>

            {useSimplifiedPowerInput ? (
              /* Steady State: Simple power input */
              <div className="flex flex-col items-center">
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-2">Average Power</label>
                <div className="relative w-full max-w-xs">
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.avgPower}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, avgPower: val, workPower: val, restPower: 0 });
                    }}
                    className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-xl py-4 pl-4 pr-10 text-neutral-900 dark:text-white focus:border-neutral-900 dark:focus:border-white outline-none font-mono text-3xl text-center"
                  />
                  <span className="absolute right-4 top-5 text-lg text-neutral-400 pointer-events-none">W</span>
                </div>
                <p className="text-xs text-neutral-400 mt-2">Maintain this power throughout the session</p>
              </div>
            ) : (
              /* Interval Training: Work/Rest power inputs */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Work */}
                <div className="relative">
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1 ml-1">Work Interval</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0"
                      value={formData.workPower}
                      onChange={(e) => setFormData({ ...formData, workPower: e.target.value })}
                      className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-xl py-4 pl-4 pr-10 text-neutral-900 dark:text-white focus:border-neutral-900 dark:focus:border-white outline-none font-mono text-xl"
                    />
                    <span className="absolute right-4 top-5 text-xs text-neutral-400 pointer-events-none">W</span>
                  </div>
                  <button
                    type="button"
                    onClick={suggestWorkPower}
                    className="text-[10px] flex items-center gap-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-white mt-1 ml-1"
                    disabled={!formData.restPower}
                  >
                    <RefreshCw size={10} /> Auto-calc from Rest
                  </button>
                </div>

                {/* Rest */}
                <div className="relative">
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1 ml-1">Rest Interval</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0"
                      value={formData.restPower}
                      onChange={(e) => setFormData({ ...formData, restPower: e.target.value })}
                      className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-xl py-4 pl-4 pr-10 text-neutral-900 dark:text-white focus:border-neutral-900 dark:focus:border-white outline-none font-mono text-xl"
                    />
                    <span className="absolute right-4 top-5 text-xs text-neutral-400 pointer-events-none">W</span>
                  </div>
                  <button
                    type="button"
                    onClick={suggestRestPower}
                    className="text-[10px] flex items-center gap-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-white mt-1 ml-1"
                    disabled={!formData.workPower}
                  >
                    <RefreshCw size={10} /> Auto-calc from Work
                  </button>
                </div>

                {/* Result */}
                <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4 flex flex-col justify-center items-center mt-5 md:mt-0">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase mb-1">Average Power</span>
                  <span className="text-3xl font-mono font-bold text-neutral-900 dark:text-white tracking-tighter">
                    {formData.avgPower ? formData.avgPower : '--'}
                    <span className="text-sm font-normal text-neutral-500 ml-1 align-top">W</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* RPE & Distance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">RPE</label>
                <span className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">{formData.rpe}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={formData.rpe}
                onChange={(e) => setFormData({ ...formData, rpe: Number(e.target.value) })}
                className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer accent-neutral-900 dark:accent-white"
              />
              <div className="mt-3 bg-neutral-100 dark:bg-neutral-900 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-medium">
                  {RPE_GUIDE[Math.round(formData.rpe)] || "Adjust slider to see description."}
                </p>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 block">Distance (Optional)</label>
              <input
                type="number"
                step="0.01"
                value={formData.distance}
                onChange={(e) => setFormData({ ...formData, distance: Number(e.target.value) })}
                className="w-full bg-neutral-100 dark:bg-neutral-900 border-none rounded-xl p-4 text-neutral-900 dark:text-white focus:ring-1 focus:ring-neutral-400 outline-none font-mono text-sm"
                placeholder="0.00"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-neutral-900 dark:bg-white text-white dark:text-black font-bold rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all shadow-lg shadow-neutral-200 dark:shadow-none flex justify-center items-center gap-3 text-xs uppercase tracking-widest"
          >
            <span>{initialData ? 'Update Session' : 'Save Session'}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default SessionLog;
