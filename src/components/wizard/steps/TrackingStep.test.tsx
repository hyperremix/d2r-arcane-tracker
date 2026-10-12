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
    expect(screen.getByRole('region', { name: 'Game mode' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Holy Grail configuration' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Game version' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
  });
});
