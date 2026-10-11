import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WelcomeStep } from './WelcomeStep';

describe('When WelcomeStep is rendered', () => {
  it('Then the welcome heading keeps the display serif as the brand moment', () => {
    // Arrange & Act
    render(<WelcomeStep />);

    // Assert
    expect(screen.getByRole('heading', { level: 2 })).toHaveClass('font-display');
  });
});
