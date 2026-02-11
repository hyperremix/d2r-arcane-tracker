import { asc, eq } from 'drizzle-orm';
import type { Item, Settings } from '../types/grail';
import { dbItemToItem, itemToDbValues } from './converters';
import { type DbItem, schema } from './drizzle';
import type { DatabaseContext } from './types';

const { items } = schema;

export function getAllItems(ctx: DatabaseContext): Item[] {
  const dbItems = ctx.db
    .select()
    .from(items)
    .orderBy(asc(items.category), asc(items.subCategory), asc(items.name))
    .all();
  return dbItems.map(dbItemToItem);
}

export function getAllRunewords(ctx: DatabaseContext): Item[] {
  const dbItems = ctx.db
    .select()
    .from(items)
    .where(eq(items.type, 'runeword'))
    .orderBy(asc(items.name))
    .all();
  return dbItems.map(dbItemToItem);
}

export function getFilteredItems(ctx: DatabaseContext, userSettings: Settings): Item[] {
  const excludedTypes: string[] = [];
  if (!userSettings.grailRunes) excludedTypes.push('rune');
  if (!userSettings.grailRunewords) excludedTypes.push('runeword');

  if (excludedTypes.length === 0) {
    return getAllItems(ctx);
  }

  // Use raw SQL for WHERE clause to filter out disabled item types
  const placeholders = excludedTypes.map(() => '?').join(', ');
  const dbItems = ctx.rawDb
    .prepare(
      `
      SELECT * FROM items
      WHERE type NOT IN (${placeholders})
      ORDER BY category ASC, sub_category ASC, name ASC
    `,
    )
    .all(...excludedTypes) as Record<string, unknown>[];

  // Map snake_case raw SQL columns to camelCase DbItem shape.
  // Nullable columns stay as null (matching the Drizzle path);
  // dbItemToItem handles null → undefined conversion.
  return dbItems.map((row) => {
    const dbItem: DbItem = {
      id: row.id as string,
      name: row.name as string,
      link: (row.link as string | null) ?? null,
      code: (row.code as string | null) ?? null,
      itemBase: (row.item_base as string | null) ?? null,
      imageFilename: (row.image_filename as string | null) ?? null,
      type: row.type as DbItem['type'],
      category: row.category as DbItem['category'],
      subCategory: row.sub_category as DbItem['subCategory'],
      treasureClass: row.treasure_class as DbItem['treasureClass'],
      setName: (row.set_name as DbItem['setName']) ?? null,
      runes: (row.runes as string | null) ?? null,
      etherealType: row.ethereal_type as DbItem['etherealType'],
      createdAt: (row.created_at as string | null) ?? null,
      updatedAt: (row.updated_at as string | null) ?? null,
    };
    return dbItemToItem(dbItem);
  });
}

export function insertItems(ctx: DatabaseContext, itemsToInsert: Item[]): void {
  const insertMany = ctx.rawDb.transaction(() => {
    for (const item of itemsToInsert) {
      const values = itemToDbValues(item);
      ctx.db
        .insert(items)
        .values(values)
        .onConflictDoUpdate({
          target: items.id,
          set: values,
        })
        .run();
    }
  });
  insertMany();
}
