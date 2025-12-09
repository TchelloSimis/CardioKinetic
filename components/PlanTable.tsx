
import React, { useState, useEffect } from 'react';
import { PlanWeek, ProgramPreset } from '../types';
import { Calendar, Zap, RefreshCw, ArrowUp, ArrowDown, Info, Percent } from 'lucide-react';

interface PlanTableProps {
  plan: PlanWeek[];
  basePlan: PlanWeek[];
  presets: ProgramPreset[];
  onUpdatePlan: (week: number, field: keyof PlanWeek, value: any) => void;
  onLoadPreset: (presetId: string, basePower: number) => void;
  settings: {
    startDate: string;
    basePower: number;
    restRecoveryPercentage?: number;
  };
  onUpdateSettings: (settings: { startDate: string; basePower: number; restRecoveryPercentage?: number }) => void;
  activePresetId: string;
  onFinishProgram: () => void;
}

const PlanTable: React.FC<PlanTableProps> = ({ plan, basePlan, presets, onUpdatePlan, onLoadPreset, settings, onUpdateSettings, activePresetId, onFinishProgram }) => {
  const [localPower, setLocalPower] = useState(settings.basePower);
  const [localDate, setLocalDate] = useState(settings.startDate);
  const [localRestPct, setLocalRestPct] = useState(settings.restRecoveryPercentage || 50);
  const [selectedPreset, setSelectedPreset] = useState<string>(activePresetId);

  useEffect(() => {
    setSelectedPreset(activePresetId);
  }, [activePresetId]);

  useEffect(() => {
    setLocalPower(settings.basePower);
    setLocalDate(settings.startDate);
    setLocalRestPct(settings.restRecoveryPercentage || 50);
  }, [settings]);

  const activePresetDescription = presets.find(p => p.id === selectedPreset)?.description;

  const handleApplySettings = () => {
    onUpdateSettings({ startDate: localDate, basePower: localPower, restRecoveryPercentage: localRestPct });
    if (selectedPreset && selectedPreset !== activePresetId) {
      onLoadPreset(selectedPreset, localPower);
    }
  };

  const getWeekDate = (weekNum: number) => {
    if (!settings.startDate) return '';
    const date = new Date(settings.startDate);
    date.setDate(date.getDate() + (weekNum - 1) * 7);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-light text-neutral-900 dark:text-white tracking-tight">Program</h2>
        <p className="text-neutral-500 text-sm mt-1">Macrocycle & Configuration</p>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 mb-6 border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest mb-2 block">Program Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input
                type="date"
                value={localDate}
                onChange={(e) => setLocalDate(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-10 pr-3 py-2.5 text-sm text-neutral-900 dark:text-white focus:border-neutral-400 outline-none font-mono shadow-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest mb-2 block">Baseline Power (Watts)</label>
            <div className="relative">
              <Zap className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input
                type="number"
                value={localPower}
                onChange={(e) => setLocalPower(Number(e.target.value))}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-10 pr-3 py-2.5 text-sm text-neutral-900 dark:text-white focus:border-neutral-400 outline-none font-mono shadow-sm"
                placeholder="e.g. 150"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest mb-2 block">Rest % of Work</label>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input
                type="number"
                min="0"
                max="100"
                value={localRestPct}
                onChange={(e) => setLocalRestPct(Number(e.target.value))}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-10 pr-3 py-2.5 text-sm text-neutral-900 dark:text-white focus:border-neutral-400 outline-none font-mono shadow-sm"
              />
            </div>
          </div>
          <button
            onClick={handleApplySettings}
            className="md:col-span-3 bg-neutral-900 dark:bg-white text-white dark:text-black font-bold rounded-lg py-2.5 px-4 text-xs uppercase tracking-widest hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 h-[42px]"
          >
            <RefreshCw size={14} />
            <span>Apply Settings</span>
          </button>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-bold uppercase text-neutral-400 tracking-wider whitespace-nowrap">Load Preset:</span>
        <select
          onChange={(e) => {
            setSelectedPreset(e.target.value);
            onLoadPreset(e.target.value, localPower);
          }}
          value={selectedPreset}
          className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white text-sm rounded-lg py-2 px-3 focus:ring-1 focus:ring-neutral-500 outline-none shadow-sm"
        >
          <option value="" disabled>Select a Scientific Protocol...</option>
          {presets.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {activePresetDescription && (
        <div className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Info size={14} className="text-neutral-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Scientific Basis</span>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
            {activePresetDescription}
          </p>
        </div>
      )}

      <div className="bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead className="bg-white dark:bg-neutral-900 text-xs uppercase text-neutral-400 font-medium tracking-widest sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-800 shadow-sm">
              <tr>
                <th className="p-4 font-normal w-24">Week</th>
                <th className="p-4 font-normal">Phase Focus</th>
                <th className="p-4 font-normal">Work:Rest</th>
                <th className="p-4 font-normal">Duration</th>
                <th className="p-4 text-right font-normal">Target (W)</th>
                <th className="p-4 font-normal">Target RPE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {plan.map((week, index) => {
                const baseVal = basePlan[index]?.plannedPower || 0;
                const adaptedVal = week.plannedPower;
                const diff = adaptedVal - baseVal;

                return (
                  <tr key={week.week} className="hover:bg-white dark:hover:bg-neutral-800 transition-colors group">
                    <td className="p-4 font-mono text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                      <div className="font-bold text-lg">{String(week.week).padStart(2, '0')}</div>
                      <div className="text-[10px] opacity-60">{getWeekDate(week.week)}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-neutral-900 dark:text-white mb-1">{week.phaseName}</div>
                      <span className="text-xs text-neutral-500 hidden md:block">{week.description}</span>
                    </td>
                    <td className="p-4">
                      <div className="relative">
                        <select
                          value={week.workRestRatio}
                          onChange={(e) => onUpdatePlan(week.week, 'workRestRatio', e.target.value)}
                          className="appearance-none bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-neutral-900 dark:text-white cursor-pointer font-mono text-xs hover:border-neutral-400 transition-colors w-24 outline-none focus:border-neutral-500"
                        >
                          <option value="steady">Steady</option>
                          <option value="1:2">1:2</option>
                          <option value="1:1">1:1</option>
                          <option value="2:1">2:1</option>
                          <option value="1:6">1:6</option>
                        </select>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={week.targetDurationMinutes || 15}
                          onChange={(e) => onUpdatePlan(week.week, 'targetDurationMinutes', Number(e.target.value))}
                          className="w-14 bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-neutral-900 dark:text-white text-center font-mono text-xs outline-none focus:border-neutral-500"
                        />
                        <span className="text-xs text-neutral-400">min</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {diff !== 0 && (
                          <span className={`text-[10px] font-bold flex items-center ${diff > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {diff > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                            {Math.abs(diff)}
                          </span>
                        )}
                        <input
                          type="number"
                          value={basePlan[index]?.plannedPower}
                          onChange={(e) => onUpdatePlan(week.week, 'plannedPower', Number(e.target.value))}
                          className="w-20 bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-neutral-900 dark:text-white text-right font-mono text-sm outline-none focus:border-neutral-500"
                        />
                      </div>
                      {diff !== 0 && (
                        <div className="text-[10px] text-neutral-400 mt-1 text-right">
                          Adapted: {adaptedVal}W
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={week.targetRPE}
                          onChange={(e) => onUpdatePlan(week.week, 'targetRPE', Number(e.target.value))}
                          className="w-10 bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-neutral-900 dark:text-white text-center font-mono text-xs outline-none focus:border-neutral-500"
                        />
                        <div className="w-12 md:w-20 h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-neutral-900 dark:bg-white"
                            style={{ width: `${week.targetRPE * 10}%`, opacity: week.targetRPE / 10 }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PlanTable;
