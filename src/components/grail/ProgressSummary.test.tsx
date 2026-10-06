import { render, screen } from '@testing-library/react';
import type { GrailStatistics } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import { ProgressSummary } from './ProgressSummary';

const statistics: GrailStatistics = {
  totalItems: 975,
  foundItems: 190,
  completionPercentage: 19.5,
  recentFinds: 0,
  normalItems: { total: 628, found: 184 },
  etherealItems: { total: 347, found: 6 },
  currentStreak: 0,
  maxStreak: 0,
};

describe('When ProgressSummary is rendered', () => {
  describe('If ethereal tracking is disabled', () => {
    it('Then shows only the total progress with percentage and found/total', () => {
      // Arrange & Act
      render(<ProgressSummary statistics={statistics} showEtherealBreakdown={false} />);

      // Assert
      expect(screen.getByRole('progressbar', { name: 'Total Progress' })).toBeInTheDocument();
      expect(screen.getByText('19.5%')).toBeInTheDocument();
      expect(screen.getByText('190 of 975 found')).toBeInTheDocument();
      expect(screen.getAllByRole('progressbar')).toHaveLength(1);
      expect(screen.queryByText('Normal Items')).not.toBeInTheDocument();
      expect(screen.queryByText('Ethereal Items')).not.toBeInTheDocument();
    });
  });

  describe('If ethereal tracking is enabled', () => {
    it('Then splits the bar into a normal and an ethereal lane while keeping the total', () => {
      // Arrange & Act
      render(<ProgressSummary statistics={statistics} showEtherealBreakdown />);

      // Assert
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(2);
      expect(screen.getByRole('progressbar', { name: 'Normal Items' })).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: 'Ethereal Items' })).toBeInTheDocument();
      expect(screen.getByText('184/628')).toBeInTheDocument();
      expect(screen.getByText('6/347')).toBeInTheDocument();
      expect(screen.getByText('19.5%')).toBeInTheDocument();
      expect(screen.getByText('190 of 975 found')).toBeInTheDocument();
    });

    it('Then sizes each lane by its share of the grail', () => {
      // Arrange & Act
      render(<ProgressSummary statistics={statistics} showEtherealBreakdown />);

      // Assert
      expect(screen.getByRole('progressbar', { name: 'Normal Items' })).toHaveStyle({
        flexGrow: '628',
      });
      expect(screen.getByRole('progressbar', { name: 'Ethereal Items' })).toHaveStyle({
        flexGrow: '347',
      });
    });
  });

  describe('If ethereal tracking is enabled but there are no ethereal items', () => {
    it('Then shows a single total bar instead of lanes', () => {
      // Arrange
      const noEtherealStatistics: GrailStatistics = {
        ...statistics,
        etherealItems: { total: 0, found: 0 },
      };

      // Act
      render(<ProgressSummary statistics={noEtherealStatistics} showEtherealBreakdown />);

      // Assert
      expect(screen.getAllByRole('progressbar')).toHaveLength(1);
      expect(screen.getByRole('progressbar', { name: 'Total Progress' })).toBeInTheDocument();
    });
  });

  describe('If there are no items to track', () => {
    it('Then shows 0% instead of dividing by zero', () => {
      // Arrange
      const emptyStatistics: GrailStatistics = { ...statistics, totalItems: 0, foundItems: 0 };

      // Act
      render(<ProgressSummary statistics={emptyStatistics} showEtherealBreakdown={false} />);

      // Assert
      expect(screen.getByText('0.0%')).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: 'Total Progress' })).toBeInTheDocument();
    });
  });
});
