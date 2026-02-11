import { index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { vaultCategories } from './vaultCategories';
import { vaultItems } from './vaultItems';

export const vaultItemCategories = sqliteTable(
  'vault_item_categories',
  {
    vaultItemId: text('vault_item_id')
      .notNull()
      .references(() => vaultItems.id, { onDelete: 'cascade' }),
    vaultCategoryId: text('vault_category_id')
      .notNull()
      .references(() => vaultCategories.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    primaryKey({ columns: [table.vaultItemId, table.vaultCategoryId] }),
    index('idx_vault_item_categories_item').on(table.vaultItemId),
    index('idx_vault_item_categories_category').on(table.vaultCategoryId),
  ],
);

export type DbVaultItemCategory = typeof vaultItemCategories.$inferSelect;
export type DbVaultItemCategoryInsert = typeof vaultItemCategories.$inferInsert;
