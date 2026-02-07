import { eq } from 'drizzle-orm';
import type { RunStatistics, SessionStats, Settings } from '../types/grail';
import { schema } from './drizzle';
import { getFilteredItems } from './items';
import { getFilteredProgress } from './progress';
import type { DatabaseContext } from './types';

const { sessions } = schema;

export function getFilteredGrailStatistics(
  ctx: DatabaseContext,
  userSettings: Settings,
  characterId?: string,
): {
  totalItems: number;
  foundItems: number;
  uniqueItems: number;
  setItems: number;
  runes: number;
  foundUnique: number;
  foundSet: number;
  foundRunes: number;
} {
  const filteredItems = getFilteredItems(ctx, userSettings);
  const filteredProgressList = getFilteredProgress(ctx, userSettings);

  const totalItems = filteredItems.length;

  // Count items by type
  const uniqueItems = filteredItems.filter((item) => item.type === 'unique').length;
  const setItems = filteredItems.filter((item) => item.type === 'set').length;
  const runeItems = filteredItems.filter((item) => item.type === 'rune').length;

  // Count found items
  const foundProgress = characterId
    ? filteredProgressList.filter((p) => p.characterId === characterId)
    : filteredProgressList;

  const foundItemIds = new Set(foundProgress.map((p) => p.itemId));
  const foundItems = foundItemIds.size;

  // Count found items by type
  const foundUnique = filteredItems.filter(
    (item) => item.type === 'unique' && foundItemIds.has(item.id),
  ).length;
  const foundSet = filteredItems.filter(
    (item) => item.type === 'set' && foundItemIds.has(item.id),
  ).length;
  const foundRunes = filteredItems.filter(
    (item) => item.type === 'rune' && foundItemIds.has(item.id),
  ).length;

  return {
    totalItems,
    foundItems,
    uniqueItems,
    setItems,
    runes: runeItems,
    foundUnique,
    foundSet,
    foundRunes,
  };
}

export function getSessionStatistics(ctx: DatabaseContext, sessionId: string): SessionStats | null {
  const session = ctx.db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

  if (!session) {
    return null;
  }

  // Get run statistics for this session using raw SQL for aggregations
  const runStatsResult = ctx.rawDb
    .prepare(
      `
      SELECT
        COUNT(*) as totalRuns,
        AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE 0 END) as averageRunDuration,
        MIN(CASE WHEN duration IS NOT NULL THEN duration ELSE NULL END) as fastestRun,
        MAX(CASE WHEN duration IS NOT NULL THEN duration ELSE NULL END) as slowestRun
      FROM runs
      WHERE session_id = ?
    `,
    )
    .get(sessionId) as {
    totalRuns: number;
    averageRunDuration: number | null;
    fastestRun: number | null;
    slowestRun: number | null;
  };

  // Get item statistics for this session
  const itemStatsResult = ctx.rawDb
    .prepare(
      `
      SELECT
        COUNT(ri.id) as itemsFound,
        COUNT(CASE WHEN gp.from_initial_scan = 0 THEN ri.id END) as newGrailItems
      FROM run_items ri
      INNER JOIN runs r ON ri.run_id = r.id
      LEFT JOIN grail_progress gp ON ri.grail_progress_id = gp.id
      WHERE r.session_id = ?
    `,
    )
    .get(sessionId) as {
    itemsFound: number;
    newGrailItems: number;
  };

  return {
    sessionId: session.id,
    totalRuns: runStatsResult.totalRuns,
    totalTime: session.totalSessionTime ?? 0,
    totalRunTime: session.totalRunTime ?? 0,
    averageRunDuration: runStatsResult.averageRunDuration || 0,
    fastestRun: runStatsResult.fastestRun || 0,
    slowestRun: runStatsResult.slowestRun || 0,
    itemsFound: itemStatsResult.itemsFound,
    newGrailItems: itemStatsResult.newGrailItems,
  };
}

export function getOverallRunStatistics(ctx: DatabaseContext): RunStatistics {
  // Get session and run counts
  const sessionStatsResult = ctx.rawDb
    .prepare(
      `
      SELECT
        COUNT(DISTINCT s.id) as totalSessions,
        COUNT(r.id) as totalRuns,
        SUM(s.total_session_time) as totalTime
      FROM sessions s
      LEFT JOIN runs r ON s.id = r.session_id
      WHERE s.archived = 0
    `,
    )
    .get() as {
    totalSessions: number;
    totalRuns: number;
    totalTime: number | null;
  };

  // Get run duration statistics
  const runDurationResult = ctx.rawDb
    .prepare(
      `
      SELECT
        AVG(CASE WHEN r.duration IS NOT NULL THEN r.duration ELSE 0 END) as averageRunDuration,
        MIN(CASE WHEN r.duration IS NOT NULL THEN r.duration ELSE NULL END) as minDuration,
        MAX(CASE WHEN r.duration IS NOT NULL THEN r.duration ELSE NULL END) as maxDuration
      FROM runs r
      INNER JOIN sessions s ON r.session_id = s.id
      WHERE s.archived = 0
    `,
    )
    .get() as {
    averageRunDuration: number | null;
    minDuration: number | null;
    maxDuration: number | null;
  };

  // Get fastest run details
  const fastestRunResult = ctx.rawDb
    .prepare(
      `
      SELECT r.id, r.duration, r.start_time
      FROM runs r
      INNER JOIN sessions s ON r.session_id = s.id
      WHERE s.archived = 0 AND r.duration IS NOT NULL
      ORDER BY r.duration ASC
      LIMIT 1
    `,
    )
    .get() as { id: string; duration: number; start_time: string } | undefined;

  const slowestRunResult = ctx.rawDb
    .prepare(
      `
      SELECT r.id, r.duration, r.start_time
      FROM runs r
      INNER JOIN sessions s ON r.session_id = s.id
      WHERE s.archived = 0 AND r.duration IS NOT NULL
      ORDER BY r.duration DESC
      LIMIT 1
    `,
    )
    .get() as { id: string; duration: number; start_time: string } | undefined;

  // Get items per run average
  const itemsPerRunResult = ctx.rawDb
    .prepare(
      `
      SELECT
        COUNT(ri.id) as totalItems,
        COUNT(DISTINCT r.id) as runsWithItems
      FROM runs r
      INNER JOIN sessions s ON r.session_id = s.id
      LEFT JOIN run_items ri ON r.id = ri.run_id
      WHERE s.archived = 0
    `,
    )
    .get() as {
    totalItems: number;
    runsWithItems: number;
  };

  return {
    totalSessions: sessionStatsResult.totalSessions,
    totalRuns: sessionStatsResult.totalRuns,
    totalTime: sessionStatsResult.totalTime || 0,
    averageRunDuration: runDurationResult.averageRunDuration || 0,
    fastestRun: fastestRunResult
      ? {
          runId: fastestRunResult.id,
          duration: fastestRunResult.duration,
          timestamp: new Date(fastestRunResult.start_time),
        }
      : { runId: '', duration: 0, timestamp: new Date() },
    slowestRun: slowestRunResult
      ? {
          runId: slowestRunResult.id,
          duration: slowestRunResult.duration,
          timestamp: new Date(slowestRunResult.start_time),
        }
      : { runId: '', duration: 0, timestamp: new Date() },
    itemsPerRun:
      itemsPerRunResult.runsWithItems > 0
        ? itemsPerRunResult.totalItems / itemsPerRunResult.runsWithItems
        : 0,
  };
}
