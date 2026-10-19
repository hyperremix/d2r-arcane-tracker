import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ItemRollQuality } from '@/lib/rollQuality';
import { RollQualityDetails } from './RollQuality';

describe('When RollQualityDetails is rendered', () => {
  describe('If every variable stat is at its max', () => {
    it('Then the perfect roll badge uses the success color', () => {
      // Arrange
      const rollQuality: ItemRollQuality = {
        stats: [],
        percent: 100,
        isPerfect: true,
        unratedCount: 0,
      };

      // Act
      render(<RollQualityDetails rollQuality={rollQuality} />);

      // Assert
      expect(screen.getByText('Perfect roll')).toHaveClass('text-success');
    });

    it('Then it says the roll is perfect and lists each stat with its range', () => {
      // Arrange
      const rollQuality: ItemRollQuality = {
        stats: [
          {
            propertyCode: 'ac%',
            min: 100,
            max: 150,
            value: 150,
            percent: 100,
            description: '+150% Enhanced Defense',
          },
        ],
        percent: 100,
        isPerfect: true,
        unratedCount: 0,
      };

      // Act
      render(<RollQualityDetails rollQuality={rollQuality} />);

      // Assert
      expect(screen.getByRole('heading', { name: 'Roll quality' })).toBeInTheDocument();
      expect(screen.getByText('Perfect roll')).toBeInTheDocument();
      expect(screen.getByRole('listitem')).toHaveTextContent(
        '+150% Enhanced Defense (100 to 150)100%',
      );
    });
  });

  describe('If a stat could not be rated', () => {
    it('Then the overall percent is rounded down and the unrated stat is counted', () => {
      // Arrange
      const rollQuality: ItemRollQuality = {
        stats: [
          { propertyCode: 'str', min: 10, max: 20, value: 19, percent: 90 },
          { propertyCode: 'red-dmg%', min: -20, max: -10, value: -25 },
        ],
        percent: 89.9,
        isPerfect: false,
        unratedCount: 1,
      };

      // Act
      render(<RollQualityDetails rollQuality={rollQuality} />);

      // Assert
      expect(screen.getByText('89%')).toBeInTheDocument();
      const [rated, unrated] = screen.getAllByRole('listitem');
      expect(rated).toHaveTextContent('Variable stat (10 to 20)90%');
      expect(unrated).toHaveTextContent('Variable stat (-20 to -10)Not rated');
      expect(screen.getByText("1 variable stat couldn't be rated.")).toBeInTheDocument();
    });
  });
});
