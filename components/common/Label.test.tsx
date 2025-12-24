/**
 * Unit tests for Label component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Label from './Label';

describe('Label Component', () => {
    it('should render children', () => {
        render(<Label>Username</Label>);
        expect(screen.getByText('Username')).toBeTruthy();
    });

    it('should apply default variant styles', () => {
        const { container } = render(<Label>Default</Label>);
        const label = container.querySelector('label') as HTMLElement;
        expect(label.className).toContain('uppercase');
        expect(label.className).toContain('tracking-widest');
    });

    it('should apply subtle variant', () => {
        const { container } = render(<Label variant="subtle">Subtle</Label>);
        const label = container.querySelector('label') as HTMLElement;
        expect(label.className).toContain('text-xs');
        expect(label.className).toContain('font-medium');
    });

    it('should apply strong variant', () => {
        const { container } = render(<Label variant="strong">Strong</Label>);
        const label = container.querySelector('label') as HTMLElement;
        expect(label.className).toContain('text-sm');
        expect(label.className).toContain('font-semibold');
    });

    it('should show required indicator', () => {
        render(<Label required>Required Field</Label>);
        expect(screen.getByText('*')).toBeTruthy();
    });

    it('should not show required indicator when false', () => {
        render(<Label required={false}>Optional</Label>);
        expect(screen.queryByText('*')).toBeNull();
    });

    it('should show helper text', () => {
        render(<Label helperText="Enter your username">Username</Label>);
        expect(screen.getByText('Enter your username')).toBeTruthy();
    });

    it('should show error message when error is true', () => {
        render(
            <Label error errorMessage="This field is required">
                Email
            </Label>
        );
        expect(screen.getByText('This field is required')).toBeTruthy();
    });

    it('should hide helper text when error is shown', () => {
        render(
            <Label helperText="Helper" error errorMessage="Error">
                Field
            </Label>
        );
        expect(screen.queryByText('Helper')).toBeNull();
        expect(screen.getByText('Error')).toBeTruthy();
    });

    it('should apply custom className', () => {
        const { container } = render(<Label className="custom-class">Label</Label>);
        const label = container.querySelector('label') as HTMLElement;
        expect(label.className).toContain('custom-class');
    });

    it('should pass through native label props', () => {
        render(<Label htmlFor="test-input">For Input</Label>);
        const label = screen.getByText('For Input');
        expect(label.getAttribute('for')).toBe('test-input');
    });
});
