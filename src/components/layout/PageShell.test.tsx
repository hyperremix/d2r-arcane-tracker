import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { PageShell } from './PageShell';

describe('When PageShell is rendered', () => {
  it('Then it is a single flex-filling vertical scroll container with padded content', () => {
    // Arrange & Act
    render(
      <PageShell data-testid="shell">
        <p>content</p>
      </PageShell>,
    );

    // Assert
    const shell = screen.getByTestId('shell');
    expect(shell).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(screen.getByText('content').parentElement).toHaveClass('space-y-6', 'p-6');
  });

  it('If padding is disabled, Then the children are rendered directly in the scroll container', () => {
    // Arrange & Act
    render(
      <PageShell data-testid="shell" padded={false}>
        <p>content</p>
      </PageShell>,
    );

    // Assert
    expect(screen.getByText('content').parentElement).toBe(screen.getByTestId('shell'));
  });

  it('If a ref is given, Then it points to the scroll container', () => {
    // Arrange
    const ref = createRef<HTMLDivElement>();

    // Act
    render(
      <PageShell ref={ref} data-testid="shell">
        <p>content</p>
      </PageShell>,
    );

    // Assert
    expect(ref.current).toBe(screen.getByTestId('shell'));
  });
});
