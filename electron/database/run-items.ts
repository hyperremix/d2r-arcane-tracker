import { asc, eq } from 'drizzle-orm';
import type { RunItem } from '../types/grail';
import { dbRunItemToRunItem } from './converters';
import type { DbRunItem } from './drizzle';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';

const { runItems } = schema;

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
  const dbItems = ctx.rawDb
    .prepare(
      `
      SELECT ri.* FROM run_items ri
      INNER JOIN runs r ON ri.run_id = r.id
      WHERE r.session_id = ?
      ORDER BY ri.found_time ASC
    `,
    )
    .all(sessionId) as DbRunItem[];
  return dbItems.map((item) => ({
    id: item.id,
    runId: item.runId,
    grailProgressId: item.grailProgressId ?? undefined,
    name: item.name ?? undefined,
    foundTime: new Date(item.foundTime),
    created: new Date(item.createdAt ?? new Date().toISOString()),
  }));
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
