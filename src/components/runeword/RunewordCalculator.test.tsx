import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Item } from 'electron/types/grail';
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

interface ElectronApiOptions {
  runewords?: Item[];
  availableRunes?: Record<string, number>;
}

function stubElectronApi({
  runewords = [infinity, enigma, steel, stealth],
  availableRunes = { tir: 1, el: 1, tal: 1, eth: 1, jah: 1, ith: 1 },
}: ElectronApiOptions = {}) {
  const api = {
    grail: { getAllRunewords: vi.fn().mockResolvedValue(runewords) },
    saveFile: {
      refreshSaveFiles: vi.fn().mockResolvedValue({ success: true }),
      getAvailableRunes: vi.fn().mockResolvedValue(availableRunes),
    },
    icon: { getByFilename: vi.fn().mockResolvedValue(undefined) },
    shell: { openExternal: vi.fn() },
  };
  windowGlobals.electronAPI = api;
  return api;
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
    if (originalElectronAPI && 'value' in originalElectronAPI) {
      windowGlobals.electronAPI = originalElectronAPI.value;
    } else {
      delete windowGlobals.electronAPI;
    }
  });

  describe('availability filter', () => {
    it('When the page loads, then Craftable now is pressed and only craftable runewords show, sorted by name', async () => {
      // Arrange
      stubElectronApi();

      // Act
      await renderCalculator();

      // Assert
      expect(screen.getByRole('button', { name: 'Craftable now' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
      expect(getCardTitles()).toEqual(['Filter by Runes', 'Stealth', 'Steel']);
    });

    it('When Missing ≤ 1 is selected, then runewords missing one rune are added after craftable ones', async () => {
      // Arrange
      stubElectronApi();
      await renderCalculator();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Missing ≤ 1' }));

      // Assert
      expect(screen.getByRole('button', { name: 'Missing ≤ 1' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(getCardTitles()).toEqual(['Filter by Runes', 'Stealth', 'Steel', 'Enigma']);
    });

    it('When All is selected, then every runeword shows, sorted by fewest missing runes', async () => {
      // Arrange
      stubElectronApi();
      await renderCalculator();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'All' }));

      // Assert
      expect(getCardTitles()).toEqual([
        'Filter by Runes',
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
      expect(
        screen.getByText("You can't craft any runeword with your current runes"),
      ).toBeInTheDocument();

      // Act
      fireEvent.click(
        screen.getByRole('button', { name: 'Show runewords missing at most 1 rune' }),
      );

      // Assert
      expect(screen.getByRole('button', { name: 'Missing ≤ 1' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(getCardTitles()).toEqual(['Filter by Runes', 'Enigma']);
    });

    it('If nothing is craftable or missing at most 1 rune, then the empty state offers Show all and applies it', async () => {
      // Arrange
      stubElectronApi({ availableRunes: {} });
      await renderCalculator();
      expect(
        screen.getByText("You can't craft any runeword with your current runes"),
      ).toBeInTheDocument();
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
        screen.queryByText("You can't craft any runeword with your current runes"),
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
      fireEvent.click(screen.getByRole('button', { name: 'Missing ≤ 1' }));
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
      fireEvent.click(screen.getByLabelText(/^Ber/));
      fireEvent.click(screen.getByLabelText(/^Jah/));

      // Assert
      expect(screen.getByText('Shows runewords that use all selected runes')).toBeInTheDocument();
      expect(getCardTitles()).toEqual(['Filter by Runes', 'Enigma']);
    });

    it('When Clear selection is clicked, then the rune selection is reset', async () => {
      // Arrange
      stubElectronApi();
      await renderCalculator();
      fireEvent.click(screen.getByRole('button', { name: 'All' }));
      const clearButton = screen.getByRole('button', { name: 'Clear selection' });
      expect(clearButton).toBeDisabled();
      fireEvent.click(screen.getByLabelText(/^Ber/));
      expect(getCardTitles()).toEqual(['Filter by Runes', 'Enigma', 'Infinity']);

      // Act
      fireEvent.click(clearButton);

      // Assert
      expect(screen.getByLabelText(/^Ber/)).not.toBeChecked();
      expect(clearButton).toBeDisabled();
      expect(getCardTitles()).toEqual([
        'Filter by Runes',
        'Stealth',
        'Steel',
        'Enigma',
        'Infinity',
      ]);
    });
  });

  describe('runeword cards', () => {
    it('When runewords are shown, then each card displays an owned/total runes badge', async () => {
      // Arrange
      stubElectronApi({ availableRunes: { ber: 1, mal: 1, tir: 1, el: 1 } });
      await renderCalculator();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'All' }));

      // Assert
      const infinityCard = screen
        .getByRole('heading', { name: 'Infinity' })
        .closest('[data-slot="card"]');
      const steelCard = screen
        .getByRole('heading', { name: 'Steel' })
        .closest('[data-slot="card"]');
      expect(within(infinityCard as HTMLElement).getByText('2/4 runes')).toBeInTheDocument();
      expect(
        within(infinityCard as HTMLElement).getByText('2 of 4 runes available'),
      ).toBeInTheDocument();
      expect(within(steelCard as HTMLElement).getByText('2/2 runes')).toBeInTheDocument();
    });
  });

  describe('missing runes', () => {
    it('When a runeword card lacks a rune, then the missing rune shows a marker and Missing text inside that card', async () => {
      // Arrange
      stubElectronApi({ availableRunes: { jah: 1, ith: 1 } });
      await renderCalculator();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Missing ≤ 1' }));

      // Assert
      const enigmaCard = screen
        .getByRole('heading', { name: 'Enigma' })
        .closest('[data-slot="card"]') as HTMLElement;
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
      await waitFor(() => expect(getCardTitles()).toEqual(['Filter by Runes', 'Steel']));
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
      expect(getCardTitles()).toEqual(['Filter by Runes', 'Stealth', 'Steel']);

      // Act
      resolveRefresh({ success: true });

      // Assert
      await waitFor(() => expect(refreshButton).toBeEnabled());
      expect(refreshButton).toHaveAttribute('aria-busy', 'false');
      expect(getCardTitles()).toEqual(['Filter by Runes', 'Stealth', 'Steel']);
    });

    it('If a refresh fails, then an error toast is shown, the button is re-enabled and results remain', async () => {
      // Arrange
      const api = stubElectronApi();
      await renderCalculator();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      api.saveFile.refreshSaveFiles.mockRejectedValue(new Error('scan failed'));

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Refresh runes' }));

      // Assert
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('Failed to refresh runes from save files'),
      );
      expect(screen.getByRole('button', { name: 'Refresh runes' })).toBeEnabled();
      expect(getCardTitles()).toEqual(['Filter by Runes', 'Stealth', 'Steel']);
      consoleError.mockRestore();
    });
  });
});
