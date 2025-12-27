import React, { useMemo } from 'react';
import { Trophy, TrendingUp, TrendingDown, Flame, Activity, Calendar, Zap, Heart, ArrowLeft, Minus } from 'lucide-react';
import { Session, ProgramRecord } from '../types';
import { AccentColorConfig } from '../presets';
import {
    calculatePersonalRecords,
    calculateTrends,
    calculateFatigueReadinessInsights,
    getRecentActivity,
    formatChange,
    getChangeColor,
    formatPRDate
} from '../utils/insightsUtils';

interface InsightsPageProps {
    sessions: Session[];
    programs: ProgramRecord[];
    isDarkMode: boolean;
    currentAccent: AccentColorConfig;
    simulatedDate: string;
    programStartDate: string;
    basePower: number;
    onClose: () => void;
}

const InsightsPage: React.FC<InsightsPageProps> = ({
    sessions,
    programs,
    isDarkMode,
    currentAccent,
    simulatedDate,
    programStartDate,
    basePower,
    onClose
}) => {
    const accentColor = isDarkMode ? currentAccent.dark : currentAccent.light;
    const accentAltColor = isDarkMode ? currentAccent.darkAlt : currentAccent.lightAlt;
    const currentDate = useMemo(() => new Date(simulatedDate), [simulatedDate]);
    const startDate = useMemo(() => new Date(programStartDate), [programStartDate]);

    // Calculate all insights with proper date handling
    const personalRecords = useMemo(() => calculatePersonalRecords(sessions), [sessions]);
    const weeklyTrends = useMemo(() => calculateTrends(sessions, 'week', currentDate), [sessions, currentDate]);
    const fatigueReadiness = useMemo(() =>
        calculateFatigueReadinessInsights(sessions, startDate, currentDate, basePower),
        [sessions, startDate, currentDate, basePower]
    );
    const recentActivity = useMemo(() => getRecentActivity(sessions, 7, currentDate), [sessions, currentDate]);

    const prIcons: Record<string, React.ReactNode> = {
        power: <Zap size={20} />,
        duration: <Activity size={20} />,
        work: <Flame size={20} />
    };

    const prLabels: Record<string, string> = {
        power: 'Peak Power',
        duration: 'Longest Session',
        work: 'Most Work'
    };

    const getChangeColorClass = (value: number): string => {
        const color = getChangeColor(value, 'power');
        if (color === 'positive') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
        if (color === 'negative') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400';
    };

    const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
        if (trend === 'improving') return <TrendingUp size={20} className="text-green-500" />;
        if (trend === 'declining') return <TrendingDown size={20} className="text-red-500" />;
        return <Minus size={20} className="text-neutral-400" />;
    };

    return (
        <div className="fixed inset-0 z-[100] bg-neutral-100 dark:bg-black flex flex-col animate-in slide-in-from-bottom-10 duration-300">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-xl font-medium text-neutral-900 dark:text-white">Training Insights</h2>
                    <p className="text-sm text-neutral-500">Performance analysis and trends</p>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">

                {/* Fatigue & Readiness Insights Section */}
                <section>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                        <Heart size={16} style={{ color: accentColor }} />
                        Body Status
                    </h3>
                    <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-6">
                        {/* Current State Row */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="text-center">
                                <div className="text-3xl font-medium text-neutral-900 dark:text-white">
                                    {fatigueReadiness.currentReadiness}%
                                </div>
                                <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Readiness</div>
                                <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${getChangeColorClass(fatigueReadiness.readinessChange)}`}>
                                    {fatigueReadiness.readinessChange >= 0 ? '+' : ''}{fatigueReadiness.readinessChange}
                                </span>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-medium text-neutral-900 dark:text-white">
                                    {fatigueReadiness.currentFatigue}%
                                </div>
                                <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Fatigue</div>
                                <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${getChangeColorClass(-fatigueReadiness.fatigueChange)}`}>
                                    {fatigueReadiness.fatigueChange >= 0 ? '+' : ''}{fatigueReadiness.fatigueChange}
                                </span>
                            </div>
                        </div>

                        {/* Trend & Insight */}
                        <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4">
                            <div className="flex items-center gap-2 mb-3">
                                {getTrendIcon(fatigueReadiness.trend)}
                                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 capitalize">
                                    {fatigueReadiness.trend} Trend
                                </span>
                            </div>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                                {fatigueReadiness.insight}
                            </p>
                            <p className="text-sm font-medium" style={{ color: accentColor }}>
                                {fatigueReadiness.recommendation}
                            </p>
                        </div>

                        {/* Weekly Averages */}
                        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                            <div className="text-center">
                                <div className="text-lg font-medium text-neutral-700 dark:text-neutral-300">
                                    {fatigueReadiness.weeklyReadinessAvg}%
                                </div>
                                <div className="text-[10px] uppercase tracking-widest text-neutral-500">7-Day Avg Readiness</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-medium text-neutral-700 dark:text-neutral-300">
                                    {fatigueReadiness.weeklyFatigueAvg}%
                                </div>
                                <div className="text-[10px] uppercase tracking-widest text-neutral-500">7-Day Avg Fatigue</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Personal Records Section */}
                <section>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                        <Trophy size={16} style={{ color: accentAltColor }} />
                        Personal Records
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        {personalRecords.length > 0 ? (
                            personalRecords.map((pr) => (
                                <div
                                    key={pr.type}
                                    className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm text-center"
                                >
                                    <div className="mb-2" style={{ color: accentColor }}>{prIcons[pr.type]}</div>
                                    <div className="text-xl font-medium text-neutral-900 dark:text-white">
                                        {pr.value}<span className="text-xs opacity-60 ml-0.5">{pr.unit}</span>
                                    </div>
                                    <div className="text-[9px] uppercase tracking-widest text-neutral-500">
                                        {prLabels[pr.type]}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-3 text-center py-8 text-neutral-500 text-sm">
                                Complete sessions to see your personal records
                            </div>
                        )}
                    </div>
                </section>

                {/* Weekly Trends Section */}
                <section>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                        <TrendingUp size={16} style={{ color: accentColor }} />
                        This Week vs Last Week
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <TrendCard
                            label="Avg Power"
                            current={weeklyTrends.current.avgPower}
                            unit="W"
                            change={weeklyTrends.changes.power}
                            getChangeColorClass={getChangeColorClass}
                        />
                        <TrendCard
                            label="Sessions"
                            current={weeklyTrends.current.sessionCount}
                            unit=""
                            change={weeklyTrends.changes.sessions}
                            isAbsolute
                            getChangeColorClass={getChangeColorClass}
                        />
                        <TrendCard
                            label="Avg Duration"
                            current={weeklyTrends.current.avgDuration}
                            unit="min"
                            change={weeklyTrends.changes.duration}
                            getChangeColorClass={getChangeColorClass}
                        />
                        <TrendCard
                            label="Total Work"
                            current={weeklyTrends.current.totalWork}
                            unit="Wh"
                            change={weeklyTrends.changes.work}
                            getChangeColorClass={getChangeColorClass}
                        />
                    </div>
                </section>

                {/* Recent Activity Section */}
                <section>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                        <Calendar size={16} style={{ color: accentAltColor }} />
                        Last 7 Days
                    </h3>
                    {recentActivity.sessionCount > 0 ? (
                        <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                            <div className="grid grid-cols-4 gap-2 p-4 border-b border-neutral-200 dark:border-neutral-800">
                                <div className="text-center">
                                    <div className="text-lg font-medium text-neutral-900 dark:text-white">{recentActivity.sessionCount}</div>
                                    <div className="text-[9px] uppercase tracking-widest text-neutral-500">Sessions</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-medium text-neutral-900 dark:text-white">{recentActivity.avgPower}</div>
                                    <div className="text-[9px] uppercase tracking-widest text-neutral-500">Avg W</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-medium text-neutral-900 dark:text-white">{recentActivity.avgDuration}</div>
                                    <div className="text-[9px] uppercase tracking-widest text-neutral-500">Avg Min</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-medium text-neutral-900 dark:text-white">{recentActivity.totalWork}</div>
                                    <div className="text-[9px] uppercase tracking-widest text-neutral-500">Wh</div>
                                </div>
                            </div>
                            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 max-h-48 overflow-y-auto">
                                {recentActivity.sessions.slice(0, 7).map((session, idx) => (
                                    <div key={idx} className="flex items-center justify-between px-4 py-3">
                                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                            {new Date(session.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs">
                                            <span className="text-neutral-900 dark:text-white font-medium">{session.power}W</span>
                                            <span className="text-neutral-500">{session.duration}min</span>
                                            <span className="text-neutral-400">RPE {session.rpe}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-center text-neutral-500 text-sm">
                            No sessions in the last 7 days
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface TrendCardProps {
    label: string;
    current: number;
    unit: string;
    change: number;
    isAbsolute?: boolean;
    getChangeColorClass: (value: number) => string;
}

const TrendCard: React.FC<TrendCardProps> = ({ label, current, unit, change, isAbsolute, getChangeColorClass }) => (
    <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="text-[9px] uppercase tracking-widest text-neutral-500 mb-1">{label}</div>
        <div className="text-xl font-medium text-neutral-900 dark:text-white mb-1">
            {current}{unit && <span className="text-xs opacity-60 ml-0.5">{unit}</span>}
        </div>
        <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full ${getChangeColorClass(change)}`}>
            {isAbsolute
                ? (change >= 0 ? '+' : '') + change
                : formatChange(change)
            }
        </span>
    </div>
);

export default InsightsPage;
