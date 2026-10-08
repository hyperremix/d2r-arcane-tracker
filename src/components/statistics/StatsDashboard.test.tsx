import { render, screen } from '@testing-library/react';
import type { ItemCategory } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { StatsDashboard } from './StatsDashboard';

vi.mock('@/stores/grailStore', () => ({
  useGrailStatistics: vi.fn(),
  useGrailStore: vi.fn(),
}));
vi.mock('@/hooks/useProgressLookup', () => ({
  useProgressLookup: () => new Map(),
}));
vi.mock('@/components/grail/ItemCard', () => ({
  ItemCard: () => <div data-testid="item-card" />,
}));

function setupStatistics(categories: ItemCategory[]) {
  vi.mocked(useGrailStore).mockReturnValue({
    items: [],
    progress: [],
    characters: [],
    settings: {},
  } as unknown as ReturnType<typeof useGrailStore>);
  vi.mocked(useGrailStatistics).mockReturnValue({
    totalItems: 10,
    foundItems: 5,
    completionPercentage: 50,
    recentFinds: 0,
    currentStreak: 0,
    maxStreak: 0,
    averageItemsPerDay: 0,
    lastFind: undefined,
    categoryStats: categories.map((category) => ({
      category,
      total: 4,
      found: 2,
      percentage: 50,
      recent: 0,
    })),
    characterStats: [],
  } as unknown as ReturnType<typeof useGrailStatistics>);
}

describe('When StatsDashboard shows the category breakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('If categories are returned as raw enum values', () => {
    it('Then each category name and progress label uses the translated category', () => {
      // Arrange
      setupStatistics(['weapons', 'armor', 'runewords']);

      // Act
      render(<StatsDashboard />);

      // Assert
      for (const label of ['Weapons', 'Armor', 'Runewords']) {
        expect(screen.getByText(label)).toBeInTheDocument();
        expect(screen.getByText(`${label} progress`)).toBeInTheDocument();
      }
      expect(screen.queryByText('weapons')).not.toBeInTheDocument();
      expect(screen.queryByText('weapons progress')).not.toBeInTheDocument();
    });
  });
});
