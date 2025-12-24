/**
 * StepIndicator Component
 * 
 * Progress indicator for multi-step flows (onboarding, wizards)
 */

import React from 'react';
import { Check } from 'lucide-react';

interface Step {
    label: string;
    description?: string;
}

interface StepIndicatorProps {
    /** Array of step definitions */
    steps: Step[];
    /** Current active step (0-indexed) */
    currentStep: number;
    /** Callback when a step is clicked (for navigation) */
    onStepClick?: (stepIndex: number) => void;
    /** Whether previous steps are clickable */
    allowNavigation?: boolean;
    /** Orientation */
    orientation?: 'horizontal' | 'vertical';
    /** Show labels */
    showLabels?: boolean;
    /** Additional className */
    className?: string;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({
    steps,
    currentStep,
    onStepClick,
    allowNavigation = false,
    orientation = 'horizontal',
    showLabels = true,
    className = '',
}) => {
    const isHorizontal = orientation === 'horizontal';

    const handleStepClick = (index: number) => {
        if (allowNavigation && onStepClick && index < currentStep) {
            onStepClick(index);
        }
    };

    return (
        <div
            className={`
                flex ${isHorizontal ? 'flex-row items-center' : 'flex-col'} 
                gap-0 ${className}
            `}
        >
            {steps.map((step, index) => {
                const isCompleted = index < currentStep;
                const isActive = index === currentStep;
                const isClickable = allowNavigation && isCompleted && onStepClick;

                return (
                    <React.Fragment key={index}>
                        {/* Step */}
                        <div
                            className={`
                                flex ${isHorizontal ? 'flex-col items-center' : 'flex-row items-start gap-3'}
                                ${isClickable ? 'cursor-pointer' : ''}
                            `}
                            onClick={() => handleStepClick(index)}
                        >
                            {/* Circle */}
                            <div
                                className={`
                                    w-8 h-8 rounded-full flex items-center justify-center
                                    text-sm font-bold transition-all duration-300
                                    ${isCompleted
                                        ? 'bg-emerald-500 text-white'
                                        : isActive
                                            ? 'ring-2 ring-offset-2 text-white'
                                            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'
                                    }
                                `}
                                style={isActive ? { backgroundColor: 'var(--accent)', ringColor: 'var(--accent)' } : {}}
                            >
                                {isCompleted ? (
                                    <Check size={16} strokeWidth={3} />
                                ) : (
                                    index + 1
                                )}
                            </div>

                            {/* Label */}
                            {showLabels && (
                                <div className={`${isHorizontal ? 'mt-2 text-center' : ''}`}>
                                    <span
                                        className={`
                                            text-xs font-medium transition-colors
                                            ${isCompleted || isActive
                                                ? 'text-neutral-900 dark:text-white'
                                                : 'text-neutral-400'
                                            }
                                        `}
                                    >
                                        {step.label}
                                    </span>
                                    {step.description && !isHorizontal && (
                                        <p className="text-xs text-neutral-500 mt-1">
                                            {step.description}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Connector line */}
                        {index < steps.length - 1 && (
                            <div
                                className={`
                                    ${isHorizontal
                                        ? 'flex-1 h-0.5 mx-2'
                                        : 'w-0.5 h-8 ml-4 my-1'
                                    }
                                    transition-colors duration-300
                                    ${index < currentStep
                                        ? 'bg-emerald-500'
                                        : 'bg-neutral-200 dark:bg-neutral-700'
                                    }
                                `}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default StepIndicator;
