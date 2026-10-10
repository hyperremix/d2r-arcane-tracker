import type {
  CharacterInventorySnapshot,
  ParsedInventoryItem,
  VaultItem,
} from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import {
  buildStashTabsToRender,
  canDropItemCodeInModernResourceTab,
  isStashSourceFileType,
  resolveWithdrawCountForGridDrop,
} from './stashTabs';

function createSnapshot(
  overrides: Partial<CharacterInventorySnapshot>,
): CharacterInventorySnapshot {
  return {
    snapshotId: 'snap',
    characterName: 'Shared',
    sourceFileType: 'd2i',
    sourceFilePath: '/saves/Shared.d2i',
    capturedAt: new Date('2024-01-01T00:00:00.000Z'),
    items: [],
    ...overrides,
  };
}

describe('When items are dropped on modern resource tabs', () => {
  it.each([
    ['a rune on the runes tab', 'r01', 7, true],
    ['a gem on the gems tab', 'gsv', 5, true],
    ['a rune on the gems tab', 'r01', 5, false],
    ['a helm on the materials tab', 'uap', 6, false],
    ['a rune on a shared tab', 'r01', 0, false],
    ['the last base game rune on the runes tab', 'r33', 7, true],
    ['a rune code above the base game runes on the runes tab', 'r39', 7, true],
    ['a code past the rune range on the runes tab', 'r40', 7, false],
  ])('Then %s is allowed: %s', (_label, code, stashTab, expected) => {
    // Arrange / Act
    const allowed = canDropItemCodeInModernResourceTab(code, stashTab);

    // Assert
    expect(allowed).toBe(expected);
  });

  it('Then item codes are matched trimmed and case-insensitively', () => {
    // Arrange
    const paddedUpperCaseRune = ' R01 ';

    // Act
    const allowed = canDropItemCodeInModernResourceTab(paddedUpperCaseRune, 7);

    // Assert
    expect(allowed).toBe(true);
  });

  it.each([
    ['a blank code', '  '],
    ['a non-string code', 7],
    ['a missing code', undefined],
  ])('If the item has %s, Then it is not allowed on a resource tab', (_label, code) => {
    // Arrange / Act
    const allowed = canDropItemCodeInModernResourceTab(code, 7);

    // Assert
    expect(allowed).toBe(false);
  });
});

describe('When a vaulted item is withdrawn onto a grid', () => {
  it('Then a vaulted rune stack gives up exactly one rune', () => {
    // Arrange
    const vaultItem = { itemCode: 'r01', stackCount: 5 } as VaultItem;

    // Act
    const count = resolveWithdrawCountForGridDrop(vaultItem);

    // Assert
    expect(count).toBe(1);
  });

  it.each([
    ...Array.from({ length: 6 }, (_unused, index) => {
      const code = `r${34 + index}`;
      return [`the rune code ${code}`, code];
    }),
    ['the lowest rune code', 'r00'],
    ['a rune code at the top of the accepted range', 'r39'],
    ['an upper-case padded rune code', ' R34 '],
  ])('If the vaulted stack holds %s, Then it gives up exactly one unit', (_label, itemCode) => {
    // Arrange
    const vaultItem = { itemCode, stackCount: 5 } as VaultItem;

    // Act
    const count = resolveWithdrawCountForGridDrop(vaultItem);

    // Assert
    expect(count).toBe(1);
  });

  it('If the vaulted stack has a code past the rune range, Then the whole item is withdrawn', () => {
    // Arrange
    const vaultItem = { itemCode: 'r40', stackCount: 5 } as VaultItem;

    // Act
    const count = resolveWithdrawCountForGridDrop(vaultItem);

    // Assert
    expect(count).toBeUndefined();
  });

  it.each([
    ['a single rune', { itemCode: 'r01', stackCount: 1 }],
    ['a stacked non-resource item', { itemCode: 'tbk', stackCount: 20 }],
  ])('If it is %s, Then the whole item is withdrawn', (_label, item) => {
    // Arrange / Act
    const count = resolveWithdrawCountForGridDrop(item as VaultItem);

    // Assert
    expect(count).toBeUndefined();
  });
});

describe('When the stash tabs of a snapshot are listed', () => {
  it('Then a modern stash shows all eight tabs with resource kinds', () => {
    // Arrange
    const snapshot = createSnapshot({ sourceFileVersion: 105 });

    // Act
    const tabs = buildStashTabsToRender(snapshot, new Map());

    // Assert
    expect(tabs.map(({ stashTab, fallbackTabKind }) => [stashTab, fallbackTabKind])).toEqual([
      [0, 'shared'],
      [1, 'shared'],
      [2, 'shared'],
      [3, 'shared'],
      [4, 'shared'],
      [5, 'gems'],
      [6, 'materials'],
      [7, 'runes'],
    ]);
  });

  it('If a classic stash has no items, Then one empty tab is shown', () => {
    // Arrange
    const snapshot = createSnapshot({ sourceFileType: 'sss' });

    // Act
    const tabs = buildStashTabsToRender(snapshot, new Map());

    // Assert
    expect(tabs).toEqual([{ stashTab: 0, items: [], fallbackTabKind: undefined }]);
  });

  it('If a classic stash has items, Then its tabs are listed in order', () => {
    // Arrange
    const item = { fingerprint: 'fp', locationContext: 'stash' } as ParsedInventoryItem;
    const stashByTab = new Map([
      [2, [item]],
      [0, [item]],
    ]);

    // Act
    const tabs = buildStashTabsToRender(createSnapshot({ sourceFileType: 'd2x' }), stashByTab);

    // Assert
    expect(tabs.map(({ stashTab }) => stashTab)).toEqual([0, 2]);
  });

  it('Then stash files are told apart from character files', () => {
    // Arrange / Act / Assert
    expect(isStashSourceFileType('d2i')).toBe(true);
    expect(isStashSourceFileType('d2s')).toBe(false);
  });
});
