import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Item, ParsedInventoryItem, VaultItem } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnedRunewordBase, RunewordReadiness } from '@/lib/runeword-readiness';
import { RunewordCard } from './RunewordCard';

function createRuneword(runes: string[] | undefined, link = ''): Item {
  return {
    id: 'steel',
    name: 'Steel',
    link,
    etherealType: 'none',
    type: 'runeword',
    category: 'weapons',
    subCategory: 'runewords',
    treasureClass: 'normal',
    runes,
  } as Item;
}

// Other suites define a non-configurable `window.electronAPI` (vitest runs with isolate: false),
// so it is replaced by assignment rather than vi.stubGlobal, and restored after each test.
const windowGlobals = window as unknown as Record<string, unknown>;
let originalElectronAPI: PropertyDescriptor | undefined;

function stubElectronApi() {
  windowGlobals.electronAPI = {
    icon: { getByFilename: vi.fn().mockResolvedValue(undefined) },
  };
}

function renderCard(runes: string[] | undefined, link = '') {
  stubElectronApi();
  render(<RunewordCard runeword={createRuneword(runes, link)} availableRunes={{}} />);
}

function createSaveBase(
  overrides: Partial<ParsedInventoryItem>,
  baseOverrides: Partial<OwnedRunewordBase> = {},
): OwnedRunewordBase {
  const item = {
    characterName: 'Sorc',
    sourceFileType: 'd2s',
    locationContext: 'inventory',
    itemName: 'Phase Blade',
    ...overrides,
  } as ParsedInventoryItem;
  return {
    key: `save-${item.characterName}-${item.locationContext}`,
    itemName: item.itemName,
    itemTypes: [],
    socketCount: 2,
    ethereal: false,
    location: { kind: 'save', item },
    ...baseOverrides,
  };
}

function createVaultBase(): OwnedRunewordBase {
  const item = { itemName: 'Phase Blade' } as VaultItem;
  return {
    key: 'vault-1',
    itemName: 'Phase Blade',
    itemTypes: [],
    socketCount: 2,
    ethereal: false,
    location: { kind: 'vault', item },
  };
}

function renderCardWithBases(bases: OwnedRunewordBase[]) {
  stubElectronApi();
  render(
    <RunewordCard
      runeword={createRuneword(['tir', 'el'])}
      availableRunes={{ tir: 1, el: 1 }}
      readiness={{ upgradePlan: [], bases }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /owned bases?/ }));
}

describe('RunewordCard', () => {
  beforeEach(() => {
    originalElectronAPI = Object.getOwnPropertyDescriptor(window, 'electronAPI');
  });

  afterEach(() => {
    if (originalElectronAPI && 'value' in originalElectronAPI) {
      windowGlobals.electronAPI = originalElectronAPI.value;
    } else {
      delete windowGlobals.electronAPI;
    }
  });

  it('When a runeword has several runes, Then the footer shows one socket per rune', () => {
    // Arrange & Act
    renderCard(['tir', 'el']);

    // Assert
    expect(screen.getByText('2 sockets')).toBeInTheDocument();
  });

  it('When a runeword has a single rune, Then the footer uses the singular form', () => {
    // Arrange & Act
    renderCard(['tir']);

    // Assert
    expect(screen.getByText('1 socket')).toBeInTheDocument();
  });

  it.each([
    ['an empty runes list', []],
    ['no runes list', undefined],
  ])('If a runeword has %s, Then no socket count is shown', (_label, runes) => {
    // Arrange & Act
    renderCard(runes);

    // Assert
    expect(screen.queryByText(/socket/)).not.toBeInTheDocument();
  });

  it('When the card is rendered, Then it is a positioned container for the missing rune sr-only text', () => {
    // Arrange & Act
    renderCard(['tir', 'el']);

    // Assert
    // The missing rune markers' sr-only spans are position: absolute. Without a positioned card
    // they would be contained by the page and stretch the document's scrollable height.
    const card = screen.getByRole('heading', { name: 'Steel' }).closest('[data-slot="card"]');
    expect(card).toHaveClass('relative');
  });

  it.each([
    ['an owned base fits', [createVaultBase()], '1 owned base'],
    ['no owned base fits', [], 'No owned base'],
  ])('If %s, Then the base status sits on its own line directly below the name', (_label, bases, status) => {
    // Arrange
    stubElectronApi();

    // Act
    render(
      <RunewordCard
        runeword={createRuneword(['tir', 'el'])}
        availableRunes={{ tir: 1, el: 1 }}
        readiness={{ upgradePlan: [], bases }}
      />,
    );

    // Assert
    const heading = screen.getByRole('heading', { name: 'Steel' });
    expect(heading.parentElement).toHaveClass('flex-col');
    expect(heading.nextElementSibling).toHaveTextContent(status);
  });

  it('If every rune is owned, Then the card shows no rune count', () => {
    // Arrange
    stubElectronApi();

    // Act
    render(
      <RunewordCard runeword={createRuneword(['tir', 'el'])} availableRunes={{ tir: 1, el: 1 }} />,
    );

    // Assert
    expect(screen.queryByText(/^Missing \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+\/\d+ runes/)).not.toBeInTheDocument();
  });

  it.each([
    ['one rune is', { tir: 1 }, 'Missing 1 rune: El'],
    ['several runes are', {}, 'Missing 2 runes: Tir, El'],
  ])('If %s missing, Then a line names the missing runes', (_label, availableRunes, text) => {
    // Arrange
    stubElectronApi();

    // Act
    render(
      <RunewordCard runeword={createRuneword(['tir', 'el'])} availableRunes={availableRunes} />,
    );

    // Assert
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it.each([
    [
      'd2runewizard',
      'https://d2runewizard.com/runewords/Steel',
      'View on d2runewizard',
      'd2runewizard',
    ],
    [
      'diablo2.io',
      'https://diablo2.io/runewords/steel-t1.html',
      'View on diablo2.io',
      'diablo2.io',
    ],
  ])('If the runeword links to %s, Then the link shows the site name and its accessible name says where it goes', (_site, link, accessibleName, visibleText) => {
    // Arrange & Act
    renderCard(['tir', 'el'], link);

    // Assert
    const anchor = screen.getByRole('link', { name: accessibleName });
    expect(anchor).toHaveAttribute('href', link);
    expect(anchor).toHaveTextContent(visibleText);
    expect(anchor).not.toHaveTextContent('View on');
  });

  it('When the footer is narrow, Then the socket count and link stay unbroken and the link wraps below', () => {
    // Arrange & Act
    renderCard(['tir', 'el'], 'https://d2runewizard.com/runewords/Steel');

    // Assert
    const sockets = screen.getByText('2 sockets');
    const link = screen.getByRole('link', { name: 'View on d2runewizard' });
    expect(sockets).toHaveClass('whitespace-nowrap');
    expect(link).toHaveClass('whitespace-nowrap');
    expect(sockets.parentElement).toHaveClass('flex-wrap');
  });

  it('If the runeword has no link, Then no external link is shown', () => {
    // Arrange & Act
    renderCard(['tir', 'el']);

    // Assert
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('When upgrades make the missing runes, Then each step names the runes and gem it takes and how often', () => {
    // Arrange
    stubElectronApi();
    const readiness: RunewordReadiness = {
      upgradePlan: [
        { runeId: 'nef', runeCount: 3, resultRuneId: 'eth', times: 1 },
        { runeId: 'lem', runeCount: 3, gemCode: 'gfg', resultRuneId: 'pul', times: 2 },
      ],
      bases: [],
    };

    // Act
    render(
      <RunewordCard
        runeword={createRuneword(['eth', 'pul', 'pul'])}
        availableRunes={{}}
        readiness={readiness}
      />,
    );

    // Assert
    expect(screen.getByText('Makeable with upgrades')).toBeInTheDocument();
    const plan = screen.getByRole('list', { name: 'Horadric Cube rune upgrades' });
    expect(
      within(plan)
        .getAllByRole('listitem')
        .map((step) => step.textContent),
    ).toEqual(['Cube 3 Nef → Eth', 'Cube 3 Lem + Flawed Emerald → Pul, 2 times']);
  });

  it('If every rune is owned, Then no upgrade plan or upgrade badge is shown', () => {
    // Arrange
    stubElectronApi();

    // Act
    render(
      <RunewordCard
        runeword={createRuneword(['tir', 'el'])}
        availableRunes={{ tir: 1, el: 1 }}
        readiness={{ upgradePlan: [], bases: [] }}
      />,
    );

    // Assert
    expect(screen.queryByText('Makeable with upgrades')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('If the card has no readiness, Then it shows neither an upgrade plan nor owned bases', () => {
    // Arrange & Act
    renderCard(['tir', 'el']);

    // Assert
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText('No owned base')).not.toBeInTheDocument();
  });

  it('If the owned bases are in the vault, a character and the shared stash, Then each is listed with its location', () => {
    // Arrange & Act
    renderCardWithBases([
      createVaultBase(),
      createSaveBase({ characterName: 'Sorc', locationContext: 'inventory' }),
      createSaveBase({
        characterName: 'Shared',
        sourceFileType: 'd2i',
        locationContext: 'stash',
        stashTab: 1,
      }),
    ]);

    // Assert
    expect(screen.getByText('3 owned bases')).toBeInTheDocument();
    const locations = screen
      .getAllByRole('listitem')
      .map((entry) => entry.lastElementChild?.textContent);
    expect(locations).toEqual(['Vaulted', 'Sorc, Inventory', 'Shared stash, Stash tab 2']);
  });

  it('If an owned base is ethereal, Then it shows the ethereal badge and a normal base does not', () => {
    // Arrange & Act
    renderCardWithBases([
      createSaveBase({ characterName: 'Ethereal' }, { ethereal: true }),
      createSaveBase({ characterName: 'Plain' }),
    ]);

    // Assert
    const [etherealEntry, plainEntry] = screen.getAllByRole('listitem');
    expect(within(etherealEntry).getByText('Ethereal')).toBeInTheDocument();
    expect(within(plainEntry).queryByText('Ethereal')).not.toBeInTheDocument();
  });
});
