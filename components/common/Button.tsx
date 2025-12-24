/**
 * Button Component
 * 
 * Standardized button component with variants
 */

import React from 'react';
import { theme } from '../../styles/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Visual variant */
    variant?: ButtonVariant;
    /** Size */
    size?: ButtonSize;
    /** Full width */
    fullWidth?: boolean;
    /** Loading state */
    loading?: boolean;
    /** Icon before text */
    leftIcon?: React.ReactNode;
    /** Icon after text */
    rightIcon?: React.ReactNode;
}

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs min-h-[32px]',
    md: 'px-4 py-2.5 text-sm min-h-[44px]',
    lg: 'px-6 py-3 text-base min-h-[52px]',
};

const variantStyles: Record<ButtonVariant, string> = {
    primary: `
        text-white shadow-lg
        hover:opacity-90 active:opacity-80
    `,
    secondary: `
        bg-neutral-100 dark:bg-neutral-800 
        text-neutral-900 dark:text-white
        hover:bg-neutral-200 dark:hover:bg-neutral-700
        border border-neutral-200 dark:border-neutral-700
    `,
    ghost: `
        bg-transparent 
        text-neutral-700 dark:text-neutral-300
        hover:bg-neutral-100 dark:hover:bg-neutral-800
    `,
    danger: `
        bg-red-500 text-white
        hover:bg-red-600 active:bg-red-700
        shadow-lg shadow-red-500/20
    `,
    success: `
        bg-emerald-500 text-white
        hover:bg-emerald-600 active:bg-emerald-700
        shadow-lg shadow-emerald-500/20
    `,
};

const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    leftIcon,
    rightIcon,
    className = '',
    children,
    disabled,
    style,
    ...props
}) => {
    const baseClasses = `
        inline-flex items-center justify-center gap-2
        font-bold uppercase tracking-wider
        rounded-xl
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
    `;

    // For primary variant, we use the accent color via style
    const accentStyle = variant === 'primary'
        ? { backgroundColor: 'var(--accent)', ...style }
        : style;

    return (
        <button
            className={`
                ${baseClasses}
                ${sizeStyles[size]}
                ${variantStyles[variant]}
                ${fullWidth ? 'w-full' : ''}
                ${className}
            `}
            disabled={disabled || loading}
            style={accentStyle}
            {...props}
        >
            {loading && (
                <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            )}
            {!loading && leftIcon}
            {children}
            {!loading && rightIcon}
        </button>
    );
};

export default Button;
