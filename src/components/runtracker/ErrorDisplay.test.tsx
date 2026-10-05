import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorDisplay } from './ErrorDisplay';

describe('When ErrorDisplay is rendered with a network error', () => {
  it('Then the dismiss button has an accessible name and dismisses the error', () => {
    // Arrange
    const onDismiss = vi.fn();
    render(
      <ErrorDisplay
        error="Connection lost"
        errorType="network"
        retryCount={0}
        loading={false}
        onRetry={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }));

    // Assert
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Then the retry button and attempt counter are translated', () => {
    // Arrange & Act
    render(
      <ErrorDisplay
        error="Connection lost"
        errorType="network"
        retryCount={2}
        loading={false}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByText('(Attempt 2/3)')).toBeInTheDocument();
  });
});
