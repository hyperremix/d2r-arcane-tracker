import { describe, expect, it } from 'vitest';
import {
  isVaultedFromSaveFile,
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
  ])('If the origin has %s, Then there is no restore target', (_case, origin) => {
    // Arrange / Act
    const target = resolveVaultRestoreTarget(origin);

    // Assert
    expect(target).toBeUndefined();
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
