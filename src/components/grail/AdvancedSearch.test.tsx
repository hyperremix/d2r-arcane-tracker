import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Settings } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { AdvancedSearch } from './AdvancedSearch';

const SEARCH_DEBOUNCE_MS = 150;

const initialStoreState = useGrailStore.getState();

function resetStore(settings: Partial<Settings> = {}) {
  useGrailStore.setState(
    {
      ...initialStoreState,
      filter: { foundStatus: 'all' },
      advancedFilter: { ...initialStoreState.advancedFilter },
      viewMode: 'grid',
      groupMode: 'none',
      settings: { ...initialStoreState.settings, ...settings },
    },
    true,
  );
}

function openFiltersPopover() {
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
}

describe('When AdvancedSearch toolbar is rendered', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetStore();
  });

  describe('If no filters are active', () => {
    it('Then renders the search input, status control, sort, group and view controls', () => {
      // Arrange & Act
      render(<AdvancedSearch />);

      // Assert
      expect(screen.getByLabelText('Search')).toHaveAttribute('placeholder', 'Search items...');
      expect(screen.getByRole('group', { name: 'Status' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
      expect(screen.getByLabelText('Sort By')).toBeInTheDocument();
      expect(screen.getByLabelText('Group By')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('Then does not show the clear all button, filter count or active filter chips', () => {
      // Arrange & Act
      render(<AdvancedSearch />);

      // Assert
      expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
      expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
    });
  });

  describe('If user types in the search input', () => {
    it('Then updates the input immediately and the store searchTerm after the debounce', () => {
      // Arrange
      vi.useFakeTimers();
      render(<AdvancedSearch />);
      const input = screen.getByLabelText('Search');

      // Act
      fireEvent.change(input, { target: { value: 'Shako' } });
      const searchTermBeforeDebounce = useGrailStore.getState().filter.searchTerm;
      act(() => {
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      });

      // Assert
      expect(input).toHaveValue('Shako');
      expect(searchTermBeforeDebounce).toBeUndefined();
      expect(useGrailStore.getState().filter.searchTerm).toBe('Shako');
    });
  });

  describe('If user types and the component unmounts before the debounce elapses', () => {
    it('Then commits the pending search term to the store', () => {
      // Arrange
      vi.useFakeTimers();
      const { unmount } = render(<AdvancedSearch />);
      fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Shako' } });

      // Act
      unmount();

      // Assert
      expect(useGrailStore.getState().filter.searchTerm).toBe('Shako');
    });
  });

  describe('If filters are set and the component remounts', () => {
    it('Then the controls reflect the store filter state', () => {
      // Arrange
      vi.useFakeTimers();
      const { unmount } = render(<AdvancedSearch />);
      fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Shako' } });
      act(() => {
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      });
      fireEvent.click(screen.getByRole('button', { name: 'Missing' }));
      fireEvent.click(screen.getByRole('button', { name: 'Fuzzy Search' }));

      // Act — simulate navigating away and back
      unmount();
      render(<AdvancedSearch />);

      // Assert
      expect(screen.getByLabelText('Search')).toHaveValue('Shako');
      expect(screen.getByRole('button', { name: 'Missing' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Fuzzy Search' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  describe('If the store filter changes elsewhere', () => {
    it('Then the toolbar reflects the store state', () => {
      // Arrange
      render(<AdvancedSearch />);

      // Act
      act(() => {
        useGrailStore.getState().setFilter({ searchTerm: 'Windforce', foundStatus: 'found' });
      });

      // Assert
      expect(screen.getByLabelText('Search')).toHaveValue('Windforce');
      expect(screen.getByRole('button', { name: 'Found' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('Then clears the search input if the store filters are reset', () => {
      // Arrange
      useGrailStore.getState().setFilter({ searchTerm: 'Shako', categories: ['armor'] });
      render(<AdvancedSearch />);
      expect(screen.getByLabelText('Search')).toHaveValue('Shako');

      // Act
      act(() => {
        useGrailStore.getState().resetFilters();
      });

      // Assert
      expect(screen.getByLabelText('Search')).toHaveValue('');
      expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
    });
  });

  describe('If user selects a found status segment', () => {
    it('Then updates foundStatus in the store and marks the segment as pressed', () => {
      // Arrange
      render(<AdvancedSearch />);
      const missingButton = screen.getByRole('button', { name: 'Missing' });

      // Act
      fireEvent.click(missingButton);

      // Assert
      expect(useGrailStore.getState().filter.foundStatus).toBe('missing');
      expect(missingButton).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('If user toggles fuzzy search', () => {
    it('Then enables fuzzy search in the store', () => {
      // Arrange
      render(<AdvancedSearch />);
      const fuzzyToggle = screen.getByRole('button', { name: 'Fuzzy Search' });

      // Act
      fireEvent.click(fuzzyToggle);

      // Assert
      expect(useGrailStore.getState().advancedFilter.fuzzySearch).toBe(true);
      expect(fuzzyToggle).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('If user opens the filters popover', () => {
    it('Then shows category and type checkboxes', async () => {
      // Arrange
      render(<AdvancedSearch />);

      // Act
      openFiltersPopover();

      // Assert
      expect(await screen.findByLabelText('Weapons')).toBeInTheDocument();
      expect(screen.getByLabelText('Armor')).toBeInTheDocument();
      expect(screen.getByLabelText('Jewelry')).toBeInTheDocument();
      expect(screen.getByLabelText('Charms')).toBeInTheDocument();
      expect(screen.getByLabelText('Unique')).toBeInTheDocument();
      expect(screen.getByLabelText('Set')).toBeInTheDocument();
      expect(screen.queryByLabelText('Rune')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Runeword')).not.toBeInTheDocument();
    });

    it('Then includes rune and runeword types if they are tracked', async () => {
      // Arrange
      resetStore({ grailRunes: true, grailRunewords: true });
      render(<AdvancedSearch />);

      // Act
      openFiltersPopover();

      // Assert
      expect(await screen.findByLabelText('Rune')).toBeInTheDocument();
      expect(screen.getByLabelText('Runeword')).toBeInTheDocument();
    });

    it('Then toggling a category updates the store categories', async () => {
      // Arrange
      render(<AdvancedSearch />);
      openFiltersPopover();

      // Act
      fireEvent.click(await screen.findByLabelText('Armor'));

      // Assert
      expect(useGrailStore.getState().filter.categories).toEqual(['armor']);
    });

    it('Then toggling a type updates the store types', async () => {
      // Arrange
      render(<AdvancedSearch />);
      openFiltersPopover();

      // Act
      fireEvent.click(await screen.findByLabelText('Set'));

      // Assert
      expect(useGrailStore.getState().filter.types).toEqual(['set']);
    });
  });

  describe('If categories and types are selected', () => {
    it('Then the filters trigger shows the active filter count', () => {
      // Arrange
      useGrailStore.getState().setFilter({ categories: ['armor', 'weapons'], types: ['set'] });

      // Act
      render(<AdvancedSearch />);

      // Assert
      const trigger = screen.getByRole('button', { name: 'Filters (3 active)' });
      expect(within(trigger).getByText('3')).toBeInTheDocument();
    });

    it('Then shows removable chips that update the store when removed', () => {
      // Arrange
      useGrailStore.getState().setFilter({ categories: ['armor'], types: ['set'] });
      render(<AdvancedSearch />);
      const chips = screen.getByRole('list', { name: 'Active filters' });
      expect(within(chips).getByText('Armor')).toBeInTheDocument();
      expect(within(chips).getByText('Set')).toBeInTheDocument();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Armor' }));

      // Assert
      expect(useGrailStore.getState().filter.categories).toEqual([]);
      expect(useGrailStore.getState().filter.types).toEqual(['set']);
    });
  });

  describe('If user clicks the sort direction toggle', () => {
    it('Then flips the sort order in the store and updates its label', () => {
      // Arrange
      render(<AdvancedSearch />);
      const toggle = screen.getByRole('button', { name: 'Sort order: Descending' });

      // Act
      fireEvent.click(toggle);

      // Assert
      expect(useGrailStore.getState().advancedFilter.sortOrder).toBe('asc');
      expect(screen.getByRole('button', { name: 'Sort order: Ascending' })).toBeInTheDocument();
    });

    it('Then toggles back to descending on a second click', () => {
      // Arrange
      render(<AdvancedSearch />);
      fireEvent.click(screen.getByRole('button', { name: 'Sort order: Descending' }));

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Sort order: Ascending' }));

      // Assert
      expect(useGrailStore.getState().advancedFilter.sortOrder).toBe('desc');
    });
  });

  describe('If user clicks the list view toggle', () => {
    it('Then sets the view mode to list in the store', () => {
      // Arrange
      render(<AdvancedSearch />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'List' }));

      // Assert
      expect(useGrailStore.getState().viewMode).toBe('list');
      expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('If something is active and user clicks Clear all', () => {
    it('Then resets filters and sorting in the store and hides the button', () => {
      // Arrange
      useGrailStore.getState().setFilter({
        searchTerm: 'Shako',
        foundStatus: 'missing',
        categories: ['armor'],
        types: ['unique'],
      });
      useGrailStore.getState().setAdvancedFilter({
        sortBy: 'name',
        sortOrder: 'asc',
        fuzzySearch: true,
      });
      render(<AdvancedSearch />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

      // Assert
      const { filter, advancedFilter } = useGrailStore.getState();
      expect(filter).toEqual({ foundStatus: 'all' });
      expect(advancedFilter).toEqual(
        expect.objectContaining({ sortBy: 'found_date', sortOrder: 'desc', fuzzySearch: false }),
      );
      expect(screen.getByLabelText('Search')).toHaveValue('');
      expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
    });

    it('Then discards a search edit that is still pending', () => {
      // Arrange
      vi.useFakeTimers();
      useGrailStore.getState().setFilter({ foundStatus: 'missing' });
      render(<AdvancedSearch />);
      const input = screen.getByLabelText('Search');
      fireEvent.change(input, { target: { value: 'Shako' } });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
      act(() => {
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      });

      // Assert
      expect(input).toHaveValue('');
      expect(useGrailStore.getState().filter.searchTerm).toBeUndefined();
    });
  });

  describe('If only the sort order differs from the default', () => {
    it('Then shows the clear all button', () => {
      // Arrange
      useGrailStore.getState().setAdvancedFilter({ sortOrder: 'asc' });

      // Act
      render(<AdvancedSearch />);

      // Assert
      expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
    });
  });

  describe('If the store filters are cleared externally while a search edit is still pending', () => {
    it('Then the pending edit is discarded and the input is cleared', () => {
      // Arrange
      vi.useFakeTimers();
      useGrailStore.getState().setFilter({ searchTerm: 'nomatch' });
      render(<AdvancedSearch />);
      const input = screen.getByLabelText('Search');
      fireEvent.change(input, { target: { value: 'edited' } });

      // Act
      act(() => {
        useGrailStore.getState().resetFilters();
      });
      act(() => {
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      });

      // Assert
      expect(input).toHaveValue('');
      expect(useGrailStore.getState().filter.searchTerm).toBeUndefined();
    });

    it('Then the pending edit is discarded even if the store search term was already empty', () => {
      // Arrange
      vi.useFakeTimers();
      useGrailStore.getState().setFilter({ types: ['unique'] });
      render(<AdvancedSearch />);
      const input = screen.getByLabelText('Search');
      fireEvent.change(input, { target: { value: 'edited' } });

      // Act
      act(() => {
        useGrailStore.getState().resetFilters();
      });
      act(() => {
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      });

      // Assert
      expect(input).toHaveValue('');
      expect(useGrailStore.getState().filter.searchTerm).toBeUndefined();
    });
  });

  describe('If a selected type becomes unavailable because its tracking setting is disabled', () => {
    it('Then the type is removed from the filter, the chips and the active filter count', () => {
      // Arrange
      resetStore({ grailRunes: true });
      useGrailStore.getState().setFilter({ types: ['rune'] });
      render(<AdvancedSearch />);
      expect(screen.getByRole('button', { name: 'Filters (1 active)' })).toBeInTheDocument();

      // Act
      act(() => {
        useGrailStore.getState().hydrateSettings({ grailRunes: false });
      });

      // Assert
      expect(useGrailStore.getState().filter.types).toEqual([]);
      expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
    });
  });
});
