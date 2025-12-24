/**
 * useScrollPosition Hook
 * 
 * Preserves and restores scroll position across tab navigation
 */

import { useEffect, useRef, useCallback } from 'react';

interface ScrollPositions {
    [key: string]: number;
}

// Global store for scroll positions
const scrollPositions: ScrollPositions = {};

/**
 * Hook to preserve scroll position for a specific key
 */
export function useScrollPosition(key: string, enabled: boolean = true) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const isRestoringRef = useRef(false);

    // Save current scroll position
    const savePosition = useCallback(() => {
        if (scrollRef.current && enabled) {
            scrollPositions[key] = scrollRef.current.scrollTop;
        }
    }, [key, enabled]);

    // Restore saved scroll position
    const restorePosition = useCallback(() => {
        if (scrollRef.current && enabled && scrollPositions[key] !== undefined) {
            isRestoringRef.current = true;
            scrollRef.current.scrollTop = scrollPositions[key];
            // Wait for next frame to reset flag
            requestAnimationFrame(() => {
                isRestoringRef.current = false;
            });
        }
    }, [key, enabled]);

    // Set up scroll listener
    useEffect(() => {
        const element = scrollRef.current;
        if (!element || !enabled) return;

        const handleScroll = () => {
            if (!isRestoringRef.current) {
                savePosition();
            }
        };

        element.addEventListener('scroll', handleScroll, { passive: true });

        // Restore position on mount
        restorePosition();

        return () => {
            element.removeEventListener('scroll', handleScroll);
        };
    }, [key, enabled, savePosition, restorePosition]);

    // Reset position for this key
    const resetPosition = useCallback(() => {
        delete scrollPositions[key];
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, [key]);

    // Scroll to top
    const scrollToTop = useCallback((smooth: boolean = true) => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: 0,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
    }, []);

    return {
        scrollRef,
        savePosition,
        restorePosition,
        resetPosition,
        scrollToTop,
        currentPosition: scrollPositions[key] ?? 0,
    };
}

/**
 * Get all stored scroll positions (for debugging)
 */
export function getAllScrollPositions(): ScrollPositions {
    return { ...scrollPositions };
}

/**
 * Clear all stored scroll positions
 */
export function clearAllScrollPositions(): void {
    Object.keys(scrollPositions).forEach(key => {
        delete scrollPositions[key];
    });
}

export default useScrollPosition;
