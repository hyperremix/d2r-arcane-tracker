import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { characters } from './characters';
import { items } from './items';

export const vaultItems = sqliteTable(
  'vault_items',
  {
    id: text('id').primaryKey(),
    fingerprint: text('fingerprint').notNull(),
    itemName: text('item_name').notNull(),
    itemCode: text('item_code'),
    quality: text('quality').notNull(),
    ethereal: integer('ethereal', { mode: 'boolean' }).notNull().default(false),
    socketCount: integer('socket_count'),
    rawItemJson: text('raw_item_json').notNull(),
    sourceCharacterId: text('source_character_id').references(() => characters.id, {
      onDelete: 'set null',
    }),
    sourceCharacterName: text('source_character_name'),
    sourceFileType: text('source_file_type', { enum: ['d2s', 'sss', 'd2x', 'd2i'] }).notNull(),
    locationContext: text('location_context', {
      enum: ['equipped', 'inventory', 'stash', 'mercenary', 'corpse', 'unknown'],
    })
      .notNull()
      .default('unknown'),
    stashTab: integer('stash_tab'),
    gridX: integer('grid_x'),
    gridY: integer('grid_y'),
    gridWidth: integer('grid_width'),
    gridHeight: integer('grid_height'),
    equippedSlotId: integer('equipped_slot_id'),
    iconFileName: text('icon_file_name'),
    isSocketedItem: integer('is_socketed_item', { mode: 'boolean' }).notNull().default(false),
    grailItemId: text('grail_item_id').references(() => items.id, { onDelete: 'set null' }),
    isPresentInLatestScan: integer('is_present_in_latest_scan', { mode: 'boolean' })
      .notNull()
      .default(true),
    lastSeenAt: text('last_seen_at'),
    vaultedAt: text('vaulted_at'),
    unvaultedAt: text('unvaulted_at'),
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    uniqueIndex('idx_vault_items_fingerprint').on(table.fingerprint),
    index('idx_vault_items_item_name').on(table.itemName),
    index('idx_vault_items_item_code').on(table.itemCode),
    index('idx_vault_items_quality').on(table.quality),
    index('idx_vault_items_source_character_id').on(table.sourceCharacterId),
    index('idx_vault_items_source_file_type').on(table.sourceFileType),
    index('idx_vault_items_location_context').on(table.locationContext),
    index('idx_vault_items_socketed').on(table.isSocketedItem),
    index('idx_vault_items_grail_item_id').on(table.grailItemId),
    index('idx_vault_items_present_scan').on(table.isPresentInLatestScan),
    index('idx_vault_items_last_seen_at').on(table.lastSeenAt),
  ],
);

export type DbVaultItem = typeof vaultItems.$inferSelect;
export type DbVaultItemInsert = typeof vaultItems.$inferInsert;
