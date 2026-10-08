import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert, AlertDescription } from './alert';

describe('Alert', () => {
  it('When live is not provided, then the alert has the assertive alert role', () => {
    // Arrange & Act
    render(
      <Alert>
        <AlertDescription>Something went wrong</AlertDescription>
      </Alert>,
    );

    // Assert
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('When live is polite, then the alert has the status role instead of alert', () => {
    // Arrange & Act
    render(
      <Alert live="polite">
        <AlertDescription>Just so you know</AlertDescription>
      </Alert>,
    );

    // Assert
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('When the warning variant is used, then warning theme tokens are applied', () => {
    // Arrange & Act
    render(
      <Alert variant="warning" live="polite">
        <AlertDescription>Heads up</AlertDescription>
      </Alert>,
    );

    // Assert
    expect(screen.getByRole('status')).toHaveClass('border-warning/50', 'text-warning');
  });
});
