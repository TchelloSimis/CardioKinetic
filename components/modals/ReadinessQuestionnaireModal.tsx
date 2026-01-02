import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, History, Calendar } from 'lucide-react';
import { QuestionnaireResponse } from '../../types';
import { AccentColorConfig } from '../../presets';
import {
    QUESTIONNAIRE_QUESTIONS,
    CATEGORY_INFO,
    getQuestionsByCategory,
    getDefaultResponses
} from '../../utils/questionnaireConfig';
import { getLocalDateString } from '../../utils/dateUtils';

interface ReadinessQuestionnaireModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (response: QuestionnaireResponse) => void;
    existingResponse?: QuestionnaireResponse;
    allResponses?: QuestionnaireResponse[];  // All responses for date selector feature
    isDarkMode: boolean;
    currentAccent: AccentColorConfig;
    onOpenHistory?: () => void;
}

const ReadinessQuestionnaireModal: React.FC<ReadinessQuestionnaireModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    existingResponse,
    allResponses = [],
    isDarkMode,
    currentAccent,
    onOpenHistory
}) => {
    const [responses, setResponses] = useState<Record<string, number | undefined>>(getDefaultResponses());
    const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());

    // Initialize with existing responses if editing, or reset on open
    useEffect(() => {
        if (existingResponse) {
            setSelectedDate(existingResponse.date);
            setResponses(existingResponse.responses);
        } else {
            setSelectedDate(getLocalDateString());
            setResponses(getDefaultResponses());
        }
    }, [existingResponse, isOpen]);

    // When date changes, load existing response for that date if available
    const handleDateChange = (newDate: string) => {
        setSelectedDate(newDate);
        const existingForDate = allResponses.find(r => r.date === newDate);
        if (existingForDate) {
            setResponses(existingForDate.responses);
        } else {
            setResponses(getDefaultResponses());
        }
    };

    const handleValueChange = (questionId: string, value: number | undefined) => {
        setResponses(prev => ({ ...prev, [questionId]: value }));
    };

    const handleSubmit = () => {
        // Filter out undefined values for submission
        const cleanedResponses: Record<string, number> = {};
        for (const [key, value] of Object.entries(responses) as [string, number | undefined][]) {
            if (value !== undefined) {
                cleanedResponses[key] = value;
            }
        }

        const response: QuestionnaireResponse = {
            date: selectedDate,  // Use selectedDate instead of always today
            responses: cleanedResponses,
            timestamp: new Date().toISOString()
        };
        onSubmit(response);
        onClose();
    };

    if (!isOpen) return null;

    const questionsByCategory = getQuestionsByCategory();
    const categories: Array<keyof typeof CATEGORY_INFO> = ['sleep', 'nutrition', 'stress', 'physical', 'motivation'];

    // Colors for gradient: fatigue (alt) at 1, readiness (primary) at 5
    const fatigueColor = isDarkMode ? currentAccent.darkAlt : currentAccent.lightAlt;
    const readinessColor = isDarkMode ? currentAccent.dark : currentAccent.light;

    // Helper to interpolate between two hex colors
    const interpolateColor = (color1: string, color2: string, factor: number): string => {
        // Parse hex colors
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

    // Get color for a specific value (1-5): 1=fatigue, 5=readiness
    const getValueColor = (value: number): string => {
        const factor = (value - 1) / 4; // 0 at value 1, 1 at value 5
        return interpolateColor(fatigueColor, readinessColor, factor);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center gap-4 p-4 border-b border-neutral-200 dark:border-neutral-800">
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <ArrowLeft size={24} className="text-neutral-900 dark:text-white" />
                    </button>
                    <h2 className="text-xl font-medium text-neutral-900 dark:text-white">
                        Readiness Check-In
                    </h2>
                </div>

                {/* Questions */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Date Selector Field */}
                    <div>
                        <div className="mb-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                                Date
                            </span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                    Which day is this check-in for?
                                </span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <Calendar size={20} style={{ color: readinessColor }} />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const input = document.getElementById('date-picker-input') as HTMLInputElement;
                                            if (input?.showPicker) input.showPicker();
                                            else input?.focus();
                                        }}
                                        className="text-lg font-medium cursor-pointer hover:opacity-80 transition-opacity"
                                        style={{ color: readinessColor }}
                                    >
                                        {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </button>
                                    <input
                                        id="date-picker-input"
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => handleDateChange(e.target.value)}
                                        max={getLocalDateString()}
                                        className="sr-only"
                                    />
                                    {allResponses.find(r => r.date === selectedDate) && selectedDate !== (existingResponse?.date || '') && (
                                        <span
                                            className="text-xs px-2 py-1 rounded-md"
                                            style={{ backgroundColor: `${readinessColor}20`, color: readinessColor }}
                                        >
                                            Has existing data
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {categories.map(category => {
                        const questions = questionsByCategory.get(category) || [];
                        const info = CATEGORY_INFO[category];

                        return (
                            <div key={category}>
                                {/* Category Header */}
                                <div className="mb-4">
                                    <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                                        {info.label}
                                    </span>
                                </div>

                                {/* Questions in this category */}
                                <div className="space-y-6">
                                    {questions.map(question => {
                                        const currentValue = responses[question.id];
                                        const hasValue = currentValue !== undefined;
                                        const displayValue = currentValue ?? 3;
                                        const tooltip = question.tooltips[displayValue as 1 | 2 | 3 | 4 | 5];

                                        return (
                                            <div key={question.id} className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                                        {question.question}
                                                    </span>
                                                    {question.optional && (
                                                        <span className="text-xs text-neutral-400 ml-2">
                                                            (Optional)
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Slider with value display */}
                                                <div className="space-y-2">
                                                    {/* Tooltip as main display + Skip toggle for optional */}
                                                    <div className="flex items-center justify-between">
                                                        <span
                                                            className="text-lg font-medium"
                                                            style={{ color: hasValue ? getValueColor(displayValue) : '#a3a3a3' }}
                                                        >
                                                            {hasValue ? tooltip : 'Not answered'}
                                                        </span>
                                                        {question.optional && (
                                                            <button
                                                                onClick={() => handleValueChange(question.id, hasValue ? undefined : 3)}
                                                                className="text-xs px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                                            >
                                                                {hasValue ? 'Skip' : 'Answer'}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Discrete Slider with gradient track */}
                                                    <div className="relative">
                                                        <input
                                                            type="range"
                                                            min={1}
                                                            max={5}
                                                            step={1}
                                                            value={displayValue}
                                                            onChange={(e) => handleValueChange(question.id, parseInt(e.target.value))}
                                                            disabled={question.optional && !hasValue}
                                                            className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                                            style={{
                                                                background: `linear-gradient(to right, ${fatigueColor}, ${readinessColor})`,
                                                                accentColor: getValueColor(displayValue)
                                                            }}
                                                        />
                                                        {/* Tick marks with gradient colors */}
                                                        <div className="flex justify-between px-0.5 mt-1">
                                                            {[1, 2, 3, 4, 5].map(v => (
                                                                <span
                                                                    key={v}
                                                                    className={`text-[10px] ${v === displayValue && hasValue ? 'font-bold' : 'text-neutral-400'}`}
                                                                    style={{ color: v === displayValue && hasValue ? getValueColor(v) : undefined }}
                                                                >
                                                                    {v}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t border-neutral-200 dark:border-neutral-800">
                    {onOpenHistory && (
                        <button
                            onClick={onOpenHistory}
                            className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                            title="View History"
                        >
                            <History size={20} />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-medium text-white transition-colors"
                        style={{
                            backgroundColor: readinessColor,
                        }}
                    >
                        {existingResponse ? 'Update' : 'Submit'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReadinessQuestionnaireModal;
