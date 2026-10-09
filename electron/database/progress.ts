import { and, desc, eq, notInArray } from 'drizzle-orm';
import type { GrailProgress, Settings } from '../types/grail';
import { dbProgressToProgress, toISOString } from './converters';
import { type DbItem, schema } from './drizzle';
import type { DatabaseContext } from './types';

const { grailProgress, items } = schema;

export function getAllProgress(ctx: DatabaseContext): GrailProgress[] {
  const dbProgress = ctx.db
    .select()
    .from(grailProgress)
    .orderBy(desc(grailProgress.updatedAt))
    .all();
  return dbProgress.map(dbProgressToProgress);
}

export function getFilteredProgress(ctx: DatabaseContext, userSettings: Settings): GrailProgress[] {
  const excludedTypes: DbItem['type'][] = [];
  if (!userSettings.grailRunes) excludedTypes.push('rune');
  if (!userSettings.grailRunewords) excludedTypes.push('runeword');

  if (excludedTypes.length === 0) {
    return getAllProgress(ctx);
  }

  // Filter in SQL instead of loading all items and progress
  const rows = ctx.db
    .select({ progress: grailProgress })
    .from(grailProgress)
    .innerJoin(items, eq(grailProgress.itemId, items.id))
    .where(notInArray(items.type, excludedTypes))
    .orderBy(desc(grailProgress.updatedAt))
    .all();
  return rows.map((row) => dbProgressToProgress(row.progress));
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

export function getProgressById(ctx: DatabaseContext, progressId: string): GrailProgress | null {
  const dbProg = ctx.db.select().from(grailProgress).where(eq(grailProgress.id, progressId)).get();
  return dbProg ? dbProgressToProgress(dbProg) : null;
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
      autoDetected: !progress.manuallyAdded,
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
        autoDetected: !progress.manuallyAdded,
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
          autoDetected: !progress.manuallyAdded,
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
            autoDetected: !progress.manuallyAdded,
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

/**
 * Deletes a progress record, but only if it was added manually by the user.
 * Auto-detected records are derived from save files and cannot be removed here.
 * @returns True if a record was deleted, false otherwise
 */
export function deleteManualProgress(ctx: DatabaseContext, progressId: string): boolean {
  const result = ctx.db
    .delete(grailProgress)
    .where(and(eq(grailProgress.id, progressId), eq(grailProgress.manuallyAdded, true)))
    .run();
  return result.changes > 0;
}
