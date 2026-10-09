import { asc, eq } from 'drizzle-orm';
import type { RunItem } from '../types/grail';
import { dbRunItemToRunItem } from './converters';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';

const { runItems, runs } = schema;

export function getRunItems(ctx: DatabaseContext, runId: string): RunItem[] {
  const dbItems = ctx.db
    .select()
    .from(runItems)
    .where(eq(runItems.runId, runId))
    .orderBy(asc(runItems.foundTime))
    .all();
  return dbItems.map(dbRunItemToRunItem);
}

export function getSessionItems(ctx: DatabaseContext, sessionId: string): RunItem[] {
  const rows = ctx.db
    .select({ runItem: runItems })
    .from(runItems)
    .innerJoin(runs, eq(runItems.runId, runs.id))
    .where(eq(runs.sessionId, sessionId))
    .orderBy(asc(runItems.foundTime))
    .all();
  return rows.map((row) => dbRunItemToRunItem(row.runItem));
}

export function addRunItem(ctx: DatabaseContext, runItem: RunItem): void {
  ctx.db
    .insert(runItems)
    .values({
      id: runItem.id,
      runId: runItem.runId,
      grailProgressId: runItem.grailProgressId ?? null,
      name: runItem.name ?? null,
      foundTime: runItem.foundTime.toISOString(),
    })
    .run();
}

export function addRunItemsBatch(ctx: DatabaseContext, items: RunItem[]): void {
  if (items.length === 0) return;

  const insertMany = ctx.rawDb.transaction(() => {
    for (const item of items) {
      ctx.db
        .insert(runItems)
        .values({
          id: item.id,
          runId: item.runId,
          grailProgressId: item.grailProgressId ?? null,
          name: item.name ?? null,
          foundTime: item.foundTime.toISOString(),
        })
        .run();
    }
  });
  insertMany();
}

export function deleteRunItem(ctx: DatabaseContext, itemId: string): void {
  ctx.db.delete(runItems).where(eq(runItems.id, itemId)).run();
}
