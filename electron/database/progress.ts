import { and, desc, eq } from 'drizzle-orm';
import type { GrailProgress, Settings } from '../types/grail';
import { dbProgressToProgress, toISOString } from './converters';
import { schema } from './drizzle';
import { getFilteredItems } from './items';
import type { DatabaseContext } from './types';

const { grailProgress } = schema;

export function getAllProgress(ctx: DatabaseContext): GrailProgress[] {
  const dbProgress = ctx.db
    .select()
    .from(grailProgress)
    .orderBy(desc(grailProgress.updatedAt))
    .all();
  return dbProgress.map(dbProgressToProgress);
}

export function getFilteredProgress(ctx: DatabaseContext, userSettings: Settings): GrailProgress[] {
  const allProgress = getAllProgress(ctx);
  const filteredItems = getFilteredItems(ctx, userSettings);
  const filteredItemIds = new Set(filteredItems.map((item) => item.id));

  return allProgress.filter((progress) => filteredItemIds.has(progress.itemId));
}

export function getProgressByCharacter(ctx: DatabaseContext, characterId: string): GrailProgress[] {
  const dbProgress = ctx.db
    .select()
    .from(grailProgress)
    .where(eq(grailProgress.characterId, characterId))
    .all();
  return dbProgress.map(dbProgressToProgress);
}

export function getProgressByItem(ctx: DatabaseContext, itemId: string): GrailProgress[] {
  const dbProgress = ctx.db
    .select()
    .from(grailProgress)
    .where(eq(grailProgress.itemId, itemId))
    .all();
  return dbProgress.map(dbProgressToProgress);
}

export function getCharacterProgress(
  ctx: DatabaseContext,
  characterId: string,
  itemId: string,
): GrailProgress | null {
  const dbProg = ctx.db
    .select()
    .from(grailProgress)
    .where(and(eq(grailProgress.characterId, characterId), eq(grailProgress.itemId, itemId)))
    .get();
  return dbProg ? dbProgressToProgress(dbProg) : null;
}

export function upsertProgress(ctx: DatabaseContext, progress: GrailProgress): void {
  ctx.db
    .insert(grailProgress)
    .values({
      id: progress.id,
      characterId: progress.characterId,
      itemId: progress.itemId,
      foundDate: toISOString(progress.foundDate),
      manuallyAdded: progress.manuallyAdded,
      autoDetected: true,
      difficulty: progress.difficulty ?? null,
      notes: progress.notes ?? null,
      isEthereal: progress.isEthereal,
      fromInitialScan: progress.fromInitialScan ?? false,
    })
    .onConflictDoUpdate({
      target: grailProgress.id,
      set: {
        characterId: progress.characterId,
        itemId: progress.itemId,
        foundDate: toISOString(progress.foundDate),
        manuallyAdded: progress.manuallyAdded,
        autoDetected: true,
        difficulty: progress.difficulty ?? null,
        notes: progress.notes ?? null,
        isEthereal: progress.isEthereal,
        fromInitialScan: progress.fromInitialScan ?? false,
      },
    })
    .run();
}

export function upsertProgressBatch(ctx: DatabaseContext, progressList: GrailProgress[]): void {
  if (progressList.length === 0) return;

  const insertMany = ctx.rawDb.transaction(() => {
    for (const progress of progressList) {
      ctx.db
        .insert(grailProgress)
        .values({
          id: progress.id,
          characterId: progress.characterId,
          itemId: progress.itemId,
          foundDate: toISOString(progress.foundDate),
          manuallyAdded: progress.manuallyAdded,
          autoDetected: true,
          difficulty: progress.difficulty ?? null,
          notes: progress.notes ?? null,
          isEthereal: progress.isEthereal,
          fromInitialScan: progress.fromInitialScan ?? false,
        })
        .onConflictDoUpdate({
          target: grailProgress.id,
          set: {
            characterId: progress.characterId,
            itemId: progress.itemId,
            foundDate: toISOString(progress.foundDate),
            manuallyAdded: progress.manuallyAdded,
            autoDetected: true,
            difficulty: progress.difficulty ?? null,
            notes: progress.notes ?? null,
            isEthereal: progress.isEthereal,
            fromInitialScan: progress.fromInitialScan ?? false,
          },
        })
        .run();
    }
  });
  insertMany();
}
