import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { characters } from './characters';
import { sessions } from './sessions';

export const runs = sqliteTable(
  'runs',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    characterId: text('character_id').references(() => characters.id),
    runNumber: integer('run_number').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time'),
    duration: integer('duration'), // milliseconds
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    index('idx_runs_session').on(table.sessionId),
    index('idx_runs_character').on(table.characterId),
    index('idx_runs_start_time').on(table.startTime),
    index('idx_runs_session_number').on(table.sessionId, table.runNumber),
  ],
);

export type DbRun = typeof runs.$inferSelect;
export type DbRunInsert = typeof runs.$inferInsert;
