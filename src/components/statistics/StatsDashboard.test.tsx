import { fireEvent, render, screen, within } from '@testing-library/react';
import type {
  Character,
  CharacterClass,
  GrailProgress,
  Item,
  ItemCategory,
  Settings,
} from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterBuilder, GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { buildRune } from '@/test/buildRune';
import { mockStoreState } from '@/test/storeMock';
import { StatsDashboard } from './StatsDashboard';

vi.mock('@/stores/grailStore', () => ({
  useGrailStatistics: vi.fn(),
  useGrailStore: vi.fn(),
}));

interface SetupOptions {
  categories?: ItemCategory[];
  settings?: Pick<Settings, 'grailNormal' | 'grailEthereal'>;
  characters?: Character[];
  items?: Item[];
  progress?: GrailProgress[];
}

function setupStatistics({
  categories = [],
  characters = [],
  items = [],
  progress = [],
  settings = { grailNormal: true, grailEthereal: false },
}: SetupOptions = {}) {
  mockStoreState(vi.mocked(useGrailStore), {
    items,
    progress,
    characters,
    settings,
  } as unknown as ReturnType<typeof useGrailStore>);
  vi.mocked(useGrailStatistics).mockReturnValue({
    totalItems: 10,
    foundItems: 5,
    completionPercentage: 50,
    recentFinds: 0,
    currentStreak: 0,
    maxStreak: 0,
    averageItemsPerDay: 0,
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

/** Returns the stat tile with the given label. */
function getTile(label: string): HTMLElement {
  const tile = screen.getByText(label).closest<HTMLElement>('[data-slot="card"]');
  expect(tile).not.toBeNull();
  return tile as HTMLElement;
}

/** Returns the row that holds the two progress charts. */
function getChartsRow(): HTMLElement {
  return screen.getByTestId('stats-charts');
}

/** Returns the chart card, or the note that replaces an empty chart, with the given heading. */
function getChart(name: string): HTMLElement {
  const chart = screen
    .getByRole('heading', { level: 2, name })
    .closest<HTMLElement>('[data-slot="card"], [data-chart-state="empty"]');
  expect(chart).not.toBeNull();
  return chart as HTMLElement;
}

function buildCharacter(id: string, name: string, characterClass: CharacterClass) {
  return CharacterBuilder.new()
    .withId(id)
    .withName(name)
    .withCharacterClass(characterClass)
    .withLevel(80)
    .build();
}

describe('When StatsDashboard shows the headline statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 10, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('If everything came from the first save scan, Then the tiles still show the sets and runes left', () => {
    // Arrange
    const items = [
      ...['a1', 'a2', 'a3', 'a4'].map((id) =>
        HolyGrailItemBuilder.new()
          .withId(id)
          .withType('set')
          .withSetName("Arcanna's Tricks")
          .build(),
      ),
      buildRune('el', 'El', 'r01'),
      buildRune('zod', 'Zod', 'r33'),
    ];
    const progress = ['a1', 'a2', 'a3', 'el'].map((itemId) =>
      GrailProgressBuilder.new()
        .withId(`scan-${itemId}`)
        .withItemId(itemId)
        .withFoundDate(new Date(2026, 9, 1, 9))
        .asFromInitialScan()
        .build(),
    );
    setupStatistics({ items, progress });

    // Act
    render(<StatsDashboard />);

    // Assert
    const lastFind = within(getTile('Last find'));
    expect(within(getTile('Total progress')).getByText('5/10')).toBeInTheDocument();
    expect(lastFind.getByText('None yet')).toBeInTheDocument();
    expect(lastFind.getByText('Since tracking began')).toBeInTheDocument();
    const closestSet = within(getTile('Closest set'));
    expect(closestSet.getByText('3/4')).toBeInTheDocument();
    expect(closestSet.getByText("Arcanna's Tricks")).toBeInTheDocument();
    const runesMissing = within(getTile('Runes missing'));
    expect(runesMissing.getByText('1')).toBeInTheDocument();
    expect(runesMissing.getByText('Highest missing: Zod')).toBeInTheDocument();
    expect(screen.queryByText('Current Streak')).not.toBeInTheDocument();
    expect(
      screen.getByText('4 items were found by the first scan that found items, on Oct 1, 2026'),
    ).toBeInTheDocument();
  });

  it('If an item was found while tracking and everything is complete, Then the tiles say so', () => {
    // Arrange
    const items = [
      HolyGrailItemBuilder.new()
        .withId('set-item')
        .withName('Angelic Halo')
        .withType('set')
        .withSetName('Angelic Raiment')
        .build(),
      buildRune('el', 'El', 'r01'),
    ];
    const progress = [
      GrailProgressBuilder.new()
        .withId('p1')
        .withItemId('el')
        .withFoundDate(new Date(2026, 9, 1, 9))
        .build(),
      GrailProgressBuilder.new()
        .withId('p2')
        .withItemId('set-item')
        .withFoundDate(new Date(2026, 9, 7, 12))
        .build(),
    ];
    setupStatistics({ items, progress });

    // Act
    render(<StatsDashboard />);

    // Assert
    const lastFind = within(getTile('Last find'));
    expect(lastFind.getByText('3 days ago')).toBeInTheDocument();
    expect(lastFind.getByText('Angelic Halo')).toBeInTheDocument();
    const closestSet = within(getTile('Closest set'));
    expect(closestSet.getByText('1/1')).toBeInTheDocument();
    expect(closestSet.getByText('All sets complete')).toBeInTheDocument();
    const runesMissing = within(getTile('Runes missing'));
    expect(runesMissing.getByText('0')).toBeInTheDocument();
    expect(runesMissing.getByText('All runes found')).toBeInTheDocument();
    expect(screen.queryByText(/by the first scan/)).not.toBeInTheDocument();
  });

  it('If a later startup scan found an item after the last tracked find, Then the page shows one last find, the scanned one marked as found by scan', () => {
    // Arrange
    const items = [
      HolyGrailItemBuilder.new().withId('tracked').withName('Vampire Gaze').build(),
      HolyGrailItemBuilder.new().withId('scanned').withName("Mara's Kaleidoscope").build(),
    ];
    const progress = [
      GrailProgressBuilder.new()
        .withId('p1')
        .withItemId('tracked')
        .withFoundDate(new Date(2026, 9, 5, 12))
        .build(),
      GrailProgressBuilder.new()
        .withId('p2')
        .withItemId('scanned')
        .withFoundDate(new Date(2026, 9, 8, 12))
        .asFromInitialScan()
        .build(),
    ];
    setupStatistics({ items, progress });

    // Act
    const { container } = render(<StatsDashboard />);

    // Assert
    expect(screen.getAllByText(/last find/i)).toHaveLength(1);
    expect(screen.queryByText('Last Find')).not.toBeInTheDocument();
    const lastFind = within(getTile('Last find'));
    expect(lastFind.getByText('2 days ago')).toBeInTheDocument();
    expect(lastFind.getByText("Mara's Kaleidoscope \u2022 found by scan")).toBeInTheDocument();
    expect(container).not.toHaveTextContent('Vampire Gaze');
    expect(container).not.toHaveTextContent('Recent Activity');
  });

  it('If no sets or runes are tracked, Then their tiles are hidden', () => {
    // Arrange
    setupStatistics({ items: [HolyGrailItemBuilder.new().build()] });

    // Act
    render(<StatsDashboard />);

    // Assert
    expect(screen.queryByText('Closest set')).not.toBeInTheDocument();
    expect(screen.queryByText('Runes missing')).not.toBeInTheDocument();
  });

  it('If only ethereal items are tracked, Then the set and rune tiles are hidden because sets and runes cannot be ethereal', () => {
    // Arrange
    const items = [
      HolyGrailItemBuilder.new()
        .withId('set-item')
        .withType('set')
        .withSetName('Angelic Raiment')
        .build(),
      buildRune('el', 'El', 'r01'),
      HolyGrailItemBuilder.new().withId('ethereal').withEtherealType('optional').build(),
    ];
    setupStatistics({ items, settings: { grailNormal: false, grailEthereal: true } });

    // Act
    render(<StatsDashboard />);

    // Assert
    expect(screen.queryByText('Closest set')).not.toBeInTheDocument();
    expect(screen.queryByText('Runes missing')).not.toBeInTheDocument();
    expect(screen.getByText('Last find')).toBeInTheDocument();
  });

  it('If only ethereal items are tracked, Then a normal find of a set item is not the last find', () => {
    // Arrange
    const items = [
      HolyGrailItemBuilder.new()
        .withId('ethereal')
        .withName('Ethereal Helm')
        .withEtherealType('optional')
        .build(),
      HolyGrailItemBuilder.new()
        .withId('set-item')
        .withName('Angelic Halo')
        .withType('set')
        .withSetName('Angelic Raiment')
        .build(),
    ];
    const progress = [
      GrailProgressBuilder.new()
        .withId('p1')
        .withItemId('ethereal')
        .withFoundDate(new Date(2026, 9, 5, 12))
        .asEthereal()
        .build(),
      GrailProgressBuilder.new()
        .withId('p2')
        .withItemId('set-item')
        .withFoundDate(new Date(2026, 9, 8, 12))
        .build(),
    ];
    setupStatistics({ items, progress, settings: { grailNormal: false, grailEthereal: true } });

    // Act
    render(<StatsDashboard />);

    // Assert
    const lastFind = within(getTile('Last find'));
    expect(lastFind.getByText('5 days ago')).toBeInTheDocument();
    expect(lastFind.getByText('Ethereal Helm')).toBeInTheDocument();
  });

  it('If both versions are tracked, Then the set and rune tiles are shown', () => {
    // Arrange
    const items = [
      HolyGrailItemBuilder.new()
        .withId('set-item')
        .withType('set')
        .withSetName('Angelic Raiment')
        .build(),
      buildRune('el', 'El', 'r01'),
    ];
    setupStatistics({ items, settings: { grailNormal: true, grailEthereal: true } });

    // Act
    render(<StatsDashboard />);

    // Assert
    expect(within(getTile('Closest set')).getByText('0/1')).toBeInTheDocument();
    expect(within(getTile('Runes missing')).getByText('Highest missing: El')).toBeInTheDocument();
  });
});

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
      expect(screen.queryByText(/^(Weapons|Armor|Runewords) progress$/)).not.toBeInTheDocument();
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
    expect(screen.queryByRole('heading', { name: 'Character comparison' })).not.toBeInTheDocument();
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
      screen.getByRole('heading', { level: 2, name: 'Grail progress over time' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Finds per week' })).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('No finds in the last 12 weeks')).toBeInTheDocument();
  });

  it('If both charts have finds, Then they share the row and neither is compact', () => {
    // Arrange
    const items = [HolyGrailItemBuilder.new().withId('a').build()];
    setupStatistics({
      items,
      progress: [
        GrailProgressBuilder.new()
          .withId('p1')
          .withItemId('a')
          .withFoundDate(new Date(2026, 9, 9, 9))
          .build(),
      ],
    });

    // Act
    render(<StatsDashboard />);

    // Assert
    expect(getChartsRow()).toHaveAttribute('data-layout', 'side-by-side');
    expect(getChart('Grail progress over time')).not.toHaveAttribute('data-chart-state', 'empty');
    expect(getChart('Finds per week')).not.toHaveAttribute('data-chart-state', 'empty');
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('If nothing was found in the last 12 weeks, Then the progress chart takes the whole row and the weekly chart is a one-line note', () => {
    // Arrange
    const items = [HolyGrailItemBuilder.new().withId('a').build()];
    setupStatistics({
      items,
      progress: [
        GrailProgressBuilder.new()
          .withId('p1')
          .withItemId('a')
          .withFoundDate(new Date(2026, 0, 15, 9))
          .build(),
      ],
    });

    // Act
    render(<StatsDashboard />);

    // Assert
    expect(getChartsRow()).toHaveAttribute('data-layout', 'stacked');
    expect(screen.getByRole('img', { name: /^Grail progress over time/ })).toBeInTheDocument();
    expect(getChart('Grail progress over time')).not.toHaveAttribute('data-chart-state', 'empty');
    const weekly = getChart('Finds per week');
    expect(weekly).toHaveAttribute('data-chart-state', 'empty');
    expect(weekly).not.toHaveAttribute('data-slot', 'card');
    expect(within(weekly).getByText('No finds in the last 12 weeks')).toBeInTheDocument();
    expect(within(weekly).queryByRole('img')).not.toBeInTheDocument();
    expect(within(weekly).queryByText(/the latest week ending today/)).not.toBeInTheDocument();
  });

  it('If the only find is of an item that is not tracked, Then neither chart counts it', () => {
    // Arrange
    setupStatistics({
      items: [],
      progress: [
        GrailProgressBuilder.new()
          .withId('p1')
          .withItemId('untracked')
          .withFoundDate(new Date(2026, 9, 9, 9))
          .build(),
      ],
    });

    // Act
    render(<StatsDashboard />);

    // Assert
    expect(getChartsRow()).toHaveAttribute('data-layout', 'stacked');
    expect(getChart('Finds per week')).toHaveAttribute('data-chart-state', 'empty');
    expect(getChart('Grail progress over time')).toHaveAttribute('data-chart-state', 'empty');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('If neither chart has finds, Then both are compact and stacked', () => {
    // Arrange
    setupStatistics();

    // Act
    render(<StatsDashboard />);

    // Assert
    expect(getChartsRow()).toHaveAttribute('data-layout', 'stacked');
    expect(getChart('Grail progress over time')).toHaveAttribute('data-chart-state', 'empty');
    expect(getChart('Finds per week')).toHaveAttribute('data-chart-state', 'empty');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
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
    const progressTable = screen.getByRole('table', { name: 'Grail progress over time' });
    expect(within(progressTable).getAllByRole('row')).toHaveLength(3);
    expect(getChartsRow()).toHaveAttribute('data-layout', 'side-by-side');
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
    expect(latestTooltip).toMatch(/Found2(?!\d)/);
    expect(firstTooltip).toContain('Oct 1, 2026');
    expect(firstTooltip).toMatch(/Found1(?!\d)/);
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument();
  });
});
