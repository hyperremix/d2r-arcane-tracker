import { fireEvent, render, screen } from '@testing-library/react';
import type { Settings } from 'electron/types/grail';
import { GameMode, GameVersion } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { AdvancedSearch } from './AdvancedSearch';

// Mock the store
vi.mock('@/stores/grailStore');

const mockSetFilter = vi.fn();
const mockSetAdvancedFilter = vi.fn();
const mockSetViewMode = vi.fn();
const mockSetGroupMode = vi.fn();

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

function setupStoreMock(
  overrides: { viewMode?: string; groupMode?: string; settings?: Partial<Settings> } = {},
) {
  const state = {
    setFilter: mockSetFilter,
    setAdvancedFilter: mockSetAdvancedFilter,
    viewMode: overrides.viewMode ?? 'grid',
    setViewMode: mockSetViewMode,
    groupMode: overrides.groupMode ?? 'none',
    setGroupMode: mockSetGroupMode,
    settings: { ...defaultSettings, ...overrides.settings },
  };

  const mockUseGrailStore = vi.mocked(useGrailStore);
  // Handle selector-based calls: useGrailStore((state) => state.someField)
  mockUseGrailStore.mockImplementation((selector?: unknown) => {
    if (typeof selector === 'function') {
      return (selector as (s: typeof state) => unknown)(state);
    }
    return state as ReturnType<typeof useGrailStore>;
  });
}

describe('When AdvancedSearch is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
  });

  describe('If initial state (no active filters)', () => {
    it('Then renders search input', () => {
      // Arrange & Act
      render(<AdvancedSearch />);

      // Assert
      expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument();
    });

    it('Then renders category checkboxes', () => {
      // Arrange & Act
      render(<AdvancedSearch />);

      // Assert
      expect(screen.getByLabelText('Weapons')).toBeInTheDocument();
      expect(screen.getByLabelText('Armor')).toBeInTheDocument();
      expect(screen.getByLabelText('Jewelry')).toBeInTheDocument();
      expect(screen.getByLabelText('Charms')).toBeInTheDocument();
    });

    it('Then renders type checkboxes for Unique and Set', () => {
      // Arrange & Act
      render(<AdvancedSearch />);

      // Assert
      expect(screen.getByLabelText('Unique')).toBeInTheDocument();
      expect(screen.getByLabelText('Set')).toBeInTheDocument();
    });

    it('Then renders view mode buttons', () => {
      // Arrange & Act
      render(<AdvancedSearch />);

      // Assert
      expect(screen.getByRole('button', { name: /Grid/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /List/i })).toBeInTheDocument();
    });

    it('Then does not show active filter count badge', () => {
      // Arrange & Act
      render(<AdvancedSearch />);

      // Assert — no badge with a number should appear when no filters active
      expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
      // The badge only shows when getActiveFiltersCount() > 0
      const badges = screen.queryAllByText(/^\d+$/);
      expect(badges).toHaveLength(0);
    });
  });

  describe('If grailRunes enabled', () => {
    it('Then includes Rune type checkbox', () => {
      // Arrange
      setupStoreMock({ settings: { grailRunes: true } });

      // Act
      render(<AdvancedSearch />);

      // Assert
      expect(screen.getByLabelText('Rune')).toBeInTheDocument();
    });
  });

  describe('If grailRunewords enabled', () => {
    it('Then includes Runeword type checkbox', () => {
      // Arrange
      setupStoreMock({ settings: { grailRunewords: true } });

      // Act
      render(<AdvancedSearch />);

      // Assert
      expect(screen.getByLabelText('Runeword')).toBeInTheDocument();
    });
  });

  describe('If user types in search input', () => {
    it('Then updates input value and calls setFilter with searchTerm', () => {
      // Arrange
      render(<AdvancedSearch />);
      const input = screen.getByPlaceholderText('Search items...');

      // Act
      fireEvent.change(input, { target: { value: 'Shako' } });

      // Assert
      expect(input).toHaveValue('Shako');
      expect(mockSetFilter).toHaveBeenCalledWith(expect.objectContaining({ searchTerm: 'Shako' }));
    });
  });

  describe('If user toggles fuzzy search', () => {
    it('Then calls setAdvancedFilter with fuzzySearch: true', () => {
      // Arrange
      render(<AdvancedSearch />);
      const fuzzyCheckbox = screen.getByLabelText('Fuzzy Search');

      // Act
      fireEvent.click(fuzzyCheckbox);

      // Assert
      expect(mockSetAdvancedFilter).toHaveBeenCalledWith(
        expect.objectContaining({ fuzzySearch: true }),
      );
    });
  });

  describe('If user clicks category checkbox', () => {
    it('Then calls setFilter with categories array containing that value', () => {
      // Arrange
      render(<AdvancedSearch />);
      const armorCheckbox = screen.getByLabelText('Armor');

      // Act
      fireEvent.click(armorCheckbox);

      // Assert
      expect(mockSetFilter).toHaveBeenCalledWith(
        expect.objectContaining({ categories: ['armor'] }),
      );
    });
  });

  describe('If user clicks type checkbox', () => {
    it('Then calls setFilter with types array containing that value', () => {
      // Arrange
      render(<AdvancedSearch />);
      const setCheckbox = screen.getByLabelText('Set');

      // Act
      fireEvent.click(setCheckbox);

      // Assert
      expect(mockSetFilter).toHaveBeenCalledWith(expect.objectContaining({ types: ['set'] }));
    });
  });

  describe('If user clicks Grid button', () => {
    it('Then calls setViewMode with grid', () => {
      // Arrange
      render(<AdvancedSearch />);
      const gridButton = screen.getByRole('button', { name: /Grid/i });

      // Act
      fireEvent.click(gridButton);

      // Assert
      expect(mockSetViewMode).toHaveBeenCalledWith('grid');
    });
  });

  describe('If user clicks List button', () => {
    it('Then calls setViewMode with list', () => {
      // Arrange
      render(<AdvancedSearch />);
      const listButton = screen.getByRole('button', { name: /List/i });

      // Act
      fireEvent.click(listButton);

      // Assert
      expect(mockSetViewMode).toHaveBeenCalledWith('list');
    });
  });

  describe('If user clicks Reset', () => {
    it('Then clears input and calls setFilter and setAdvancedFilter with defaults', () => {
      // Arrange
      render(<AdvancedSearch />);
      const input = screen.getByPlaceholderText('Search items...');

      // First set a search term
      fireEvent.change(input, { target: { value: 'Shako' } });
      vi.clearAllMocks();

      // Act
      const resetButton = screen.getByRole('button', { name: /Reset/i });
      fireEvent.click(resetButton);

      // Assert
      expect(input).toHaveValue('');
      expect(mockSetFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          searchTerm: '',
          categories: [],
          types: [],
          foundStatus: 'all',
        }),
      );
      expect(mockSetAdvancedFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'found_date',
          sortOrder: 'desc',
          fuzzySearch: false,
        }),
      );
    });
  });

  describe('If multiple filters active', () => {
    it('Then shows correct count badge', () => {
      // Arrange
      render(<AdvancedSearch />);

      // Act — activate search and a category
      const input = screen.getByPlaceholderText('Search items...');
      fireEvent.change(input, { target: { value: 'test' } });
      const armorCheckbox = screen.getByLabelText('Armor');
      fireEvent.click(armorCheckbox);

      // Assert — 2 active filters: search + category
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('If grailEthereal enabled', () => {
    it('Then renders without errors', () => {
      // Arrange
      setupStoreMock({ settings: { grailEthereal: true } });

      // Act & Assert — component renders successfully with ethereal enabled
      const { container } = render(<AdvancedSearch />);
      expect(container.querySelector('[data-slot="select-trigger"]')).toBeInTheDocument();
    });
  });
});
