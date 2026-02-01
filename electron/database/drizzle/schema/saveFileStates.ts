import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const saveFileStates = sqliteTable(
  'save_file_states',
  {
    id: text('id').primaryKey(),
    filePath: text('file_path').notNull().unique(),
    lastModified: text('last_modified').notNull(),
    lastParsed: text('last_parsed').notNull(),
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    index('idx_save_file_states_path').on(table.filePath),
    index('idx_save_file_states_modified').on(table.lastModified),
  ],
);

export type DbSaveFileState = typeof saveFileStates.$inferSelect;
export type DbSaveFileStateInsert = typeof saveFileStates.$inferInsert;
