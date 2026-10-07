import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Item } from 'electron/types/grail';
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
  });
});
