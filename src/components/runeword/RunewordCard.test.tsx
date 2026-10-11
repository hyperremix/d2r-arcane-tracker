import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Item } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    ['d2runewizard', 'https://d2runewizard.com/runewords/Steel', 'View on d2runewizard'],
    ['diablo2.io', 'https://diablo2.io/runewords/steel-t1.html', 'View on diablo2.io'],
  ])('If the runeword links to %s, Then the link names that site', (_site, link, expectedName) => {
    // Arrange & Act
    renderCard(['tir', 'el'], link);

    // Assert
    expect(screen.getByRole('link', { name: expectedName })).toHaveAttribute('href', link);
  });

  it('If the runeword has no link, Then no external link is shown', () => {
    // Arrange & Act
    renderCard(['tir', 'el']);

    // Assert
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
