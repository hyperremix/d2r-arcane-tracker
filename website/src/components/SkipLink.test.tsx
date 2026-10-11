import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkipLink } from './SkipLink';

describe('When the skip link is rendered', () => {
  it('Then it links to the main content of the page', () => {
    // Arrange / Act
    render(<SkipLink />);

    // Assert
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
  });
});
