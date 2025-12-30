import React from 'react';
import { Activity, Battery, Zap, Info, ClipboardCheck, TrendingUp, ChevronRight } from 'lucide-react';
import { PlanWeek, ReadinessState, Session, ProgramRecord, QuestionnaireResponse } from '../types';
import { AccentColorConfig } from '../presets';
import ProgramHistory from './ProgramHistory';
import { sanitizeDescription } from '../utils/chartUtils';

interface DashboardMetrics {
    readiness: number;
    fatigue: number;
    tsb: number;
    acwr: number;
    status: ReadinessState;
    advice: string | null;
    isAutoAdaptiveAdvice?: boolean;
    questionnaireAdjustment?: {
        readinessChange: number;
        fatigueChange: number;
    };
}

interface DashboardTabProps {
    currentWeekNum: number;
    currentWeekPlan: PlanWeek;
    metrics: DashboardMetrics;
    programs: ProgramRecord[];
    sessions: Session[];
    isDarkMode: boolean;
    currentAccent: AccentColorConfig;
    onEditSession: (session: Session) => void;
    onDeleteSession: (id: string) => void;
    onRenameProgram: (programId: string, newName: string) => void;
    onDeleteProgram: (programId: string) => void;
    onStartSession?: () => void;
    todayQuestionnaireResponse?: QuestionnaireResponse;
    onOpenQuestionnaire: () => void;
    onOpenInsights: () => void;
}

const DashboardTab: React.FC<DashboardTabProps> = ({
    currentWeekNum,
    currentWeekPlan,
    metrics,
    programs,
    sessions,
    isDarkMode,
    currentAccent,
    onEditSession,
    onDeleteSession,
    onRenameProgram,
    onDeleteProgram,
    onStartSession,
    todayQuestionnaireResponse,
    onOpenQuestionnaire,
    onOpenInsights
}) => {
    const hasCompletedToday = !!todayQuestionnaireResponse;
    const completionTime = hasCompletedToday
        ? new Date(todayQuestionnaireResponse.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : null;

    const accentColor = isDarkMode ? currentAccent.dark : currentAccent.light;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="mb-8">
                <h2 className="text-4xl font-light text-neutral-900 dark:text-white tracking-tight">Overview</h2>
                <p className="text-neutral-500 mt-2">Week {currentWeekNum} • {currentWeekPlan.phaseName}</p>
            </div>

            {metrics.advice && (
                <div className="mb-6 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 p-5 rounded-3xl shadow-sm flex gap-4 items-start">
                    <Info size={20} style={{ color: accentColor }} className="mt-0.5 flex-shrink-0" />
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
                            {metrics.isAutoAdaptiveAdvice ? 'Auto-generated Modifier' : "Coach's Advice"}
                        </div>
                        <p className="text-sm text-neutral-900 dark:text-neutral-200 leading-relaxed">{metrics.advice}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Next Target Card */}
                <div className="bg-neutral-900 dark:bg-white p-8 rounded-3xl shadow-lg text-white dark:text-neutral-900 flex flex-col justify-between min-h-[200px] md:col-span-2 lg:col-span-1">
                    <div className="flex justify-between items-start">
                        <div className="text-xs font-bold uppercase tracking-widest opacity-70">Next Target</div>
                        <div className="bg-white/20 dark:bg-black/10 px-2 py-1 rounded-full text-xs font-semibold">
                            {currentWeekPlan.sessionStyle === 'steady-state' || currentWeekPlan.workRestRatio === '1:0' || currentWeekPlan.workRestRatio === 'steady'
                                ? 'Steady State'
                                : currentWeekPlan.workRestRatio}
                        </div>
                    </div>
                    <div className="flex items-end gap-4 mt-6">
                        <div>
                            <span className="text-6xl font-light tracking-tighter">{currentWeekPlan.plannedPower}</span>
                            <span className="text-lg opacity-60 ml-1">W</span>
                        </div>
                        <div className="pb-2 opacity-60 text-sm font-mono">
                            {currentWeekPlan.targetDurationMinutes && (
                                <span className="mr-3">{currentWeekPlan.targetDurationMinutes} min</span>
                            )}
                            @ RPE {currentWeekPlan.targetRPE}
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 dark:border-black/10">
                        <div className="text-sm opacity-80">{sanitizeDescription(currentWeekPlan.description)}</div>
                    </div>
                </div>

                {/* Right column: Metrics grid */}
                <div className="grid grid-cols-2 gap-4 md:gap-6 lg:col-span-1">
                    {/* Readiness Tile */}
                    <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                            <Activity size={20} style={{ color: accentColor }} />
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${metrics.readiness > 65 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : metrics.readiness < 35 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'}`}>TSB {metrics.tsb > 0 ? '+' : ''}{metrics.tsb}</span>
                        </div>
                        <div>
                            <div className="text-3xl font-medium text-neutral-900 dark:text-white mb-1">{metrics.readiness}%</div>
                            <div className="text-[10px] uppercase tracking-widest text-neutral-500">Readiness</div>
                        </div>
                    </div>

                    {/* Fatigue Tile */}
                    <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                            <Battery size={20} style={{ color: isDarkMode ? currentAccent.darkAlt : currentAccent.lightAlt }} />
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${metrics.acwr > 1.3 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : metrics.acwr >= 0.8 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'}`}>ACWR {metrics.acwr.toFixed(2)}</span>
                        </div>
                        <div>
                            <div className="text-3xl font-medium text-neutral-900 dark:text-white mb-1">{metrics.fatigue}%</div>
                            <div className="text-[10px] uppercase tracking-widest text-neutral-500">Fatigue</div>
                        </div>
                    </div>

                    {/* Daily Check-In Tile - Side by side with Training Insights */}
                    <div
                        onClick={onOpenQuestionnaire}
                        className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md p-5 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between cursor-pointer hover:bg-white/80 dark:hover:bg-neutral-900/80 transition-colors min-h-[130px]"
                    >
                        <div className="flex justify-between items-start">
                            <ClipboardCheck
                                size={20}
                                style={{
                                    color: hasCompletedToday
                                        ? (isDarkMode ? currentAccent.dark : currentAccent.light)
                                        : (isDarkMode ? currentAccent.darkAlt : currentAccent.lightAlt)
                                }}
                            />
                            {hasCompletedToday && metrics.questionnaireAdjustment && (
                                <div className="flex flex-row gap-1.5 items-center">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${metrics.questionnaireAdjustment.fatigueChange < 0
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : metrics.questionnaireAdjustment.fatigueChange > 0
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                                        }`}>
                                        {metrics.questionnaireAdjustment.fatigueChange > 0 ? '+' : ''}{metrics.questionnaireAdjustment.fatigueChange} F
                                    </span>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${metrics.questionnaireAdjustment.readinessChange > 0
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : metrics.questionnaireAdjustment.readinessChange < 0
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                                        }`}>
                                        {metrics.questionnaireAdjustment.readinessChange > 0 ? '+' : ''}{metrics.questionnaireAdjustment.readinessChange} R
                                    </span>
                                </div>
                            )}
                            {!hasCompletedToday && (
                                <ChevronRight size={16} className="text-neutral-400" />
                            )}
                        </div>
                        <div className="mt-auto">
                            {hasCompletedToday ? (
                                <>
                                    <div className="text-2xl font-medium text-neutral-900 dark:text-white mb-1">
                                        Done
                                    </div>
                                    <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                                        At {completionTime}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl font-medium text-neutral-900 dark:text-white mb-1">
                                        Pending
                                    </div>
                                    <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                                        Questionnaire
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Training Insights Tile - Side by side with Questionnaire */}
                    <div
                        onClick={onOpenInsights}
                        className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md p-5 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between cursor-pointer hover:bg-white/80 dark:hover:bg-neutral-900/80 transition-colors min-h-[130px]"
                    >
                        <div className="flex justify-between items-start">
                            <TrendingUp
                                size={20}
                                style={{ color: isDarkMode ? currentAccent.darkAlt : currentAccent.lightAlt }}
                            />
                            <ChevronRight size={16} className="text-neutral-400" />
                        </div>
                        <div className="mt-auto">
                            <div className="text-2xl font-medium text-neutral-900 dark:text-white mb-1">
                                Insights
                            </div>
                            <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                                Records & Trends
                            </div>
                        </div>
                    </div>

                    {/* Program Status Tile */}
                    <div className="col-span-2 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-1">Program Status</div>
                            <div className="text-lg font-medium text-neutral-900 dark:text-white">{metrics.status}</div>
                        </div>
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{
                                backgroundColor: metrics.status === ReadinessState.PROGRESS
                                    ? (isDarkMode ? currentAccent.displayDark : currentAccent.displayLight)
                                    : (isDarkMode ? '#262626' : '#e5e5e5'),
                                color: metrics.status === ReadinessState.PROGRESS
                                    ? '#ffffff'
                                    : (isDarkMode ? '#737373' : '#a3a3a3')
                            }}
                        >
                            <Zap size={20} fill="currentColor" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-12">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-6">Session History</h3>
                <ProgramHistory
                    programs={programs}
                    sessions={sessions}
                    onEditSession={onEditSession}
                    onDeleteSession={onDeleteSession}
                    onRenameProgram={onRenameProgram}
                    onDeleteProgram={onDeleteProgram}
                />
            </div>
        </div>
    );
};

export default DashboardTab;
