import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVaultPresenceKey } from '../utils/vaultPresence';
import { createDrizzleDb } from './drizzle';
import { initializeSchema } from './schema';
import type { DatabaseContext } from './types';
import {
  addVaultItem,
  addVaultItemWithUndo,
  getVaultItemById,
  getVaultSourceFilePathsPresentInLatestScan,
  markVaultItemsMissingForSourceFiles,
  reconcileVaultItemsForScan,
  searchVaultItems,
  unvaultVaultItem,
  upsertVaultItemByFingerprint,
} from './vault-items';

function createTestContext(): DatabaseContext {
  const rawDb = new Database(':memory:');
  const db = createDrizzleDb(rawDb);
  const ctx: DatabaseContext = {
    rawDb,
    db,
    dbPath: ':memory:',
  };
  initializeSchema(ctx);
  return ctx;
}

describe('When vault item database operations are executed', () => {
  let ctx: DatabaseContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  describe('If an item is re-parsed with the same fingerprint', () => {
    it('Then upsert prevents duplicates and updates the existing record', () => {
      // Arrange
      const fingerprint = 'fp-duplicate';

      // Act
      const first = upsertVaultItemByFingerprint(ctx, {
        fingerprint,
        itemName: 'Harlequin Crest',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{"roll":1}',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
      });

      const second = upsertVaultItemByFingerprint(ctx, {
        fingerprint,
        itemName: 'Harlequin Crest Updated',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{"roll":2}',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
      });

      // Assert
      expect(second.id).toBe(first.id);
      expect(second.itemName).toBe('Harlequin Crest Updated');
      expect(second.rawItemJson).toBe('{"roll":2}');
    });
  });

  describe('If the same item is manually vaulted multiple times', () => {
    it('Then add operation behaves idempotently and updates the existing record', () => {
      // Arrange
      const fingerprint = 'fp-manual-repeat';

      // Act
      const first = addVaultItem(ctx, {
        fingerprint,
        itemName: 'War Traveler',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{"roll":1}',
        sourceFileType: 'd2s',
        locationContext: 'stash',
      });
      const second = addVaultItem(ctx, {
        fingerprint,
        itemName: 'War Traveler (Updated)',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{"roll":2}',
        sourceFileType: 'd2s',
        locationContext: 'stash',
      });

      // Assert
      expect(second.id).toBe(first.id);
      expect(second.itemName).toBe('War Traveler (Updated)');
      expect(second.rawItemJson).toBe('{"roll":2}');
    });
  });

  describe('If a previously present item disappears from a scan', () => {
    it('Then reconciliation marks it missing and keeps last-seen metadata', () => {
      // Arrange
      const lastSeenAt = new Date('2024-01-01T12:00:00.000Z');
      const saved = upsertVaultItemByFingerprint(ctx, {
        fingerprint: 'fp-missing',
        itemName: 'Stone of Jordan',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{"seed":1}',
        sourceCharacterName: 'SorcOne',
        sourceFileType: 'd2s',
        sourceFilePath: '/saves/SorcOne.d2s',
        locationContext: 'stash',
        lastSeenAt,
        isPresentInLatestScan: true,
      });

      // Act
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2s',
        sourceFilePath: '/saves/SorcOne.d2s',
        presentFingerprints: [],
        presentIdentityKeys: [],
        lastSeenAt: new Date('2024-01-02T12:00:00.000Z'),
      });

      const reconciled = getVaultItemById(ctx, saved.id);

      // Assert
      expect(reconciled).toBeTruthy();
      expect(reconciled?.isPresentInLatestScan).toBe(false);
      expect(reconciled?.lastSeenAt?.toISOString()).toBe(lastSeenAt.toISOString());
      expect(reconciled?.sourceCharacterName).toBe('SorcOne');
    });
  });

  describe('If a missing item shows up again in a scan', () => {
    it('Then reconciliation marks it present and refreshes its last-seen time', () => {
      // Arrange
      const saved = upsertVaultItemByFingerprint(ctx, {
        fingerprint: 'fp-back',
        itemName: 'Stone of Jordan',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{"seed":1}',
        sourceFileType: 'd2s',
        sourceFilePath: '/saves/SorcOne.d2s',
        locationContext: 'stash',
        lastSeenAt: new Date('2024-01-01T12:00:00.000Z'),
        isPresentInLatestScan: false,
      });

      // Act
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2s',
        sourceFilePath: '/saves/SorcOne.d2s',
        presentFingerprints: ['fp-back'],
        presentIdentityKeys: ['identity-back'],
        lastSeenAt: new Date('2024-01-03T12:00:00.000Z'),
      });
      const reconciled = getVaultItemById(ctx, saved.id);

      // Assert
      expect(reconciled?.isPresentInLatestScan).toBe(true);
      expect(reconciled?.lastSeenAt?.toISOString()).toBe('2024-01-03T12:00:00.000Z');
    });
  });

  describe('If an item moves within its save file', () => {
    const FILE = '/saves/SharedStashSoftCoreV2.d2i';
    const runeKey = createVaultPresenceKey({
      sourceFileType: 'd2i',
      itemCode: 'r01',
      quality: 'normal',
      itemName: 'El Rune',
    });

    function insertRuneRow(fingerprint: string, overrides: Record<string, unknown> = {}) {
      return upsertVaultItemByFingerprint(ctx, {
        fingerprint,
        itemName: 'El Rune',
        itemCode: 'r01',
        quality: 'normal',
        ethereal: false,
        rawItemJson: '{"code":"r01"}',
        sourceFileType: 'd2i',
        sourceFilePath: FILE,
        locationContext: 'stash',
        isPresentInLatestScan: true,
        ...overrides,
      });
    }

    it('Then its row stays present although the fingerprint changed', () => {
      // Arrange
      const row = insertRuneRow('fp-old-position');

      // Act
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2i',
        sourceFilePath: FILE,
        presentFingerprints: ['fp-new-position'],
        presentIdentityKeys: [runeKey],
      });

      // Assert
      expect(getVaultItemById(ctx, row.id)?.isPresentInLatestScan).toBe(true);
    });

    it('Then a row that was already flagged missing is present again', () => {
      // Arrange
      const row = insertRuneRow('fp-old-position', { isPresentInLatestScan: false });

      // Act
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2i',
        sourceFilePath: FILE,
        presentFingerprints: ['fp-new-position'],
        presentIdentityKeys: [runeKey],
        lastSeenAt: new Date('2024-02-01T00:00:00.000Z'),
      });

      // Assert
      const reconciled = getVaultItemById(ctx, row.id);
      expect(reconciled?.isPresentInLatestScan).toBe(true);
      expect(reconciled?.lastSeenAt?.toISOString()).toBe('2024-02-01T00:00:00.000Z');
    });

    it('Then one of two identical items being removed marks exactly one row missing', () => {
      // Arrange
      const first = insertRuneRow('fp-first');
      const second = insertRuneRow('fp-second');

      // Act: one El Rune left, and it sits somewhere new
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2i',
        sourceFilePath: FILE,
        presentFingerprints: ['fp-somewhere-else'],
        presentIdentityKeys: [runeKey],
      });

      // Assert
      const flags = [first, second].map(
        (row) => getVaultItemById(ctx, row.id)?.isPresentInLatestScan,
      );
      expect(flags.filter(Boolean)).toHaveLength(1);
      expect(flags.filter((flag) => flag === false)).toHaveLength(1);
    });

    it('Then an exact fingerprint match claims the only scanned item so the moved-away identical row reads missing', () => {
      // Arrange
      const stayed = insertRuneRow('fp-stayed');
      const moved = insertRuneRow('fp-moved-away');

      // Act: a single El Rune is left, and it sits at the stayed row's spot
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2i',
        sourceFilePath: FILE,
        presentFingerprints: ['fp-stayed'],
        presentIdentityKeys: [runeKey],
      });

      // Assert
      expect(getVaultItemById(ctx, stayed.id)?.isPresentInLatestScan).toBe(true);
      expect(getVaultItemById(ctx, moved.id)?.isPresentInLatestScan).toBe(false);
    });

    it('Then identical items that are all still present are all kept present', () => {
      // Arrange
      const stayed = insertRuneRow('fp-stayed');
      const moved = insertRuneRow('fp-moved-away');

      // Act: both are still there, one at its old spot and one at a new spot
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2i',
        sourceFilePath: FILE,
        presentFingerprints: ['fp-stayed', 'fp-new-spot'],
        presentIdentityKeys: [runeKey, runeKey],
      });

      // Assert
      expect(getVaultItemById(ctx, stayed.id)?.isPresentInLatestScan).toBe(true);
      expect(getVaultItemById(ctx, moved.id)?.isPresentInLatestScan).toBe(true);
    });

    it('Then an item that is really gone is marked missing', () => {
      // Arrange
      const row = insertRuneRow('fp-gone');

      // Act: the file now holds a different item
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2i',
        sourceFilePath: FILE,
        presentFingerprints: ['fp-other'],
        presentIdentityKeys: [
          createVaultPresenceKey({
            sourceFileType: 'd2i',
            itemCode: 'r02',
            quality: 'normal',
            itemName: 'Eld Rune',
          }),
        ],
      });

      // Assert
      expect(getVaultItemById(ctx, row.id)?.isPresentInLatestScan).toBe(false);
    });

    it('Then items sharing a name are told apart by their game item id', () => {
      // Arrange
      const ringKey = (uid: number) =>
        createVaultPresenceKey({
          sourceFileType: 'd2i',
          itemCode: 'rin',
          quality: 'magic',
          itemName: 'Ring of Fire',
          itemUid: uid,
        });
      const ringRow = (fingerprint: string, uid: number) =>
        upsertVaultItemByFingerprint(ctx, {
          fingerprint,
          itemName: 'Ring of Fire',
          itemCode: 'rin',
          quality: 'magic',
          ethereal: false,
          rawItemJson: JSON.stringify({ id: uid, code: 'rin' }),
          sourceFileType: 'd2i',
          sourceFilePath: FILE,
          locationContext: 'stash',
          isPresentInLatestScan: true,
        });
      const ringOne = ringRow('fp-ring-1', 1);
      const ringTwo = ringRow('fp-ring-2', 2);

      // Act: ring 2 moved, ring 1 is gone
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2i',
        sourceFilePath: FILE,
        presentFingerprints: ['fp-ring-2-moved'],
        presentIdentityKeys: [ringKey(2)],
      });

      // Assert
      expect(getVaultItemById(ctx, ringOne.id)?.isPresentInLatestScan).toBe(false);
      expect(getVaultItemById(ctx, ringTwo.id)?.isPresentInLatestScan).toBe(true);
    });

    it('Then a vaulted row is never matched by content, because its item left the file', () => {
      // Arrange
      const vaulted = addVaultItem(ctx, {
        fingerprint: 'fp-vaulted-el',
        itemName: 'El Rune',
        itemCode: 'r01',
        quality: 'normal',
        ethereal: false,
        rawItemJson: '{"code":"r01"}',
        sourceFileType: 'd2i',
        sourceFilePath: FILE,
        locationContext: 'stash',
      });

      // Act: another, identical El Rune remains in the file
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2i',
        sourceFilePath: FILE,
        presentFingerprints: ['fp-other-el'],
        presentIdentityKeys: [runeKey],
      });

      // Assert
      expect(getVaultItemById(ctx, vaulted.id)?.isPresentInLatestScan).toBe(false);
    });

    it('Then only exact fingerprints are compared when the identity keys do not match the scanned items', () => {
      // Arrange
      const row = insertRuneRow('fp-old-position');

      // Act
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2i',
        sourceFilePath: FILE,
        presentFingerprints: ['fp-new-position'],
        presentIdentityKeys: [],
      });

      // Assert
      expect(getVaultItemById(ctx, row.id)?.isPresentInLatestScan).toBe(false);
    });
  });

  describe('If vault rows from several source files are flagged present', () => {
    it('Then only distinct source paths of present rows are returned', () => {
      // Arrange
      const baseRow = {
        itemName: 'Item',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s' as const,
        locationContext: 'inventory' as const,
      };
      upsertVaultItemByFingerprint(ctx, {
        ...baseRow,
        fingerprint: 'fp-1',
        sourceFilePath: '/saves/A.d2s',
        isPresentInLatestScan: true,
      });
      upsertVaultItemByFingerprint(ctx, {
        ...baseRow,
        fingerprint: 'fp-2',
        sourceFilePath: '/saves/A.d2s',
        isPresentInLatestScan: true,
      });
      upsertVaultItemByFingerprint(ctx, {
        ...baseRow,
        fingerprint: 'fp-3',
        sourceFilePath: '/saves/B.d2s',
        isPresentInLatestScan: false,
      });
      upsertVaultItemByFingerprint(ctx, {
        ...baseRow,
        fingerprint: 'grail:bookmark',
        isPresentInLatestScan: true,
      });

      // Act
      const paths = getVaultSourceFilePathsPresentInLatestScan(ctx);

      // Assert
      expect(paths).toEqual(['/saves/A.d2s']);
    });
  });

  describe('If the source files of vault rows were deleted', () => {
    const baseRow = {
      itemName: 'Item',
      quality: 'unique',
      ethereal: false,
      rawItemJson: '{"id":7}',
      sourceFileType: 'd2s' as const,
      locationContext: 'inventory' as const,
      isPresentInLatestScan: true,
    };

    it('Then only the presence flag of rows from those files is cleared', () => {
      // Arrange
      const lastSeenAt = new Date('2024-01-01T00:00:00.000Z');
      const orphan = addVaultItem(ctx, {
        ...baseRow,
        fingerprint: 'fp-orphan-vaulted',
        sourceFilePath: '/saves/Deleted.d2s',
        lastSeenAt,
      });
      const plain = upsertVaultItemByFingerprint(ctx, {
        ...baseRow,
        fingerprint: 'fp-orphan-plain',
        sourceFilePath: '/saves/Deleted.d2s',
        lastSeenAt,
      });
      const otherFile = upsertVaultItemByFingerprint(ctx, {
        ...baseRow,
        fingerprint: 'fp-other',
        sourceFilePath: '/saves/Kept.d2s',
      });
      const bookmark = upsertVaultItemByFingerprint(ctx, {
        ...baseRow,
        fingerprint: 'grail:bookmark',
      });

      // Act
      markVaultItemsMissingForSourceFiles(ctx, ['/saves/Deleted.d2s']);

      // Assert
      const flagged = getVaultItemById(ctx, orphan.id);
      expect(flagged?.isPresentInLatestScan).toBe(false);
      expect(flagged?.vaultedAt?.toISOString()).toBe(orphan.vaultedAt?.toISOString());
      expect(flagged?.unvaultedAt).toBeUndefined();
      expect(flagged?.rawItemJson).toBe('{"id":7}');
      expect(flagged?.lastSeenAt?.toISOString()).toBe(lastSeenAt.toISOString());
      expect(getVaultItemById(ctx, plain.id)?.isPresentInLatestScan).toBe(false);
      expect(getVaultItemById(ctx, otherFile.id)?.isPresentInLatestScan).toBe(true);
      expect(getVaultItemById(ctx, bookmark.id)?.isPresentInLatestScan).toBe(true);
    });

    it('Then an empty path list changes nothing', () => {
      // Arrange
      const row = upsertVaultItemByFingerprint(ctx, {
        ...baseRow,
        fingerprint: 'fp-untouched',
        sourceFilePath: '/saves/A.d2s',
      });

      // Act
      markVaultItemsMissingForSourceFiles(ctx, []);

      // Assert
      expect(getVaultItemById(ctx, row.id)?.isPresentInLatestScan).toBe(true);
    });

    it('Then more than 500 deleted files are cleared in statements of at most 500 paths each', () => {
      // Arrange
      const paths = Array.from({ length: 1201 }, (_unused, index) => `/saves/Deleted${index}.d2s`);
      const rows = paths.map((sourceFilePath, index) =>
        upsertVaultItemByFingerprint(ctx, {
          ...baseRow,
          fingerprint: `fp-bulk-${index}`,
          sourceFilePath,
        }),
      );
      const kept = upsertVaultItemByFingerprint(ctx, {
        ...baseRow,
        fingerprint: 'fp-bulk-kept',
        sourceFilePath: '/saves/Kept.d2s',
      });
      const prepareSpy = vi.spyOn(ctx.rawDb, 'prepare');

      // Act
      markVaultItemsMissingForSourceFiles(ctx, paths);

      // Assert: every statement binds the path list plus two fixed parameters (the new flag value
      // and the "currently present" filter)
      const nonPathParameters = 2;
      const pathsPerStatement = prepareSpy.mock.calls
        .map(([sql]) => String(sql))
        .filter((sql) => /^update "vault_items"/i.test(sql))
        .map((sql) => (sql.match(/\?/g) ?? []).length - nonPathParameters);
      expect(pathsPerStatement).toHaveLength(3);
      expect(Math.max(...pathsPerStatement)).toBeLessThanOrEqual(500);
      expect(
        rows.every((row) => getVaultItemById(ctx, row.id)?.isPresentInLatestScan === false),
      ).toBe(true);
      expect(getVaultItemById(ctx, kept.id)?.isPresentInLatestScan).toBe(true);
      prepareSpy.mockRestore();
    });

    it('Then rows come back as present when the file is scanned again', () => {
      // Arrange
      const row = upsertVaultItemByFingerprint(ctx, {
        ...baseRow,
        fingerprint: 'fp-restored',
        sourceFilePath: '/saves/Restored.d2s',
      });
      markVaultItemsMissingForSourceFiles(ctx, ['/saves/Restored.d2s']);

      // Act
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2s',
        sourceFilePath: '/saves/Restored.d2s',
        presentFingerprints: ['fp-restored'],
        presentIdentityKeys: ['identity-restored'],
      });

      // Assert
      expect(getVaultItemById(ctx, row.id)?.isPresentInLatestScan).toBe(true);
    });
  });

  describe('If a scan covers one stash file while vault rows exist for other files', () => {
    it('Then rows from other files of the same file type and rows without a source file stay untouched', () => {
      // Arrange
      const baseRow = {
        itemName: 'Item',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2i' as const,
        locationContext: 'stash' as const,
        isPresentInLatestScan: true,
      };
      const scannedFile = upsertVaultItemByFingerprint(ctx, {
        ...baseRow,
        fingerprint: 'fp-scanned-file',
        sourceFilePath: '/saves/SharedStashSoftCoreV2.d2i',
      });
      const otherFile = upsertVaultItemByFingerprint(ctx, {
        ...baseRow,
        fingerprint: 'fp-other-file',
        sourceFilePath: '/saves/SharedStashHardCoreV2.d2i',
      });
      const bookmark = upsertVaultItemByFingerprint(ctx, {
        ...baseRow,
        fingerprint: 'grail:some-item',
      });

      // Act
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2i',
        sourceFilePath: '/saves/SharedStashSoftCoreV2.d2i',
        presentFingerprints: [],
        presentIdentityKeys: [],
      });

      // Assert
      expect(getVaultItemById(ctx, scannedFile.id)?.isPresentInLatestScan).toBe(false);
      expect(getVaultItemById(ctx, otherFile.id)?.isPresentInLatestScan).toBe(true);
      expect(getVaultItemById(ctx, bookmark.id)?.isPresentInLatestScan).toBe(true);
    });
  });

  describe('If reconciliation runs against a vaulted item', () => {
    it('Then only the presence flag changes and vault state and item data are preserved', () => {
      // Arrange
      const vaulted = addVaultItem(ctx, {
        fingerprint: 'fp-vaulted',
        itemName: 'Harlequin Crest',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{"id":7}',
        stackCount: 1,
        sourceFileType: 'd2s',
        sourceFilePath: '/saves/SorcOne.d2s',
        locationContext: 'inventory',
      });

      // Act
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2s',
        sourceFilePath: '/saves/SorcOne.d2s',
        presentFingerprints: [],
        presentIdentityKeys: [],
      });
      const reconciled = getVaultItemById(ctx, vaulted.id);

      // Assert
      expect(reconciled?.isPresentInLatestScan).toBe(false);
      expect(reconciled?.vaultedAt?.toISOString()).toBe(vaulted.vaultedAt?.toISOString());
      expect(reconciled?.unvaultedAt).toBeUndefined();
      expect(reconciled?.rawItemJson).toBe('{"id":7}');
      expect(reconciled?.stackCount).toBe(1);
    });
  });

  describe('If reconciliation is asked to scan without a source file', () => {
    it('Then it changes nothing', () => {
      // Arrange
      const saved = upsertVaultItemByFingerprint(ctx, {
        fingerprint: 'fp-no-path-scan',
        itemName: 'Item',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        sourceFilePath: '/saves/SorcOne.d2s',
        locationContext: 'stash',
        isPresentInLatestScan: true,
      });

      // Act
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2s',
        sourceFilePath: '',
        presentFingerprints: [],
        presentIdentityKeys: [],
      });

      // Assert
      expect(getVaultItemById(ctx, saved.id)?.isPresentInLatestScan).toBe(true);
    });
  });

  describe('If character filter is provided as character name', () => {
    it('Then vault search returns items whose source character name matches', () => {
      // Arrange
      const namedItem = upsertVaultItemByFingerprint(ctx, {
        fingerprint: 'fp-character-name-match',
        itemName: "Skullder's Ire",
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceCharacterName: 'SorcName',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
      });

      // Act
      const filtered = searchVaultItems(ctx, {
        characterId: 'SorcName',
        page: 1,
        pageSize: 20,
      });

      // Assert
      expect(filtered.total).toBe(1);
      expect(filtered.items[0]?.id).toBe(namedItem.id);
    });
  });

  describe('If search returns rows loaded from raw SQL', () => {
    it('Then mapped vault items keep icon and raw metadata fields', () => {
      // Arrange
      upsertVaultItemByFingerprint(ctx, {
        fingerprint: 'fp-search-metadata',
        itemName: 'Flail',
        itemCode: 'fla',
        quality: 'unique',
        ethereal: false,
        socketCount: 0,
        rawItemJson: '{"inv_file":"invfla","name":"Flail"}',
        sourceCharacterName: 'Sorc',
        sourceFileType: 'd2s',
        locationContext: 'stash',
        iconFileName: 'flail.png',
        isSocketedItem: false,
        isPresentInLatestScan: true,
      });

      // Act
      const filtered = searchVaultItems(ctx, {
        text: 'flail',
        page: 1,
        pageSize: 20,
      });

      // Assert
      expect(filtered.total).toBe(1);
      expect(filtered.items[0]?.itemName).toBe('Flail');
      expect(filtered.items[0]?.iconFileName).toBe('flail.png');
      expect(filtered.items[0]?.rawItemJson).toBe('{"inv_file":"invfla","name":"Flail"}');
      expect(filtered.items[0]?.sourceFileType).toBe('d2s');
      expect(filtered.items[0]?.isPresentInLatestScan).toBe(true);
    });
  });

  describe('If addVaultItem is called without providing vaultedAt', () => {
    it('Then vaultedAt is automatically stamped on the persisted record', () => {
      // Arrange
      const before = new Date();

      // Act
      const item = addVaultItem(ctx, {
        fingerprint: 'fp-vault-stamp',
        itemName: "Mara's Kaleidoscope",
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
      });

      // Assert
      expect(item.vaultedAt).toBeTruthy();
      expect(item.vaultedAt?.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('If addVaultItem is called for a previously unvaulted item', () => {
    it('Then unvaultedAt is cleared to mark the item as currently vaulted', () => {
      // Arrange
      const fingerprint = 'fp-re-vault';
      const first = addVaultItem(ctx, {
        fingerprint,
        itemName: "Tal Rasha's Wrappings",
        quality: 'set',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'stash',
      });
      unvaultVaultItem(ctx, first.id);
      const afterUnvault = getVaultItemById(ctx, first.id);
      expect(afterUnvault?.unvaultedAt).toBeTruthy();

      // Act
      const revaulted = addVaultItem(ctx, {
        fingerprint,
        itemName: "Tal Rasha's Wrappings",
        quality: 'set',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'stash',
      });

      // Assert
      expect(revaulted.unvaultedAt).toBeUndefined();
    });
  });

  describe('If addVaultItem is called with a sourceFilePath', () => {
    it('Then sourceFilePath is stored and returned in the result', () => {
      // Arrange
      const fingerprint = 'fp-source-file-path';
      const sourceFilePath = '/saves/Sorc.d2s';

      // Act
      const item = addVaultItem(ctx, {
        fingerprint,
        itemName: 'Shako',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{"id":42}',
        sourceFileType: 'd2s',
        sourceFilePath,
        locationContext: 'inventory',
      });

      // Assert
      expect(item.sourceFilePath).toBe(sourceFilePath);
    });
  });

  describe('If unvaultVaultItem is called for a vaulted item', () => {
    it('Then unvaultedAt is set to a recent timestamp', () => {
      // Arrange
      const item = addVaultItem(ctx, {
        fingerprint: 'fp-unvault',
        itemName: 'Windforce',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
      });
      const before = new Date();

      // Act
      unvaultVaultItem(ctx, item.id);

      // Assert
      const updated = getVaultItemById(ctx, item.id);
      expect(updated?.unvaultedAt).toBeTruthy();
      expect(updated?.unvaultedAt?.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('If searchVaultItems is called with vaultedState vaulted', () => {
    it('Then only currently-vaulted items are returned', () => {
      // Arrange
      const vaultedAt = new Date('2024-01-01T10:00:00.000Z').toISOString();
      const laterUnvaulted = new Date('2024-01-01T09:00:00.000Z').toISOString(); // before vaultedAt

      // Item that IS currently vaulted (vaultedAt set, no unvaultedAt)
      const vaulted = addVaultItem(ctx, {
        fingerprint: 'fp-currently-vaulted',
        itemName: 'Vaulted Shako',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'stash',
        vaultedAt: new Date(vaultedAt),
      });

      // Item with unvaultedAt < vaultedAt — still considered vaulted
      const revaultedAfterUnvault = addVaultItem(ctx, {
        fingerprint: 'fp-revaulted',
        itemName: 'Re-Vaulted Belt',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'stash',
        vaultedAt: new Date(vaultedAt),
        unvaultedAt: new Date(laterUnvaulted),
      });
      expect(revaultedAfterUnvault.id).toBeTruthy();

      // Item with unvaultedAt >= vaultedAt — NOT currently vaulted
      const unvaultedItem = addVaultItem(ctx, {
        fingerprint: 'fp-unvaulted-search',
        itemName: 'Unvaulted Ring',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'stash',
      });
      unvaultVaultItem(ctx, unvaultedItem.id);

      // Item with no vaultedAt — NOT currently vaulted
      upsertVaultItemByFingerprint(ctx, {
        fingerprint: 'fp-never-vaulted',
        itemName: 'Never Vaulted Amulet',
        quality: 'magic',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
      });

      // Act
      const result = searchVaultItems(ctx, {
        vaultedState: 'vaulted',
        page: 1,
        pageSize: 20,
      });

      // Assert
      expect(result.total).toBe(2);
      const ids = result.items.map((i) => i.id);
      expect(ids).toContain(vaulted.id);
      expect(ids).toContain(revaultedAfterUnvault.id);
    });
  });

  describe('If addVaultItem is called twice for the same stackable rune item code', () => {
    it('Then the second vault merges count instead of creating a duplicate', () => {
      // Arrange
      const runeJson = JSON.stringify({
        code: 'r07',
        magic_attributes: [{ id: 381, values: [3] }],
      });

      // Act
      const first = addVaultItem(ctx, {
        fingerprint: 'fp-rune-first',
        itemName: 'Vex Rune',
        itemCode: 'r07',
        quality: 'normal',
        ethereal: false,
        rawItemJson: runeJson,
        sourceFileType: 'd2i',
        locationContext: 'stash',
      });

      const second = addVaultItem(ctx, {
        fingerprint: 'fp-rune-second',
        itemName: 'Vex Rune',
        itemCode: 'r07',
        quality: 'normal',
        ethereal: false,
        rawItemJson: JSON.stringify({
          code: 'r07',
          magic_attributes: [{ id: 381, values: [2] }],
        }),
        sourceFileType: 'd2i',
        locationContext: 'stash',
      });

      // Assert — should be merged into first entry
      expect(second.id).toBe(first.id);
      expect(second.stackCount).toBe(5); // 3 + 2
    });
  });

  describe('If unvaultVaultItem is called with withdrawCount less than current stackCount', () => {
    it('Then only decrements the count without marking item as unvaulted', () => {
      // Arrange
      const runeJson = JSON.stringify({
        code: 'r07',
        magic_attributes: [{ id: 381, values: [5] }],
      });
      const item = addVaultItem(ctx, {
        fingerprint: 'fp-rune-partial',
        itemName: 'Vex Rune',
        itemCode: 'r07',
        quality: 'normal',
        ethereal: false,
        rawItemJson: runeJson,
        sourceFileType: 'd2i',
        locationContext: 'stash',
      });

      // Act
      unvaultVaultItem(ctx, item.id, 2);

      // Assert
      const updated = getVaultItemById(ctx, item.id);
      expect(updated?.stackCount).toBe(3); // 5 - 2
      expect(updated?.unvaultedAt).toBeUndefined();
    });
  });

  describe('If unvaultVaultItem is called with withdrawCount equal to current stackCount', () => {
    it('Then fully unvaults the item', () => {
      // Arrange
      const runeJson = JSON.stringify({
        code: 'r07',
        magic_attributes: [{ id: 381, values: [3] }],
      });
      const item = addVaultItem(ctx, {
        fingerprint: 'fp-rune-full-unvault',
        itemName: 'Vex Rune',
        itemCode: 'r07',
        quality: 'normal',
        ethereal: false,
        rawItemJson: runeJson,
        sourceFileType: 'd2i',
        locationContext: 'stash',
      });

      // Act
      unvaultVaultItem(ctx, item.id, 3);

      // Assert
      const updated = getVaultItemById(ctx, item.id);
      expect(updated?.unvaultedAt).toBeTruthy();
    });
  });

  describe('If searchVaultItems is called with vaultedState unvaulted', () => {
    it('Then only previously-vaulted-then-unvaulted items are returned', () => {
      // Arrange
      // Item that IS currently vaulted — should NOT appear
      addVaultItem(ctx, {
        fingerprint: 'fp-still-vaulted',
        itemName: 'Still Vaulted Item',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'stash',
      });

      // Item that was vaulted then unvaulted — SHOULD appear
      const toUnvault = addVaultItem(ctx, {
        fingerprint: 'fp-was-vaulted',
        itemName: 'Was Vaulted Item',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'stash',
      });
      unvaultVaultItem(ctx, toUnvault.id);

      // Act
      const result = searchVaultItems(ctx, {
        vaultedState: 'unvaulted',
        page: 1,
        pageSize: 20,
      });

      // Assert
      expect(result.total).toBe(1);
      expect(result.items[0]?.id).toBe(toUnvault.id);
    });
  });

  describe('If an existing vault_items table is missing socketed columns', () => {
    it('Then schema initialization adds missing columns and backfills canonical icon/location fields', () => {
      // Arrange
      const rawDb = new Database(':memory:');
      rawDb.exec(`
        CREATE TABLE vault_items (
          id TEXT PRIMARY KEY,
          fingerprint TEXT NOT NULL,
          item_name TEXT NOT NULL,
          item_code TEXT,
          quality TEXT NOT NULL,
          ethereal BOOLEAN NOT NULL DEFAULT FALSE,
          socket_count INTEGER,
          raw_item_json TEXT NOT NULL,
          source_character_id TEXT,
          source_character_name TEXT,
          source_file_type TEXT NOT NULL CHECK (source_file_type IN ('d2s', 'sss', 'd2x', 'd2i')),
          location_context TEXT NOT NULL DEFAULT 'unknown' CHECK (
            location_context IN ('equipped', 'inventory', 'stash', 'mercenary', 'corpse', 'unknown')
          ),
          stash_tab INTEGER,
          icon_file_name TEXT,
          grail_item_id TEXT,
          is_present_in_latest_scan BOOLEAN NOT NULL DEFAULT TRUE,
          last_seen_at DATETIME,
          vaulted_at DATETIME,
          unvaulted_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const insertLegacyRow = rawDb.prepare(
        `
          INSERT INTO vault_items (
            id,
            fingerprint,
            item_name,
            item_code,
            quality,
            ethereal,
            socket_count,
            raw_item_json,
            source_file_type,
            location_context,
            icon_file_name,
            is_present_in_latest_scan
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      );
      insertLegacyRow.run(
        'legacy-row-1',
        'legacy-fingerprint-1',
        'Harlequin Crest',
        'uap',
        'unique',
        0,
        0,
        '{"inv_file":"invhamm","type_name":"Shako","location_id":2,"alt_position_id":0,"position_x":5,"position_y":0,"inv_width":1,"inv_height":1}',
        'd2s',
        'inventory',
        'invhamm.png',
        1,
      );
      insertLegacyRow.run(
        'legacy-row-2',
        'legacy-fingerprint-2',
        'Expanded Inventory Item',
        'cm3',
        'magic',
        0,
        0,
        '{"inv_file":"invcm3","type_name":"Grand Charm","location_id":0,"alt_position_id":1,"position_x":12,"position_y":1,"inv_width":1,"inv_height":3}',
        'd2s',
        'stash',
        'invcm3.png',
        1,
      );

      const legacyCtx: DatabaseContext = {
        rawDb,
        db: createDrizzleDb(rawDb),
        dbPath: ':memory:',
      };

      // Act
      initializeSchema(legacyCtx);
      const columns = rawDb.prepare('PRAGMA table_info(vault_items)').all() as Array<{
        name: string;
      }>;
      const firstPassIconName = rawDb
        .prepare(
          `
            SELECT
              icon_file_name,
              location_context,
              stash_tab,
              grid_x,
              grid_y,
              grid_width,
              grid_height
            FROM vault_items
            WHERE id = ?
          `,
        )
        .get('legacy-row-1') as {
        icon_file_name: string | null;
        location_context: string;
        stash_tab: number | null;
        grid_x: number | null;
        grid_y: number | null;
        grid_width: number | null;
        grid_height: number | null;
      };

      // Re-run schema initialization to verify idempotent behavior.
      initializeSchema(legacyCtx);
      const secondPassIconName = rawDb
        .prepare(
          `
            SELECT
              icon_file_name,
              location_context,
              stash_tab,
              grid_x,
              grid_y,
              grid_width,
              grid_height
            FROM vault_items
            WHERE id = ?
          `,
        )
        .get('legacy-row-1') as {
        icon_file_name: string | null;
        location_context: string;
        stash_tab: number | null;
        grid_x: number | null;
        grid_y: number | null;
        grid_width: number | null;
        grid_height: number | null;
      };
      const expandedInventoryRow = rawDb
        .prepare(
          `
            SELECT
              location_context,
              stash_tab,
              grid_x,
              grid_y,
              grid_width,
              grid_height
            FROM vault_items
            WHERE id = ?
          `,
        )
        .get('legacy-row-2') as {
        location_context: string;
        stash_tab: number | null;
        grid_x: number | null;
        grid_y: number | null;
        grid_width: number | null;
        grid_height: number | null;
      };

      // Assert
      expect(columns.some((column) => column.name === 'is_socketed_item')).toBe(true);
      expect(firstPassIconName.icon_file_name).toBe('cap_hat.png');
      expect(firstPassIconName.location_context).toBe('unknown');
      expect(firstPassIconName.stash_tab).toBeNull();
      expect(firstPassIconName.grid_x).toBe(1);
      expect(firstPassIconName.grid_y).toBe(1);
      expect(firstPassIconName.grid_width).toBe(1);
      expect(firstPassIconName.grid_height).toBe(1);
      expect(secondPassIconName.icon_file_name).toBe('cap_hat.png');
      expect(secondPassIconName.location_context).toBe('unknown');
      expect(secondPassIconName.stash_tab).toBeNull();
      expect(secondPassIconName.grid_x).toBe(1);
      expect(secondPassIconName.grid_y).toBe(1);
      expect(secondPassIconName.grid_width).toBe(1);
      expect(secondPassIconName.grid_height).toBe(1);
      expect(expandedInventoryRow.location_context).toBe('inventory');
      expect(expandedInventoryRow.stash_tab).toBeNull();
      expect(expandedInventoryRow.grid_x).toBe(12);
      expect(expandedInventoryRow.grid_y).toBe(1);
      expect(expandedInventoryRow.grid_width).toBe(1);
      expect(expandedInventoryRow.grid_height).toBe(3);
    });
  });
});

describe('When vault adds could overwrite or lose already vaulted items', () => {
  let ctx: DatabaseContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  const baseInput = {
    itemName: 'Harlequin Crest',
    quality: 'unique',
    ethereal: false,
    sourceFileType: 'd2s' as const,
    sourceFilePath: '/saves/Sorc.d2s',
    locationContext: 'inventory' as const,
  };

  describe('If a different item with the same fingerprint is vaulted while the first is still vaulted', () => {
    it('Then both items are kept in separate rows', () => {
      // Arrange
      const first = addVaultItem(ctx, {
        ...baseInput,
        fingerprint: 'fp-shared',
        rawItemJson: '{"id":1,"roll":"first"}',
      });

      // Act
      const second = addVaultItem(ctx, {
        ...baseInput,
        fingerprint: 'fp-shared',
        rawItemJson: '{"id":2,"roll":"second"}',
      });

      // Assert
      expect(second.id).not.toBe(first.id);
      expect(getVaultItemById(ctx, first.id)?.rawItemJson).toBe('{"id":1,"roll":"first"}');
      expect(second.rawItemJson).toBe('{"id":2,"roll":"second"}');
      expect(searchVaultItems(ctx, { vaultedState: 'vaulted' }).total).toBe(2);
    });
  });

  describe('If a stack merge is undone after the source removal failed', () => {
    it('Then the previously vaulted stack keeps its count and stays vaulted', () => {
      // Arrange
      const existing = addVaultItem(ctx, {
        ...baseInput,
        fingerprint: 'fp-runes-1',
        itemName: 'Fal Rune',
        itemCode: 'r19',
        rawItemJson: JSON.stringify({ code: 'r19', magic_attributes: [{ id: 381, values: [10] }] }),
      });
      const result = addVaultItemWithUndo(ctx, {
        ...baseInput,
        fingerprint: 'fp-runes-2',
        itemName: 'Fal Rune',
        itemCode: 'r19',
        rawItemJson: JSON.stringify({ code: 'r19', magic_attributes: [{ id: 381, values: [4] }] }),
      });
      expect(result.item.stackCount).toBe(14);

      // Act
      result.undo();

      // Assert
      const restored = getVaultItemById(ctx, existing.id);
      expect(restored?.stackCount).toBe(10);
      expect(restored?.unvaultedAt).toBeUndefined();
      expect(searchVaultItems(ctx, { vaultedState: 'vaulted' }).total).toBe(1);
    });
  });

  describe('If an add that replaced a previously unvaulted row is undone', () => {
    it('Then the old row data is restored', () => {
      // Arrange
      const first = addVaultItem(ctx, {
        ...baseInput,
        fingerprint: 'fp-reused',
        rawItemJson: '{"id":1,"roll":"old"}',
      });
      unvaultVaultItem(ctx, first.id);
      const result = addVaultItemWithUndo(ctx, {
        ...baseInput,
        fingerprint: 'fp-reused',
        rawItemJson: '{"id":1,"roll":"new"}',
      });

      // Act
      result.undo();

      // Assert
      const restored = getVaultItemById(ctx, first.id);
      expect(restored?.rawItemJson).toBe('{"id":1,"roll":"old"}');
      expect(searchVaultItems(ctx, { vaultedState: 'vaulted' }).total).toBe(0);
    });
  });

  describe('If a brand-new add is undone', () => {
    it('Then the row keeps its item data but is no longer vaulted', () => {
      // Arrange
      const result = addVaultItemWithUndo(ctx, {
        ...baseInput,
        fingerprint: 'fp-new',
        rawItemJson: '{"id":7}',
      });

      // Act
      result.undo();

      // Assert
      const row = getVaultItemById(ctx, result.item.id);
      expect(row?.rawItemJson).toBe('{"id":7}');
      expect(searchVaultItems(ctx, { vaultedState: 'vaulted' }).total).toBe(0);
    });
  });

  describe('If natively stackable items with a quantity are vaulted', () => {
    it('Then they get their own rows instead of merging beyond the game stack limit', () => {
      // Arrange
      const keys = (fingerprint: string) => ({
        ...baseInput,
        fingerprint,
        itemName: 'Key',
        itemCode: 'key',
        rawItemJson: JSON.stringify({ code: 'key', quantity: 12 }),
      });

      // Act
      const first = addVaultItem(ctx, keys('fp-key-1'));
      const second = addVaultItem(ctx, keys('fp-key-2'));

      // Assert
      expect(second.id).not.toBe(first.id);
      expect(first.stackCount).toBe(12);
      expect(second.stackCount).toBe(12);
    });
  });

  describe('If a rune is vaulted while a grail bookmark exists for the same code', () => {
    it('Then the rune is not merged into the bookmark', () => {
      // Arrange
      const bookmark = addVaultItem(ctx, {
        fingerprint: 'grail:fal',
        itemName: 'Fal Rune',
        itemCode: 'r19',
        quality: 'normal',
        ethereal: false,
        rawItemJson: '{"id":"fal"}',
        sourceFileType: 'd2s',
        locationContext: 'unknown',
      });

      // Act
      const rune = addVaultItem(ctx, {
        ...baseInput,
        fingerprint: 'fp-fal',
        itemName: 'Fal Rune',
        itemCode: 'r19',
        rawItemJson: JSON.stringify({ code: 'r19' }),
      });

      // Assert
      expect(rune.id).not.toBe(bookmark.id);
      expect(getVaultItemById(ctx, bookmark.id)?.stackCount).toBe(1);
    });
  });

  describe('If a grail bookmark is added while a real rune stack of the same code is vaulted', () => {
    it('Then the real stack keeps its count and a separate bookmark row is returned', () => {
      // Arrange
      const realStack = addVaultItem(ctx, {
        ...baseInput,
        fingerprint: 'd2i|stash|r01',
        itemName: 'El Rune',
        itemCode: 'r01',
        rawItemJson: JSON.stringify({ code: 'r01', quantity: 3 }),
      });
      const bookmarkInput = {
        fingerprint: 'grail:el',
        itemName: 'El Rune',
        itemCode: 'r01',
        quality: 'rune',
        ethereal: false,
        rawItemJson: JSON.stringify({ id: 'el', code: 'r01', type: 'rune' }),
        sourceFileType: 'd2s' as const,
        locationContext: 'unknown' as const,
        grailItemId: 'el',
        isPresentInLatestScan: false,
      };

      // Act
      const bookmark = addVaultItem(ctx, bookmarkInput);
      const bookmarkAgain = addVaultItem(ctx, bookmarkInput);

      // Assert
      expect(bookmark.id).not.toBe(realStack.id);
      expect(bookmark.fingerprint).toBe('grail:el');
      expect(bookmarkAgain.id).toBe(bookmark.id);
      expect(getVaultItemById(ctx, realStack.id)?.stackCount).toBe(3);
      expect(searchVaultItems(ctx, { vaultedState: 'all' }).total).toBe(2);
    });
  });

  describe('If a gem stack and a gem of the same code are vaulted', () => {
    it('Then their counts are summed in a single row', () => {
      // Arrange
      const gem = (fingerprint: string, quantity: number) => ({
        ...baseInput,
        fingerprint,
        itemName: 'Perfect Skull',
        itemCode: 'skz',
        rawItemJson: JSON.stringify({ code: 'skz', quantity }),
      });

      // Act
      const first = addVaultItem(ctx, gem('fp-skz-1', 6));
      const second = addVaultItem(ctx, gem('fp-skz-2', 1));

      // Assert
      expect(second.id).toBe(first.id);
      expect(second.stackCount).toBe(7);
    });
  });

  describe('If unvaultVaultItem receives an invalid withdraw count', () => {
    it('Then it throws instead of growing or ignoring the stack', () => {
      // Arrange
      const saved = addVaultItem(ctx, {
        ...baseInput,
        fingerprint: 'fp-rune-withdraw',
        itemCode: 'r07',
        rawItemJson: JSON.stringify({ code: 'r07', magic_attributes: [{ id: 381, values: [5] }] }),
      });

      // Act
      const withdrawNegative = () => unvaultVaultItem(ctx, saved.id, -2);
      const withdrawZero = () => unvaultVaultItem(ctx, saved.id, 0);

      // Assert
      expect(withdrawNegative).toThrow('positive integer');
      expect(withdrawZero).toThrow('positive integer');
      expect(getVaultItemById(ctx, saved.id)?.stackCount).toBe(5);
    });
  });
});

describe('When a stack merge is undone after another merge landed in the same row', () => {
  it('Then only the undone units are taken out and the other merge survives', () => {
    // Arrange
    const ctx = createTestContext();
    const base = {
      itemName: 'Fal Rune',
      itemCode: 'r19',
      quality: 'normal',
      ethereal: false,
      sourceFileType: 'd2i' as const,
      sourceFilePath: '/saves/shared.d2i',
      locationContext: 'stash' as const,
    };
    const rune = (count: number) =>
      JSON.stringify({ code: 'r19', magic_attributes: [{ id: 381, values: [count] }] });
    const row = addVaultItem(ctx, { ...base, fingerprint: 'fp-a', rawItemJson: rune(10) });
    const first = addVaultItemWithUndo(ctx, { ...base, fingerprint: 'fp-b', rawItemJson: rune(4) });
    addVaultItemWithUndo(ctx, { ...base, fingerprint: 'fp-c', rawItemJson: rune(3) });

    // Act
    first.undo();

    // Assert
    expect(getVaultItemById(ctx, row.id)?.stackCount).toBe(13);
  });
});
