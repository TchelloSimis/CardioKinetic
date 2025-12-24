/**
 * Unit tests for Typography components
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Heading, Text, typographyClasses } from './Typography';

describe('Typography Components', () => {
    describe('Heading', () => {
        it('should render as h2 by default', () => {
            render(<Heading>My Heading</Heading>);
            const heading = screen.getByText('My Heading');
            expect(heading.tagName).toBe('H2');
        });

        it('should render correct heading level', () => {
            render(<Heading level={1}>H1 Heading</Heading>);
            expect(screen.getByText('H1 Heading').tagName).toBe('H1');

            render(<Heading level={3}>H3 Heading</Heading>);
            expect(screen.getByText('H3 Heading').tagName).toBe('H3');
        });

        it('should apply level-based styles', () => {
            const { container } = render(<Heading level={1}>Large</Heading>);
            const heading = container.querySelector('h1') as HTMLElement;
            expect(heading.className).toContain('text-3xl');
            expect(heading.className).toContain('font-bold');
        });

        it('should allow size override', () => {
            const { container } = render(<Heading level={3} size="2xl">Override</Heading>);
            const heading = container.querySelector('h3') as HTMLElement;
            expect(heading.className).toContain('text-2xl');
        });

        it('should apply custom className', () => {
            const { container } = render(<Heading className="custom-heading">Custom</Heading>);
            const heading = container.querySelector('h2') as HTMLElement;
            expect(heading.className).toContain('custom-heading');
        });
    });

    describe('Text', () => {
        it('should render as paragraph', () => {
            render(<Text>Paragraph text</Text>);
            const text = screen.getByText('Paragraph text');
            expect(text.tagName).toBe('P');
        });

        it('should apply body variant by default', () => {
            const { container } = render(<Text>Body text</Text>);
            const text = container.querySelector('p') as HTMLElement;
            expect(text.className).toContain('text-base');
        });

        it('should apply small variant', () => {
            const { container } = render(<Text variant="small">Small</Text>);
            const text = container.querySelector('p') as HTMLElement;
            expect(text.className).toContain('text-sm');
        });

        it('should apply caption variant', () => {
            const { container } = render(<Text variant="caption">Caption</Text>);
            const text = container.querySelector('p') as HTMLElement;
            expect(text.className).toContain('text-xs');
        });

        it('should apply overline variant', () => {
            const { container } = render(<Text variant="overline">Overline</Text>);
            const text = container.querySelector('p') as HTMLElement;
            expect(text.className).toContain('uppercase');
            expect(text.className).toContain('tracking-widest');
        });

        it('should apply muted color', () => {
            const { container } = render(<Text muted>Muted</Text>);
            const text = container.querySelector('p') as HTMLElement;
            expect(text.className).toContain('text-neutral-500');
        });

        it('should apply text alignment', () => {
            const { container: left } = render(<Text align="left">Left</Text>);
            const { container: center } = render(<Text align="center">Center</Text>);
            const { container: right } = render(<Text align="right">Right</Text>);

            expect((left.querySelector('p') as HTMLElement).className).toContain('text-left');
            expect((center.querySelector('p') as HTMLElement).className).toContain('text-center');
            expect((right.querySelector('p') as HTMLElement).className).toContain('text-right');
        });
    });

    describe('typographyClasses', () => {
        it('should have heading classes', () => {
            expect(typographyClasses.h1).toContain('text-3xl');
            expect(typographyClasses.h2).toContain('text-2xl');
            expect(typographyClasses.h3).toContain('text-xl');
        });

        it('should have body classes', () => {
            expect(typographyClasses.body).toContain('text-base');
            expect(typographyClasses.bodyMuted).toContain('text-neutral-500');
        });

        it('should have overline class', () => {
            expect(typographyClasses.overline).toContain('uppercase');
            expect(typographyClasses.overline).toContain('tracking-widest');
        });
    });
});
