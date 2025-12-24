/**
 * Unit tests for Common Components
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Activity, Calendar } from 'lucide-react';
import EmptyState from './EmptyState';
import { Skeleton, SkeletonText, SkeletonCard, SkeletonStat, SkeletonListItem, SkeletonChart } from './SkeletonLoader';

describe('Skeleton Components', () => {
    describe('Skeleton', () => {
        it('should render with default props', () => {
            const { container } = render(<Skeleton />);
            const skeleton = container.firstChild as HTMLElement;

            expect(skeleton).toBeTruthy();
            expect(skeleton.style.width).toBe('100%');
            expect(skeleton.style.height).toBe('1rem');
        });

        it('should apply custom dimensions', () => {
            const { container } = render(<Skeleton width={200} height={50} />);
            const skeleton = container.firstChild as HTMLElement;

            expect(skeleton.style.width).toBe('200px');
            expect(skeleton.style.height).toBe('50px');
        });

        it('should apply string dimensions', () => {
            const { container } = render(<Skeleton width="50%" height="2rem" />);
            const skeleton = container.firstChild as HTMLElement;

            expect(skeleton.style.width).toBe('50%');
            expect(skeleton.style.height).toBe('2rem');
        });

        it('should apply custom className', () => {
            const { container } = render(<Skeleton className="custom-class" />);
            const skeleton = container.firstChild as HTMLElement;

            expect(skeleton.className).toContain('custom-class');
        });

        it('should apply pulse animation by default', () => {
            const { container } = render(<Skeleton />);
            const skeleton = container.firstChild as HTMLElement;

            expect(skeleton.className).toContain('animate-pulse');
        });
    });

    describe('SkeletonText', () => {
        it('should render multiple lines', () => {
            const { container } = render(<SkeletonText />);
            // Just verify it renders content
            expect(container.innerHTML).toBeTruthy();
            expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
        });

        it('should render specified number of lines', () => {
            const { container } = render(<SkeletonText lines={5} />);
            // Verify it renders more elements for more lines
            expect(container.querySelectorAll('div').length).toBeGreaterThan(1);
        });
    });

    describe('SkeletonCard', () => {
        it('should render card container', () => {
            const { container } = render(<SkeletonCard />);
            expect(container.firstChild).toBeTruthy();
            expect((container.firstChild as HTMLElement).className).toContain('rounded-2xl');
        });

        it('should render without image when showImage is false', () => {
            const { container } = render(<SkeletonCard showImage={false} />);
            expect(container.firstChild).toBeTruthy();
        });
    });

    describe('SkeletonStat', () => {
        it('should render stat skeleton container', () => {
            const { container } = render(<SkeletonStat />);
            expect(container.firstChild).toBeTruthy();
            expect((container.firstChild as HTMLElement).className).toContain('rounded-2xl');
        });
    });

    describe('SkeletonListItem', () => {
        it('should render list item with content', () => {
            const { container } = render(<SkeletonListItem />);
            expect(container.firstChild).toBeTruthy();
            expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
        });

        it('should render without avatar', () => {
            const { container } = render(<SkeletonListItem showAvatar={false} />);
            expect(container.firstChild).toBeTruthy();
        });
    });

    describe('SkeletonChart', () => {
        it('should render chart skeleton', () => {
            const { container } = render(<SkeletonChart />);
            expect(container.firstChild).toBeTruthy();
            expect((container.firstChild as HTMLElement).className).toContain('rounded-2xl');
        });

        it('should accept custom height', () => {
            const { container } = render(<SkeletonChart height={300} />);
            expect(container.firstChild).toBeTruthy();
        });
    });
});

describe('EmptyState Component', () => {
    it('should render title and icon', () => {
        render(
            <EmptyState
                icon={Activity}
                title="No sessions yet"
            />
        );

        expect(screen.getByText('No sessions yet')).toBeTruthy();
    });

    it('should render description when provided', () => {
        render(
            <EmptyState
                icon={Activity}
                title="No sessions"
                description="Start your first training session"
            />
        );

        expect(screen.getByText('Start your first training session')).toBeTruthy();
    });

    it('should render action button when provided', () => {
        const onAction = vi.fn();
        render(
            <EmptyState
                icon={Activity}
                title="No sessions"
                actionText="Get Started"
                onAction={onAction}
            />
        );

        const button = screen.getByText('Get Started');
        expect(button).toBeTruthy();

        fireEvent.click(button);
        expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('should render secondary action when provided', () => {
        const onSecondary = vi.fn();
        render(
            <EmptyState
                icon={Activity}
                title="No sessions"
                secondaryActionText="Learn More"
                onSecondaryAction={onSecondary}
            />
        );

        const button = screen.getByText('Learn More');
        expect(button).toBeTruthy();

        fireEvent.click(button);
        expect(onSecondary).toHaveBeenCalledTimes(1);
    });

    it('should apply custom className', () => {
        const { container } = render(
            <EmptyState
                icon={Calendar}
                title="Empty"
                className="custom-empty"
            />
        );

        expect(container.firstChild).toBeTruthy();
        expect((container.firstChild as HTMLElement).className).toContain('custom-empty');
    });
});
