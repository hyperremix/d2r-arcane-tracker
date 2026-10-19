import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';

describe('When Badge is rendered', () => {
  it('If the variant is success, Then it uses the success color instead of the accent', () => {
    // Arrange
    const label = 'Active';

    // Act
    render(<Badge variant="success">{label}</Badge>);

    // Assert
    const badge = screen.getByText(label);
    expect(badge).toHaveClass('bg-success/15', 'text-success');
    expect(badge.className).not.toMatch(/\b(?:bg|text)-primary\b/);
  });

  it('If the variant is link, Then it uses the shared link style instead of the accent', () => {
    // Arrange
    const label = 'Details';

    // Act
    render(<Badge variant="link">{label}</Badge>);

    // Assert
    const badge = screen.getByText(label);
    expect(badge).toHaveClass(
      'text-foreground',
      'underline',
      'decoration-muted-foreground',
      'underline-offset-4',
      'hover:decoration-foreground',
    );
    expect(badge).not.toHaveClass('text-primary');
  });
});
