import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ProgressGauge } from './ProgressGauge';

describe('ProgressGauge', () => {
  beforeAll(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
        takeRecords = vi.fn(() => []);
      },
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

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
});
