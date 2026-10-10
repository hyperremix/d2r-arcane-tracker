import type { VaultItem, VaultItemUpsertInput } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import {
  isVaultedFromSaveFile,
  isVaultRowCreatedByAdd,
  resolveAddedStackCount,
  resolveVaultRestoreTarget,
  type VaultItemOrigin,
} from './vaultRestore';

const INVENTORY_ORIGIN: VaultItemOrigin = {
  sourceFilePath: '/saves/Sorc.d2s',
  sourceFileType: 'd2s',
  locationContext: 'inventory',
  gridX: 2,
  gridY: 3,
};

describe('When the restore target of a vault row is resolved', () => {
  it('If it came from a character inventory cell, Then the target is that cell', () => {
    // Arrange
    const origin = INVENTORY_ORIGIN;

    // Act
    const target = resolveVaultRestoreTarget(origin);

    // Assert
    expect(target).toEqual({
      targetFilePath: '/saves/Sorc.d2s',
      targetFileType: 'd2s',
      targetLocationContext: 'inventory',
      targetGridX: 2,
      targetGridY: 3,
    });
  });

  it('If it came from a shared stash tab, Then the target keeps the stash tab', () => {
    // Arrange
    const origin: VaultItemOrigin = {
      sourceFilePath: '/saves/SharedStashSoftCoreV2.d2i',
      sourceFileType: 'd2i',
      locationContext: 'stash',
      stashTab: 2,
      gridX: 0,
      gridY: 0,
    };

    // Act
    const target = resolveVaultRestoreTarget(origin);

    // Assert
    expect(target).toEqual({
      targetFilePath: '/saves/SharedStashSoftCoreV2.d2i',
      targetFileType: 'd2i',
      targetLocationContext: 'stash',
      targetStashTab: 2,
      targetGridX: 0,
      targetGridY: 0,
    });
  });

  it.each([
    ['no source file', { ...INVENTORY_ORIGIN, sourceFilePath: '  ' }],
    ['an equipped slot', { ...INVENTORY_ORIGIN, locationContext: 'equipped' as const }],
    ['the mercenary', { ...INVENTORY_ORIGIN, locationContext: 'mercenary' as const }],
    ['a missing grid position', { ...INVENTORY_ORIGIN, gridX: undefined }],
    ['a negative grid position', { ...INVENTORY_ORIGIN, gridY: -1 }],
    [
      'a stash file without a stash location',
      { ...INVENTORY_ORIGIN, sourceFileType: 'd2i' as const },
    ],
    [
      'a shared stash row without a stash tab',
      {
        ...INVENTORY_ORIGIN,
        sourceFileType: 'sss' as const,
        locationContext: 'stash' as const,
        stashTab: undefined,
      },
    ],
    [
      'a shared stash row with an invalid stash tab',
      {
        ...INVENTORY_ORIGIN,
        sourceFileType: 'd2i' as const,
        locationContext: 'stash' as const,
        stashTab: -1,
      },
    ],
    [
      'a stack count that differs from the stack it was taken from (merged stack)',
      { ...INVENTORY_ORIGIN, stackCount: 5, rawItemJson: '{"code":"r01","quantity":2}' },
    ],
  ])('If the origin has %s, Then there is no restore target', (_case, origin) => {
    // Arrange / Act
    const target = resolveVaultRestoreTarget(origin);

    // Assert
    expect(target).toBeUndefined();
  });
});

describe('When the restore target of a stack row is resolved', () => {
  it('If the stack count matches the stack that was taken out, Then the target is its origin', () => {
    // Arrange
    const origin = {
      ...INVENTORY_ORIGIN,
      stackCount: 2,
      rawItemJson: '{"code":"r01","quantity":2}',
    };

    // Act
    const target = resolveVaultRestoreTarget(origin);

    // Assert
    expect(target).toMatchObject({ targetGridX: 2, targetGridY: 3 });
  });
});

describe('When the restore target of a row that was part of a merge is resolved', () => {
  it('If the row count equals the count in its item data again, Then the rule is count-based and the target is its origin', () => {
    // Arrange
    // The row of rune A (count 1) took in rune B (count 2), then Undo withdrew A's unit (count 1 again).
    const origin = {
      ...INVENTORY_ORIGIN,
      stackCount: 1,
      rawItemJson: '{"code":"r01"}',
    };

    // Act
    const target = resolveVaultRestoreTarget(origin);

    // Assert
    expect(target).toMatchObject({ targetGridX: 2, targetGridY: 3 });
  });
});

describe('When it is checked whether a vault row was created by an add', () => {
  const INPUT = {
    ...INVENTORY_ORIGIN,
    fingerprint: 'fp',
    stackCount: 2,
  } as VaultItemUpsertInput;

  it('If the row has the stack count and origin of the input, Then it was created by the add', () => {
    // Arrange
    const row = { ...INPUT, id: 'v1' } as VaultItem;

    // Act
    const result = isVaultRowCreatedByAdd(INPUT, row);

    // Assert
    expect(result).toBe(true);
  });

  it.each([
    ['a larger stack count (merged stack)', { stackCount: 5 }],
    ['another grid cell', { gridX: 9 }],
    ['another stash tab', { stashTab: 3 }],
    ['another source file', { sourceFilePath: '/saves/Other.d2s' }],
  ])('If the row has %s, Then it is an existing row', (_case, difference) => {
    // Arrange
    const row = { ...INPUT, id: 'v1', ...difference } as VaultItem;

    // Act
    const result = isVaultRowCreatedByAdd(INPUT, row);

    // Assert
    expect(result).toBe(false);
  });
});

describe('When it is checked whether a vault row was created by an add of an unsent stack count', () => {
  const KEY_RAW = '{"code":"key","quantity":12}';
  const KEY_INPUT = {
    ...INVENTORY_ORIGIN,
    fingerprint: 'fp-key',
    rawItemJson: KEY_RAW,
  } as VaultItemUpsertInput;

  it('If a natively stackable item from a save file became its own row, Then it was created by the add', () => {
    // Arrange
    const row = { ...KEY_INPUT, id: 'v1', stackCount: 12 } as VaultItem;

    // Act
    const result = isVaultRowCreatedByAdd(KEY_INPUT, row);

    // Assert
    expect(result).toBe(true);
  });

  it.each([
    ['one stack merged into another single unit', '{"code":"r01"}', 2],
    ['a key stack merged into another key stack', KEY_RAW, 20],
  ])('If %s, Then the returned row is an existing row', (_case, rawItemJson, rowCount) => {
    // Arrange
    const input = { ...KEY_INPUT, rawItemJson } as VaultItemUpsertInput;
    const row = { ...input, id: 'v1', stackCount: rowCount } as VaultItem;

    // Act
    const result = isVaultRowCreatedByAdd(input, row);

    // Assert
    expect(result).toBe(false);
  });
});

describe('When the number of units an add puts into the vault is resolved', () => {
  it.each([
    ['a sent stack count', { stackCount: 4, rawItemJson: '{"code":"key","quantity":12}' }, 4],
    ['the count in the item data', { rawItemJson: '{"code":"key","quantity":12}' }, 12],
    ['an item without a stack', { rawItemJson: '{"code":"cap"}' }, 1],
    ['unreadable item data', { rawItemJson: 'not json' }, 1],
    ['no item data', {}, 1],
  ])('If the add has %s, Then it is counted correctly', (_name, input, expected) => {
    // Arrange
    // (the input comes from the table)

    // Act
    const count = resolveAddedStackCount(input);

    // Assert
    expect(count).toBe(expected);
  });
});

describe('When it is checked whether a vault row came from a save file', () => {
  it.each([
    ['/saves/Sorc.d2s', true],
    ['   ', false],
    [undefined, false],
  ])('If the source file path is %s, Then the result is %s', (sourceFilePath, expected) => {
    // Arrange / Act
    const result = isVaultedFromSaveFile({ sourceFilePath });

    // Assert
    expect(result).toBe(expected);
  });
});
