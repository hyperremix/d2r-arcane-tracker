import { and, desc, eq } from 'drizzle-orm';
import type { Difficulty, GrailProgress, Settings } from '../types/grail';
import { dbProgressToProgress, toISOString } from './converters';
import { type DbGrailProgress, schema } from './drizzle';
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
  const excludedTypes: string[] = [];
  if (!userSettings.grailRunes) excludedTypes.push('rune');
  if (!userSettings.grailRunewords) excludedTypes.push('runeword');

  if (excludedTypes.length === 0) {
    return getAllProgress(ctx);
  }

  // Use raw SQL for the JOIN + filter to avoid loading all items and progress
  const placeholders = excludedTypes.map(() => '?').join(', ');
  const rawDbProgress = ctx.rawDb
    .prepare(
      `
      SELECT gp.* FROM grail_progress gp
      INNER JOIN items i ON gp.item_id = i.id
      WHERE i.type NOT IN (${placeholders})
      ORDER BY gp.updated_at DESC
    `,
    )
    .all(...excludedTypes) as Record<string, unknown>[];

  // Map snake_case raw SQL columns to camelCase DbGrailProgress shape.
  // dbProgressToProgress handles the domain conversion (including dropping autoDetected,
  // which is stored in the DB but not part of the GrailProgress domain type).
  return rawDbProgress.map((row) => {
    const dbProg: DbGrailProgress = {
      id: row.id as string,
      characterId: row.character_id as string,
      itemId: row.item_id as string,
      foundDate: (row.found_date as string | null) ?? null,
      manuallyAdded: Boolean(row.manually_added),
      autoDetected: Boolean(row.auto_detected),
      difficulty: (row.difficulty as Difficulty | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      isEthereal: Boolean(row.is_ethereal),
      fromInitialScan: Boolean(row.from_initial_scan),
      createdAt: (row.created_at as string | null) ?? null,
      updatedAt: (row.updated_at as string | null) ?? null,
    };
    return dbProgressToProgress(dbProg);
  });
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
