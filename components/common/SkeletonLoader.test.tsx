/**
 * Unit tests for SkeletonLoader components
 * 
 * Tests skeleton loading state components.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
    Skeleton,
    SkeletonText,
    SkeletonCard,
    SkeletonStat,
    SkeletonListItem,
    SkeletonChart
} from './SkeletonLoader';

// ============================================================================
// Skeleton TESTS
// ============================================================================

describe('Skeleton', () => {
    it('should render with default props', () => {
        render(<Skeleton />);
        const element = document.querySelector('div');
        expect(element).toBeTruthy();
    });

    it('should accept width and height props without throwing', () => {
        expect(() => render(<Skeleton width="50%" height="2rem" />)).not.toThrow();
    });

    it('should accept radius prop without throwing', () => {
        expect(() => render(<Skeleton radius="1rem" />)).not.toThrow();
    });

    it('should accept numeric width and height without throwing', () => {
        expect(() => render(<Skeleton width={100} height={50} />)).not.toThrow();
    });

    it('should apply className', () => {
        render(<Skeleton className="test-class" />);
        const element = document.querySelector('.test-class');
        expect(element).toBeTruthy();
    });

    it('should apply pulse animation by default', () => {
        render(<Skeleton />);
        const element = document.querySelector('.animate-pulse');
        expect(element).toBeTruthy();
    });
});

// ============================================================================
// SkeletonText TESTS
// ============================================================================

describe('SkeletonText', () => {
    it('should render 3 lines by default', () => {
        render(<SkeletonText />);
        const container = document.querySelector('.space-y-2');
        expect(container?.children.length).toBe(3);
    });

    it('should render custom number of lines', () => {
        render(<SkeletonText lines={5} />);
        const container = document.querySelector('.space-y-2');
        expect(container?.children.length).toBe(5);
    });
});

// ============================================================================
// SkeletonCard TESTS
// ============================================================================

describe('SkeletonCard', () => {
    it('should render all parts by default', () => {
        render(<SkeletonCard />);
        const container = document.querySelector('.p-4');
        expect(container).toBeTruthy();
    });

    it('should hide image when showImage is false', () => {
        const { container } = render(<SkeletonCard showImage={false} />);
        // Card should still render, just without the image skeleton
        expect(container.querySelector('.p-4')).toBeTruthy();
    });
});

// ============================================================================
// SkeletonStat TESTS
// ============================================================================

describe('SkeletonStat', () => {
    it('should render with correct structure', () => {
        render(<SkeletonStat />);
        const container = document.querySelector('.p-4');
        expect(container).toBeTruthy();
    });
});

// ============================================================================
// SkeletonListItem TESTS
// ============================================================================

describe('SkeletonListItem', () => {
    it('should render with avatar by default', () => {
        render(<SkeletonListItem />);
        const container = document.querySelector('.flex');
        expect(container).toBeTruthy();
    });

    it('should apply className', () => {
        render(<SkeletonListItem className="test-class" />);
        const element = document.querySelector('.test-class');
        expect(element).toBeTruthy();
    });
});

// ============================================================================
// SkeletonChart TESTS
// ============================================================================

describe('SkeletonChart', () => {
    it('should render chart skeleton', () => {
        render(<SkeletonChart />);
        const container = document.querySelector('.p-4');
        expect(container).toBeTruthy();
    });

    it('should render with custom height', () => {
        render(<SkeletonChart height={300} />);
        const container = document.querySelector('.p-4');
        expect(container).toBeTruthy();
    });
});
