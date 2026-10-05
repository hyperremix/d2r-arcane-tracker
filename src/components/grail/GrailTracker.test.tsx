import { render, screen } from '@testing-library/react';
import type { GrailStatistics, Settings } from 'electron/types/grail';
import { GameMode, GameVersion } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { GrailTracker } from './GrailTracker';

vi.mock('@/stores/grailStore');
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

function setupStoreMock(settingsOverrides: Partial<Settings> = {}) {
  const storeState = {
    settings: { ...defaultSettings, ...settingsOverrides },
    setCharacters: vi.fn(),
    setItems: vi.fn(),
    setProgress: vi.fn(),
    setLoading: vi.fn(),
    hydrateSettings: vi.fn(),
  };
  vi.mocked(useGrailStore).mockReturnValue(
    storeState as unknown as ReturnType<typeof useGrailStore>,
  );
  vi.mocked(useGrailStatistics).mockReturnValue(
    statistics as unknown as ReturnType<typeof useGrailStatistics>,
  );
}

describe('When GrailTracker is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('If ethereal tracking is enabled in settings', () => {
    it('Then passes showEtherealBreakdown=true to ProgressSummary', () => {
      // Arrange
      setupStoreMock({ grailEthereal: true });

      // Act
      render(<GrailTracker />);

      // Assert
      const summary = screen.getByTestId('progress-summary');
      expect(summary).toHaveAttribute('data-show-ethereal-breakdown', 'true');
      expect(summary).toHaveAttribute('data-found-items', '190');
    });
  });

  describe('If ethereal tracking is disabled in settings', () => {
    it('Then passes showEtherealBreakdown=false to ProgressSummary', () => {
      // Arrange
      setupStoreMock({ grailEthereal: false });

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
