import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { GrailDatabase } from '../../database/database';
import type { RunCounterImportResult } from '../../types/d2rLoader';
import type { Run, RunItem, Session } from '../../types/grail';
import { parseCsv } from '../../utils/csv';

/**
 * Runs that start more than this long after the previous run ended belong to a new session. Run
 * Counter's files don't record its sessions, so imported runs are grouped into play sessions.
 */
export const SESSION_GAP_MS = 30 * 60 * 1000;

/** Rune item codes, `r01` (El) to `r33` (Zod). */
const RUNE_CODE_PATTERN = /^r\d\d$/;

/** A row of Run Counter's runs.csv. */
export interface RunCounterRun {
  run: number;
  start: Date;
  end: Date;
  seconds: number;
  character: string;
}

/** A row of Run Counter's drops.csv. */
export interface RunCounterDrop {
  run: number;
  time: Date;
  name: string;
  quality: string;
  code: string;
}

/** Database operations the import needs. */
export type RunCounterImportDatabase = Pick<
  GrailDatabase,
  | 'addRunItemsBatch'
  | 'getCharacterByName'
  | 'getRunsBySession'
  | 'getSessionById'
  | 'transaction'
  | 'upsertRun'
  | 'upsertSession'
>;

/**
 * Finds Run Counter's data folder: `data_folder` from its config file, otherwise
 * `<game>/d2rloader/run-counter`.
 * @param gameFolder - The D2R folder
 */
export async function resolveRunCounterFolder(gameFolder: string): Promise<string> {
  const defaultFolder = path.join(gameFolder, 'd2rloader', 'run-counter');
  let config: string;
  try {
    config = await readFile(
      path.join(gameFolder, 'd2rloader', 'config', 'run-counter.toml'),
      'utf8',
    );
  } catch {
    return defaultFolder;
  }
  const dataFolder = /^\s*data_folder\s*=\s*"([^"]*)"/m.exec(config)?.[1]?.trim();
  return dataFolder ? path.resolve(gameFolder, dataFolder) : defaultFolder;
}

/** Reads a text file; undefined when it doesn't exist. */
async function readOptionalText(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

/** Parses Run Counter's local time stamps, `YYYY-MM-DD HH:MM:SS`. */
function parseTimestamp(value: string | undefined): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value?.trim() ?? '');
  if (!match) return undefined;
  const [year, month, day, hours, minutes, seconds] = match.slice(1).map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

/** Reads a CSV file into objects keyed by its header row. Columns are matched by name. */
function readCsvRecords(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const columns = header.map((column) => column.trim());
  return rows.map((row) =>
    Object.fromEntries(columns.map((column, index) => [column, row[index]?.trim() ?? ''])),
  );
}

/**
 * Parses runs.csv. Rows without a valid run number or times are skipped.
 * @param text - The file content
 */
export function parseRunCounterRuns(text: string): RunCounterRun[] {
  return readCsvRecords(text).flatMap((record) => {
    const start = parseTimestamp(record.start);
    const end = parseTimestamp(record.end);
    const run = Number(record.run);
    const seconds = Number(record.seconds);
    if (!start || !end || !Number.isInteger(run) || !Number.isFinite(seconds) || seconds < 0) {
      return [];
    }
    return [{ run, start, end, seconds, character: record.character ?? '' }];
  });
}

/**
 * Parses drops.csv. Rows without a valid run number or time are skipped.
 * @param text - The file content
 */
export function parseRunCounterDrops(text: string): RunCounterDrop[] {
  return readCsvRecords(text).flatMap((record) => {
    const time = parseTimestamp(record.time);
    const run = Number(record.run);
    if (!time || !Number.isInteger(run) || !record.name) {
      return [];
    }
    return [
      {
        run,
        time,
        name: record.name,
        quality: (record.quality ?? '').toLowerCase(),
        code: (record.code ?? '').toLowerCase(),
      },
    ];
  });
}

/** Whether a drop is a grail item: a unique, a set item or a rune. Run items only hold those. */
function isGrailDrop(drop: RunCounterDrop): boolean {
  return drop.quality === 'unique' || drop.quality === 'set' || RUNE_CODE_PATTERN.test(drop.code);
}

/**
 * Groups runs into sessions: a run that starts more than {@link SESSION_GAP_MS} after the previous
 * one ended starts a new session.
 * @param runs - The runs, in any order
 * @returns The sessions' runs, oldest first
 */
export function groupRunsIntoSessions(runs: RunCounterRun[]): RunCounterRun[][] {
  const sorted = [...runs].sort((a, b) => a.start.getTime() - b.start.getTime());
  const sessions: RunCounterRun[][] = [];
  for (const run of sorted) {
    const current = sessions[sessions.length - 1];
    const previous = current?.[current.length - 1];
    if (previous && run.start.getTime() - previous.end.getTime() <= SESSION_GAP_MS) {
      current.push(run);
    } else {
      sessions.push([run]);
    }
  }
  return sessions;
}

/**
 * Imports Run Counter's runs and its grail drops (uniques, set items and runes) as run tracker
 * sessions, runs and run items. The ids are derived from the run times, so importing again only
 * adds the runs that are new since the last import. Runs are attributed to a character with the
 * same name, if the app knows one.
 * @param database - The database
 * @param folder - Run Counter's data folder
 * @returns What was imported; `found` is false when the folder has no runs.csv
 * @throws When a file exists but can't be read
 */
export async function importRunCounterData(
  database: RunCounterImportDatabase,
  folder: string,
): Promise<RunCounterImportResult> {
  const result: RunCounterImportResult = {
    folder,
    found: false,
    sessions: 0,
    runs: 0,
    items: 0,
    skippedRuns: 0,
  };
  const runsText = await readOptionalText(path.join(folder, 'runs.csv'));
  if (runsText === undefined) {
    return result;
  }
  result.found = true;
  const runs = parseRunCounterRuns(runsText);
  const drops = parseRunCounterDrops(
    (await readOptionalText(path.join(folder, 'drops.csv'))) ?? '',
  ).filter(isGrailDrop);
  const now = new Date();

  database.transaction(() => {
    for (const sessionRuns of groupRunsIntoSessions(runs)) {
      const first = sessionRuns[0];
      const last = sessionRuns[sessionRuns.length - 1];
      const sessionId = `runcounter-session-${first.start.getTime()}`;
      const existingSession = database.getSessionById(sessionId);
      const existingRunIds = new Set(database.getRunsBySession(sessionId).map((run) => run.id));

      const newRuns: Run[] = [];
      const newItems: RunItem[] = [];
      sessionRuns.forEach((row, index) => {
        const runId = `runcounter-run-${row.start.getTime()}-${row.run}`;
        if (existingRunIds.has(runId)) {
          result.skippedRuns += 1;
          return;
        }
        newRuns.push({
          id: runId,
          sessionId,
          characterId: row.character ? database.getCharacterByName(row.character)?.id : undefined,
          runNumber: index + 1,
          startTime: row.start,
          endTime: row.end,
          duration: row.seconds * 1000,
          created: now,
          lastUpdated: now,
        });
        drops
          .filter(
            (drop) =>
              drop.run === row.run &&
              drop.time.getTime() >= row.start.getTime() &&
              drop.time.getTime() <= row.end.getTime(),
          )
          .forEach((drop, dropIndex) => {
            newItems.push({
              id: `runcounter-item-${runId}-${dropIndex}`,
              runId,
              name: drop.name,
              foundTime: drop.time,
              created: now,
            });
          });
      });
      if (newRuns.length === 0) continue;

      const session: Session = {
        id: sessionId,
        startTime: first.start,
        endTime: last.end,
        totalRunTime: sessionRuns.reduce((total, row) => total + row.seconds * 1000, 0),
        totalSessionTime: last.end.getTime() - first.start.getTime(),
        runCount: sessionRuns.length,
        archived: existingSession?.archived ?? false,
        notes: existingSession?.notes,
        created: existingSession?.created ?? now,
        lastUpdated: now,
      };
      database.upsertSession(session);
      for (const run of newRuns) {
        database.upsertRun(run);
      }
      database.addRunItemsBatch(newItems);

      result.sessions += 1;
      result.runs += newRuns.length;
      result.items += newItems.length;
    }
  });

  return result;
}
