import React, { useState, useMemo } from 'react';
import { QuestionnaireResponse } from '../types';
import { AccentColorConfig } from '../presets';
import { ChevronDown, ChevronRight, Calendar, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import {
    QUESTIONNAIRE_QUESTIONS,
    CATEGORY_INFO,
    calculateWeightedAverage
} from '../utils/questionnaireConfig';

interface QuestionnaireHistoryProps {
    responses: QuestionnaireResponse[];
    onEditResponse: (response: QuestionnaireResponse) => void;
    onDeleteResponse: (responseDate: string) => void;
    onClose: () => void;
    isDarkMode: boolean;
    currentAccent: AccentColorConfig;
}

interface MonthGroup {
    monthKey: string;  // YYYY-MM
    monthLabel: string;  // e.g., "December 2025"
    responses: QuestionnaireResponse[];
}

const QuestionnaireHistory: React.FC<QuestionnaireHistoryProps> = ({
    responses,
    onEditResponse,
    onDeleteResponse,
    onClose,
    isDarkMode,
    currentAccent
}) => {
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

    // Colors for gradient: fatigue (alt) at low scores, readiness (primary) at high scores
    const fatigueColor = isDarkMode ? currentAccent.darkAlt : currentAccent.lightAlt;
    const readinessColor = isDarkMode ? currentAccent.dark : currentAccent.light;

    // Helper to interpolate between two hex colors
    const interpolateColor = (color1: string, color2: string, factor: number): string => {
        const hex1 = color1.replace('#', '');
        const hex2 = color2.replace('#', '');

        const r1 = parseInt(hex1.substring(0, 2), 16);
        const g1 = parseInt(hex1.substring(2, 4), 16);
        const b1 = parseInt(hex1.substring(4, 6), 16);

        const r2 = parseInt(hex2.substring(0, 2), 16);
        const g2 = parseInt(hex2.substring(2, 4), 16);
        const b2 = parseInt(hex2.substring(4, 6), 16);

        const r = Math.round(r1 + (r2 - r1) * factor);
        const g = Math.round(g1 + (g2 - g1) * factor);
        const b = Math.round(b1 + (b2 - b1) * factor);

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    // Get color for a score (1-5): 1=fatigue, 5=readiness
    const getScoreColor = (score: number): string => {
        const factor = (score - 1) / 4; // 0 at score 1, 1 at score 5
        return interpolateColor(fatigueColor, readinessColor, factor);
    };

    const toggleMonth = (monthKey: string) => {
        setExpandedMonths(prev => {
            const next = new Set(prev);
            if (next.has(monthKey)) {
                next.delete(monthKey);
            } else {
                next.add(monthKey);
            }
            return next;
        });
    };

    const toggleDate = (dateKey: string) => {
        setExpandedDates(prev => {
            const next = new Set(prev);
            if (next.has(dateKey)) {
                next.delete(dateKey);
            } else {
                next.add(dateKey);
            }
            return next;
        });
    };

    const handleEdit = (response: QuestionnaireResponse, e: React.MouseEvent) => {
        e.stopPropagation();
        onEditResponse(response);
    };

    const handleDelete = (responseDate: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Delete this questionnaire response? This cannot be undone.')) {
            onDeleteResponse(responseDate);
        }
    };

    // Group responses by month (YYYY-MM)
    const monthGroups: MonthGroup[] = useMemo(() => {
        // Sort responses by date descending (most recent first)
        const sorted = [...responses].sort((a, b) => b.date.localeCompare(a.date));

        const groups = new Map<string, QuestionnaireResponse[]>();

        for (const response of sorted) {
            const monthKey = response.date.substring(0, 7); // YYYY-MM
            if (!groups.has(monthKey)) {
                groups.set(monthKey, []);
            }
            groups.get(monthKey)!.push(response);
        }

        return Array.from(groups.entries()).map(([monthKey, monthResponses]) => {
            // Parse month for display
            const [year, month] = monthKey.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1, 1);
            const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            return {
                monthKey,
                monthLabel,
                responses: monthResponses
            };
        });
    }, [responses]);

    // Format date for display
    const formatDate = (dateStr: string): string => {
        const [year, month, day] = dateStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Get summary text for a response
    const getResponseSummary = (response: QuestionnaireResponse): string => {
        const summaries: string[] = [];

        // Get category averages
        const categoryScores: Record<string, number[]> = {};
        for (const question of QUESTIONNAIRE_QUESTIONS) {
            const value = response.responses[question.id];
            if (value === undefined) continue;
            if (!categoryScores[question.category]) {
                categoryScores[question.category] = [];
            }
            categoryScores[question.category].push(value);
        }

        // Create summary from top categories
        const categoryLabels: Record<string, string> = {
            sleep: 'Sleep',
            nutrition: 'Nutrition',
            stress: 'Stress',
            physical: 'Energy',
            motivation: 'Motivation'
        };

        const scoreLabels: Record<number, string> = {
            1: 'Poor',
            2: 'Low',
            3: 'Average',
            4: 'Good',
            5: 'Excellent'
        };

        for (const [cat, scores] of Object.entries(categoryScores)) {
            if (scores.length === 0) continue;
            const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
            summaries.push(`${categoryLabels[cat] || cat}: ${scoreLabels[avg] || avg}`);
        }

        return summaries.slice(0, 3).join(' • ');
    };

    if (monthGroups.length === 0) {
        return (
            <div className="fixed inset-0 z-[100] bg-white dark:bg-black flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center gap-4 p-4 border-b border-neutral-200 dark:border-neutral-800">
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <ArrowLeft size={24} className="text-neutral-900 dark:text-white" />
                    </button>
                    <h2 className="text-xl font-medium text-neutral-900 dark:text-white">
                        Questionnaire History
                    </h2>
                </div>

                {/* Empty State */}
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="text-center">
                        <Calendar size={48} className="mx-auto mb-4 text-neutral-300 dark:text-neutral-600" />
                        <p className="text-neutral-500 dark:text-neutral-400">No questionnaire responses yet.</p>
                        <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-2">
                            Fill out your daily check-in to start tracking.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-black flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 border-b border-neutral-200 dark:border-neutral-800">
                <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                    <ArrowLeft size={24} className="text-neutral-900 dark:text-white" />
                </button>
                <div>
                    <h2 className="text-xl font-medium text-neutral-900 dark:text-white">
                        Questionnaire History
                    </h2>
                    <p className="text-sm text-neutral-500">
                        {responses.length} response{responses.length !== 1 ? 's' : ''} recorded
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-20">
                <div className="max-w-2xl mx-auto space-y-4">
                    {monthGroups.map(({ monthKey, monthLabel, responses: monthResponses }) => {
                        const isMonthExpanded = expandedMonths.has(monthKey);

                        return (
                            <div key={monthKey} className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                                {/* Month Header */}
                                <button
                                    onClick={() => toggleMonth(monthKey)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="p-2 rounded-xl"
                                            style={{ backgroundColor: `${readinessColor}20` }}
                                        >
                                            <Calendar size={18} style={{ color: readinessColor }} />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                                                {monthLabel}
                                            </h3>
                                            <p className="text-xs text-neutral-500">
                                                {monthResponses.length} response{monthResponses.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isMonthExpanded ? (
                                            <ChevronDown size={20} className="text-neutral-400" />
                                        ) : (
                                            <ChevronRight size={20} className="text-neutral-400" />
                                        )}
                                    </div>
                                </button>

                                {/* Month Content (Responses) */}
                                {isMonthExpanded && (
                                    <div className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-black/20">
                                        {monthResponses.map(response => {
                                            const isDateExpanded = expandedDates.has(response.date);
                                            const avgScore = calculateWeightedAverage(response);
                                            const scorePercent = Math.round((avgScore / 5) * 100);
                                            const scoreColor = getScoreColor(avgScore);

                                            return (
                                                <div key={response.date} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                                                    <button
                                                        onClick={() => toggleDate(response.date)}
                                                        className="w-full flex items-center justify-between p-4 pl-6 hover:bg-white dark:hover:bg-neutral-900/50 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-2 h-2 rounded-full"
                                                                style={{ backgroundColor: scoreColor }}
                                                            />
                                                            <div className="text-left">
                                                                <span className="text-sm font-medium text-neutral-900 dark:text-white">
                                                                    {formatDate(response.date)}
                                                                </span>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span
                                                                        className="text-xs font-bold"
                                                                        style={{ color: scoreColor }}
                                                                    >
                                                                        {avgScore.toFixed(1)}/5
                                                                    </span>
                                                                    <span className="text-xs text-neutral-400">
                                                                        ({scorePercent}%)
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {isDateExpanded ? (
                                                                <ChevronDown size={16} className="text-neutral-400" />
                                                            ) : (
                                                                <ChevronRight size={16} className="text-neutral-400" />
                                                            )}
                                                        </div>
                                                    </button>

                                                    {/* Response Details */}
                                                    {isDateExpanded && (
                                                        <div className="bg-white dark:bg-neutral-900 p-4 pl-8 space-y-3">
                                                            {/* Score bar */}
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-full transition-all"
                                                                        style={{
                                                                            width: `${scorePercent}%`,
                                                                            background: `linear-gradient(to right, ${fatigueColor}, ${readinessColor})`
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Summary */}
                                                            <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                                                {getResponseSummary(response)}
                                                            </p>

                                                            {/* Individual responses */}
                                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                                {QUESTIONNAIRE_QUESTIONS.map(question => {
                                                                    const value = response.responses[question.id];
                                                                    if (value === undefined) return null;
                                                                    const color = getScoreColor(value);
                                                                    return (
                                                                        <div key={question.id} className="flex justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                                                                            <span className="text-neutral-500 truncate">{question.question.split('?')[0]}?</span>
                                                                            <span className="font-bold ml-2" style={{ color }}>{value}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            {/* Actions */}
                                                            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                                                                <button
                                                                    onClick={(e) => handleEdit(response, e)}
                                                                    className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                                                                >
                                                                    <Pencil size={14} />
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDelete(response.date, e)}
                                                                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 size={14} />
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default QuestionnaireHistory;
