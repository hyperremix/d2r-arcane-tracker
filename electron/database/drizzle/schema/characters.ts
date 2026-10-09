import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { CharacterClass } from '../../../types/grail';

export const characters = sqliteTable(
  'characters',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    characterClass: text('character_class', {
      enum: [
        'amazon',
        'assassin',
        'barbarian',
        'druid',
        'necromancer',
        'paladin',
        'sorceress',
        'shared_stash',
      ],
    })
      .notNull()
      .$type<CharacterClass>(),
    level: integer('level').notNull().default(1),
    hardcore: integer('hardcore', { mode: 'boolean' }).notNull().default(false),
    expansion: integer('expansion', { mode: 'boolean' }).notNull().default(true),
    saveFilePath: text('save_file_path'),
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_characters_class').on(table.characterClass),
    index('idx_characters_deleted_at').on(table.deletedAt),
    index('idx_characters_updated_at').on(table.updatedAt),
    check(
      'characters_character_class_check',
      sql`character_class IN ('amazon', 'assassin', 'barbarian', 'druid', 'necromancer', 'paladin', 'sorceress', 'shared_stash')`,
    ),
  ],
);

export type DbCharacter = typeof characters.$inferSelect;
export type DbCharacterInsert = typeof characters.$inferInsert;
