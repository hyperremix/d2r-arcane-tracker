import { describe, expect, it } from 'vitest';
import { getItemGridEmptyStateVariant } from './ItemGridEmptyState';

const baseInput = {
  displayItemCount: 0,
  totalItemCount: 5,
  grailNormal: true,
  grailEthereal: false,
  hasActiveFilters: false,
  loading: false,
};

describe('When getItemGridEmptyStateVariant is called', () => {
  describe('If items are displayed', () => {
    it('Then no empty state is returned', () => {
      // Arrange
      const input = { ...baseInput, displayItemCount: 2 };

      // Act
      const variant = getItemGridEmptyStateVariant(input);

      // Assert
      expect(variant).toBeUndefined();
    });
  });

  describe('If both normal and ethereal tracking are disabled', () => {
    it('Then the trackingDisabled variant is returned', () => {
      // Arrange
      const input = { ...baseInput, grailNormal: false, grailEthereal: false };

      // Act
      const variant = getItemGridEmptyStateVariant(input);

      // Assert
      expect(variant).toBe('trackingDisabled');
    });
  });

  describe('If no items are loaded', () => {
    it.each([
      [true, 'loading'],
      [false, 'noItems'],
    ])('Then with loading=%s the %s variant is returned', (loading, expected) => {
      // Arrange
      const input = { ...baseInput, totalItemCount: 0, loading };

      // Act
      const variant = getItemGridEmptyStateVariant(input);

      // Assert
      expect(variant).toBe(expected);
    });
  });

  describe('If items are loaded and active filters match none of them', () => {
    it('Then the noMatches variant is returned', () => {
      // Arrange
      const input = { ...baseInput, hasActiveFilters: true };

      // Act
      const variant = getItemGridEmptyStateVariant(input);

      // Assert
      expect(variant).toBe('noMatches');
    });
  });

  describe('If items are loaded, no filters are active, but tracking settings hide every item', () => {
    it('Then the hiddenBySettings variant is returned instead of claiming there are no items', () => {
      // Arrange
      const input = { ...baseInput, hasActiveFilters: false, totalItemCount: 5 };

      // Act
      const variant = getItemGridEmptyStateVariant(input);

      // Assert
      expect(variant).toBe('hiddenBySettings');
    });
  });
});
