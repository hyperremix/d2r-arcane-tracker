import { render } from '@testing-library/react';
import type {
  GrailProgress,
  GrailStatistics,
  Item,
  Run,
  RunItem,
  Session,
  SessionStats,
  Settings,
} from 'electron/types/grail';
import i18n from 'i18next';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { Widget } from './Widget';

const widgetTestState = vi.hoisted(() => ({ hideSession: false }));

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
      activeSession: widgetTestState.hideSession ? null : session,
      runs,
      runItems,
      getSessionStats: () => sessionStats,
      loadSessionRuns,
      loadRunItems,
      addManualRunItem: vi.fn().mockResolvedValue(undefined),
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

/**
 * The mocked run tracker store is shared by every test in this file (and by the whole run, since
 * test files share one module registry), so snapshot and restore the maps tests mutate.
 */
interface RunStoreMaps {
  runs: Map<string, Run[]>;
  runItems: Map<string, RunItem[]>;
}

let runStoreSnapshot: { runs: [string, Run[]][]; runItems: [string, RunItem[]][] };

beforeEach(() => {
  const store = useRunTrackerStore() as unknown as RunStoreMaps;
  runStoreSnapshot = { runs: [...store.runs], runItems: [...store.runItems] };
});

afterEach(() => {
  const store = useRunTrackerStore() as unknown as RunStoreMaps;
  store.runs.clear();
  store.runItems.clear();
  for (const [key, value] of runStoreSnapshot.runs) {
    store.runs.set(key, value);
  }
  for (const [key, value] of runStoreSnapshot.runItems) {
    store.runItems.set(key, value);
  }
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

    // Act - the initial render triggers the data loading effect
    render(
      <Widget
        statistics={null}
        settings={baseSettings}
        onDragStart={() => ({})}
        onDragEnd={() => ({})}
      />,
    );

    // Assert - loadRunItems is called once for each run that is missing its items
    expect(sessionRuns.length).toBeGreaterThan(0);
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

describe('Widget display and legibility', () => {
  beforeAll(() => {
    // ProgressGauge animations rely on IntersectionObserver, which jsdom does not provide
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
        takeRecords = vi.fn(() => []);
      },
    );
    // framer-motion reads matchMedia for reduced-motion, which jsdom does not provide
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  const statistics: GrailStatistics = {
    totalItems: 100,
    foundItems: 40,
    completionPercentage: 40,
    recentFinds: 0,
    normalItems: { total: 60, found: 30 },
    etherealItems: { total: 40, found: 10 },
    currentStreak: 0,
    maxStreak: 0,
  };

  it('If split mode is stored but ethereal tracking is off, Then the widget falls back to overall', () => {
    // Arrange
    const settings: Partial<Settings> = { widgetDisplay: 'split', grailEthereal: false };

    // Act
    const { getAllByText, queryAllByText } = render(
      <Widget
        statistics={statistics}
        settings={settings}
        onDragStart={() => ({})}
        onDragEnd={() => ({})}
      />,
    );

    // Assert
    expect(getAllByText('Overall').length).toBeGreaterThan(0);
    expect(queryAllByText('Normal')).toHaveLength(0);
    expect(queryAllByText('Ethereal')).toHaveLength(0);
  });

  it('If split mode is stored and ethereal tracking is on, Then normal and ethereal gauges render', () => {
    // Arrange
    const settings: Partial<Settings> = { widgetDisplay: 'split', grailEthereal: true };

    // Act
    const { getAllByText, queryAllByText } = render(
      <Widget
        statistics={statistics}
        settings={settings}
        onDragStart={() => ({})}
        onDragEnd={() => ({})}
      />,
    );

    // Assert
    expect(getAllByText('Normal').length).toBeGreaterThan(0);
    expect(getAllByText('Ethereal').length).toBeGreaterThan(0);
    expect(queryAllByText('Overall')).toHaveLength(0);
  });

  it('If the stored opacity is below the minimum, Then the background uses the clamped opacity', () => {
    // Arrange
    const settings: Partial<Settings> = { widgetDisplay: 'overall', widgetOpacity: 0 };

    // Act
    const { container } = render(
      <Widget
        statistics={statistics}
        settings={settings}
        onDragStart={() => ({})}
        onDragEnd={() => ({})}
      />,
    );

    // Assert
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.backgroundColor).toBe('rgba(0, 0, 0, 0.3)');
  });

  it('When gauges render, Then their text uses light overlay colors instead of theme grays', () => {
    // Arrange
    const settings: Partial<Settings> = { widgetDisplay: 'overall' };

    // Act
    const { getByText } = render(
      <Widget
        statistics={statistics}
        settings={settings}
        onDragStart={() => ({})}
        onDragEnd={() => ({})}
      />,
    );

    // Assert
    const ratio = getByText('40/100');
    expect(ratio.className).toContain('text-white/85');
    expect(ratio.className).not.toContain('text-gray');
    expect(getByText('Overall', { selector: 'div' }).className).not.toContain('text-gray');
  });

  it('When the focusable widget root is hovered or focused, Then the drag grip brightens', () => {
    // Arrange
    const settings: Partial<Settings> = { widgetDisplay: 'overall' };

    // Act
    const { getByTestId, container } = render(
      <Widget
        statistics={statistics}
        settings={settings}
        onDragStart={() => ({})}
        onDragEnd={() => ({})}
      />,
    );

    // Assert
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute('role', 'button');
    expect(root).toHaveAttribute('tabindex', '0');
    expect(root.className).toContain('group');
    const gripClasses = getByTestId('widget-drag-grip').getAttribute('class') ?? '';
    expect(gripClasses).toContain('opacity-30');
    expect(gripClasses).toContain('group-hover:opacity-80');
    expect(gripClasses).toContain('group-focus-visible:opacity-80');
  });

  it('When the widget renders, Then it shows a decorative drag grip that ignores pointer events', () => {
    // Arrange
    const settings: Partial<Settings> = { widgetDisplay: 'overall' };

    // Act
    const { getByTestId, container } = render(
      <Widget
        statistics={statistics}
        settings={settings}
        onDragStart={() => ({})}
        onDragEnd={() => ({})}
      />,
    );

    // Assert
    const grip = getByTestId('widget-drag-grip');
    expect(grip).toHaveAttribute('aria-hidden', 'true');
    expect(grip.getAttribute('class')).toContain('pointer-events-none');
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.cursor).toBe('move');
    expect(root).toContainElement(grip);
  });
});

describe('Widget localization', () => {
  const originalBundle = structuredClone(i18n.getResourceBundle('en', 'common'));

  beforeAll(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
        takeRecords = vi.fn(() => []);
      },
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    widgetTestState.hideSession = false;
    i18n.addResourceBundle('en', 'common', originalBundle, true, true);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Replaces the English strings the widget uses with marked values so untranslated literals stand out.
   */
  function markTranslations() {
    i18n.addResourceBundle(
      'en',
      'common',
      {
        common: { loading: 'tr:loading' },
        grail: { itemCard: { normal: 'tr:normal' } },
        settings: { widget: { overall: 'tr:overall' } },
        runTracker: {
          controls: { startRunFirst: 'tr:startRunFirst' },
          sessionCard: { noActiveSession: 'tr:noActiveSession' },
        },
        widget: {
          ethereal: 'tr:ethereal',
          startSessionPrompt: 'tr:startSessionPrompt',
          run: 'tr:run',
          current: 'tr:current',
          fastest: 'tr:fastest',
          average: 'tr:average',
          runItems: 'tr:runItems',
          addItemPlaceholder: 'tr:addItemPlaceholder',
        },
      },
      true,
      true,
    );
  }

  const renderWidget = (settings: Partial<Settings>, statistics: GrailStatistics | null) =>
    render(
      <Widget
        statistics={statistics}
        settings={settings}
        onDragStart={() => ({})}
        onDragEnd={() => ({})}
      />,
    );

  it('If there is no active session in run-only mode, Then the status copy is translated', () => {
    // Arrange
    markTranslations();
    widgetTestState.hideSession = true;

    // Act
    const { getByText } = renderWidget({ widgetDisplay: 'run-only' }, null);

    // Assert
    expect(getByText('tr:noActiveSession')).toBeDefined();
    expect(getByText('tr:startSessionPrompt')).toBeDefined();
  });

  it('If a session is active in run-only mode, Then the labels and placeholder are translated', () => {
    // Arrange
    markTranslations();
    const store = useRunTrackerStore() as unknown as {
      runs: Map<string, Run[]>;
      activeSession: Session;
    };
    store.runs.set(store.activeSession.id, [
      {
        id: 'run-l10n',
        sessionId: store.activeSession.id,
        runNumber: 1,
        startTime: new Date(),
        created: new Date(),
        lastUpdated: new Date(),
      },
    ]);

    // Act
    const { getByText, getByPlaceholderText } = renderWidget(
      { widgetDisplay: 'run-only', widgetRunOnlyShowItems: true },
      null,
    );

    // Assert
    expect(getByText('tr:run')).toBeDefined();
    expect(getByText('tr:current')).toBeDefined();
    expect(getByText('tr:fastest')).toBeDefined();
    expect(getByText('tr:average')).toBeDefined();
    expect(getByText('tr:runItems')).toBeDefined();
    expect(getByPlaceholderText('tr:addItemPlaceholder')).toBeDefined();
  });

  it('If a session has no runs yet, Then the add item placeholder asks to start a run in translated copy', () => {
    // Arrange
    markTranslations();
    const store = useRunTrackerStore() as unknown as {
      runs: Map<string, Run[]>;
    };
    store.runs.clear();

    // Act
    const { getByPlaceholderText } = renderWidget(
      { widgetDisplay: 'run-only', widgetRunOnlyShowItems: true },
      null,
    );

    // Assert
    expect(getByPlaceholderText('tr:startRunFirst')).toBeDefined();
  });

  it('If statistics are not loaded yet, Then the loading message is translated', () => {
    // Arrange
    markTranslations();

    // Act
    const { getByText } = renderWidget({ widgetDisplay: 'overall' }, null);

    // Assert
    expect(getByText('tr:loading')).toBeDefined();
  });

  it('If gauges are shown, Then their labels are translated', () => {
    // Arrange
    markTranslations();
    const statistics: GrailStatistics = {
      totalItems: 100,
      foundItems: 40,
      completionPercentage: 40,
      recentFinds: 0,
      normalItems: { total: 60, found: 30 },
      etherealItems: { total: 40, found: 10 },
      currentStreak: 0,
      maxStreak: 0,
    };

    // Act
    const overall = renderWidget({ widgetDisplay: 'overall' }, statistics);

    // Assert
    expect(overall.getAllByText('tr:overall').length).toBeGreaterThan(0);
    overall.unmount();

    // Act
    const split = renderWidget({ widgetDisplay: 'split', grailEthereal: true }, statistics);

    // Assert
    expect(split.getAllByText('tr:normal').length).toBeGreaterThan(0);
    expect(split.getAllByText('tr:ethereal').length).toBeGreaterThan(0);
  });
});
