import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardTitle } from './card';

describe('When CardTitle is rendered', () => {
  it('If no className is given, Then it uses the semibold Inter heading style without the display serif', () => {
    // Arrange & Act
    render(<CardTitle>Heading</CardTitle>);

    // Assert
    const title = screen.getByText('Heading');
    expect(title).toHaveClass('font-semibold', 'text-base');
    expect(title).not.toHaveClass('font-display', 'tracking-wide');
  });

  it('If a size className is given, Then it overrides the default size', () => {
    // Arrange & Act
    render(<CardTitle className="text-lg">Heading</CardTitle>);

    // Assert
    const title = screen.getByText('Heading');
    expect(title).toHaveClass('text-lg', 'font-semibold');
    expect(title).not.toHaveClass('text-base');
  });
});
