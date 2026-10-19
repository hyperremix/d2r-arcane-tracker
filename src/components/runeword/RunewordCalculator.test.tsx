import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { CharacterInventorySnapshot, Item, ParsedInventoryItem } from 'electron/types/grail';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunewordCalculator } from './RunewordCalculator';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

function createRuneword(id: string, name: string, runes: string[]): Item {
  return {
    id,
    name,
    link: '',
    etherealType: 'none',
    type: 'runeword',
    category: 'weapons',
    subCategory: 'runewords',
    treasureClass: 'normal',
    runes,
  } as Item;
}

const steel = createRuneword('steel', 'Steel', ['tir', 'el']);
const stealth = createRuneword('stealth', 'Stealth', ['tal', 'eth']);
const enigma = createRuneword('enigma', 'Enigma', ['jah', 'ith', 'ber']);
const infinity = createRuneword('infinity', 'Infinity', ['ber', 'mal', 'ber', 'ist']);

// Other suites define a non-configurable `window.electronAPI` (vitest runs with isolate: false),
// so it is replaced by assignment rather than vi.stubGlobal, and restored after each test.
const windowGlobals = window as unknown as Record<string, unknown>;
let originalElectronAPI: PropertyDescriptor | undefined;
let consoleError: { mockRestore: () => void } | undefined;

function createSaveItem(
  overrides: Partial<ParsedInventoryItem>,
  raw: Record<string, unknown> = {},
): ParsedInventoryItem {
  return {
    fingerprint: `fp-${overrides.itemName}-${overrides.gridX ?? 0}`,
    characterName: 'Sorc',
    sourceFileType: 'd2s',
    sourceFilePath: '/saves/Sorc.d2s',
    locationContext: 'inventory',
    itemName: 'Item',
    quality: 'normal',
    ethereal: false,
    socketCount: 0,
    rawItemJson: JSON.stringify(raw),
    seenAt: new Date('2026-10-18T10:00:00.000Z'),
    ...overrides,
  };
}

/** An empty two-socket normal sword in the shared stash: a base for Steel. */
const crystalSword = createSaveItem(
  {
    itemName: 'Crystal Sword',
    itemCode: 'crs',
    sourceFileType: 'd2i',
    sourceFilePath: '/saves/SharedStashSoftCoreV2.d2i',
    locationContext: 'stash',
    stashTab: 2,
    ethereal: true,
  },
  {
    quality: 2,
    total_nr_of_sockets: 2,
    nr_of_items_in_sockets: 0,
    categories: ['Sword', 'Swords and Knives', 'Melee Weapon', 'Weapon'],
  },
);

function createSnapshot(items: ParsedInventoryItem[]): CharacterInventorySnapshot {
  return {
    snapshotId: 'snapshot-1',
    characterName: 'Sorc',
    sourceFileType: 'd2s',
    sourceFilePath: '/saves/Sorc.d2s',
    capturedAt: new Date('2026-10-18T10:00:00.000Z'),
    items,
  };
}

interface ElectronApiOptions {
  runewords?: Item[];
  availableRunes?: Record<string, number>;
  inventoryItems?: ParsedInventoryItem[];
}

function stubElectronApi({
  runewords = [infinity, enigma, steel, stealth],
  availableRunes = { tir: 1, el: 1, tal: 1, eth: 1, jah: 1, ith: 1 },
  inventoryItems = [],
}: ElectronApiOptions = {}) {
  const api = {
    grail: { getAllRunewords: vi.fn().mockResolvedValue(runewords) },
    saveFile: {
      refreshSaveFiles: vi.fn().mockResolvedValue({ success: true }),
      getAvailableRunes: vi.fn().mockResolvedValue(availableRunes),
    },
    inventory: {
      searchAll: vi.fn().mockResolvedValue({
        inventory: {
          snapshots: [createSnapshot(inventoryItems)],
          totalSnapshots: 1,
          totalItems: inventoryItems.length,
        },
        vault: { items: [], total: 0, page: 1, pageSize: 200 },
      }),
    },
    vault: { search: vi.fn() },
    icon: { getByFilename: vi.fn().mockResolvedValue(undefined) },
    shell: { openExternal: vi.fn() },
  };
  windowGlobals.electronAPI = api;
  return api;
}

function getCard(name: string): HTMLElement {
  return screen.getByRole('heading', { name }).closest('[data-slot="card"]') as HTMLElement;
}

function getCardTitles(): string[] {
  return screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent ?? '');
}

async function renderCalculator() {
  render(<RunewordCalculator />);
  await waitFor(() =>
    expect(screen.getByText(/^Showing \d+ of \d+ runewords$/)).toBeInTheDocument(),
  );
}

describe('RunewordCalculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    originalElectronAPI = Object.getOwnPropertyDescriptor(window, 'electronAPI');
  });

  afterEach(() => {
    consoleError?.mockRestore();
    consoleError = undefined;
    if (originalElectronAPI && 'value' in originalElectronAPI) {
      windowGlobals.electronAPI = originalElectronAPI.value;
    } else {
      delete windowGlobals.electronAPI;
    }
  });

  describe('availability filter', () => {
    it('When the page loads, then Runes only is pressed and only craftable runewords show, sorted by name', async () => {
      // Arrange
      stubElectronApi();

      // Act
      await renderCalculator();

      // Assert
      expect(screen.getByRole('button', { name: 'Runes only' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
      expect(getCardTitles()).toEqual(['Filter by runes', 'Stealth', 'Steel']);
    });

    it('When Up to 1 missing is selected, then runewords missing one rune are added after craftable ones', async () => {
      // Arrange
      stubElectronApi();
      await renderCalculator();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Up to 1 missing' }));

      // Assert
      expect(screen.getByRole('button', { name: 'Up to 1 missing' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(getCardTitles()).toEqual(['Filter by runes', 'Stealth', 'Steel', 'Enigma']);
    });

    it('When All is selected, then every runeword shows, sorted by fewest missing runes', async () => {
      // Arrange
      stubElectronApi();
      await renderCalculator();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'All' }));

      // Assert
      expect(getCardTitles()).toEqual([
        'Filter by runes',
        'Stealth',
        'Steel',
        'Enigma',
        'Infinity',
      ]);
      expect(screen.getByText('Showing 4 of 4 runewords')).toBeInTheDocument();
    });

    it('If nothing is craftable, then the empty state offers to show runewords missing at most 1 rune', async () => {
      // Arrange
      stubElectronApi({ availableRunes: { jah: 1, ith: 1 } });
      await renderCalculator();
      expect(screen.getByText("You don't have the runes for any runeword yet")).toBeInTheDocument();

      // Act
      fireEvent.click(
        screen.getByRole('button', { name: 'Show runewords missing at most 1 rune' }),
      );

      // Assert
      expect(screen.getByRole('button', { name: 'Up to 1 missing' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(getCardTitles()).toEqual(['Filter by runes', 'Enigma']);
    });

    it('If nothing is craftable or missing at most 1 rune, then the empty state offers Show all and applies it', async () => {
      // Arrange
      stubElectronApi({ availableRunes: {} });
      await renderCalculator();
      expect(screen.getByText("You don't have the runes for any runeword yet")).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Show runewords missing at most 1 rune' }),
      ).not.toBeInTheDocument();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Show all runewords' }));

      // Assert
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Showing 4 of 4 runewords')).toBeInTheDocument();
    });
  });

  describe('readiness', () => {
    it('When Runes and base is selected, then only craftable runewords with an owned base show', async () => {
      // Arrange
      stubElectronApi({ inventoryItems: [crystalSword] });
      await renderCalculator();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Runes and base' }));

      // Assert
      expect(getCardTitles()).toEqual(['Filter by runes', 'Steel']);
      expect(within(getCard('Steel')).getByRole('button', { name: '1 owned base' })).toBeVisible();
    });

    it('When an owned base is expanded, then it shows its name, ethereal flag and location', async () => {
      // Arrange
      stubElectronApi({ inventoryItems: [crystalSword] });
      await renderCalculator();
      const steelCard = getCard('Steel');

      // Act
      fireEvent.click(within(steelCard).getByRole('button', { name: '1 owned base' }));

      // Assert
      await waitFor(() => expect(within(steelCard).getByText('Crystal Sword')).toBeVisible());
      expect(within(steelCard).getByText('Ethereal')).toBeVisible();
      expect(within(steelCard).getByText('Shared stash, Stash tab 3')).toBeVisible();
    });

    it('If no owned base fits a runeword, then its card says so', async () => {
      // Arrange
      stubElectronApi({ inventoryItems: [crystalSword] });

      // Act
      await renderCalculator();

      // Assert
      expect(within(getCard('Stealth')).getByText('No owned base')).toBeVisible();
    });

    it('When With upgrades is selected, then runewords the owned runes and gems can be cubed into show with their plan', async () => {
      // Arrange
      stubElectronApi({
        availableRunes: { tir: 1, el: 1, jah: 1, ith: 1, sur: 2 },
        inventoryItems: [createSaveItem({ itemName: 'Flawless Amethyst', itemCode: 'gzv' })],
      });
      await renderCalculator();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'With upgrades' }));

      // Assert
      expect(getCardTitles()).toEqual(['Filter by runes', 'Steel', 'Enigma']);
      const enigmaCard = getCard('Enigma');
      expect(within(enigmaCard).getByText('Makeable with upgrades')).toBeVisible();
      const plan = within(enigmaCard).getByRole('list', { name: 'Horadric Cube rune upgrades' });
      expect(
        within(plan)
          .getAllByRole('listitem')
          .map((step) => step.textContent),
      ).toEqual(['Cube 2 Sur + Flawless Amethyst → Ber']);
    });

    it('If the gem an upgrade needs is not owned, then the runeword is not makeable with upgrades', async () => {
      // Arrange
      stubElectronApi({ availableRunes: { tir: 1, el: 1, jah: 1, ith: 1, sur: 2 } });
      await renderCalculator();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'With upgrades' }));

      // Assert
      expect(getCardTitles()).toEqual(['Filter by runes', 'Steel']);
    });

    it('If owned gems and bases cannot be loaded, then runewords still show from the rune counts and an error toast is shown', async () => {
      // Arrange
      const api = stubElectronApi();
      api.inventory.searchAll.mockRejectedValue(new Error('inventory failed'));
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      // Act
      await renderCalculator();

      // Assert
      expect(getCardTitles()).toEqual(['Filter by runes', 'Stealth', 'Steel']);
      expect(within(getCard('Steel')).getByText('No owned base')).toBeVisible();
      expect(toast.error).toHaveBeenCalledWith('Failed to load owned gems and bases');
    });
  });

  describe('filtered empty state', () => {
    it('If a search hides every craftable runeword, then the generic empty state is shown instead of claiming nothing is craftable', async () => {
      // Arrange
      stubElectronApi();
      await renderCalculator();

      // Act
      fireEvent.change(screen.getByPlaceholderText('Search runewords...'), {
        target: { value: 'Enigma' },
      });

      // Assert
      expect(screen.getByText('No runewords found')).toBeInTheDocument();
      expect(
        screen.queryByText("You don't have the runes for any runeword yet"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Show runewords missing at most 1 rune' }),
      ).toBeInTheDocument();
    });

    it('If a search matches nothing in any tier, then the empty state offers no broader tier', async () => {
      // Arrange
      stubElectronApi();
      await renderCalculator();

      // Act
      fireEvent.change(screen.getByPlaceholderText('Search runewords...'), {
        target: { value: 'zzz' },
      });

      // Assert
      expect(screen.getByText('No runewords found')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Show runewords missing at most 1 rune' }),
      ).not.toBeInTheDocument();
    });

    it('If a search leaves no runewords missing at most 1 rune, then Show all is only offered when it would reveal results', async () => {
      // Arrange
      stubElectronApi();
      await renderCalculator();
      fireEvent.click(screen.getByRole('button', { name: 'Up to 1 missing' }));
      const search = screen.getByPlaceholderText('Search runewords...');

      // Act
      fireEvent.change(search, { target: { value: 'zzz' } });

      // Assert
      expect(screen.queryByRole('button', { name: 'Show all runewords' })).not.toBeInTheDocument();

      // Act
      fireEvent.change(search, { target: { value: 'Infinity' } });

      // Assert
      expect(screen.getByRole('button', { name: 'Show all runewords' })).toBeInTheDocument();
    });
  });

  describe('rune selection', () => {
    it('When several runes are selected, then only runewords using all of them show', async () => {
      // Arrange
      stubElectronApi();
      await renderCalculator();
      fireEvent.click(screen.getByRole('button', { name: 'All' }));

      // Act
      fireEvent.click(screen.getByRole('button', { name: /^Ber,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^Jah,/ }));

      // Assert
      expect(screen.getByText('Shows runewords that use all selected runes')).toBeInTheDocument();
      expect(getCardTitles()).toEqual(['Filter by runes', 'Enigma']);
    });

    it('When Clear selection is clicked, then the rune selection is reset', async () => {
      // Arrange
      stubElectronApi();
      await renderCalculator();
      fireEvent.click(screen.getByRole('button', { name: 'All' }));
      const clearButton = screen.getByRole('button', { name: 'Clear selection' });
      expect(clearButton).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: /^Ber,/ }));
      expect(getCardTitles()).toEqual(['Filter by runes', 'Enigma', 'Infinity']);

      // Act
      fireEvent.click(clearButton);

      // Assert
      expect(screen.getByRole('button', { name: /^Ber,/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(clearButton).toBeDisabled();
      expect(getCardTitles()).toEqual([
        'Filter by runes',
        'Stealth',
        'Steel',
        'Enigma',
        'Infinity',
      ]);
    });
  });

  describe('runeword cards', () => {
    it('When All is selected, then cards missing runes name them and craftable cards show no rune count', async () => {
      // Arrange
      stubElectronApi({ availableRunes: { ber: 1, mal: 1, tir: 1, el: 1 } });
      await renderCalculator();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'All' }));

      // Assert
      expect(within(getCard('Infinity')).getByText('Missing 2 runes: Ber, Ist')).toBeVisible();
      const steelCard = getCard('Steel');
      expect(within(steelCard).queryByText(/^Missing \d/)).not.toBeInTheDocument();
      expect(within(steelCard).queryByText(/\d+\/\d+ runes/)).not.toBeInTheDocument();
    });

    it('If a runeword is craftable, Then its card leads with the base status instead of a rune count', async () => {
      // Arrange
      stubElectronApi({ inventoryItems: [crystalSword] });

      // Act
      await renderCalculator();

      // Assert
      const steelHeading = screen.getByRole('heading', { name: 'Steel' });
      expect(steelHeading.nextElementSibling).toHaveTextContent('1 owned base');
      expect(within(getCard('Steel')).queryByText(/\d+\/\d+ runes/)).not.toBeInTheDocument();
    });

    it('When runewords are shown, Then each card footer shows one socket per rune', async () => {
      // Arrange
      stubElectronApi();
      await renderCalculator();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'All' }));

      // Assert
      const infinityCard = getCard('Infinity');
      const steelCard = getCard('Steel');
      expect(within(infinityCard).getByText('4 sockets')).toBeInTheDocument();
      expect(within(steelCard).getByText('2 sockets')).toBeInTheDocument();
    });

    it('If a runeword has a details link, Then the link is part of that runeword card', async () => {
      // Arrange
      const link = 'https://d2runewizard.com/runewords/Steel';
      stubElectronApi({
        runewords: [
          { ...steel, link },
          { ...stealth, link: '' },
        ],
      });

      // Act
      await renderCalculator();

      // Assert
      const steelCard = getCard('Steel');
      const stealthCard = getCard('Stealth');
      expect(
        within(steelCard).getByRole('link', { name: 'View on d2runewizard' }),
      ).toBeInTheDocument();
      expect(within(stealthCard).queryByRole('link')).not.toBeInTheDocument();
    });

    it('When the details link is clicked, Then it opens externally instead of navigating in the app', async () => {
      // Arrange
      const link = 'https://d2runewizard.com/runewords/Steel';
      const api = stubElectronApi({ runewords: [{ ...steel, link }] });
      await renderCalculator();

      // Act
      const notPrevented = fireEvent.click(
        screen.getByRole('link', { name: 'View on d2runewizard' }),
      );

      // Assert
      expect(notPrevented).toBe(false);
      expect(api.shell.openExternal).toHaveBeenCalledWith(link);
    });

    it('When runewords are shown, Then each card is a subgrid that shares its rows with the grid row', async () => {
      // Arrange
      stubElectronApi();

      // Act
      await renderCalculator();

      // Assert
      const steelCard = getCard('Steel');
      expect(steelCard).toHaveClass('row-span-3', 'grid-rows-subgrid');
    });
  });

  describe('missing runes', () => {
    it('When a runeword card lacks a rune, then the missing rune shows a marker and Missing text inside that card', async () => {
      // Arrange
      stubElectronApi({ availableRunes: { jah: 1, ith: 1 } });
      await renderCalculator();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Up to 1 missing' }));

      // Assert
      const enigmaCard = getCard('Enigma');
      await waitFor(() =>
        expect(within(enigmaCard).getAllByTestId('missing-rune-marker')).toHaveLength(1),
      );
      expect(within(enigmaCard).getByText('Missing')).toHaveClass('sr-only');
    });
  });

  describe('refresh', () => {
    it('When Refresh runes is clicked, then save files are rescanned and rune counts reloaded', async () => {
      // Arrange
      const api = stubElectronApi({ availableRunes: {} });
      await renderCalculator();
      api.saveFile.getAvailableRunes.mockResolvedValue({ tir: 1, el: 1 });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Refresh runes' }));

      // Assert
      await waitFor(() => expect(getCardTitles()).toEqual(['Filter by runes', 'Steel']));
      expect(api.saveFile.refreshSaveFiles).toHaveBeenCalledTimes(2);
    });

    it('While a refresh is pending, then current results stay visible and the button is busy until it resolves', async () => {
      // Arrange
      const api = stubElectronApi();
      await renderCalculator();
      let resolveRefresh: (value: { success: boolean }) => void = () => undefined;
      api.saveFile.refreshSaveFiles.mockReturnValue(
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
      );

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Refresh runes' }));

      // Assert
      const refreshButton = screen.getByRole('button', { name: 'Refresh runes' });
      expect(refreshButton).toBeDisabled();
      expect(refreshButton).toHaveAttribute('aria-busy', 'true');
      expect(getCardTitles()).toEqual(['Filter by runes', 'Stealth', 'Steel']);

      // Act
      resolveRefresh({ success: true });

      // Assert
      await waitFor(() => expect(refreshButton).toBeEnabled());
      expect(refreshButton).toHaveAttribute('aria-busy', 'false');
      expect(getCardTitles()).toEqual(['Filter by runes', 'Stealth', 'Steel']);
    });

    it('If a refresh fails, then an error toast is shown, the button is re-enabled and results remain', async () => {
      // Arrange
      const api = stubElectronApi();
      await renderCalculator();
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      api.saveFile.refreshSaveFiles.mockRejectedValue(new Error('scan failed'));

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Refresh runes' }));

      // Assert
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('Failed to refresh runes from save files'),
      );
      expect(screen.getByRole('button', { name: 'Refresh runes' })).toBeEnabled();
      expect(getCardTitles()).toEqual(['Filter by runes', 'Stealth', 'Steel']);
    });
  });

  describe('page layout', () => {
    it('When the page loads, Then search, view and refresh sit in the toolbar and the sidebar holds only the rune filters', async () => {
      // Arrange
      stubElectronApi();

      // Act
      await renderCalculator();

      // Assert
      const toolbar = screen.getByTestId('runeword-toolbar');
      const sidebar = screen.getByTestId('runeword-sidebar');
      expect(
        within(toolbar).getByRole('textbox', { name: 'Search runewords' }),
      ).toBeInTheDocument();
      expect(within(toolbar).getByRole('group', { name: 'Show runewords' })).toBeInTheDocument();
      expect(within(toolbar).getByRole('button', { name: 'Refresh runes' })).toBeInTheDocument();
      expect(within(sidebar).queryByRole('textbox')).not.toBeInTheDocument();
      expect(within(sidebar).getByRole('group', { name: 'Filter by runes' })).toBeInTheDocument();
    });

    it('When the page loads, Then the runeword grid scrolls in its own container and the sidebar stays outside it', async () => {
      // Arrange
      stubElectronApi();

      // Act
      render(<RunewordCalculator />);
      await waitFor(() => expect(screen.getByTestId('runeword-grid')).toBeInTheDocument());

      // Assert
      const scrollArea = screen.getByTestId('runeword-scroll-area');
      expect(scrollArea).toHaveClass('overflow-y-auto');
      expect(scrollArea).toContainElement(screen.getByTestId('runeword-grid'));
      expect(scrollArea).not.toContainElement(screen.getByTestId('runeword-sidebar'));
      expect(scrollArea).not.toContainElement(screen.getByTestId('runeword-toolbar'));
    });

    it('When the page loads, Then the view options never wrap onto a second line', async () => {
      // Arrange
      stubElectronApi();

      // Act
      await renderCalculator();

      // Assert
      for (const name of [
        'Runes and base',
        'Runes only',
        'With upgrades',
        'Up to 1 missing',
        'All',
      ]) {
        expect(screen.getByRole('button', { name })).toHaveClass('whitespace-nowrap');
      }
    });

    it('When the page loads, Then each view option describes the rule it applies', async () => {
      // Arrange
      stubElectronApi();

      // Act
      await renderCalculator();

      // Assert
      const view = within(screen.getByRole('group', { name: 'Show runewords' }));
      expect(view.getByRole('button', { name: 'Runes and base' })).toHaveAccessibleDescription(
        'You have every rune and an empty base the runeword fits',
      );
      expect(view.getByRole('button', { name: 'Runes only' })).toHaveAccessibleDescription(
        'You have every rune, with or without a base',
      );
      expect(view.getByRole('button', { name: 'With upgrades' })).toHaveAccessibleDescription(
        'You have every rune or can cube the missing ones from your runes and gems',
      );
      expect(view.getByRole('button', { name: 'Up to 1 missing' })).toHaveAccessibleDescription(
        'You need at most one more rune',
      );
      expect(view.getByRole('button', { name: 'All' })).toHaveAccessibleDescription(
        'Every runeword, whatever you own',
      );
    });

    it('When the page loads, Then the rune sidebar is narrow and only widens in wide windows', async () => {
      // Arrange
      stubElectronApi();

      // Act
      await renderCalculator();

      // Assert
      const page = screen.getByTestId('runeword-sidebar').parentElement?.parentElement;
      expect(page).toHaveClass(
        'grid-cols-[14rem_minmax(0,1fr)]',
        'xl:grid-cols-[18rem_minmax(0,1fr)]',
      );
    });
  });

  describe('toolbar', () => {
    it('When the page loads, then the search field has an accessible label and comes before the other filters', async () => {
      // Arrange
      stubElectronApi();

      // Act
      await renderCalculator();

      // Assert
      const search = screen.getByRole('textbox', { name: 'Search runewords' });
      const availability = screen.getByRole('group', { name: 'Show runewords' });
      const refresh = screen.getByRole('button', { name: 'Refresh runes' });
      expect(search.compareDocumentPosition(availability)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(search.compareDocumentPosition(refresh)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('When the labelled search field is used, then runewords are filtered by name', async () => {
      // Arrange
      stubElectronApi();
      await renderCalculator();

      // Act
      fireEvent.change(screen.getByRole('textbox', { name: 'Search runewords' }), {
        target: { value: 'Ste' },
      });

      // Assert
      expect(getCardTitles()).toEqual(['Filter by runes', 'Stealth', 'Steel']);
    });
  });

  describe('runeword grid', () => {
    it('When runewords are shown, then the grid sizes its columns from the available width instead of viewport breakpoints', async () => {
      // Arrange
      stubElectronApi();

      // Act
      await renderCalculator();

      // Assert
      const grid = screen.getByTestId('runeword-grid');
      expect(grid).toHaveClass('grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]');
      expect(grid.className).not.toMatch(/\b(md|lg):grid-cols-/);
    });
  });

  describe('page heading', () => {
    it('If the data is still loading, Then exactly one level-1 heading is present', () => {
      // Arrange
      const api = stubElectronApi();
      api.grail.getAllRunewords.mockReturnValue(new Promise(() => undefined));

      // Act
      render(<RunewordCalculator />);

      // Assert
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1, name: 'Runeword calculator' })).toBeVisible();
    });

    it('If the data has loaded, Then exactly one level-1 heading is present', async () => {
      // Arrange
      stubElectronApi();

      // Act
      await renderCalculator();

      // Assert
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });
  });
});
