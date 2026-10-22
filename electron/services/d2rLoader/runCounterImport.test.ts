import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Run, RunItem, Session } from '../../types/grail';
import {
  groupRunsIntoSessions,
  importRunCounterData,
  parseRunCounterDrops,
  parseRunCounterRuns,
  type RunCounterImportDatabase,
  resolveRunCounterFolder,
  SESSION_GAP_MS,
} from './runCounterImport';

const RUNS_HEADER =
  'run,start,end,seconds,farm_seconds,town_seconds,difficulty,area,levels,bosses,items,character,level,terrorized,gold';
const DROPS_HEADER =
  'run,time,area,name,quality,code,ilvl,ethereal,sockets,character,difficulty,terrorized,source,run_area';

const RUNS_CSV = [
  RUNS_HEADER,
  '1,2026-10-20 20:00:00,2026-10-20 20:02:00,120,100,20,Hell,Travincal,1,1,2,Sorc,90,0,1500',
  '2,2026-10-20 20:03:00,2026-10-20 20:04:30,90,80,10,Hell,Travincal,1,1,0,Sorc,90,0,800',
  '3,2026-10-21 18:00:00,2026-10-21 18:01:00,60,50,10,Hell,Pit,1,0,1,Barb,85,1,200',
].join('\n');

const DROPS_CSV = [
  DROPS_HEADER,
  '1,2026-10-20 20:01:00,Travincal,Harlequin Crest,unique,uap,85,0,0,Sorc,Hell,0,Council,Travincal',
  '1,2026-10-20 20:01:30,Travincal,Grand Charm,magic,cm3,85,0,0,Sorc,Hell,0,Council,Travincal',
  '3,2026-10-21 18:00:30,Pit,Ber Rune,normal,r30,85,0,0,Barb,Hell,1,Pit,Pit',
].join('\n');

/** An in-memory stand-in for the run tracker tables. */
function createDatabase() {
  const sessions = new Map<string, Session>();
  const runs = new Map<string, Run>();
  const runItems: RunItem[] = [];
  const database = {
    transaction: vi.fn(<T>(fn: () => T) => fn()),
    getSessionById: vi.fn((id: string) => sessions.get(id) ?? null),
    getRunsBySession: vi.fn((id: string) =>
      [...runs.values()].filter((run) => run.sessionId === id),
    ),
    upsertSession: vi.fn((session: Session) => sessions.set(session.id, session)),
    upsertRun: vi.fn((run: Run) => runs.set(run.id, run)),
    addRunItemsBatch: vi.fn((items: RunItem[]) => runItems.push(...items)),
    getCharacterByName: vi.fn((name: string) =>
      name === 'Sorc' ? ({ id: 'char-sorc' } as never) : undefined,
    ),
  };
  return { database: database as unknown as RunCounterImportDatabase, sessions, runs, runItems };
}

describe('When Run Counter files are parsed', () => {
  it('Then runs and drops are read by column name with local times', () => {
    // Act
    const runs = parseRunCounterRuns(RUNS_CSV);
    const drops = parseRunCounterDrops(DROPS_CSV);

    // Assert
    expect(runs[0]).toEqual({
      run: 1,
      start: new Date(2026, 9, 20, 20, 0, 0),
      end: new Date(2026, 9, 20, 20, 2, 0),
      seconds: 120,
      character: 'Sorc',
    });
    expect(drops[0]).toEqual({
      run: 1,
      time: new Date(2026, 9, 20, 20, 1, 0),
      name: 'Harlequin Crest',
      quality: 'unique',
      code: 'uap',
    });
  });

  it('If a row has no valid time, Then it is skipped', () => {
    // Arrange
    const csv = `${RUNS_HEADER}\n1,yesterday,2026-10-20 20:02:00,120,0,0,Hell,,0,0,0,Sorc,90,0,0`;

    // Act
    const runs = parseRunCounterRuns(csv);

    // Assert
    expect(runs).toEqual([]);
  });
});

describe('When runs are grouped into sessions', () => {
  it(`Then a gap of more than ${SESSION_GAP_MS / 60_000} minutes starts a new session`, () => {
    // Arrange
    const runs = parseRunCounterRuns(RUNS_CSV);

    // Act
    const sessions = groupRunsIntoSessions([...runs].reverse());

    // Assert
    expect(sessions.map((session) => session.map((run) => run.run))).toEqual([[1, 2], [3]]);
  });
});

describe('When Run Counter data is imported', () => {
  let folder: string;

  beforeEach(async () => {
    folder = await mkdtemp(path.join(tmpdir(), 'run-counter-test-'));
    await writeFile(path.join(folder, 'runs.csv'), RUNS_CSV);
    await writeFile(path.join(folder, 'drops.csv'), DROPS_CSV);
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('Then each play session becomes a session with its runs and grail drops', async () => {
    // Arrange
    const { database, sessions, runs, runItems } = createDatabase();

    // Act
    const result = await importRunCounterData(database, folder);

    // Assert
    expect(result).toEqual({ folder, found: true, sessions: 2, runs: 3, items: 2, skippedRuns: 0 });
    const firstSession = [...sessions.values()][0];
    expect(firstSession).toMatchObject({
      startTime: new Date(2026, 9, 20, 20, 0, 0),
      endTime: new Date(2026, 9, 20, 20, 4, 30),
      runCount: 2,
      totalRunTime: 210_000,
      archived: false,
    });
    expect([...runs.values()][0]).toMatchObject({
      sessionId: firstSession.id,
      characterId: 'char-sorc',
      runNumber: 1,
      duration: 120_000,
    });
    expect(runItems.map((item) => item.name)).toEqual(['Harlequin Crest', 'Ber Rune']);
  });

  it('If the data was imported before, Then only new runs are added', async () => {
    // Arrange
    const { database, runs } = createDatabase();
    await importRunCounterData(database, folder);
    await writeFile(
      path.join(folder, 'runs.csv'),
      `${RUNS_CSV}\n4,2026-10-21 18:02:00,2026-10-21 18:03:00,60,50,10,Hell,Pit,1,0,0,Barb,85,1,0`,
    );

    // Act
    const result = await importRunCounterData(database, folder);

    // Assert
    expect(result).toMatchObject({ sessions: 1, runs: 1, skippedRuns: 3 });
    expect(runs.size).toBe(4);
  });

  it('If the folder has no runs.csv, Then nothing is imported and the result says so', async () => {
    // Arrange
    const { database } = createDatabase();
    await rm(path.join(folder, 'runs.csv'));

    // Act
    const result = await importRunCounterData(database, folder);

    // Assert
    expect(result).toEqual({
      folder,
      found: false,
      sessions: 0,
      runs: 0,
      items: 0,
      skippedRuns: 0,
    });
    expect(database.transaction).not.toHaveBeenCalled();
  });
});

describe('When the Run Counter folder is resolved', () => {
  let gameFolder: string;

  beforeEach(async () => {
    gameFolder = await mkdtemp(path.join(tmpdir(), 'run-counter-folder-test-'));
  });

  afterEach(async () => {
    await rm(gameFolder, { recursive: true, force: true });
  });

  it('If Run Counter has no data folder set, Then it is in the D2RLoader folder', async () => {
    // Act
    const folder = await resolveRunCounterFolder(gameFolder);

    // Assert
    expect(folder).toBe(path.join(gameFolder, 'd2rloader', 'run-counter'));
  });

  it('If its config sets a data folder, Then that folder is used', async () => {
    // Arrange
    const configFolder = path.join(gameFolder, 'd2rloader', 'config');
    await mkdir(configFolder, { recursive: true });
    const dataFolder = path.join(gameFolder, 'stats').replace(/\\/g, '/');
    await writeFile(
      path.join(configFolder, 'run-counter.toml'),
      `[run-counter]\ndata_folder = "${dataFolder}"\n`,
    );

    // Act
    const folder = await resolveRunCounterFolder(gameFolder);

    // Assert
    expect(folder).toBe(path.resolve(dataFolder));
  });
});
