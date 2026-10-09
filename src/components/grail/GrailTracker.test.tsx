import { render, screen } from '@testing-library/react';
import type { GrailStatistics, Settings } from 'electron/types/grail';
import { GameMode, GameVersion } from 'electron/types/grail';
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
vi.mock('./ItemGrid', () => ({
  ItemGrid: () => <div data-testid="item-grid" />,
}));
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

interface WindowWithApis {
  electronAPI?: unknown;
}

const testWindow = window as unknown as WindowWithApis;
const originalElectronAPI = testWindow.electronAPI;
beforeEach(() => {
  testWindow.electronAPI = {
    grail: {
      getSettings: vi.fn(),
      getCharacters: vi.fn(),
      getItems: vi.fn(),
      getProgress: vi.fn(),
    },
    on: vi.fn(() => () => undefined),
  };
  vi.mocked(useGrailStatistics).mockReset();
  useGrailStore.setState(initialStoreState, true);
});

afterEach(() => {
  testWindow.electronAPI = originalElectronAPI;
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

describe('When GrailTracker is rendered as a page', () => {
  it('If the statistics are loaded, Then exactly one level-1 heading is present', () => {
    // Arrange
    setupStatistics();

    // Act
    render(<GrailTracker />);

    // Assert
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Holy Grail' })).toBeInTheDocument();
  });
});

describe('When GrailTracker mounts', () => {
  it('Then it does not load grail data itself, since App loads it once for the whole window', () => {
    // Arrange
    setupStatistics();
    const grail = (testWindow.electronAPI as { grail: Record<string, ReturnType<typeof vi.fn>> })
      .grail;

    // Act
    render(<GrailTracker />);

    // Assert
    expect(grail.getSettings).not.toHaveBeenCalled();
    expect(grail.getItems).not.toHaveBeenCalled();
    expect(grail.getProgress).not.toHaveBeenCalled();
  });
});
