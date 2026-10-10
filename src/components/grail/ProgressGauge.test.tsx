import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressGauge } from './ProgressGauge';

describe('ProgressGauge', () => {
  it('When rendered with the default tone, Then the ratio and label use theme muted text', () => {
    // Arrange
    const props = { label: 'Overall', current: 4, total: 10, showLabel: true };

    // Act
    render(<ProgressGauge {...props} />);

    // Assert
    expect(screen.getByText('4/10').className).toContain('text-muted-foreground');
    expect(screen.getByText('Overall', { selector: 'div' }).className).toContain(
      'text-muted-foreground',
    );
  });

  it('If the overlay tone is used, Then the percentage, ratio and label use light text', () => {
    // Arrange
    const props = { label: 'Overall', current: 4, total: 10, showLabel: true };

    // Act
    render(<ProgressGauge {...props} tone="overlay" />);

    // Assert
    expect(screen.getByText('4/10').className).toContain('text-white/85');
    expect(screen.getByText('4/10').className).not.toContain('text-muted-foreground');
    expect(screen.getByText('Overall', { selector: 'div' }).className).toContain('text-white/85');
    expect(screen.getByText('40.0%').className).toContain('text-white');
  });

  it('When rendered, Then the progress stroke dasharray reflects the value', () => {
    // Arrange
    const props = { label: 'Overall', current: 4, total: 10 };

    // Act
    const { container } = render(<ProgressGauge {...props} />);
    const fill = container.querySelector('circle.text-ethereal');

    // Assert
    expect(fill?.getAttribute('stroke-dasharray')).toBe('30 100');
  });

  it('If rendered, Then the transition and starting-style classes are gated by motion-safe', () => {
    // Arrange
    const props = { label: 'Overall', current: 4, total: 10 };

    // Act
    const { container } = render(<ProgressGauge {...props} />);
    const fill = container.querySelector('circle.text-ethereal');
    const animationClasses = fill
      ?.getAttribute('class')
      ?.split(' ')
      .filter((cls) => /transition|duration|ease|starting/.test(cls));

    // Assert
    expect(animationClasses).toEqual([
      'motion-safe:transition-[stroke-dasharray]',
      'motion-safe:duration-1500',
      'motion-safe:ease-in-out',
      'motion-safe:starting:[stroke-dasharray:0_100]',
    ]);
  });
});
