import { asc, eq } from 'drizzle-orm';
import type { Item, Settings } from '../types/grail';
import { dbItemToItem, itemToDbValues } from './converters';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';

const { items } = schema;

function isItemTypeEnabled(itemType: string, userSettings: Settings): boolean {
  if (itemType === 'rune' && !userSettings.grailRunes) {
    return false;
  }
  if (itemType === 'runeword' && !userSettings.grailRunewords) {
    return false;
  }
  return true;
}

function shouldIncludeItem(item: Item, userSettings: Settings): boolean {
  return isItemTypeEnabled(item.type, userSettings);
}

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
  const allItems = getAllItems(ctx);
  return allItems.filter((item) => shouldIncludeItem(item, userSettings));
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
