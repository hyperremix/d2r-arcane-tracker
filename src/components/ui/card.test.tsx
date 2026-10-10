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
});
