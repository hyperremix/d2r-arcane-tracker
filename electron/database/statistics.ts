import { eq } from 'drizzle-orm';
import type { RunStatistics, SessionStats, Settings } from '../types/grail';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';

const { sessions } = schema;

function buildTypeFilter(
  userSettings: Settings,
  tableAlias: string = '',
): { types: string[]; filter: string } {
  const types: string[] = [];
  if (!userSettings.grailRunes) types.push('rune');
  if (!userSettings.grailRunewords) types.push('runeword');
  const column = tableAlias ? `${tableAlias}.type` : 'type';
  const filter =
    types.length > 0 ? `AND ${column} NOT IN (${types.map(() => '?').join(', ')})` : '';
  return { types, filter };
}

function getCounts(ctx: DatabaseContext, query: string, params: string[]): Map<string, number> {
  const results = ctx.rawDb.prepare(query).all(...params) as { type: string; count: number }[];
  return new Map(results.map((r) => [r.type, r.count]));
}

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
  const { types: excludedTypes, filter: itemsTypeFilter } = buildTypeFilter(userSettings, '');
  const { filter: joinTypeFilter } = buildTypeFilter(userSettings, 'i');
  const charFilter = characterId ? 'AND gp.character_id = ?' : '';

  const typeParams = excludedTypes;
  const fullParams = [...excludedTypes, ...(characterId ? [characterId] : [])];

  // Query 1: Count items by type
  const itemCountMap = getCounts(
    ctx,
    `SELECT type, COUNT(*) as count FROM items WHERE 1=1 ${itemsTypeFilter} GROUP BY type`,
    typeParams,
  );

  // Query 2: Count found items (distinct item_id) by type
  const foundCountMap = getCounts(
    ctx,
    `SELECT i.type, COUNT(DISTINCT gp.item_id) as count FROM grail_progress gp INNER JOIN items i ON gp.item_id = i.id WHERE 1=1 ${joinTypeFilter} ${charFilter} GROUP BY i.type`,
    fullParams,
  );

  const sumCounts = (map: Map<string, number>) =>
    (map.get('unique') || 0) +
    (map.get('set') || 0) +
    (map.get('rune') || 0) +
    (map.get('runeword') || 0);

  return {
    totalItems: sumCounts(itemCountMap),
    foundItems: sumCounts(foundCountMap),
    uniqueItems: itemCountMap.get('unique') || 0,
    setItems: itemCountMap.get('set') || 0,
    runes: itemCountMap.get('rune') || 0,
    foundUnique: foundCountMap.get('unique') || 0,
    foundSet: foundCountMap.get('set') || 0,
    foundRunes: foundCountMap.get('rune') || 0,
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
