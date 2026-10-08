import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardTitle } from './card';

describe('When CardTitle is rendered', () => {
  it('If no variant is given, Then it uses the Cinzel display heading style', () => {
    // Arrange & Act
    render(<CardTitle>Heading</CardTitle>);

    // Assert
    const title = screen.getByText('Heading');
    expect(title).toHaveClass('font-display', 'font-semibold', 'tracking-wide');
    expect(title).not.toHaveClass('font-ui');
  });

  it('If the label variant is used, Then it uses the small UI font instead of the display font', () => {
    // Arrange & Act
    render(<CardTitle variant="label">Total Sessions</CardTitle>);

    // Assert
    const title = screen.getByText('Total Sessions');
    expect(title).toHaveClass('font-ui', 'font-medium', 'text-sm');
    expect(title).not.toHaveClass('font-display');
    expect(title).not.toHaveClass('tracking-wide');
  });

  it('If a className sets the UI font, Then it replaces the display font', () => {
    // Arrange & Act
    render(<CardTitle className="font-ui">Override</CardTitle>);

    // Assert
    const title = screen.getByText('Override');
    expect(title).toHaveClass('font-ui');
    expect(title).not.toHaveClass('font-display');
  });
});
