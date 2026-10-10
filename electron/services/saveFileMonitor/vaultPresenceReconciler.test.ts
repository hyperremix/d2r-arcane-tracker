import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  D2SItem,
  ParsedInventoryItemWithRaw,
  ParsedInventorySnapshot,
} from '../../types/grail';
import { normalizeInventoryItem } from '../itemNormalizer';
import type { SingleFileParseResult } from './types';
import {
  createPresenceIdentityKey,
  markOrphanedVaultRowsMissing,
  reconcileVaultPresence,
  type VaultPresenceDatabase,
} from './vaultPresenceReconciler';

function createDatabase() {
  return {
    getVaultSourceFilePathsPresentInLatestScan: vi.fn<() => string[]>(() => []),
    markVaultItemsMissingForSourceFiles: vi.fn(),
    reconcileVaultItemsForScan: vi.fn(),
  };
}

function asDatabase(database: ReturnType<typeof createDatabase>): VaultPresenceDatabase {
  return database as unknown as VaultPresenceDatabase;
}

function parseStashItem(item: Partial<D2SItem>): ParsedInventoryItemWithRaw {
  return normalizeInventoryItem({
    filePath: '/tmp/SharedStash.d2i',
    saveName: 'Shared',
    sourceFileType: 'd2i',
    item: item as D2SItem,
    fallbackLocation: 'stash',
    stashTab: 0,
  });
}

function createSnapshot(sourceFilePath: string): ParsedInventorySnapshot {
  return {
    snapshotId: `${sourceFilePath}-1`,
    characterName: 'Hero',
    sourceFileType: 'd2s',
    sourceFilePath,
    readOnly: false,
    capturedAt: new Date('2024-01-02T00:00:00.000Z'),
    items: [],
  };
}

describe('When the presence identity of an item is created', () => {
  it('Then a moved item keeps its presence identity while its fingerprint changes', () => {
    // Arrange
    const itemAt = (x: number, y: number): Partial<D2SItem> => ({
      name: 'Ring of Fire',
      type: 'ring',
      code: 'rin',
      quality: 4,
      id: 987654,
      location_id: 0,
      alt_position_id: 5,
      position_x: x,
      position_y: y,
      inv_width: 1,
      inv_height: 1,
    });

    // Act
    const before = parseStashItem(itemAt(1, 1));
    const after = parseStashItem(itemAt(6, 4));

    // Assert
    expect(after.fingerprint).not.toBe(before.fingerprint);
    expect(createPresenceIdentityKey(after)).toBe(createPresenceIdentityKey(before));
  });

  it('Then items that differ only by their game item id have different presence identities', () => {
    // Arrange
    const ring = (id: number): Partial<D2SItem> => ({
      name: 'Ring of Fire',
      type: 'ring',
      code: 'rin',
      quality: 4,
      id,
      position_x: 1,
      position_y: 1,
      inv_width: 1,
      inv_height: 1,
    });

    // Act
    const first = createPresenceIdentityKey(parseStashItem(ring(1)));
    const second = createPresenceIdentityKey(parseStashItem(ring(2)));

    // Assert
    expect(first).not.toBe(second);
  });
});

describe('When vault rows reference save files that no longer exist', () => {
  // These tests use real files: the reconciler reads file metadata through node:fs/promises.
  let database: ReturnType<typeof createDatabase>;
  let saveDir: string;
  let goneFile: string;

  beforeEach(() => {
    database = createDatabase();
    saveDir = mkdtempSync(join(tmpdir(), 'save-monitor-orphans-'));
    goneFile = join(saveDir, 'Gone.d2s');
    database.getVaultSourceFilePathsPresentInLatestScan.mockReturnValue([goneFile]);
  });

  afterEach(() => {
    chmodSync(saveDir, 0o700);
    rmSync(saveDir, { recursive: true, force: true });
  });

  it('Then rows of a file that is truly absent are marked missing', async () => {
    // Arrange
    const scannedFiles = [join(saveDir, 'Other.d2s')];

    // Act
    await markOrphanedVaultRowsMissing(asDatabase(database), scannedFiles);

    // Assert
    expect(database.markVaultItemsMissingForSourceFiles).toHaveBeenCalledWith([goneFile]);
  });

  it('Then a file that still exists is left alone', async () => {
    // Arrange
    writeFileSync(goneFile, 'save');

    // Act
    await markOrphanedVaultRowsMissing(asDatabase(database), []);

    // Assert
    expect(database.markVaultItemsMissingForSourceFiles).not.toHaveBeenCalled();
  });

  // chmod 000 only blocks stat() for unprivileged POSIX users: root ignores the mode and Windows
  // has no POSIX permission bits, so the test would pass without checking anything there.
  const canRestrictDirectoryAccess =
    process.platform !== 'win32' && (process.getuid?.() ?? 0) !== 0;

  it.skipIf(!canRestrictDirectoryAccess)(
    'Then a file that cannot be inspected right now does not count as deleted',
    async () => {
      // Arrange
      writeFileSync(goneFile, 'save');
      chmodSync(saveDir, 0o000);

      try {
        // Act
        await markOrphanedVaultRowsMissing(asDatabase(database), []);

        // Assert
        expect(database.markVaultItemsMissingForSourceFiles).not.toHaveBeenCalled();
      } finally {
        chmodSync(saveDir, 0o700);
      }
    },
  );

  it('Then an unavailable save directory does not count as deleted files', async () => {
    // Arrange
    const missingDirectoryFile = join(saveDir, 'unmounted', 'Gone.d2s');
    database.getVaultSourceFilePathsPresentInLatestScan.mockReturnValue([missingDirectoryFile]);

    // Act
    await markOrphanedVaultRowsMissing(asDatabase(database), []);

    // Assert
    expect(database.markVaultItemsMissingForSourceFiles).not.toHaveBeenCalled();
  });

  it('Then a file that was just scanned is never marked missing', async () => {
    // Arrange
    const scannedFiles = [goneFile];

    // Act
    await markOrphanedVaultRowsMissing(asDatabase(database), scannedFiles);

    // Assert
    expect(database.markVaultItemsMissingForSourceFiles).not.toHaveBeenCalled();
  });

  it('Then a database error does not break the scan', async () => {
    // Arrange
    database.markVaultItemsMissingForSourceFiles.mockImplementation(() => {
      throw new Error('database is locked');
    });

    // Act
    const run = markOrphanedVaultRowsMissing(asDatabase(database), []);

    // Assert
    await expect(run).resolves.toBeUndefined();
  });
});

describe('When vault presence is reconciled with the parse results of a scan', () => {
  describe('If files were parsed completely, partially, not at all or failed', () => {
    it('Then only the completely parsed files are reconciled, each scoped to its own file', () => {
      // Arrange
      const database = createDatabase();
      const complete = createSnapshot('/saves/complete.d2s');
      const results: Array<SingleFileParseResult | undefined> = [
        {
          saveName: 'Complete',
          success: true,
          parseStatus: 'parsed',
          presentFingerprints: ['fp-visible', 'fp-socketed'],
          presentIdentityKeys: ['key-visible', 'key-socketed'],
          inventorySnapshot: complete,
          saveFile: {} as never,
          parsedItems: [],
        },
        {
          saveName: 'Partial',
          success: true,
          parseStatus: 'partial',
          inventorySnapshot: createSnapshot('/saves/partial.d2i'),
          saveFile: {} as never,
          parsedItems: [],
        },
        {
          saveName: 'Skipped',
          success: true,
          parseStatus: 'skipped',
          inventorySnapshot: createSnapshot('/saves/skipped.d2s'),
          saveFile: {} as never,
          parsedItems: [],
        },
        { saveName: 'Failed', success: false },
        undefined,
      ];

      // Act
      reconcileVaultPresence(asDatabase(database), results);

      // Assert
      expect(database.reconcileVaultItemsForScan).toHaveBeenCalledTimes(1);
      expect(database.reconcileVaultItemsForScan).toHaveBeenCalledWith({
        sourceFileType: 'd2s',
        sourceFilePath: '/saves/complete.d2s',
        presentFingerprints: ['fp-visible', 'fp-socketed'],
        presentIdentityKeys: ['key-visible', 'key-socketed'],
        lastSeenAt: complete.capturedAt,
      });
    });
  });

  describe('If reconciling one file fails', () => {
    it('Then the error is swallowed and the next file is still reconciled', () => {
      // Arrange
      const database = createDatabase();
      database.reconcileVaultItemsForScan.mockImplementationOnce(() => {
        throw new Error('database is locked');
      });
      const parsed = (path: string): SingleFileParseResult => ({
        saveName: path,
        success: true,
        parseStatus: 'parsed',
        presentFingerprints: [],
        presentIdentityKeys: [],
        inventorySnapshot: createSnapshot(path),
        saveFile: {} as never,
        parsedItems: [],
      });

      // Act
      const run = () =>
        reconcileVaultPresence(asDatabase(database), [
          parsed('/saves/a.d2s'),
          parsed('/saves/b.d2s'),
        ]);

      // Assert
      expect(run).not.toThrow();
      expect(database.reconcileVaultItemsForScan).toHaveBeenCalledTimes(2);
    });
  });
});
