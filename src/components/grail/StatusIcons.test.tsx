import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecentDiscoveryIndicator } from './StatusIcons';

describe('When RecentDiscoveryIndicator is rendered', () => {
  describe('If it is rendered for a recent find', () => {
    it('Then it shows a neutral "New" badge that uses no item-quality color', () => {
      // Arrange / Act
      render(<RecentDiscoveryIndicator />);

      // Assert
      const badge = screen.getByText('New');
      expect(badge).toHaveClass('bg-foreground', 'text-background');
      expect(badge.className).not.toMatch(/item-/);
    });

    it('Then the badge is not a focusable button inside an interactive card', () => {
      // Arrange / Act
      render(<RecentDiscoveryIndicator focusableTriggers={false} />);

      // Assert
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });
});
