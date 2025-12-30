/**
 * useChartGestures Hook
 * 
 * High-performance gesture handling for chart pan/zoom interactions.
 * 
 * Key optimizations:
 * - RAF throttling: Only process one gesture update per animation frame
 * - Ref-based intermediate state: No React re-renders during active gestures
 * - Gesture coalescing: Batch touch events into single visual updates
 * - Passive listeners where possible, active only for horizontal pan
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';

export interface ZoomDomain {
    start: number;
    end: number;
}

export interface UseChartGesturesOptions {
    /** Total number of data points in the chart */
    dataLength: number;
    /** Ref to the chart container element */
    containerRef: React.RefObject<HTMLDivElement>;
    /** Initial zoom domain */
    initialDomain?: ZoomDomain;
}

export interface ChartGestureHandlers {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
    onWheel: (e: React.WheelEvent) => void;
}

export interface UseChartGesturesResult {
    /** Current zoom domain (synced to React state on gesture end) */
    zoomDomain: ZoomDomain;
    /** Event handlers to spread on the container (mouse only, touch handled via effect) */
    handlers: ChartGestureHandlers;
    /** Reset zoom to show all data */
    resetZoom: () => void;
    /** Zoom in by one step */
    zoomIn: () => void;
    /** Zoom out by one step */
    zoomOut: () => void;
}

export function useChartGestures(options: UseChartGesturesOptions): UseChartGesturesResult {
    const { dataLength, containerRef, initialDomain } = options;

    // ============================================================================
    // STATE
    // ============================================================================

    // React state - only updated on gesture end for smooth rendering
    const [zoomDomain, setZoomDomain] = useState<ZoomDomain>(() =>
        initialDomain ?? { start: 0, end: Math.max(0, dataLength - 1) }
    );

    // ============================================================================
    // REFS (no re-renders during gestures)
    // ============================================================================

    // Intermediate domain during gestures - visual updates without React re-render
    const domainRef = useRef<ZoomDomain>(zoomDomain);

    // RAF handle for throttling
    const rafRef = useRef<number | null>(null);

    // Gesture state
    const isDragging = useRef(false);
    const lastX = useRef(0);
    const lastPinchDist = useRef<number | null>(null);

    // Touch direction detection
    const touchStartY = useRef(0);
    const isHorizontalPan = useRef(false);

    // Track if we need to commit changes
    const hasChanges = useRef(false);

    // ============================================================================
    // SYNC INITIAL DOMAIN WHEN DATA LENGTH CHANGES
    // ============================================================================

    useEffect(() => {
        const newDomain = { start: 0, end: Math.max(0, dataLength - 1) };
        domainRef.current = newDomain;
        setZoomDomain(newDomain);
    }, [dataLength]);

    // ============================================================================
    // CORE GESTURE LOGIC
    // ============================================================================

    /**
     * Commit the current ref domain to React state.
     * Only called on gesture end to minimize re-renders.
     */
    const commitDomain = useCallback(() => {
        if (hasChanges.current) {
            setZoomDomain({ ...domainRef.current });
            hasChanges.current = false;
        }
    }, []);

    /**
     * Apply visual update immediately via DOM manipulation if needed,
     * but we rely on React's next render with the ref value.
     * The key optimization is NOT calling setState here.
     */
    const applyDomainToRef = useCallback((newDomain: ZoomDomain) => {
        domainRef.current = newDomain;
        hasChanges.current = true;
    }, []);

    /**
     * RAF-throttled domain update.
     * Schedules a visual update for the next animation frame.
     */
    const scheduleVisualUpdate = useCallback(() => {
        if (rafRef.current !== null) return; // Already scheduled

        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            // For truly smooth updates during drag, we commit here
            // This gives us ~60fps updates instead of per-event updates
            if (hasChanges.current) {
                setZoomDomain({ ...domainRef.current });
                hasChanges.current = false;
            }
        });
    }, []);

    /**
     * Pan the chart by a pixel delta.
     */
    const pan = useCallback((deltaPixels: number) => {
        const chartWidth = containerRef.current?.clientWidth || 500;
        const currentDomain = domainRef.current;
        const totalPoints = currentDomain.end - currentDomain.start;
        const sensitivity = totalPoints / chartWidth;

        let deltaIndex = Math.round(deltaPixels * sensitivity * 3);
        if (deltaIndex === 0) return;

        let newStart = currentDomain.start + deltaIndex;
        let newEnd = currentDomain.end + deltaIndex;

        // Clamp to bounds
        if (newStart < 0) {
            newEnd -= newStart;
            newStart = 0;
        }
        if (newEnd >= dataLength) {
            const diff = newEnd - (dataLength - 1);
            newStart -= diff;
            newEnd = dataLength - 1;
        }
        if (newStart < 0) newStart = 0;

        applyDomainToRef({ start: newStart, end: newEnd });
        scheduleVisualUpdate();
    }, [dataLength, containerRef, applyDomainToRef, scheduleVisualUpdate]);

    /**
     * Zoom the chart by a factor.
     * factor > 0 = zoom in (shrink range)
     * factor < 0 = zoom out (expand range)
     */
    const zoom = useCallback((factor: number) => {
        const currentDomain = domainRef.current;
        const currentRange = currentDomain.end - currentDomain.start;
        const minRange = Math.min(3, Math.max(1, dataLength - 1));
        const maxRange = dataLength - 1;

        const changeAmount = Math.max(1, Math.round(currentRange * 0.2));
        let newRange = factor > 0
            ? Math.max(minRange, currentRange - changeAmount)
            : Math.min(maxRange, currentRange + changeAmount);

        const mid = Math.floor((currentDomain.start + currentDomain.end) / 2);
        let newStart = Math.max(0, mid - Math.floor(newRange / 2));
        let newEnd = newStart + newRange;

        // Clamp to data bounds
        if (newEnd >= dataLength) {
            newEnd = dataLength - 1;
            newStart = Math.max(0, newEnd - newRange);
        }

        applyDomainToRef({ start: newStart, end: newEnd });
        scheduleVisualUpdate();
    }, [dataLength, applyDomainToRef, scheduleVisualUpdate]);

    // ============================================================================
    // MOUSE HANDLERS (returned for JSX spread)
    // ============================================================================

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true;
        lastX.current = e.clientX;
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging.current) return;
        e.preventDefault();
        const deltaX = lastX.current - e.clientX;
        lastX.current = e.clientX;
        pan(deltaX);
    }, [pan]);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
        commitDomain();
    }, [commitDomain]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.stopPropagation();
        zoom(e.deltaY > 0 ? -1 : 1);
        commitDomain();
    }, [zoom, commitDomain]);

    // ============================================================================
    // TOUCH HANDLERS (registered via useEffect for passive control)
    // ============================================================================

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                isDragging.current = true;
                lastX.current = e.touches[0].clientX;
                touchStartY.current = e.touches[0].clientY;
                isHorizontalPan.current = false;
            } else if (e.touches.length === 2) {
                isDragging.current = false;
                lastPinchDist.current = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 1 && isDragging.current) {
                const deltaX = lastX.current - e.touches[0].clientX;
                const deltaY = touchStartY.current - e.touches[0].clientY;

                // Determine gesture direction on first significant move
                if (!isHorizontalPan.current && Math.abs(deltaX) > 10) {
                    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
                        isHorizontalPan.current = true;
                    }
                }

                // Only pan horizontally if confirmed horizontal gesture
                if (isHorizontalPan.current) {
                    e.preventDefault(); // Prevent scroll only for horizontal pan
                    lastX.current = e.touches[0].clientX;
                    pan(deltaX * 2);
                }
                // Let browser handle vertical scroll naturally
            } else if (e.touches.length === 2 && lastPinchDist.current !== null) {
                e.preventDefault(); // Always prevent default for pinch
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = dist - lastPinchDist.current;
                lastPinchDist.current = dist;
                zoom(delta * 0.1);
            }
        };

        const handleTouchEnd = () => {
            isDragging.current = false;
            lastPinchDist.current = null;
            isHorizontalPan.current = false;
            commitDomain();
        };

        // Register with passive: false to allow preventDefault for horizontal pan
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);

            // Cleanup any pending RAF
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [containerRef, pan, zoom, commitDomain]);

    // ============================================================================
    // PUBLIC API
    // ============================================================================

    const resetZoom = useCallback(() => {
        const newDomain = { start: 0, end: Math.max(0, dataLength - 1) };
        domainRef.current = newDomain;
        setZoomDomain(newDomain);
    }, [dataLength]);

    const zoomIn = useCallback(() => {
        zoom(1);
        commitDomain();
    }, [zoom, commitDomain]);

    const zoomOut = useCallback(() => {
        zoom(-1);
        commitDomain();
    }, [zoom, commitDomain]);

    const handlers: ChartGestureHandlers = {
        onMouseDown: handleMouseDown,
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        onMouseLeave: handleMouseUp,
        onWheel: handleWheel,
    };

    return {
        zoomDomain,
        handlers,
        resetZoom,
        zoomIn,
        zoomOut,
    };
}

export default useChartGestures;
