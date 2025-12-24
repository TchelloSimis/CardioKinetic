/**
 * EmptyState Component
 * 
 * Reusable empty state with icon, message, and optional CTA
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    /** Icon to display */
    icon: LucideIcon;
    /** Main title text */
    title: string;
    /** Description text */
    description?: string;
    /** Primary action button text */
    actionText?: string;
    /** Primary action callback */
    onAction?: () => void;
    /** Secondary action text */
    secondaryActionText?: string;
    /** Secondary action callback */
    onSecondaryAction?: () => void;
    /** Icon size (default: 48) */
    iconSize?: number;
    /** Custom icon color (default: accent) */
    iconColor?: string;
    /** Additional CSS classes */
    className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    actionText,
    onAction,
    secondaryActionText,
    onSecondaryAction,
    iconSize = 48,
    iconColor,
    className = '',
}) => {
    return (
        <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
            {/* Icon container */}
            <div
                className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-neutral-100 dark:bg-neutral-800"
            >
                <Icon
                    size={iconSize}
                    style={{ color: iconColor || 'var(--accent)' }}
                    className="opacity-60"
                />
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                {title}
            </h3>

            {/* Description */}
            {description && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs mb-6">
                    {description}
                </p>
            )}

            {/* Actions */}
            {(actionText || secondaryActionText) && (
                <div className="flex flex-col sm:flex-row gap-3">
                    {actionText && onAction && (
                        <button
                            onClick={onAction}
                            className="px-6 py-3 rounded-xl text-white text-sm font-bold uppercase tracking-wider hover:opacity-90 transition-opacity shadow-lg"
                            style={{ backgroundColor: 'var(--accent)' }}
                        >
                            {actionText}
                        </button>
                    )}
                    {secondaryActionText && onSecondaryAction && (
                        <button
                            onClick={onSecondaryAction}
                            className="px-6 py-3 rounded-xl text-neutral-600 dark:text-neutral-300 text-sm font-bold uppercase tracking-wider hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors border border-neutral-200 dark:border-neutral-700"
                        >
                            {secondaryActionText}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default EmptyState;
