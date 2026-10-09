import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorDisplay } from './ErrorDisplay';

describe('When ErrorDisplay is rendered with a retryable error', () => {
  it('Then the dismiss button has an accessible name and dismisses the error', () => {
    // Arrange
    const onDismiss = vi.fn();
    render(
      <ErrorDisplay
        error={{ code: 'endSessionFailed' }}
        errorType="unknown"
        canRetry
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

  it('Then the error code is translated', () => {
    // Arrange & Act
    render(
      <ErrorDisplay
        error={{ code: 'endSessionFailed' }}
        errorType="unknown"
        canRetry
        loading={false}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // Assert
    expect(
      screen.getByText('Failed to end session. Your progress has been saved.', { exact: false }),
    ).toBeInTheDocument();
  });

  it('Then clicking the translated retry button retries the action', () => {
    // Arrange
    const onRetry = vi.fn();
    render(
      <ErrorDisplay
        error={{ code: 'startRunFailed' }}
        errorType="unknown"
        canRetry
        loading={false}
        onRetry={onRetry}
        onDismiss={vi.fn()}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    // Assert
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('If ErrorDisplay is rendered with an error that cannot be retried', () => {
  it('Then no retry button is shown', () => {
    // Arrange & Act
    render(
      <ErrorDisplay
        error={{ code: 'itemNameEmpty' }}
        errorType="validation"
        canRetry={false}
        loading={false}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByText('Item name cannot be empty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});
