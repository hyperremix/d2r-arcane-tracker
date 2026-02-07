import { asc, eq } from 'drizzle-orm';
import type { SaveFileState } from '../types/grail';
import { dbSaveFileStateToSaveFileState } from './converters';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';

const { saveFileStates } = schema;

export function getSaveFileState(ctx: DatabaseContext, filePath: string): SaveFileState | null {
  const dbState = ctx.db
    .select()
    .from(saveFileStates)
    .where(eq(saveFileStates.filePath, filePath))
    .get();
  return dbState ? dbSaveFileStateToSaveFileState(dbState) : null;
}

export function upsertSaveFileState(ctx: DatabaseContext, state: SaveFileState): void {
  ctx.db
    .insert(saveFileStates)
    .values({
      id: state.id,
      filePath: state.filePath,
      lastModified: state.lastModified.toISOString(),
      lastParsed: state.lastParsed.toISOString(),
    })
    .onConflictDoUpdate({
      target: saveFileStates.id,
      set: {
        filePath: state.filePath,
        lastModified: state.lastModified.toISOString(),
        lastParsed: state.lastParsed.toISOString(),
      },
    })
    .run();
}

export function getAllSaveFileStates(ctx: DatabaseContext): SaveFileState[] {
  const dbStates = ctx.db.select().from(saveFileStates).orderBy(asc(saveFileStates.filePath)).all();
  return dbStates.map(dbSaveFileStateToSaveFileState);
}

export function deleteSaveFileState(ctx: DatabaseContext, filePath: string): void {
  ctx.db.delete(saveFileStates).where(eq(saveFileStates.filePath, filePath)).run();
}

export function clearAllSaveFileStates(ctx: DatabaseContext): void {
  ctx.db.delete(saveFileStates).run();
}
