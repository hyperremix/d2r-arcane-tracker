import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDrizzleDb } from './drizzle';
import { createSchema } from './schema';
import type { DatabaseContext } from './types';
import { addVaultCategory, setVaultItemCategories } from './vault-categories';
import {
  getVaultItemById,
  reconcileVaultItemsForScan,
  searchVaultItems,
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
  createSchema(ctx);
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
        locationContext: 'stash',
        lastSeenAt,
        isPresentInLatestScan: true,
      });

      // Act
      reconcileVaultItemsForScan(ctx, {
        sourceFileType: 'd2s',
        sourceCharacterName: 'SorcOne',
        presentFingerprints: [],
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

  describe('If categories are created and assigned to a vault item', () => {
    it('Then category filtering returns only tagged items', () => {
      // Arrange
      addVaultCategory(ctx, { id: 'cat-1', name: 'Trade' });
      addVaultCategory(ctx, { id: 'cat-2', name: 'Keep' });

      const tagged = upsertVaultItemByFingerprint(ctx, {
        fingerprint: 'fp-tagged',
        itemName: 'Arachnid Mesh',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
      });
      setVaultItemCategories(ctx, tagged.id, ['cat-1']);

      upsertVaultItemByFingerprint(ctx, {
        fingerprint: 'fp-untagged',
        itemName: 'Magefist',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
      });

      // Act
      const filtered = searchVaultItems(ctx, {
        categoryIds: ['cat-1'],
        page: 1,
        pageSize: 20,
      });

      // Assert
      expect(filtered.total).toBe(1);
      expect(filtered.items[0]?.fingerprint).toBe('fp-tagged');
      expect(filtered.items[0]?.categoryIds).toEqual(['cat-1']);
    });
  });
});
