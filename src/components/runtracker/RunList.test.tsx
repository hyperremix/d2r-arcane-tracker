import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Item, Run, RunItem, Settings } from 'electron/types/grail';
import { GameMode, GameVersion } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type CharacterBuilder,
  GrailProgressBuilder,
  HolyGrailItemBuilder,
  RunBuilder,
  RunItemBuilder,
} from '@/fixtures';
import { RunList } from './RunList';

// Mock dependencies
vi.mock('@/stores/runTrackerStore');
vi.mock('@/stores/grailStore');
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    measureElement: vi.fn(),
  }),
}));
vi.mock('@/components/grail/ItemCard', () => ({
  ItemCard: ({ item }: { item: Item }) => <div data-testid="item-card">{item.name}</div>,
}));

// Import after mocks
import { useGrailStore } from '@/stores/grailStore';
import { useRunTrackerStore } from '@/stores/runTrackerStore';

const defaultSettings: Settings = {
  saveDir: '',
  lang: 'en',
  gameMode: GameMode.Both,
  grailNormal: true,
  grailEthereal: false,
  grailRunes: false,
  grailRunewords: false,
  gameVersion: GameVersion.Resurrected,
  enableSounds: true,
  notificationVolume: 0.5,
  inAppNotifications: true,
  nativeNotifications: true,
  needsSeeding: true,
  theme: 'system',
  showItemIcons: false,
};

const mockLoadRunItems = vi.fn();

function setupRunTrackerStore(
  overrides: { runItems?: Map<string, RunItem[]>; loading?: boolean } = {},
) {
  const storeState = {
    runItems: overrides.runItems ?? new Map(),
    loadRunItems: mockLoadRunItems,
    loading: overrides.loading ?? false,
  };

  const mockStore = vi.mocked(useRunTrackerStore);
  mockStore.mockImplementation((selector?: unknown) => {
    if (typeof selector === 'function') {
      return (selector as (s: typeof storeState) => unknown)(storeState);
    }
    return storeState as ReturnType<typeof useRunTrackerStore>;
  });
}

function setupGrailStore(
  overrides: {
    items?: ReturnType<typeof HolyGrailItemBuilder.prototype.build>[];
    progress?: ReturnType<typeof GrailProgressBuilder.prototype.build>[];
    characters?: ReturnType<typeof CharacterBuilder.prototype.build>[];
  } = {},
) {
  const storeState = {
    items: overrides.items ?? [],
    progress: overrides.progress ?? [],
    characters: overrides.characters ?? [],
    settings: defaultSettings,
  };

  const mockStore = vi.mocked(useGrailStore);
  mockStore.mockImplementation((selector?: unknown) => {
    if (typeof selector === 'function') {
      return (selector as (s: typeof storeState) => unknown)(storeState);
    }
    return storeState as ReturnType<typeof useGrailStore>;
  });
}

function createRuns(count: number): Run[] {
  return Array.from({ length: count }, (_, i) =>
    RunBuilder.new()
      .withId(`run-${i}`)
      .withRunNumber(i + 1)
      .withStartTime(new Date(`2024-01-01T${String(10 + i).padStart(2, '0')}:00:00Z`))
      .withEndTime(new Date(`2024-01-01T${String(10 + i).padStart(2, '0')}:05:00Z`))
      .withDuration(300000 + i * 60000)
      .build(),
  );
}

describe('When RunList is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRunTrackerStore();
    setupGrailStore();
  });

  describe('If runs is undefined', () => {
    it('Then renders skeleton loader with table headers', () => {
      // Arrange & Act
      render(<RunList runs={undefined} />);

      // Assert
      expect(screen.getByText('Run #')).toBeInTheDocument();
      expect(screen.getByText('Start Time')).toBeInTheDocument();
      expect(screen.getByText('End Time')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('Items')).toBeInTheDocument();
    });
  });

  describe('If runs is empty array', () => {
    it('Then shows no runs message', () => {
      // Arrange & Act
      render(<RunList runs={[]} />);

      // Assert
      expect(screen.getByText('No runs match your filters')).toBeInTheDocument();
    });

    it('Then shows 0 runs badge', () => {
      // Arrange & Act
      render(<RunList runs={[]} />);

      // Assert
      expect(screen.getByText('0 runs')).toBeInTheDocument();
    });
  });

  describe('If runs has data', () => {
    it('Then renders Run History title', () => {
      // Arrange
      const runs = createRuns(2);

      // Act
      render(<RunList runs={runs} />);

      // Assert
      expect(screen.getByText('Run History')).toBeInTheDocument();
    });

    it('Then renders runs count badge', () => {
      // Arrange
      const runs = createRuns(3);

      // Act
      render(<RunList runs={runs} />);

      // Assert
      expect(screen.getByText('3 runs')).toBeInTheDocument();
    });

    it('Then renders run rows with number', () => {
      // Arrange
      const runs = createRuns(2);

      // Act
      render(<RunList runs={runs} />);

      // Assert
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
    });
  });

  describe('If run has items', () => {
    it('Then shows item count badge', () => {
      // Arrange
      const runs = [RunBuilder.new().withId('run-1').withRunNumber(1).build()];
      const runItems = new Map<string, RunItem[]>([
        ['run-1', [RunItemBuilder.new().withId('ri-1').withRunId('run-1').build()]],
      ]);
      setupRunTrackerStore({ runItems });

      // Act
      render(<RunList runs={runs} />);

      // Assert
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('If run has no items', () => {
    it('Then shows dash for items column', () => {
      // Arrange
      const runs = [RunBuilder.new().withId('run-1').withRunNumber(1).build()];

      // Act
      render(<RunList runs={runs} />);

      // Assert
      // The items column shows "-" when there are no items
      const row = screen.getByText('#1').closest('tr');
      expect(within(row!).getAllByText('-').length).toBeGreaterThan(0);
    });
  });

  describe('If run has no endTime/duration', () => {
    it('Then shows dash for those columns', () => {
      // Arrange
      const run = RunBuilder.new()
        .withId('run-1')
        .withRunNumber(1)
        .withoutEndTime()
        .withoutDuration()
        .build();

      // Act
      render(<RunList runs={[run]} />);

      // Assert
      const row = screen.getByText('#1').closest('tr');
      const dashes = within(row!).getAllByText('-');
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('If Start Time header clicked', () => {
    it('Then toggles sort order', () => {
      // Arrange
      const runs = createRuns(3);
      render(<RunList runs={runs} />);

      // Act — click Start Time header (default sort is desc on startTime)
      fireEvent.click(screen.getByText('Start Time'));

      // Assert — first run should be at the top (ascending order)
      const rows = screen.getAllByText(/#\d+/);
      expect(rows[0].textContent).toBe('#1');
    });
  });

  describe('If same header clicked twice', () => {
    it('Then toggles between asc and desc', () => {
      // Arrange
      const runs = createRuns(3);
      render(<RunList runs={runs} />);

      // Act — click twice to go asc then desc
      fireEvent.click(screen.getByText('Start Time'));
      fireEvent.click(screen.getByText('Start Time'));

      // Assert — should be back to descending
      const rows = screen.getAllByText(/#\d+/);
      expect(rows[0].textContent).toBe('#3');
    });
  });

  describe('If > 10 runs (pagination)', () => {
    it('Then pagination controls are visible', () => {
      // Arrange
      const runs = createRuns(15);

      // Act
      render(<RunList runs={runs} />);

      // Assert
      expect(screen.getByText(/Showing 1-10 of 15/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Next/ })).toBeEnabled();
    });

    it('Then Next click shows next page', () => {
      // Arrange
      const runs = createRuns(15);
      render(<RunList runs={runs} />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: /Next/ }));

      // Assert
      expect(screen.getByText(/Showing 11-15 of 15/)).toBeInTheDocument();
    });
  });

  describe('If run row clicked', () => {
    it('Then opens RunDetailsDialog', () => {
      // Arrange
      const runs = [RunBuilder.new().withId('run-1').withRunNumber(1).build()];
      render(<RunList runs={runs} />);

      // Act
      fireEvent.click(screen.getByText('#1').closest('tr')!);

      // Assert — dialog should open with run title
      expect(screen.getByText('Run #1')).toBeInTheDocument();
    });

    it('Then calls loadRunItems if not cached', () => {
      // Arrange
      const runs = [RunBuilder.new().withId('run-1').withRunNumber(1).build()];
      render(<RunList runs={runs} />);

      // Act
      fireEvent.click(screen.getByText('#1').closest('tr')!);

      // Assert
      expect(mockLoadRunItems).toHaveBeenCalledWith('run-1');
    });
  });

  describe('If run row Enter key pressed', () => {
    it('Then opens dialog', () => {
      // Arrange
      const runs = [RunBuilder.new().withId('run-1').withRunNumber(1).build()];
      render(<RunList runs={runs} />);

      // Act
      fireEvent.keyDown(screen.getByText('#1').closest('tr')!, { key: 'Enter' });

      // Assert
      expect(screen.getByText('Run #1')).toBeInTheDocument();
    });
  });

  describe('If run row Space key pressed', () => {
    it('Then opens dialog', () => {
      // Arrange
      const runs = [RunBuilder.new().withId('run-1').withRunNumber(1).build()];
      render(<RunList runs={runs} />);

      // Act
      fireEvent.keyDown(screen.getByText('#1').closest('tr')!, { key: ' ' });

      // Assert
      expect(screen.getByText('Run #1')).toBeInTheDocument();
    });
  });
});

describe('When RunDetailsDialog is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRunTrackerStore();
    setupGrailStore();
  });

  describe('If run has no items', () => {
    it('Then shows no items message', () => {
      // Arrange
      const runs = [RunBuilder.new().withId('run-1').withRunNumber(1).build()];
      setupRunTrackerStore({ runItems: new Map([['run-1', []]]) });
      render(<RunList runs={runs} />);

      // Act — open dialog
      fireEvent.click(screen.getByText('#1').closest('tr')!);

      // Assert
      expect(screen.getByText('No items found in this run.')).toBeInTheDocument();
    });
  });

  describe('If run has grail items', () => {
    it('Then renders ItemCard for each', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Windforce').build();
      const progress = GrailProgressBuilder.new()
        .withId('prog-1')
        .withCharacterId('char-1')
        .withItemId('item-1')
        .asNormal()
        .build();
      const runItem = RunItemBuilder.new()
        .withId('ri-1')
        .withRunId('run-1')
        .withGrailProgressId('prog-1')
        .build();

      setupGrailStore({ items: [item], progress: [progress] });
      setupRunTrackerStore({ runItems: new Map([['run-1', [runItem]]]) });

      const runs = [RunBuilder.new().withId('run-1').withRunNumber(1).build()];
      render(<RunList runs={runs} />);

      // Act — open dialog
      fireEvent.click(screen.getByText('#1').closest('tr')!);

      // Assert
      expect(screen.getByTestId('item-card')).toBeInTheDocument();
      expect(screen.getByText('Windforce')).toBeInTheDocument();
    });
  });

  describe('If run item is manual entry', () => {
    it('Then renders simple name display', () => {
      // Arrange
      const runItem = RunItemBuilder.new()
        .withId('ri-1')
        .withRunId('run-1')
        .withName('Manual Item')
        .build();

      setupRunTrackerStore({ runItems: new Map([['run-1', [runItem]]]) });

      const runs = [RunBuilder.new().withId('run-1').withRunNumber(1).build()];
      render(<RunList runs={runs} />);

      // Act — open dialog
      fireEvent.click(screen.getByText('#1').closest('tr')!);

      // Assert
      expect(screen.getByText('Manual Item')).toBeInTheDocument();
    });
  });

  describe('If loading', () => {
    it('Then renders skeleton placeholders', () => {
      // Arrange
      const runs = [RunBuilder.new().withId('run-1').withRunNumber(1).build()];
      setupRunTrackerStore({ loading: true });
      render(<RunList runs={runs} />);

      // Act — open dialog
      fireEvent.click(screen.getByText('#1').closest('tr')!);

      // Assert — skeleton elements have specific class
      const dialog = screen.getByText('Run #1').closest('[role="dialog"]');
      const skeletons = dialog?.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons?.length).toBeGreaterThan(0);
    });
  });
});
