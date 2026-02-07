import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Session } from '../types/grail';
import { dbSessionToSession, toISOString } from './converters';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';

const { sessions } = schema;

export function getAllSessions(ctx: DatabaseContext, includeArchived = false): Session[] {
  let query = ctx.db.select().from(sessions).$dynamic();

  if (!includeArchived) {
    query = query.where(eq(sessions.archived, false));
  }

  const dbSessions = query.orderBy(desc(sessions.startTime)).all();
  return dbSessions.map(dbSessionToSession);
}

export function getSessionById(ctx: DatabaseContext, sessionId: string): Session | null {
  const dbSession = ctx.db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  return dbSession ? dbSessionToSession(dbSession) : null;
}

export function getActiveSession(ctx: DatabaseContext): Session | null {
  const dbSession = ctx.db
    .select()
    .from(sessions)
    .where(and(eq(sessions.archived, false), isNull(sessions.endTime)))
    .orderBy(desc(sessions.startTime))
    .limit(1)
    .get();
  return dbSession ? dbSessionToSession(dbSession) : null;
}

export function upsertSession(ctx: DatabaseContext, session: Session): void {
  ctx.db
    .insert(sessions)
    .values({
      id: session.id,
      startTime: session.startTime.toISOString(),
      endTime: toISOString(session.endTime),
      totalRunTime: session.totalRunTime,
      totalSessionTime: session.totalSessionTime,
      runCount: session.runCount,
      archived: session.archived,
      notes: session.notes ?? null,
    })
    .onConflictDoUpdate({
      target: sessions.id,
      set: {
        startTime: session.startTime.toISOString(),
        endTime: toISOString(session.endTime),
        totalRunTime: session.totalRunTime,
        totalSessionTime: session.totalSessionTime,
        runCount: session.runCount,
        archived: session.archived,
        notes: session.notes ?? null,
      },
    })
    .run();
}

export function archiveSession(ctx: DatabaseContext, sessionId: string): void {
  ctx.db.update(sessions).set({ archived: true }).where(eq(sessions.id, sessionId)).run();
}

export function deleteSession(ctx: DatabaseContext, sessionId: string): void {
  ctx.db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}
