import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import type { Item } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunewordReadiness } from '@/lib/runeword-readiness';
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

  it('When the card is rendered, Then it is a positioned container for the badge sr-only text', () => {
    // Arrange & Act
    renderCard(['tir', 'el']);

    // Assert
    // The badge's sr-only span is position: absolute. Without a positioned card it would be
    // contained by the page and stretch the document's scrollable height.
    const card = screen.getByRole('heading', { name: 'Steel' }).closest('[data-slot="card"]');
    expect(card).toHaveClass('relative');
  });

  it('When the card is rendered, Then the completion badge sits on its own line below the name', () => {
    // Arrange & Act
    renderCard(['tir', 'el']);

    // Assert
    const heading = screen.getByRole('heading', { name: 'Steel' });
    const header = heading.parentElement;
    expect(header).toHaveClass('flex-col');
    expect(heading.nextElementSibling).toHaveTextContent('0 of 2 runes available');
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
});
