import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecentDiscoveryIndicator } from './StatusIcons';

describe('When RecentDiscoveryIndicator is rendered', () => {
  describe('If the find is recent', () => {
    it('Then it shows a neutral "New" badge that uses no item-quality color', () => {
      // Arrange
      const foundDate = new Date();

      // Act
      render(<RecentDiscoveryIndicator foundDate={foundDate} />);

      // Assert
      const badge = screen.getByText('New');
      expect(badge).toHaveClass('bg-foreground', 'text-background');
      expect(badge.className).not.toMatch(/item-/);
    });

    it('Then the badge is not a focusable button inside an interactive card', () => {
      // Arrange
      const foundDate = new Date();

      // Act
      render(<RecentDiscoveryIndicator foundDate={foundDate} focusableTriggers={false} />);

      // Assert
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });

  describe('If the find is older than 7 days', () => {
    it('Then it renders nothing', () => {
      // Arrange
      const foundDate = new Date('2020-01-01');

      // Act
      const { container } = render(<RecentDiscoveryIndicator foundDate={foundDate} />);

      // Assert
      expect(container).toBeEmptyDOMElement();
    });
  });
});
