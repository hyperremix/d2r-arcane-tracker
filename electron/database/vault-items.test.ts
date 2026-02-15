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
      createSchema(legacyCtx);
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

      // Re-run createSchema to verify idempotent behavior.
      createSchema(legacyCtx);
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
