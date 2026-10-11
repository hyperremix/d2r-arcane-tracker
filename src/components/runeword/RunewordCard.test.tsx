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
// so it is replaced by assignment and restored after each test.
const windowGlobals = window as unknown as Record<string, unknown>;
let originalElectronAPI: PropertyDescriptor | undefined;

describe('RunewordCard sockets', () => {
  beforeEach(() => {
    originalElectronAPI = Object.getOwnPropertyDescriptor(window, 'electronAPI');
    windowGlobals.electronAPI = {
      icon: { getByFilename: vi.fn().mockResolvedValue(undefined) },
      shell: { openExternal: vi.fn() },
    };
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
    render(<RunewordCard runeword={createRuneword(['tir', 'el'])} availableRunes={{}} />);

    // Assert
    expect(screen.getByText('2 sockets')).toBeInTheDocument();
  });

  it('When a runeword has a single rune, Then the footer uses the singular form', () => {
    // Arrange & Act
    render(<RunewordCard runeword={createRuneword(['tir'])} availableRunes={{}} />);

    // Assert
    expect(screen.getByText('1 socket')).toBeInTheDocument();
  });

  it.each([
    ['an empty runes list', []],
    ['no runes list', undefined],
  ])('If a runeword has %s, Then no socket count is shown', (_label, runes) => {
    // Arrange & Act
    render(<RunewordCard runeword={createRuneword(runes)} availableRunes={{}} />);

    // Assert
    expect(screen.queryByText(/socket/)).not.toBeInTheDocument();
  });
});
