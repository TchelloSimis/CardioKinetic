/**
 * Unit tests for Button component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';

describe('Button Component', () => {
    it('should render children', () => {
        render(<Button>Click me</Button>);
        expect(screen.getByText('Click me')).toBeTruthy();
    });

    it('should apply primary variant by default', () => {
        const { container } = render(<Button>Primary</Button>);
        const button = container.firstChild as HTMLElement;
        expect(button.className).toContain('text-white');
    });

    it('should apply secondary variant', () => {
        const { container } = render(<Button variant="secondary">Secondary</Button>);
        const button = container.firstChild as HTMLElement;
        expect(button.className).toContain('bg-neutral-100');
    });

    it('should apply ghost variant', () => {
        const { container } = render(<Button variant="ghost">Ghost</Button>);
        const button = container.firstChild as HTMLElement;
        expect(button.className).toContain('bg-transparent');
    });

    it('should apply danger variant', () => {
        const { container } = render(<Button variant="danger">Danger</Button>);
        const button = container.firstChild as HTMLElement;
        expect(button.className).toContain('bg-red-500');
    });

    it('should apply success variant', () => {
        const { container } = render(<Button variant="success">Success</Button>);
        const button = container.firstChild as HTMLElement;
        expect(button.className).toContain('bg-emerald-500');
    });

    it('should apply size classes', () => {
        const { container: sm } = render(<Button size="sm">Small</Button>);
        const { container: lg } = render(<Button size="lg">Large</Button>);

        expect((sm.firstChild as HTMLElement).className).toContain('min-h-[32px]');
        expect((lg.firstChild as HTMLElement).className).toContain('min-h-[52px]');
    });

    it('should apply fullWidth', () => {
        const { container } = render(<Button fullWidth>Full</Button>);
        const button = container.firstChild as HTMLElement;
        expect(button.className).toContain('w-full');
    });

    it('should show loading spinner', () => {
        const { container } = render(<Button loading>Loading</Button>);
        const svg = container.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should be disabled when loading', () => {
        render(<Button loading>Loading</Button>);
        const button = screen.getByRole('button');
        expect(button.hasAttribute('disabled')).toBe(true);
    });

    it('should handle click events', () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Click</Button>);

        fireEvent.click(screen.getByText('Click'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not fire click when disabled', () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick} disabled>Disabled</Button>);

        fireEvent.click(screen.getByText('Disabled'));
        expect(onClick).not.toHaveBeenCalled();
    });

    it('should render left icon', () => {
        const icon = <span data-testid="left-icon">←</span>;
        render(<Button leftIcon={icon}>Text</Button>);
        expect(screen.getByTestId('left-icon')).toBeTruthy();
    });

    it('should render right icon', () => {
        const icon = <span data-testid="right-icon">→</span>;
        render(<Button rightIcon={icon}>Text</Button>);
        expect(screen.getByTestId('right-icon')).toBeTruthy();
    });
});
