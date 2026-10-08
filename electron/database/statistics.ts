import { eq } from 'drizzle-orm';
import type { RunHighlight, RunStatistics, SessionStats, Settings } from '../types/grail';
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

interface RunHighlightRow {
  id: string;
  duration: number;
  start_time: string;
}

function toRunHighlight(row: RunHighlightRow | undefined): RunHighlight | undefined {
  if (!row) {
    return undefined;
  }
  return { runId: row.id, duration: row.duration, timestamp: new Date(row.start_time) };
}

export function getOverallRunStatistics(ctx: DatabaseContext): RunStatistics {
  // Session, run and time totals. Each aggregate reads its own table so that joining
  // sessions to runs cannot multiply a session's time by its number of runs.
  const totalsResult = ctx.rawDb
    .prepare(
      `
      SELECT
        (SELECT COUNT(*) FROM sessions WHERE archived = 0) as totalSessions,
        (SELECT COUNT(*)
           FROM runs r
           INNER JOIN sessions s ON r.session_id = s.id
           WHERE s.archived = 0) as totalRuns,
        (SELECT SUM(total_session_time) FROM sessions WHERE archived = 0) as totalTime
    `,
    )
    .get() as {
    totalSessions: number;
    totalRuns: number;
    totalTime: number | null;
  };

  // Average only completed runs; in-progress runs have no duration yet
  const runDurationResult = ctx.rawDb
    .prepare(
      `
      SELECT AVG(r.duration) as averageRunDuration
      FROM runs r
      INNER JOIN sessions s ON r.session_id = s.id
      WHERE s.archived = 0 AND r.duration IS NOT NULL
    `,
    )
    .get() as { averageRunDuration: number | null };

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
    .get() as RunHighlightRow | undefined;

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
    .get() as RunHighlightRow | undefined;

  // Count items found across all runs of non-archived sessions
  const itemsResult = ctx.rawDb
    .prepare(
      `
      SELECT COUNT(ri.id) as totalItems
      FROM run_items ri
      INNER JOIN runs r ON ri.run_id = r.id
      INNER JOIN sessions s ON r.session_id = s.id
      WHERE s.archived = 0
    `,
    )
    .get() as { totalItems: number };

  return {
    totalSessions: totalsResult.totalSessions,
    totalRuns: totalsResult.totalRuns,
    totalTime: totalsResult.totalTime || 0,
    averageRunDuration: runDurationResult.averageRunDuration || 0,
    fastestRun: toRunHighlight(fastestRunResult),
    slowestRun: toRunHighlight(slowestRunResult),
    itemsPerRun: totalsResult.totalRuns > 0 ? itemsResult.totalItems / totalsResult.totalRuns : 0,
  };
}
