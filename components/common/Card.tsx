/**
 * Card Component
 * 
 * Standardized card with consistent radii based on size
 */

import React from 'react';

type CardSize = 'sm' | 'md' | 'lg';
type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Size determines padding and border radius */
    size?: CardSize;
    /** Visual variant */
    variant?: CardVariant;
    /** Header content */
    header?: React.ReactNode;
    /** Footer content */
    footer?: React.ReactNode;
    /** Remove padding */
    noPadding?: boolean;
}

const sizeConfig: Record<CardSize, { padding: string; radius: string }> = {
    sm: { padding: 'p-4', radius: 'rounded-xl' },
    md: { padding: 'p-5', radius: 'rounded-2xl' },
    lg: { padding: 'p-6', radius: 'rounded-3xl' },
};

const variantStyles: Record<CardVariant, string> = {
    default: 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800',
    elevated: 'bg-white dark:bg-neutral-900 shadow-lg',
    outlined: 'bg-transparent border-2 border-neutral-200 dark:border-neutral-700',
    filled: 'bg-neutral-100 dark:bg-neutral-800',
};

const Card: React.FC<CardProps> = ({
    size = 'md',
    variant = 'default',
    header,
    footer,
    noPadding = false,
    className = '',
    children,
    ...props
}) => {
    const { padding, radius } = sizeConfig[size];

    return (
        <div
            className={`
                ${radius}
                ${variantStyles[variant]}
                ${className}
            `}
            {...props}
        >
            {header && (
                <div className={`border-b border-neutral-200 dark:border-neutral-700 ${padding}`}>
                    {header}
                </div>
            )}
            <div className={noPadding ? '' : padding}>
                {children}
            </div>
            {footer && (
                <div className={`border-t border-neutral-200 dark:border-neutral-700 ${padding}`}>
                    {footer}
                </div>
            )}
        </div>
    );
};

export default Card;
