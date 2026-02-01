import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time'),
    totalRunTime: integer('total_run_time').default(0), // milliseconds
    totalSessionTime: integer('total_session_time').default(0), // milliseconds
    runCount: integer('run_count').default(0),
    archived: integer('archived', { mode: 'boolean' }).default(false),
    notes: text('notes'),
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    index('idx_sessions_start_time').on(table.startTime),
    index('idx_sessions_archived').on(table.archived),
  ],
);

export type DbSession = typeof sessions.$inferSelect;
export type DbSessionInsert = typeof sessions.$inferInsert;
