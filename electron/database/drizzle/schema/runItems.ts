import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { grailProgress } from './grailProgress';
import { runs } from './runs';

export const runItems = sqliteTable(
  'run_items',
  {
    id: text('id').primaryKey(),
    runId: text('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    grailProgressId: text('grail_progress_id').references(() => grailProgress.id, {
      onDelete: 'cascade',
    }),
    name: text('name'),
    foundTime: text('found_time').notNull(),
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    index('idx_run_items_run').on(table.runId),
    index('idx_run_items_progress').on(table.grailProgressId),
  ],
);

export type DbRunItem = typeof runItems.$inferSelect;
export type DbRunItemInsert = typeof runItems.$inferInsert;
