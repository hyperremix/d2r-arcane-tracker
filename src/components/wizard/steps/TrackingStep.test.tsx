import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrackingStep } from './TrackingStep';

describe('TrackingStep', () => {
  it('When rendered, Then it combines game mode, grail contents and game version under one heading', () => {
    // Arrange & Act
    render(<TrackingStep />);

    // Assert
    expect(screen.getByRole('heading', { level: 2, name: 'What to Track' })).toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(3);
    expect(screen.getByRole('region', { name: 'Game Mode' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Holy Grail Configuration' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Game Version' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
  });
});
