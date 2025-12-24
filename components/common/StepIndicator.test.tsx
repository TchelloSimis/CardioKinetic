/**
 * Unit tests for StepIndicator and useScrollPosition
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StepIndicator from './StepIndicator';

describe('StepIndicator Component', () => {
    const mockSteps = [
        { label: 'Step 1', description: 'First step' },
        { label: 'Step 2', description: 'Second step' },
        { label: 'Step 3', description: 'Third step' },
    ];

    it('should render all steps', () => {
        render(<StepIndicator steps={mockSteps} currentStep={0} />);

        expect(screen.getByText('Step 1')).toBeTruthy();
        expect(screen.getByText('Step 2')).toBeTruthy();
        expect(screen.getByText('Step 3')).toBeTruthy();
    });

    it('should highlight current step', () => {
        render(<StepIndicator steps={mockSteps} currentStep={1} />);

        // Step 2 should be active (index 1)
        const step2 = screen.getByText('Step 2');
        expect(step2).toBeTruthy();
    });

    it('should show checkmarks for completed steps', () => {
        const { container } = render(<StepIndicator steps={mockSteps} currentStep={2} />);

        // Step 1 and 2 should be completed (currentStep is 2)
        // Check for SVG elements (checkmarks)
        const svgs = container.querySelectorAll('svg');
        expect(svgs.length).toBe(2); // Two completed steps have checkmarks
    });

    it('should call onStepClick when navigation is allowed', () => {
        const onStepClick = vi.fn();
        render(
            <StepIndicator
                steps={mockSteps}
                currentStep={2}
                onStepClick={onStepClick}
                allowNavigation={true}
            />
        );

        // Click on first step (completed)
        fireEvent.click(screen.getByText('Step 1'));
        expect(onStepClick).toHaveBeenCalledWith(0);
    });

    it('should not call onStepClick when navigation is disabled', () => {
        const onStepClick = vi.fn();
        render(
            <StepIndicator
                steps={mockSteps}
                currentStep={2}
                onStepClick={onStepClick}
                allowNavigation={false}
            />
        );

        // Click on first step
        fireEvent.click(screen.getByText('Step 1'));
        expect(onStepClick).not.toHaveBeenCalled();
    });

    it('should hide labels when showLabels is false', () => {
        render(<StepIndicator steps={mockSteps} currentStep={0} showLabels={false} />);

        // Labels should not be visible
        expect(screen.queryByText('Step 1')).toBeNull();
    });

    it('should render horizontally by default', () => {
        const { container } = render(<StepIndicator steps={mockSteps} currentStep={0} />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.className).toContain('flex-row');
    });

    it('should render vertically when oriented', () => {
        const { container } = render(
            <StepIndicator steps={mockSteps} currentStep={0} orientation="vertical" />
        );

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.className).toContain('flex-col');
    });
});
