import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type {
  EtherealType,
  ItemCategory,
  ItemSet,
  ItemSubCategory,
  ItemTreasureClass,
  ItemType,
} from '../../../types/grail';

export const items = sqliteTable(
  'items',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    link: text('link'),
    code: text('code'),
    itemBase: text('item_base'),
    imageFilename: text('image_filename'),
    type: text('type', { enum: ['unique', 'set', 'rune', 'runeword'] })
      .notNull()
      .$type<ItemType>(),
    category: text('category', {
      enum: ['weapons', 'armor', 'jewelry', 'charms', 'runes', 'runewords'],
    })
      .notNull()
      .$type<ItemCategory>(),
    subCategory: text('sub_category').notNull().$type<ItemSubCategory>(),
    treasureClass: text('treasure_class', { enum: ['normal', 'exceptional', 'elite'] })
      .notNull()
      .$type<ItemTreasureClass>(),
    setName: text('set_name').$type<ItemSet>(),
    runes: text('runes'), // JSON stringified array
    etherealType: text('ethereal_type', { enum: ['none', 'optional', 'only'] })
      .notNull()
      .$type<EtherealType>(),
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
  },
  (table) => [
    index('idx_items_category').on(table.category),
    index('idx_items_type').on(table.type),
  ],
);

export type DbItem = typeof items.$inferSelect;
export type DbItemInsert = typeof items.$inferInsert;
