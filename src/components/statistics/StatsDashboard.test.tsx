import { fireEvent, render, screen, within } from '@testing-library/react';
import type {
  Character,
  CharacterClass,
  GrailProgress,
  Item,
  ItemCategory,
} from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterBuilder, GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { mockStoreState } from '@/test/storeMock';
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

interface SetupOptions {
  categories?: ItemCategory[];
  characters?: Character[];
  items?: Item[];
  progress?: GrailProgress[];
}

function setupStatistics({
  categories = [],
  characters = [],
  items = [],
  progress = [],
}: SetupOptions = {}) {
  mockStoreState(vi.mocked(useGrailStore), {
    items,
    progress,
    characters,
    settings: { grailNormal: true, grailEthereal: false },
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
    characterStats: characters.map((character, index) => ({
      character,
      totalFound: 10 - index,
      recentFinds: 0,
    })),
  } as unknown as ReturnType<typeof useGrailStatistics>);
}

function buildCharacter(id: string, name: string, characterClass: CharacterClass) {
  return CharacterBuilder.new()
    .withId(id)
    .withName(name)
    .withCharacterClass(characterClass)
    .withLevel(80)
    .build();
}

describe('When StatsDashboard shows the category breakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('If categories are returned as raw enum values', () => {
    it('Then each category is labelled once with its translated name', () => {
      // Arrange
      setupStatistics({ categories: ['weapons', 'armor', 'runewords'] });

      // Act
      render(<StatsDashboard />);

      // Assert
      for (const label of ['Weapons', 'Armor', 'Runewords']) {
        expect(screen.getAllByText(label)).toHaveLength(1);
        expect(screen.getByRole('progressbar', { name: label })).toBeInTheDocument();
      }
      expect(screen.queryByText('weapons')).not.toBeInTheDocument();
      expect(screen.queryByText(/progress$/)).not.toBeInTheDocument();
    });
  });
});

describe('When StatsDashboard shows the character comparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('If a shared stash has finds, Then it is not ranked and classes are translated', () => {
    // Arrange
    setupStatistics({
      characters: [
        buildCharacter('stash', 'Shared Stash', 'shared_stash'),
        buildCharacter('sorc', 'Blizzy', 'sorceress'),
        buildCharacter('pala', 'Hammerdin', 'paladin'),
      ],
    });

    // Act
    render(<StatsDashboard />);

    // Assert
    const comparison = screen.getByRole('list');
    const entries = within(comparison).getAllByRole('listitem');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('Blizzy');
    expect(entries[0]).toHaveTextContent('Sorceress \u2022 Level 80');
    expect(entries[1]).toHaveTextContent('Paladin \u2022 Level 80');
    expect(screen.queryByText(/shared_stash/)).not.toBeInTheDocument();
    expect(screen.queryByText('Shared Stash')).not.toBeInTheDocument();
  });

  it('If only one character remains without the shared stash, Then the comparison is hidden', () => {
    // Arrange
    setupStatistics({
      characters: [
        buildCharacter('stash', 'Shared Stash', 'shared_stash'),
        buildCharacter('sorc', 'Blizzy', 'sorceress'),
      ],
    });

    // Act
    render(<StatsDashboard />);

    // Assert
    expect(screen.queryByRole('heading', { name: 'Character Comparison' })).not.toBeInTheDocument();
  });
});

describe('When StatsDashboard shows the progress charts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 10, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('If nothing was found yet, Then both charts show an empty state', () => {
    // Arrange
    setupStatistics();

    // Act
    render(<StatsDashboard />);

    // Assert
    expect(
      screen.getByRole('heading', { level: 2, name: 'Grail Progress Over Time' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Finds per Week' })).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('No finds in the last 12 weeks')).toBeInTheDocument();
  });

  it('If items were found, Then the charts summarize the finds and list them in a table', () => {
    // Arrange
    const items = ['a', 'b'].map((id) => HolyGrailItemBuilder.new().withId(id).build());
    setupStatistics({
      items,
      progress: [
        GrailProgressBuilder.new()
          .withId('p1')
          .withItemId('a')
          .withFoundDate(new Date(2026, 9, 1, 9))
          .build(),
        GrailProgressBuilder.new()
          .withId('p2')
          .withItemId('b')
          .withFoundDate(new Date(2026, 9, 9, 9))
          .build(),
      ],
    });

    // Act
    render(<StatsDashboard />);

    // Assert
    expect(
      screen.getByRole('img', {
        name: 'Grail progress over time: 2 of 10 found since Oct 1, 2026',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Finds per week over the last 12 weeks: 2 in total, 1 in the latest week',
      }),
    ).toBeInTheDocument();
    const progressTable = screen.getByRole('table', { name: 'Grail Progress Over Time' });
    expect(within(progressTable).getAllByRole('row')).toHaveLength(3);
  });

  it('If the user moves through a chart with the keyboard, Then the tooltip shows the focused value', () => {
    // Arrange
    const items = ['a', 'b'].map((id) => HolyGrailItemBuilder.new().withId(id).build());
    setupStatistics({
      items,
      progress: [
        GrailProgressBuilder.new()
          .withId('p1')
          .withItemId('a')
          .withFoundDate(new Date(2026, 9, 1, 9))
          .build(),
        GrailProgressBuilder.new()
          .withId('p2')
          .withItemId('b')
          .withFoundDate(new Date(2026, 9, 9, 9))
          .build(),
      ],
    });
    render(<StatsDashboard />);
    const chart = screen.getByRole('img', { name: /^Grail progress over time/ });

    // Act
    fireEvent.focus(chart);
    const latestTooltip = screen.getByTestId('chart-tooltip').textContent;
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    const firstTooltip = screen.getByTestId('chart-tooltip').textContent;
    fireEvent.keyDown(chart, { key: 'Escape' });

    // Assert
    expect(latestTooltip).toContain('Oct 9, 2026');
    expect(latestTooltip).toContain('Found2');
    expect(firstTooltip).toContain('Oct 1, 2026');
    expect(firstTooltip).toContain('Found1');
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument();
  });
});
