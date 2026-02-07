import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { Run } from '../types/grail';
import { dbRunToRun, toISOString } from './converters';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';

const { runs } = schema;

export function getRunsBySession(ctx: DatabaseContext, sessionId: string): Run[] {
  const dbRuns = ctx.db
    .select()
    .from(runs)
    .where(eq(runs.sessionId, sessionId))
    .orderBy(asc(runs.runNumber))
    .all();
  return dbRuns.map(dbRunToRun);
}

export function getActiveRun(ctx: DatabaseContext, sessionId: string): Run | null {
  const dbRun = ctx.db
    .select()
    .from(runs)
    .where(and(eq(runs.sessionId, sessionId), isNull(runs.endTime)))
    .orderBy(desc(runs.startTime))
    .limit(1)
    .get();
  return dbRun ? dbRunToRun(dbRun) : null;
}

export function upsertRun(ctx: DatabaseContext, run: Run): void {
  ctx.db
    .insert(runs)
    .values({
      id: run.id,
      sessionId: run.sessionId,
      characterId: run.characterId ?? null,
      runNumber: run.runNumber,
      startTime: run.startTime.toISOString(),
      endTime: toISOString(run.endTime),
      duration: run.duration ?? null,
    })
    .onConflictDoUpdate({
      target: runs.id,
      set: {
        sessionId: run.sessionId,
        characterId: run.characterId ?? null,
        runNumber: run.runNumber,
        startTime: run.startTime.toISOString(),
        endTime: toISOString(run.endTime),
        duration: run.duration ?? null,
      },
    })
    .run();
}

export function deleteRun(ctx: DatabaseContext, runId: string): void {
  ctx.db.delete(runs).where(eq(runs.id, runId)).run();
}
