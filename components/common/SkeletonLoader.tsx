/**
 * SkeletonLoader Component
 * 
 * Reusable skeleton loading states for content placeholders
 */

import React from 'react';

interface SkeletonProps {
    /** Width of the skeleton (default: 100%) */
    width?: string | number;
    /** Height of the skeleton (default: 1rem) */
    height?: string | number;
    /** Border radius (default: 0.5rem) */
    radius?: string | number;
    /** Additional CSS classes */
    className?: string;
    /** Animation variant */
    variant?: 'pulse' | 'shimmer';
}

/**
 * Base skeleton component with pulse animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = '1rem',
    radius = '0.5rem',
    className = '',
    variant = 'pulse',
}) => {
    const baseClasses = 'bg-neutral-200 dark:bg-neutral-700';
    const animationClasses = variant === 'pulse'
        ? 'animate-pulse'
        : 'bg-gradient-to-r from-neutral-200 via-neutral-300 to-neutral-200 dark:from-neutral-700 dark:via-neutral-600 dark:to-neutral-700 bg-[length:200%_100%] animate-shimmer';

    return (
        <div
            className={`${baseClasses} ${animationClasses} ${className}`}
            style={{
                width: typeof width === 'number' ? `${width}px` : width,
                height: typeof height === 'number' ? `${height}px` : height,
                borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
            }}
        />
    );
};

/**
 * Skeleton for text lines
 */
export const SkeletonText: React.FC<{
    lines?: number;
    className?: string;
}> = ({ lines = 3, className = '' }) => (
    <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
                key={i}
                width={i === lines - 1 ? '60%' : '100%'}
                height="0.875rem"
            />
        ))}
    </div>
);

/**
 * Skeleton for cards
 */
export const SkeletonCard: React.FC<{
    showImage?: boolean;
    showTitle?: boolean;
    showDescription?: boolean;
    className?: string;
}> = ({
    showImage = true,
    showTitle = true,
    showDescription = true,
    className = '',
}) => (
        <div className={`p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 ${className}`}>
            {showImage && (
                <Skeleton width="100%" height={120} radius="0.75rem" className="mb-4" />
            )}
            {showTitle && (
                <Skeleton width="70%" height="1.25rem" className="mb-2" />
            )}
            {showDescription && (
                <SkeletonText lines={2} />
            )}
        </div>
    );

/**
 * Skeleton for stat cards (like dashboard metrics)
 */
export const SkeletonStat: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 ${className}`}>
        <Skeleton width="40%" height="0.75rem" className="mb-3" />
        <Skeleton width="60%" height="2rem" className="mb-2" />
        <Skeleton width="80%" height="0.625rem" />
    </div>
);

/**
 * Skeleton for list items
 */
export const SkeletonListItem: React.FC<{
    showAvatar?: boolean;
    className?: string;
}> = ({ showAvatar = true, className = '' }) => (
    <div className={`flex items-center gap-3 p-3 ${className}`}>
        {showAvatar && (
            <Skeleton width={40} height={40} radius="50%" />
        )}
        <div className="flex-1">
            <Skeleton width="60%" height="1rem" className="mb-2" />
            <Skeleton width="40%" height="0.75rem" />
        </div>
    </div>
);

/**
 * Skeleton for charts
 */
export const SkeletonChart: React.FC<{
    height?: number;
    className?: string;
}> = ({ height = 200, className = '' }) => (
    <div className={`p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 ${className}`}>
        <Skeleton width="30%" height="1rem" className="mb-4" />
        <div className="flex items-end justify-between gap-2" style={{ height }}>
            {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton
                    key={i}
                    width="100%"
                    height={`${30 + Math.random() * 70}%`}
                    radius="0.25rem"
                />
            ))}
        </div>
    </div>
);

export default Skeleton;
