import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { GrailStatistics, Item, Settings } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GrailProgressBuilder } from '@/fixtures/GrailProgressBuilder';
import { HolyGrailItemBuilder } from '@/fixtures/HolyGrailItemBuilder';
import { useGrailStore } from '@/stores/grailStore';
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

const ledgerItems: Item[] = [
  HolyGrailItemBuilder.new()
    .withId('shako')
    .withType('unique')
    .withEtherealType('optional')
    .build(),
  HolyGrailItemBuilder.new().withId('soj').withType('unique').withEtherealType('none').build(),
  HolyGrailItemBuilder.new().withId('griffon').withType('unique').withEtherealType('none').build(),
  HolyGrailItemBuilder.new().withId('tal-armor').withType('set').withEtherealType('none').build(),
  HolyGrailItemBuilder.new().withId('ber').withType('rune').withEtherealType('none').build(),
  HolyGrailItemBuilder.new().withId('enigma').withType('runeword').withEtherealType('none').build(),
];

const shakoFind = GrailProgressBuilder.new()
  .withId('p1')
  .withItemId('shako')
  .withFoundDate(new Date(2024, 0, 1))
  .asNormal()
  .build();

const initialStoreState = useGrailStore.getInitialState();

function resetStore(settings: Partial<Settings> = {}) {
  useGrailStore.setState(
    {
      ...initialStoreState,
      filter: { foundStatus: 'all' },
      settings: {
        ...initialStoreState.settings,
        grailNormal: true,
        grailEthereal: false,
        grailRunes: false,
        grailRunewords: false,
        ...settings,
      },
    },
    true,
  );
}

function getLedger() {
  return screen.getByRole('group', { name: 'Filter by item type' });
}

function getFill(segment: HTMLElement) {
  return segment.querySelector<HTMLElement>('[data-slot="ledger-fill"]');
}

describe('When ProgressSummary is rendered', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  describe('If ethereal tracking is disabled', () => {
    it('Then shows the overall percentage and found count without a normal/ethereal split', () => {
      // Arrange & Act
      render(<ProgressSummary statistics={statistics} showEtherealBreakdown={false} />);

      // Assert
      expect(screen.getByRole('region', { name: 'Grail progress' })).toBeInTheDocument();
      expect(screen.getByText('19.5%')).toBeInTheDocument();
      expect(screen.getByText('190 of 975 found')).toBeInTheDocument();
      expect(screen.queryByText('Normal items')).not.toBeInTheDocument();
      expect(screen.queryByText('Ethereal items')).not.toBeInTheDocument();
    });
  });

  describe('If runes and runewords are not tracked', () => {
    it('Then the ledger has a segment for uniques and sets only', () => {
      // Arrange
      useGrailStore.setState({ items: ledgerItems.slice(0, 4), progress: [shakoFind] });

      // Act
      render(<ProgressSummary statistics={statistics} showEtherealBreakdown={false} />);

      // Assert
      const segments = within(getLedger()).getAllByRole('button');
      expect(segments.map((segment) => segment.textContent)).toEqual([
        'Unique 1/3 Found',
        'Set 0/1 Found',
      ]);
    });
  });

  describe('If runes and runewords are tracked', () => {
    beforeEach(() => {
      resetStore({ grailRunes: true, grailRunewords: true });
      useGrailStore.setState({ items: ledgerItems, progress: [shakoFind] });
    });

    it('Then shows a segment per type in quality order whose name starts with its visible text', () => {
      // Arrange & Act
      render(<ProgressSummary statistics={statistics} showEtherealBreakdown={false} />);

      // Assert
      const ledger = getLedger();
      const unique = within(ledger).getByRole('button', { name: /^Unique 1\/3/ });
      expect(unique).toHaveAccessibleName(/^Unique 1\/3\s?Found$/);
      expect(unique).toHaveAttribute('aria-pressed', 'false');
      expect(
        within(ledger)
          .getAllByRole('button')
          .map((b) => b.textContent),
      ).toEqual(['Unique 1/3 Found', 'Set 0/1 Found', 'Rune 0/1 Found', 'Runeword 0/1 Found']);
    });

    it('Then gives every segment the same width and fills it to its found share', () => {
      // Arrange & Act
      render(<ProgressSummary statistics={statistics} showEtherealBreakdown={false} />);

      // Assert
      const unique = screen.getByRole('button', { name: /^Unique/ });
      const set = screen.getByRole('button', { name: /^Set/ });
      for (const segment of within(getLedger()).getAllByRole('button')) {
        // Equal flex share regardless of how many items the type has
        expect(segment).toHaveClass('flex-1', 'basis-0', 'min-w-fit');
        expect(segment.style.flexGrow).toBe('');
      }
      expect(getFill(unique)?.style.width).toBe(`${(1 / 3) * 100}%`);
      expect(getFill(set)?.style.width).toBe('0%');
    });

    it('Then clicking a segment toggles its type filter and marks it as pressed', () => {
      // Arrange
      render(<ProgressSummary statistics={statistics} showEtherealBreakdown={false} />);
      const set = screen.getByRole('button', { name: /^Set/ });

      // Act
      fireEvent.click(set);

      // Assert
      expect(useGrailStore.getState().filter.types).toEqual(['set']);
      expect(set).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /^Unique/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it('Then clicking a pressed segment removes its type from the filter again', () => {
      // Arrange
      useGrailStore.getState().setFilter({ types: ['set', 'rune'] });
      render(<ProgressSummary statistics={statistics} showEtherealBreakdown={false} />);
      const set = screen.getByRole('button', { name: /^Set/ });

      // Act
      fireEvent.click(set);

      // Assert
      expect(useGrailStore.getState().filter.types).toEqual(['rune']);
      expect(set).toHaveAttribute('aria-pressed', 'false');
    });

    it('Then the segments are native buttons, which browsers activate with Enter and Space', () => {
      // Arrange & Act
      render(<ProgressSummary statistics={statistics} showEtherealBreakdown={false} />);

      // Assert
      for (const segment of within(getLedger()).getAllByRole('button')) {
        expect(segment.tagName).toBe('BUTTON');
        expect(segment).toHaveAttribute('type', 'button');
      }
    });

    it('Then the counts do not change when filters narrow the shown items', () => {
      // Arrange
      useGrailStore.getState().setFilter({ foundStatus: 'missing', types: ['set'] });

      // Act
      render(<ProgressSummary statistics={statistics} showEtherealBreakdown={false} />);

      // Assert
      expect(screen.getByRole('button', { name: /^Unique 1\/3/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Set 0\/1/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  describe('If a selected type stops being tracked', () => {
    it('Then its segment disappears and the type is removed from the filter', () => {
      // Arrange
      resetStore({ grailRunes: true });
      useGrailStore.getState().setFilter({ types: ['rune'] });
      render(<ProgressSummary statistics={statistics} showEtherealBreakdown={false} />);
      expect(screen.getByRole('button', { name: /^Rune/ })).toHaveAttribute('aria-pressed', 'true');

      // Act
      act(() => {
        useGrailStore.getState().hydrateSettings({ grailRunes: false });
      });

      // Assert
      expect(useGrailStore.getState().filter.types).toEqual([]);
      expect(screen.queryByRole('button', { name: /^Rune/ })).not.toBeInTheDocument();
    });
  });

  describe('If ethereal tracking is enabled', () => {
    it('Then lists the normal and ethereal progress below the segments and keeps the total', () => {
      // Arrange & Act
      render(<ProgressSummary statistics={statistics} showEtherealBreakdown />);

      // Assert
      expect(screen.getByText('Normal items')).toBeInTheDocument();
      expect(screen.getByText('Ethereal items')).toBeInTheDocument();
      expect(screen.getByText('184/628')).toBeInTheDocument();
      expect(screen.getByText('6/347')).toBeInTheDocument();
      expect(screen.getByText('19.5%')).toBeInTheDocument();
      expect(screen.getByText('190 of 975 found')).toBeInTheDocument();
    });

    it('Then the segment counts include the tracked ethereal versions', () => {
      // Arrange
      resetStore({ grailEthereal: true });
      useGrailStore.setState({ items: ledgerItems.slice(0, 4), progress: [shakoFind] });

      // Act
      render(<ProgressSummary statistics={statistics} showEtherealBreakdown />);

      // Assert
      expect(screen.getByRole('button', { name: /^Unique 1\/4/ })).toBeInTheDocument();
    });
  });

  describe('If ethereal tracking is enabled but there are no ethereal items', () => {
    it('Then does not show the normal/ethereal split', () => {
      // Arrange
      const noEtherealStatistics: GrailStatistics = {
        ...statistics,
        etherealItems: { total: 0, found: 0 },
      };

      // Act
      render(<ProgressSummary statistics={noEtherealStatistics} showEtherealBreakdown />);

      // Assert
      expect(screen.queryByText('Normal items')).not.toBeInTheDocument();
      expect(screen.queryByText('Ethereal items')).not.toBeInTheDocument();
    });
  });

  describe('If there are no items to track', () => {
    it('Then shows 0% and empty segments of equal width instead of dividing by zero', () => {
      // Arrange
      const emptyStatistics: GrailStatistics = { ...statistics, totalItems: 0, foundItems: 0 };

      // Act
      render(<ProgressSummary statistics={emptyStatistics} showEtherealBreakdown={false} />);

      // Assert
      expect(screen.getByText('0.0%')).toBeInTheDocument();
      for (const segment of within(getLedger()).getAllByRole('button')) {
        expect(segment).toHaveClass('flex-1');
        expect(getFill(segment)?.style.width).toBe('0%');
      }
    });
  });
});
