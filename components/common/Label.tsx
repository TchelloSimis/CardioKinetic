/**
 * Label Component
 * 
 * Standardized label component for consistent form styling
 */

import React from 'react';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    /** Visual variant */
    variant?: 'default' | 'subtle' | 'strong';
    /** Show required indicator */
    required?: boolean;
    /** Helper text below label */
    helperText?: string;
    /** Error state */
    error?: boolean;
    /** Error message */
    errorMessage?: string;
}

const Label: React.FC<LabelProps> = ({
    variant = 'default',
    required = false,
    helperText,
    error = false,
    errorMessage,
    className = '',
    children,
    ...props
}) => {
    const variantStyles = {
        default: 'text-[10px] font-bold uppercase tracking-widest text-neutral-400',
        subtle: 'text-xs font-medium text-neutral-500 dark:text-neutral-400',
        strong: 'text-sm font-semibold text-neutral-900 dark:text-white',
    };

    return (
        <div className="space-y-1">
            <label
                className={`block ${variantStyles[variant]} ${className}`}
                {...props}
            >
                {children}
                {required && (
                    <span className="text-red-500 ml-0.5">*</span>
                )}
            </label>
            {helperText && !error && (
                <p className="text-xs text-neutral-400">{helperText}</p>
            )}
            {error && errorMessage && (
                <p className="text-xs text-red-500">{errorMessage}</p>
            )}
        </div>
    );
};

export default Label;
