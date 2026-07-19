import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const vaultCategories = sqliteTable(
  'vault_categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color'),
    metadata: text('metadata'),
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
  },
  (table) => [uniqueIndex('idx_vault_categories_name').on(table.name)],
);

export type DbVaultCategory = typeof vaultCategories.$inferSelect;
export type DbVaultCategoryInsert = typeof vaultCategories.$inferInsert;
