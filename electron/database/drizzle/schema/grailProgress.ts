import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Difficulty } from '../../../types/grail';
import { items } from './items';

export const grailProgress = sqliteTable(
  'grail_progress',
  {
    id: text('id').primaryKey(),
    characterId: text('character_id').notNull(),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    foundDate: text('found_date'),
    manuallyAdded: integer('manually_added', { mode: 'boolean' }).notNull().default(false),
    autoDetected: integer('auto_detected', { mode: 'boolean' }).notNull().default(true),
    difficulty: text('difficulty', { enum: ['normal', 'nightmare', 'hell'] }).$type<Difficulty>(),
    notes: text('notes'),
    isEthereal: integer('is_ethereal', { mode: 'boolean' }).notNull().default(false),
    fromInitialScan: integer('from_initial_scan', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    index('idx_grail_progress_character').on(table.characterId),
    index('idx_grail_progress_item').on(table.itemId),
    index('idx_grail_progress_found_date').on(table.foundDate),
    index('idx_grail_progress_character_item').on(table.characterId, table.itemId),
  ],
);

export type DbGrailProgress = typeof grailProgress.$inferSelect;
export type DbGrailProgressInsert = typeof grailProgress.$inferInsert;
