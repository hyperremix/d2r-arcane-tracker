import type {
  CharacterInventorySnapshot,
  Item,
  ParsedInventoryItem,
  VaultItem,
} from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import {
  collectOwnedRunewordBases,
  countAvailableGems,
  findRunewordBases,
  getRunewordReadiness,
} from './runeword-readiness';

interface RawFields {
  quality?: number;
  total_nr_of_sockets?: number;
  nr_of_items_in_sockets?: number;
  socketed_items?: unknown[];
  categories?: string[];
}

const phaseBladeRaw: RawFields = {
  quality: 2,
  total_nr_of_sockets: 5,
  nr_of_items_in_sockets: 0,
  categories: ['Sword', 'Swords and Knives', 'Melee Weapon', 'Weapon'],
};

function createInventoryItem(
  overrides: Partial<ParsedInventoryItem> = {},
  raw: RawFields = phaseBladeRaw,
): ParsedInventoryItem {
  return {
    fingerprint: `fp-${overrides.itemName ?? 'Phase Blade'}-${overrides.gridX ?? 0}`,
    characterName: 'Sorc',
    sourceFileType: 'd2s',
    sourceFilePath: '/saves/Sorc.d2s',
    locationContext: 'inventory',
    itemName: 'Phase Blade',
    itemCode: '7cr',
    quality: 'normal',
    ethereal: false,
    socketCount: 1,
    rawItemJson: JSON.stringify(raw),
    seenAt: new Date('2026-10-18T10:00:00.000Z'),
    ...overrides,
  };
}

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

function createVaultItem(overrides: Partial<VaultItem> = {}, raw: RawFields = phaseBladeRaw) {
  return {
    id: 'vault-1',
    fingerprint: 'vault-fp-1',
    itemName: 'Phase Blade',
    itemCode: '7cr',
    quality: 'normal',
    ethereal: true,
    rawItemJson: JSON.stringify(raw),
    sourceFileType: 'd2s',
    locationContext: 'stash',
    isPresentInLatestScan: false,
    created: new Date('2026-10-18T10:00:00.000Z'),
    lastUpdated: new Date('2026-10-18T10:00:00.000Z'),
    ...overrides,
  } as VaultItem;
}

function createRuneword(id: string, runes: string[]): Item {
  return {
    id,
    name: id,
    link: '',
    etherealType: 'none',
    type: 'runeword',
    category: 'runewords',
    subCategory: 'runewords',
    treasureClass: 'normal',
    runes,
  } as Item;
}

describe('collectOwnedRunewordBases', () => {
  it('When a normal item has only empty sockets, then it is a base with its socket count and item types', () => {
    // Arrange
    const item = createInventoryItem();

    // Act
    const bases = collectOwnedRunewordBases([createSnapshot([item])], []);

    // Assert
    expect(bases).toEqual([
      {
        key: item.fingerprint,
        itemName: 'Phase Blade',
        itemTypes: ['Sword', 'Swords and Knives', 'Melee Weapon', 'Weapon'],
        socketCount: 5,
        ethereal: false,
        location: { kind: 'save', item },
      },
    ]);
  });

  it('When a superior ethereal item has empty sockets, then it is a base and keeps its ethereal flag', () => {
    // Arrange
    const item = createInventoryItem({ ethereal: true }, { ...phaseBladeRaw, quality: 3 });

    // Act
    const bases = collectOwnedRunewordBases([createSnapshot([item])], []);

    // Assert
    expect(bases).toHaveLength(1);
    expect(bases[0].ethereal).toBe(true);
  });

  it('If an item is low quality, then it is a base', () => {
    // Arrange
    const item = createInventoryItem({}, { ...phaseBladeRaw, quality: 1 });

    // Act
    const bases = collectOwnedRunewordBases([createSnapshot([item])], []);

    // Assert
    expect(bases).toHaveLength(1);
  });

  it('If an item is magic, rare, set, unique or crafted, then it is no base', () => {
    // Arrange
    const items = [4, 5, 6, 7, 8].map((quality) =>
      createInventoryItem({ gridX: quality }, { ...phaseBladeRaw, quality }),
    );

    // Act
    const bases = collectOwnedRunewordBases([createSnapshot(items)], []);

    // Assert
    expect(bases).toEqual([]);
  });

  it('If a socket is filled or the item has no sockets, then it is no base', () => {
    // Arrange
    const items = [
      createInventoryItem({ gridX: 1 }, { ...phaseBladeRaw, nr_of_items_in_sockets: 1 }),
      createInventoryItem({ gridX: 2 }, { ...phaseBladeRaw, socketed_items: [{}] }),
      createInventoryItem({ gridX: 3 }, { ...phaseBladeRaw, total_nr_of_sockets: 0 }),
      createInventoryItem({ gridX: 4 }, { ...phaseBladeRaw, total_nr_of_sockets: undefined }),
    ];

    // Act
    const bases = collectOwnedRunewordBases([createSnapshot(items)], []);

    // Assert
    expect(bases).toEqual([]);
  });

  it('If an item is socketed into another item or its raw data cannot be read, then it is no base', () => {
    // Arrange
    const items = [
      createInventoryItem({ gridX: 1, isSocketedItem: true }),
      createInventoryItem({ gridX: 2, rawItemJson: '{not json' }),
    ];

    // Act
    const bases = collectOwnedRunewordBases([createSnapshot(items)], []);

    // Assert
    expect(bases).toEqual([]);
  });

  it('When a vaulted item has only empty sockets, then it is a base located in the vault', () => {
    // Arrange
    const vaultItem = createVaultItem();

    // Act
    const bases = collectOwnedRunewordBases([], [vaultItem]);

    // Assert
    expect(bases).toEqual([
      {
        key: 'vault:vault-1',
        itemName: 'Phase Blade',
        itemTypes: ['Sword', 'Swords and Knives', 'Melee Weapon', 'Weapon'],
        socketCount: 5,
        ethereal: true,
        location: { kind: 'vault', item: vaultItem },
      },
    ]);
  });
});

describe('findRunewordBases', () => {
  const bases = collectOwnedRunewordBases(
    [
      createSnapshot([
        createInventoryItem({ gridX: 1 }),
        createInventoryItem(
          { gridX: 2, itemName: 'Archon Plate' },
          { ...phaseBladeRaw, total_nr_of_sockets: 3, categories: ['Armor', 'Any Armor'] },
        ),
        createInventoryItem(
          { gridX: 3, itemName: 'Mage Plate' },
          { ...phaseBladeRaw, total_nr_of_sockets: 4, categories: ['Armor', 'Any Armor'] },
        ),
      ]),
    ],
    [],
  );

  it('When a base has an allowed item type and one socket per rune, then it is listed', () => {
    // Arrange
    const grief = createRuneword('grief', ['eth', 'tir', 'lo', 'mal', 'ral']);

    // Act
    const found = findRunewordBases(grief, bases);

    // Assert
    expect(found.map((base) => base.itemName)).toEqual(['Phase Blade']);
  });

  it('If the socket count differs from the rune count, then the base is not listed', () => {
    // Arrange
    const enigma = createRuneword('enigma', ['jah', 'ith', 'ber']);

    // Act
    const found = findRunewordBases(enigma, bases);

    // Assert
    expect(found.map((base) => base.itemName)).toEqual(['Archon Plate']);
  });

  it('If the runeword allows none of the item types, then the base is not listed', () => {
    // Arrange: Lore goes into helms only
    const lore = createRuneword('lore', ['ort', 'sol']);

    // Act
    const found = findRunewordBases(lore, bases);

    // Assert
    expect(found).toEqual([]);
  });

  it('If the runeword has no known base item types, then no base is listed', () => {
    // Arrange
    const unknown = createRuneword('unknown', ['eth', 'tir', 'lo', 'mal', 'ral']);

    // Act
    const found = findRunewordBases(unknown, bases);

    // Assert
    expect(found).toEqual([]);
  });
});

describe('countAvailableGems', () => {
  it('When gems are in save files, then they are counted by code with their stack size', () => {
    // Arrange
    const items = [
      createInventoryItem({ itemCode: 'gfg', gridX: 1 }),
      createInventoryItem({ itemCode: 'gfg', gridX: 2, stackCount: 4 }),
      createInventoryItem({ itemCode: 'glb', gridX: 3 }),
    ];

    // Act
    const counts = countAvailableGems([createSnapshot(items)]);

    // Assert
    expect(counts).toEqual({ gfg: 5, glb: 1 });
  });

  it('If a gem is socketed into another item or an item is no gem, then it is not counted', () => {
    // Arrange
    const items = [
      createInventoryItem({ itemCode: 'gfg', isSocketedItem: true }),
      createInventoryItem({ itemCode: 'r20', gridX: 1 }),
      createInventoryItem({ gridX: 2 }),
    ];

    // Act
    const counts = countAvailableGems([createSnapshot(items)]);

    // Assert
    expect(counts).toEqual({});
  });
});

describe('getRunewordReadiness', () => {
  it('When readiness is worked out, then each runeword gets its upgrade plan and fitting bases', () => {
    // Arrange
    const grief = createRuneword('grief', ['eth', 'tir', 'lo', 'mal', 'ral']);
    const lore = createRuneword('lore', ['ort', 'sol']);
    const bases = collectOwnedRunewordBases([createSnapshot([createInventoryItem()])], []);
    const availableRunes = { eth: 1, tir: 1, lo: 1, mal: 1, ral: 1, ort: 1 };

    // Act
    const readiness = getRunewordReadiness([grief, lore], availableRunes, {}, bases);

    // Assert
    expect(readiness).toEqual({
      grief: { upgradePlan: [], bases },
      lore: { upgradePlan: undefined, bases: [] },
    });
  });
});
