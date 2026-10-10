import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrackingStep } from './TrackingStep';

describe('TrackingStep', () => {
  it('When rendered, Then it combines game mode, grail contents and game version without repeating the step title', () => {
    // Arrange & Act
    render(<TrackingStep />);

    // Assert
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(3);
    expect(screen.getByRole('region', { name: 'Game Mode' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Holy Grail Configuration' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Game Version' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
  });
});
