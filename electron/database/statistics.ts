import type { RunHighlight, RunStatistics } from '../types/grail';
import type { DatabaseContext } from './types';

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
