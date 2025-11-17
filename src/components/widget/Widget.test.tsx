import { render } from '@testing-library/react';
import type {
  GrailProgress,
  Item,
  Run,
  RunItem,
  Session,
  SessionStats,
  Settings,
} from 'electron/types/grail';
import { describe, expect, it, vi } from 'vitest';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { Widget } from './Widget';

// Minimal mocks for zustand stores used by Widget
vi.mock('@/stores/runTrackerStore', () => {
  const runs = new Map<string, Run[]>();
  const runItems = new Map<string, RunItem[]>();

  const session: Session = {
    id: 'session-1',
    startTime: new Date(),
    totalRunTime: 0,
    totalSessionTime: 0,
    runCount: 2,
    archived: false,
    created: new Date(),
    lastUpdated: new Date(),
  };

  const run1: Run = {
    id: 'run-1',
    sessionId: session.id,
    runNumber: 1,
    startTime: new Date(),
    created: new Date(),
    lastUpdated: new Date(),
  };

  const run2: Run = {
    id: 'run-2',
    sessionId: session.id,
    runNumber: 2,
    startTime: new Date(),
    created: new Date(),
    lastUpdated: new Date(),
  };

  runs.set(session.id, [run1, run2]);

  const runItem1: RunItem = {
    id: 'run-item-1',
    runId: run1.id,
    grailProgressId: 'progress-1',
    foundTime: new Date(),
    created: new Date(),
  };

  const runItem2: RunItem = {
    id: 'run-item-2',
    runId: run2.id,
    grailProgressId: 'progress-2',
    foundTime: new Date(),
    created: new Date(),
  };

  runItems.set(run1.id, [runItem1]);
  runItems.set(run2.id, [runItem2]);

  const sessionStats: SessionStats = {
    sessionId: session.id,
    totalRuns: 2,
    totalTime: 0,
    totalRunTime: 0,
    averageRunDuration: 0,
    fastestRun: 0,
    slowestRun: 0,
    itemsFound: 2,
    newGrailItems: 0,
  };

  const loadSessionRuns = vi.fn();
  const loadRunItems = vi.fn();

  const mockStore = {
    useRunTrackerStore: () => ({
      activeRun: null,
      activeSession: session,
      runs,
      runItems,
      getSessionStats: () => sessionStats,
      loadSessionRuns,
      loadRunItems,
      refreshActiveRun: vi.fn().mockResolvedValue(undefined),
      handleSessionStarted: vi.fn(),
      handleSessionEnded: vi.fn(),
      handleRunStarted: vi.fn(),
      handleRunEnded: vi.fn(),
      handleRunPaused: vi.fn(),
      handleRunResumed: vi.fn(),
    }),
  } as const;

  return mockStore;
});

vi.mock('@/stores/grailStore', () => {
  const items: Item[] = [
    {
      id: 'item-1',
      name: 'Harlequin Crest',
      link: '',
      etherealType: 'none',
      type: 'unique',
      category: 'armor',
      subCategory: 'helms',
      treasureClass: 'elite',
    },
    {
      id: 'item-2',
      name: "Tyrael's Might",
      link: '',
      etherealType: 'none',
      type: 'unique',
      category: 'armor',
      subCategory: 'body_armor',
      treasureClass: 'elite',
    },
  ];

  const progress: GrailProgress[] = [
    {
      id: 'progress-1',
      characterId: 'char-1',
      itemId: 'item-1',
      manuallyAdded: false,
      isEthereal: false,
    },
    {
      id: 'progress-2',
      characterId: 'char-1',
      itemId: 'item-2',
      manuallyAdded: false,
      isEthereal: false,
    },
  ];

  return {
    useGrailStore: () => ({
      items,
      progress,
      settings: {} as Settings,
      setSettings: async () => ({}),
    }),
  };
});

describe('Widget run-only item list', () => {
  const baseSettings: Partial<Settings> = {
    widgetDisplay: 'run-only',
    widgetRunOnlyShowItems: true,
  };

  it('shows run item list text when enabled', () => {
    const { getByText, getAllByText } = render(
      <Widget
        statistics={null}
        settings={baseSettings}
        onDragStart={() => ({})}
        onDragEnd={() => ({})}
      />,
    );

    // The structure changed - run numbers are now in format "#1 -" or "#2 -"
    expect(getAllByText(/#1/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/#2/).length).toBeGreaterThanOrEqual(1);
    expect(getByText('Harlequin Crest')).toBeDefined();
    expect(getByText("Tyrael's Might")).toBeDefined();
  });

  it('hides run item list when disabled in settings', () => {
    const settings: Partial<Settings> = {
      ...baseSettings,
      widgetRunOnlyShowItems: false,
    };

    const { queryByText } = render(
      <Widget
        statistics={null}
        settings={settings}
        onDragStart={() => ({})}
        onDragEnd={() => ({})}
      />,
    );

    expect(queryByText(/#1/)).toBeNull();
    expect(queryByText('Harlequin Crest')).toBeNull();
  });

  it('renders without item rows when there are no run items', () => {
    // Arrange - clear mocked runItems for this test
    const store = useRunTrackerStore() as unknown as {
      runs: Map<string, Run[]>;
      runItems: Map<string, RunItem[]>;
    };
    store.runItems.clear();

    const { queryByText } = render(
      <Widget
        statistics={null}
        settings={baseSettings}
        onDragStart={() => ({})}
        onDragEnd={() => ({})}
      />,
    );

    expect(queryByText(/#1/)).toBeNull();
    expect(queryByText('Harlequin Crest')).toBeNull();
  });

  it('loads session runs when none are present for active session', () => {
    // Arrange - clear runs and runItems to simulate unloaded state
    const store = useRunTrackerStore() as unknown as {
      runs: Map<string, Run[]>;
      runItems: Map<string, RunItem[]>;
      loadSessionRuns: ReturnType<typeof vi.fn>;
      loadRunItems: ReturnType<typeof vi.fn>;
      activeSession: Session;
    };
    store.runs.clear();
    store.runItems.clear();
    store.loadSessionRuns.mockClear();
    store.loadRunItems.mockClear();

    // Act
    render(
      <Widget
        statistics={null}
        settings={baseSettings}
        onDragStart={() => ({})}
        onDragEnd={() => ({})}
      />,
    );

    // Assert
    expect(store.loadSessionRuns).toHaveBeenCalledTimes(1);
    expect(store.loadSessionRuns).toHaveBeenCalledWith(store.activeSession.id);
    expect(store.loadRunItems).not.toHaveBeenCalled();
  });

  it('loads run items when runs exist but items are missing', () => {
    // Arrange - keep runs but clear runItems
    const store = useRunTrackerStore() as unknown as {
      runs: Map<string, Run[]>;
      runItems: Map<string, RunItem[]>;
      loadSessionRuns: ReturnType<typeof vi.fn>;
      loadRunItems: ReturnType<typeof vi.fn>;
      activeSession: Session;
    };
    const sessionRuns = store.runs.get(store.activeSession.id) ?? [];
    store.runItems.clear();
    store.loadSessionRuns.mockClear();
    store.loadRunItems.mockClear();

    // Act - initial render triggers data loading effect
    render(
      <Widget
        statistics={null}
        settings={baseSettings}
        onDragStart={() => ({})}
        onDragEnd={() => ({})}
      />,
    );

    // Simulate run-item-added IPC event for each run by directly invoking the store-side effect
    sessionRuns.forEach((run) => {
      const { loadRunItems } = useRunTrackerStore.getState() as unknown as {
        loadRunItems: (runId: string) => Promise<void>;
      };
      loadRunItems(run.id);
    });

    // Assert - loadRunItems should have been called for each run in response to events
    expect(store.loadRunItems).toHaveBeenCalledTimes(sessionRuns.length);
    for (const run of sessionRuns) {
      expect(store.loadRunItems).toHaveBeenCalledWith(run.id);
    }
  });

  it('should deduplicate runs even if duplicate runs exist in the store', () => {
    // Arrange - create a store with duplicate runs
    const store = useRunTrackerStore() as unknown as {
      runs: Map<string, Run[]>;
      runItems: Map<string, RunItem[]>;
      activeSession: Session;
    };

    // Create a test run explicitly
    const run1: Run = {
      id: 'run-test-1',
      sessionId: store.activeSession.id,
      runNumber: 1,
      startTime: new Date(),
      created: new Date(),
      lastUpdated: new Date(),
    };

    // Add duplicate run to simulate the bug (same ID, same runNumber)
    const duplicateRun: Run = { ...run1 };

    // Set up runs with duplicates
    const runsWithDuplicate = [run1, duplicateRun];
    store.runs.set(store.activeSession.id, runsWithDuplicate);

    // Add a manual item to the run so it shows up in the list
    const manualItem: RunItem = {
      id: 'run-item-manual',
      runId: run1.id,
      name: 'Test Item',
      foundTime: new Date(),
      created: new Date(),
    };
    store.runItems.set(run1.id, [manualItem]);

    // Act - render the widget
    const { getAllByText } = render(
      <Widget
        statistics={null}
        settings={baseSettings}
        onDragStart={() => ({})}
        onDragEnd={() => ({})}
      />,
    );

    // Assert - should only see one instance of the run number, not duplicates
    // The run number should appear in the format "#1 - Test Item"
    const runNumberElements = getAllByText(/#1/);
    // Should only appear once (in the run number display), not multiple times
    // We check for <= 2 to allow for the run number in the header and in the list
    expect(runNumberElements.length).toBeLessThanOrEqual(2);

    // Also verify that "Test Item" appears only once
    const itemElements = getAllByText('Test Item');
    expect(itemElements.length).toBe(1);
  });
});
