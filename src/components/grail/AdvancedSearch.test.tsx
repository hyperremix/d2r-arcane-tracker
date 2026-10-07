import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Item, Settings } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HolyGrailItemBuilder } from '@/fixtures/HolyGrailItemBuilder';
import { useGrailStore } from '@/stores/grailStore';
import { AdvancedSearch } from './AdvancedSearch';

const SEARCH_DEBOUNCE_MS = 150;

const subCategoryItems: Item[] = [
  HolyGrailItemBuilder.new().withId('shako').withArmorSubCategory('helms').build(),
  HolyGrailItemBuilder.new().withId('arkaines').withArmorSubCategory('body_armor').build(),
  {
    ...HolyGrailItemBuilder.new().withId('arreats').withCategory('armor').build(),
    subCategory: 'barbarian',
  },
  HolyGrailItemBuilder.new().withId('azurewrath').withWeaponSubCategory('1h_swords').build(),
  HolyGrailItemBuilder.new()
    .withId('enigma')
    .withType('runeword')
    .withRunewordSubCategory('runewords')
    .build(),
  HolyGrailItemBuilder.new().withId('annihilus').withCharmSubCategory('small_charms').build(),
];

const initialStoreState = useGrailStore.getInitialState();

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
      expect(screen.getByLabelText('Search')).toHaveAttribute(
        'placeholder',
        'Search name, base, set or rune...',
      );
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
    it('Then shows category checkboxes but no type checkboxes', async () => {
      // Arrange
      render(<AdvancedSearch />);

      // Act
      openFiltersPopover();

      // Assert
      expect(await screen.findByLabelText('Weapons')).toBeInTheDocument();
      expect(screen.getByLabelText('Armor')).toBeInTheDocument();
      expect(screen.getByLabelText('Jewelry')).toBeInTheDocument();
      expect(screen.getByLabelText('Charms')).toBeInTheDocument();
      expect(screen.queryByLabelText('Unique')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Set')).not.toBeInTheDocument();
    });

    it('Then shows the sub-categories of the loaded items grouped by category', async () => {
      // Arrange
      useGrailStore.setState({ items: subCategoryItems });
      render(<AdvancedSearch />);

      // Act
      openFiltersPopover();

      // Assert
      const subCategories = await screen.findByRole('group', { name: 'Sub-categories' });
      const armorGroup = within(subCategories).getByRole('group', { name: 'Armor' });
      const weaponGroup = within(subCategories).getByRole('group', { name: 'Weapons' });
      expect(within(armorGroup).getByLabelText('Helms')).toBeInTheDocument();
      expect(within(armorGroup).getByLabelText('Barbarian')).toBeInTheDocument();
      expect(within(weaponGroup).getByLabelText('1H Swords')).toBeInTheDocument();
      expect(within(subCategories).queryByRole('group', { name: 'Jewelry' })).toBeNull();
      expect(within(subCategories).queryByLabelText('Runewords')).toBeNull();
    });

    it('Then lists regular sub-categories alphabetically before class sub-categories', async () => {
      // Arrange
      useGrailStore.setState({ items: subCategoryItems });
      render(<AdvancedSearch />);

      // Act
      openFiltersPopover();

      // Assert
      const subCategories = await screen.findByRole('group', { name: 'Sub-categories' });
      const armorGroup = within(subCategories).getByRole('group', { name: 'Armor' });
      const labels = within(armorGroup)
        .getAllByRole('checkbox')
        .map((checkbox) => checkbox.parentElement?.textContent);
      expect(labels).toEqual(['Body Armor', 'Helms', 'Barbarian']);
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

    it('Then toggling a sub-category updates the store sub-categories', async () => {
      // Arrange
      useGrailStore.setState({ items: subCategoryItems });
      render(<AdvancedSearch />);
      openFiltersPopover();

      // Act
      fireEvent.click(await screen.findByLabelText('Helms'));

      // Assert
      expect(useGrailStore.getState().filter.subCategories).toEqual(['helms']);
    });
  });

  describe('If the toolbar shows the item type toggles', () => {
    it('Then shows Unique and Set but hides untracked rune and runeword types', () => {
      // Arrange & Act
      render(<AdvancedSearch />);

      // Assert
      const types = screen.getByRole('group', { name: 'Types' });
      expect(within(types).getByRole('button', { name: 'Unique' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(within(types).getByRole('button', { name: 'Set' })).toBeInTheDocument();
      expect(within(types).queryByRole('button', { name: 'Rune' })).not.toBeInTheDocument();
      expect(within(types).queryByRole('button', { name: 'Runeword' })).not.toBeInTheDocument();
    });

    it('Then includes rune and runeword types if they are tracked', () => {
      // Arrange
      resetStore({ grailRunes: true, grailRunewords: true });

      // Act
      render(<AdvancedSearch />);

      // Assert
      const types = screen.getByRole('group', { name: 'Types' });
      expect(within(types).getByRole('button', { name: 'Rune' })).toBeInTheDocument();
      expect(within(types).getByRole('button', { name: 'Runeword' })).toBeInTheDocument();
    });

    it('Then clicking a type toggles it in the store and marks it as pressed', () => {
      // Arrange
      render(<AdvancedSearch />);
      const setToggle = screen.getByRole('button', { name: 'Set' });

      // Act
      fireEvent.click(setToggle);

      // Assert
      expect(useGrailStore.getState().filter.types).toEqual(['set']);
      expect(setToggle).toHaveAttribute('aria-pressed', 'true');
    });

    it('Then clicking a pressed type removes it from the store again', () => {
      // Arrange
      useGrailStore.getState().setFilter({ types: ['set'] });
      render(<AdvancedSearch />);
      const setToggle = screen.getByRole('button', { name: 'Set' });

      // Act
      fireEvent.click(setToggle);

      // Assert
      expect(useGrailStore.getState().filter.types).toEqual([]);
      expect(setToggle).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('If categories, sub-categories and types are selected', () => {
    it('Then the filters trigger counts only the filters inside the popover', () => {
      // Arrange
      useGrailStore.getState().setFilter({
        categories: ['armor', 'weapons'],
        subCategories: ['helms'],
        types: ['set'],
      });

      // Act
      render(<AdvancedSearch />);

      // Assert
      const trigger = screen.getByRole('button', { name: 'Filters (3 active)' });
      expect(within(trigger).getByText('3')).toBeInTheDocument();
    });

    it('Then shows removable chips that update the store when removed', () => {
      // Arrange
      useGrailStore
        .getState()
        .setFilter({ categories: ['armor'], subCategories: ['helms'], types: ['set'] });
      render(<AdvancedSearch />);
      const chips = screen.getByRole('list', { name: 'Active filters' });
      expect(within(chips).getByText('Armor')).toBeInTheDocument();
      expect(within(chips).getByText('Helms')).toBeInTheDocument();
      expect(within(chips).getByText('Set')).toBeInTheDocument();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Armor' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Helms' }));

      // Assert
      expect(useGrailStore.getState().filter.categories).toEqual([]);
      expect(useGrailStore.getState().filter.subCategories).toEqual([]);
      expect(useGrailStore.getState().filter.types).toEqual(['set']);
    });
  });

  describe('If items are loaded', () => {
    it('Then shows a polite live count of the shown items out of all items', () => {
      // Arrange
      useGrailStore.setState({ items: subCategoryItems });
      render(<AdvancedSearch />);
      const count = screen.getByText('6 of 6 items');

      // Act
      act(() => {
        useGrailStore.getState().setFilter({ subCategories: ['helms'] });
      });

      // Assert
      expect(count).toHaveAttribute('aria-live', 'polite');
      expect(count).toHaveTextContent('1 of 6 items');
    });
  });

  describe('If no items are loaded yet', () => {
    it('Then the result count is empty', () => {
      // Arrange & Act
      render(<AdvancedSearch />);

      // Assert
      expect(screen.queryByText(/of \d+ items?/)).not.toBeInTheDocument();
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
    it('Then the type is removed from the filter, the type toggles and the chips', () => {
      // Arrange
      resetStore({ grailRunes: true });
      useGrailStore.getState().setFilter({ types: ['rune'] });
      render(<AdvancedSearch />);
      expect(screen.getByRole('button', { name: 'Rune' })).toHaveAttribute('aria-pressed', 'true');

      // Act
      act(() => {
        useGrailStore.getState().hydrateSettings({ grailRunes: false });
      });

      // Assert
      expect(useGrailStore.getState().filter.types).toEqual([]);
      expect(screen.queryByRole('button', { name: 'Rune' })).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
    });
  });

  describe('If user presses a focus-search shortcut', () => {
    it.each([
      ['/', {}],
      ['Ctrl+F', { key: 'f', ctrlKey: true }],
      ['Cmd+F', { key: 'f', metaKey: true }],
    ])('Then %s focuses the search input', (_label, init) => {
      // Arrange
      render(<AdvancedSearch />);
      const input = screen.getByLabelText('Search');
      const eventInit = { key: '/', ...init };

      // Act
      const notPrevented = fireEvent.keyDown(document.body, eventInit);

      // Assert
      expect(input).toHaveFocus();
      expect(notPrevented).toBe(false);
    });

    it('Then does not steal focus while typing in another input', () => {
      // Arrange
      render(
        <>
          <input aria-label="Other field" />
          <AdvancedSearch />
        </>,
      );
      const otherField = screen.getByLabelText('Other field');
      otherField.focus();

      // Act
      const notPrevented = fireEvent.keyDown(otherField, { key: '/' });

      // Assert
      expect(otherField).toHaveFocus();
      expect(notPrevented).toBe(true);
    });

    it('Then does not focus the search input while a dialog is open', () => {
      // Arrange
      render(
        <>
          <div role="dialog" aria-label="Item details" />
          <AdvancedSearch />
        </>,
      );

      // Act
      fireEvent.keyDown(document.body, { key: 'f', ctrlKey: true });

      // Assert
      expect(screen.getByLabelText('Search')).not.toHaveFocus();
    });

    it('Then typing "/" in the search input is not intercepted', () => {
      // Arrange
      render(<AdvancedSearch />);
      const input = screen.getByLabelText('Search');
      input.focus();

      // Act
      const notPrevented = fireEvent.keyDown(input, { key: '/' });

      // Assert
      expect(notPrevented).toBe(true);
    });

    it('Then the shortcut listener is removed when the toolbar unmounts', () => {
      // Arrange
      const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
      const { unmount } = render(<AdvancedSearch />);

      // Act
      unmount();

      // Assert
      expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeListenerSpy.mockRestore();
    });
  });

  describe('If user presses Escape in the search input', () => {
    it('Then clears the search input and the store search term', () => {
      // Arrange
      useGrailStore.getState().setFilter({ searchTerm: 'Shako' });
      render(<AdvancedSearch />);
      const input = screen.getByLabelText('Search');
      input.focus();

      // Act
      fireEvent.keyDown(input, { key: 'Escape' });

      // Assert
      expect(input).toHaveValue('');
      expect(useGrailStore.getState().filter.searchTerm).toBe('');
      expect(input).toHaveFocus();
    });

    it('Then leaves the field if it is already empty', () => {
      // Arrange
      render(<AdvancedSearch />);
      const input = screen.getByLabelText('Search');
      input.focus();

      // Act
      fireEvent.keyDown(input, { key: 'Escape' });

      // Assert
      expect(input).not.toHaveFocus();
    });
  });
});
