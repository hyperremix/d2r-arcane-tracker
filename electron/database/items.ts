import { createHash } from 'node:crypto';
import { asc, count, eq, or, sql } from 'drizzle-orm';
import { items as grailItems } from '../items';
import type { Item, Settings } from '../types/grail';
import { dbItemToItem, itemToDbValues } from './converters';
import { type DbItem, schema } from './drizzle';
import type { DatabaseContext } from './types';

const { items, settings } = schema;

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

type ItemDbValues = ReturnType<typeof itemToDbValues>;

const itemValueKeys = [
  'id',
  'name',
  'link',
  'code',
  'itemBase',
  'imageFilename',
  'type',
  'category',
  'subCategory',
  'treasureClass',
  'setName',
  'runes',
  'etherealType',
] as const satisfies ReadonlyArray<keyof ItemDbValues>;

type UpdatableItemKey = Exclude<(typeof itemValueKeys)[number], 'id'>;
const updatableItemKeys = itemValueKeys.filter((key): key is UpdatableItemKey => key !== 'id');

/** Named placeholders for every item column, so one prepared statement serves all items. */
const itemValuePlaceholders = Object.fromEntries(
  itemValueKeys.map((key) => [key, sql.placeholder(key)]),
) as unknown as ItemDbValues;

/** On conflict, take every item column from the proposed row (`excluded`). */
const excludedItemValues = Object.fromEntries(
  updatableItemKeys.map((key) => [key, sql`excluded.${sql.identifier(items[key].name)}`]),
);

/** True when the proposed row differs from the stored row in any item column. */
const itemRowChanged = or(
  ...updatableItemKeys.map(
    (key) => sql`${items[key]} IS NOT excluded.${sql.identifier(items[key].name)}`,
  ),
);

/**
 * Inserts new items and updates existing ones, in one transaction. Rows whose values did not
 * change are not written, so their updated_at trigger does not fire.
 * @param ctx - Database context
 * @param itemsToInsert - Items to insert or update
 */
export function insertItems(ctx: DatabaseContext, itemsToInsert: readonly Item[]): void {
  const upsert = ctx.db
    .insert(items)
    .values(itemValuePlaceholders)
    .onConflictDoUpdate({ target: items.id, set: excludedItemValues, setWhere: itemRowChanged })
    .prepare();
  const insertMany = ctx.rawDb.transaction(() => {
    for (const item of itemsToInsert) {
      const values = itemToDbValues(item);
      upsert.run({ ...values, link: values.link ?? null });
    }
  });
  insertMany();
}

/** Settings key that stores the hash of the item catalog the items table was last synced with. */
export const ITEM_CATALOG_HASH_SETTING = 'grailItemCatalogHash';

/**
 * Hash of the static Holy Grail item catalog, as stored in the items table.
 * @param catalog - The item catalog
 */
export function computeItemCatalogHash(catalog: readonly Item[]): string {
  const hash = createHash('sha256');
  for (const item of catalog) {
    hash.update(JSON.stringify(itemToDbValues(item)));
    hash.update('\n');
  }
  return hash.digest('hex');
}

let cachedCatalogHash: { catalog: readonly Item[]; hash: string } | undefined;

function getItemCatalogHash(catalog: readonly Item[]): string {
  if (cachedCatalogHash?.catalog !== catalog) {
    cachedCatalogHash = { catalog, hash: computeItemCatalogHash(catalog) };
  }
  return cachedCatalogHash.hash;
}

/**
 * Brings the items table in line with the static item catalog when the catalog changed since the
 * last sync (detected by a hash stored in settings). Otherwise does nothing, so a normal start
 * does not touch the items table.
 * @param ctx - Database context
 * @param catalog - The item catalog (defaults to the bundled Holy Grail data)
 * @returns Whether the items table was synced
 */
export function syncItemCatalog(
  ctx: DatabaseContext,
  catalog: readonly Item[] = grailItems,
): boolean {
  const catalogHash = getItemCatalogHash(catalog);
  const stored = ctx.db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, ITEM_CATALOG_HASH_SETTING))
    .get();
  const itemCount = ctx.db.select({ total: count() }).from(items).get()?.total ?? 0;
  if (stored?.value === catalogHash && itemCount >= catalog.length) {
    return false;
  }

  const sync = ctx.rawDb.transaction(() => {
    insertItems(ctx, catalog);
    ctx.db
      .insert(settings)
      .values({ key: ITEM_CATALOG_HASH_SETTING, value: catalogHash })
      .onConflictDoUpdate({ target: settings.key, set: { value: catalogHash } })
      .run();
  });
  sync();
  console.log(`[Database] Synced ${catalog.length} Holy Grail items with the item catalog`);
  return true;
}
