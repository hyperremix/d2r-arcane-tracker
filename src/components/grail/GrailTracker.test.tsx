import { act, render, screen, waitFor } from '@testing-library/react';
import type { GrailStatistics, Settings } from 'electron/types/grail';
import { GameMode, GameVersion } from 'electron/types/grail';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { GrailTracker } from './GrailTracker';

vi.mock('@/stores/grailStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/grailStore')>()),
  useGrailStatistics: vi.fn(),
}));
vi.mock('./AdvancedSearch', () => ({
  AdvancedSearch: () => <div data-testid="advanced-search" />,
}));
const itemGridObservations = vi.hoisted(() => ({ loadingAtFirstEffect: [] as boolean[] }));
vi.mock('./ItemGrid', async () => {
  const { useGrailStore: store } = await import('@/stores/grailStore');
  return {
    ItemGrid: () => {
      // Child passive effects flush after the first commit, before the parent's passive effects.
      // This records the store loading flag as it is when the first committed render is painted.
      useEffect(() => {
        itemGridObservations.loadingAtFirstEffect.push(store.getState().loading);
      }, []);
      return <div data-testid="item-grid" />;
    },
  };
});
vi.mock('./ProgressSummary', () => ({
  ProgressSummary: ({
    statistics,
    showEtherealBreakdown,
  }: {
    statistics: GrailStatistics;
    showEtherealBreakdown: boolean;
  }) => (
    <div
      data-testid="progress-summary"
      data-found-items={statistics.foundItems}
      data-show-ethereal-breakdown={String(showEtherealBreakdown)}
    />
  ),
}));

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

const initialStoreState = useGrailStore.getState();

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface WindowWithApis {
  electronAPI?: unknown;
  ipcRenderer?: unknown;
}

const testWindow = window as unknown as WindowWithApis;
const originalElectronAPI = testWindow.electronAPI;
const originalIpcRenderer = testWindow.ipcRenderer;
const getSettings = vi.fn();
const getCharacters = vi.fn();
const getItems = vi.fn();
const getProgress = vi.fn();

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  getSettings.mockReset().mockResolvedValue(undefined);
  getCharacters.mockReset().mockResolvedValue([]);
  getItems.mockReset().mockResolvedValue([]);
  getProgress.mockReset().mockResolvedValue([]);
  testWindow.electronAPI = { grail: { getSettings, getCharacters, getItems, getProgress } };
  testWindow.ipcRenderer = { on: vi.fn(), off: vi.fn() };
  vi.mocked(useGrailStatistics).mockReset();
  useGrailStore.setState(initialStoreState, true);
  itemGridObservations.loadingAtFirstEffect.length = 0;
});

afterEach(() => {
  testWindow.electronAPI = originalElectronAPI;
  testWindow.ipcRenderer = originalIpcRenderer;
  useGrailStore.setState(initialStoreState, true);
  vi.restoreAllMocks();
});

function setupStatistics(settingsOverrides: Partial<Settings> = {}) {
  useGrailStore.setState({ settings: { ...defaultSettings, ...settingsOverrides } });
  vi.mocked(useGrailStatistics).mockReturnValue(
    statistics as unknown as ReturnType<typeof useGrailStatistics>,
  );
}

describe('When GrailTracker is rendered', () => {
  describe('If ethereal tracking is enabled in settings', () => {
    it('Then passes showEtherealBreakdown=true to ProgressSummary', () => {
      // Arrange
      setupStatistics({ grailEthereal: true });

      // Act
      render(<GrailTracker />);

      // Assert
      const summary = screen.getByTestId('progress-summary');
      expect(summary).toHaveAttribute('data-show-ethereal-breakdown', 'true');
      expect(summary).toHaveAttribute('data-found-items', '190');
    });
  });

  describe('If the page lays out the item grid', () => {
    it('Then the grid wrapper bounds its height without becoming the scroll container', () => {
      // Arrange
      setupStatistics();

      // Act
      render(<GrailTracker />);

      // Assert — the grid's own container scrolls so its virtualization can measure the viewport
      const wrapper = screen.getByTestId('item-grid').parentElement;
      expect(wrapper).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
      expect(wrapper).not.toHaveClass('overflow-y-auto');
      expect(wrapper).not.toHaveClass('overflow-auto');
    });
  });

  describe('If ethereal tracking is disabled in settings', () => {
    it('Then passes showEtherealBreakdown=false to ProgressSummary', () => {
      // Arrange
      setupStatistics({ grailEthereal: false });

      // Act
      render(<GrailTracker />);

      // Assert
      expect(screen.getByTestId('progress-summary')).toHaveAttribute(
        'data-show-ethereal-breakdown',
        'false',
      );
    });
  });
});

describe('When GrailTracker mounts', () => {
  describe('If the initial data load is pending and then resolves', () => {
    it('Then the store loading flag is true during the load and false afterwards', async () => {
      // Arrange
      const settingsDeferred = createDeferred<undefined>();
      getSettings.mockReturnValue(settingsDeferred.promise);

      // Act
      render(<GrailTracker />);

      // Assert
      expect(useGrailStore.getState().loading).toBe(true);

      // Act
      settingsDeferred.resolve(undefined);

      // Assert
      await waitFor(() => expect(useGrailStore.getState().loading).toBe(false));
      expect(getItems).toHaveBeenCalledTimes(1);
    });
  });

  describe('If the store has no items yet when GrailTracker is first committed', () => {
    it('Then the loading flag is already true before the first paint so the empty state does not flash', async () => {
      // Arrange
      const settingsDeferred = createDeferred<undefined>();
      getSettings.mockReturnValue(settingsDeferred.promise);

      // Act
      render(<GrailTracker />);

      settingsDeferred.resolve(undefined);
      await waitFor(() => expect(useGrailStore.getState().loading).toBe(false));

      // Assert
      expect(useGrailStore.getState().items).toHaveLength(0);
      expect(itemGridObservations.loadingAtFirstEffect).toEqual([true]);
    });
  });

  describe('If the settings call rejects during the initial data load', () => {
    it('Then the error is logged and the store loading flag is reset to false', async () => {
      // Arrange
      const settingsDeferred = createDeferred<undefined>();
      getSettings.mockReturnValue(settingsDeferred.promise);

      // Act
      render(<GrailTracker />);

      // Assert
      expect(useGrailStore.getState().loading).toBe(true);

      // Act
      settingsDeferred.reject(new Error('settings failed'));

      // Assert
      await waitFor(() => expect(useGrailStore.getState().loading).toBe(false));
      expect(console.error).toHaveBeenCalledWith('Failed to load grail data:', expect.any(Error));
    });
  });

  describe('If one of the parallel data calls rejects', () => {
    it('Then the remaining data is applied and the loading flag is reset once the load settles', async () => {
      // Arrange
      const itemsDeferred = createDeferred<never[]>();
      getItems.mockReturnValue(itemsDeferred.promise);
      getCharacters.mockResolvedValue([]);
      getProgress.mockResolvedValue([]);

      // Act
      render(<GrailTracker />);
      await waitFor(() => expect(getItems).toHaveBeenCalledTimes(1));

      // Assert
      expect(useGrailStore.getState().loading).toBe(true);

      // Act
      itemsDeferred.reject(new Error('items failed'));

      // Assert
      await waitFor(() => expect(useGrailStore.getState().loading).toBe(false));
      expect(console.error).toHaveBeenCalledWith('Failed to load items:', expect.any(Error));
      expect(getProgress).toHaveBeenCalledTimes(1);
    });
  });

  describe('If a second load starts while the first initial load is still pending', () => {
    it('Then the loading flag stays true until the last outstanding load finishes', async () => {
      // Arrange
      const firstSettings = createDeferred<undefined>();
      const secondSettings = createDeferred<undefined>();
      getSettings
        .mockReturnValueOnce(firstSettings.promise)
        .mockReturnValueOnce(secondSettings.promise);
      const first = render(<GrailTracker />);
      first.unmount();
      render(<GrailTracker />);

      // Act
      firstSettings.resolve(undefined);
      await waitFor(() => expect(getItems).toHaveBeenCalledTimes(1));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert
      expect(useGrailStore.getState().loading).toBe(true);

      // Act
      secondSettings.resolve(undefined);

      // Assert
      await waitFor(() => expect(useGrailStore.getState().loading).toBe(false));
      expect(getItems).toHaveBeenCalledTimes(2);
    });
  });
});
