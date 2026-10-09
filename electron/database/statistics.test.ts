// @vitest-environment node
import type { Database as DatabaseType } from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryDatabase, initializeDatabaseSchema } from '../test/helpers/databaseHelpers';
import { createDrizzleDb } from './drizzle';
import { getOverallRunStatistics } from './statistics';
import type { DatabaseContext } from './types';

const CHARACTER_ID = 'char-1';

interface SessionRow {
  id: string;
  totalSessionTime: number;
  archived?: boolean;
}

interface RunRow {
  id: string;
  sessionId: string;
  runNumber: number;
  startTime: string;
  duration?: number;
}

function insertCharacter(rawDb: DatabaseType): void {
  rawDb
    .prepare(
      `INSERT INTO characters (id, name, character_class) VALUES (?, 'Hammerdin', 'paladin')`,
    )
    .run(CHARACTER_ID);
}

function insertSession(rawDb: DatabaseType, session: SessionRow): void {
  rawDb
    .prepare(
      `INSERT INTO sessions (id, start_time, total_session_time, archived)
       VALUES (?, '2024-01-01T10:00:00.000Z', ?, ?)`,
    )
    .run(session.id, session.totalSessionTime, session.archived ? 1 : 0);
}

function insertRun(rawDb: DatabaseType, run: RunRow): void {
  rawDb
    .prepare(
      `INSERT INTO runs (id, session_id, character_id, run_number, start_time, end_time, duration)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      run.id,
      run.sessionId,
      CHARACTER_ID,
      run.runNumber,
      run.startTime,
      run.duration === undefined ? null : run.startTime,
      run.duration ?? null,
    );
}

function insertRunItem(rawDb: DatabaseType, id: string, runId: string): void {
  rawDb
    .prepare(
      `INSERT INTO run_items (id, run_id, name, found_time) VALUES (?, ?, 'Shako', '2024-01-01T10:05:00.000Z')`,
    )
    .run(id, runId);
}

describe('When overall run statistics are calculated', () => {
  let rawDb: DatabaseType;
  let ctx: DatabaseContext;

  beforeEach(() => {
    rawDb = createInMemoryDatabase();
    initializeDatabaseSchema(rawDb);
    ctx = { rawDb, db: createDrizzleDb(rawDb), dbPath: ':memory:' };
    insertCharacter(rawDb);
  });

  afterEach(() => {
    rawDb.close();
  });

  describe('If there are no sessions or runs', () => {
    it('Then all totals are zero and there is no fastest or slowest run', () => {
      // Arrange (empty database)

      // Act
      const stats = getOverallRunStatistics(ctx);

      // Assert
      expect(stats).toEqual({
        totalSessions: 0,
        totalRuns: 0,
        totalTime: 0,
        averageRunDuration: 0,
        fastestRun: undefined,
        slowestRun: undefined,
        itemsPerRun: 0,
      });
    });
  });

  describe('If a session contains multiple runs', () => {
    it('Then the session time is counted once rather than once per run', () => {
      // Arrange
      insertSession(rawDb, { id: 'session-1', totalSessionTime: 600_000 });
      insertSession(rawDb, { id: 'session-2', totalSessionTime: 300_000 });
      insertRun(rawDb, {
        id: 'run-1',
        sessionId: 'session-1',
        runNumber: 1,
        startTime: '2024-01-01T10:00:00.000Z',
        duration: 60_000,
      });
      insertRun(rawDb, {
        id: 'run-2',
        sessionId: 'session-1',
        runNumber: 2,
        startTime: '2024-01-01T10:02:00.000Z',
        duration: 120_000,
      });
      insertRun(rawDb, {
        id: 'run-3',
        sessionId: 'session-1',
        runNumber: 3,
        startTime: '2024-01-01T10:05:00.000Z',
        duration: 90_000,
      });

      // Act
      const stats = getOverallRunStatistics(ctx);

      // Assert
      expect(stats.totalSessions).toBe(2);
      expect(stats.totalRuns).toBe(3);
      expect(stats.totalTime).toBe(900_000);
    });

    it('Then items per run divides all found items by all runs', () => {
      // Arrange
      insertSession(rawDb, { id: 'session-1', totalSessionTime: 600_000 });
      insertRun(rawDb, {
        id: 'run-1',
        sessionId: 'session-1',
        runNumber: 1,
        startTime: '2024-01-01T10:00:00.000Z',
        duration: 60_000,
      });
      insertRun(rawDb, {
        id: 'run-2',
        sessionId: 'session-1',
        runNumber: 2,
        startTime: '2024-01-01T10:02:00.000Z',
        duration: 120_000,
      });
      insertRunItem(rawDb, 'item-1', 'run-1');
      insertRunItem(rawDb, 'item-2', 'run-1');
      insertRunItem(rawDb, 'item-3', 'run-1');

      // Act
      const stats = getOverallRunStatistics(ctx);

      // Assert
      expect(stats.itemsPerRun).toBe(1.5);
    });
  });

  describe('If a run is still in progress', () => {
    it('Then it counts as a run but is excluded from the average, fastest and slowest run', () => {
      // Arrange
      insertSession(rawDb, { id: 'session-1', totalSessionTime: 600_000 });
      insertRun(rawDb, {
        id: 'run-1',
        sessionId: 'session-1',
        runNumber: 1,
        startTime: '2024-01-01T10:00:00.000Z',
        duration: 60_000,
      });
      insertRun(rawDb, {
        id: 'run-2',
        sessionId: 'session-1',
        runNumber: 2,
        startTime: '2024-01-01T10:02:00.000Z',
        duration: 120_000,
      });
      insertRun(rawDb, {
        id: 'run-3',
        sessionId: 'session-1',
        runNumber: 3,
        startTime: '2024-01-01T10:05:00.000Z',
      });

      // Act
      const stats = getOverallRunStatistics(ctx);

      // Assert
      expect(stats.totalRuns).toBe(3);
      expect(stats.averageRunDuration).toBe(90_000);
      expect(stats.fastestRun).toEqual({
        runId: 'run-1',
        duration: 60_000,
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
      });
      expect(stats.slowestRun).toEqual({
        runId: 'run-2',
        duration: 120_000,
        timestamp: new Date('2024-01-01T10:02:00.000Z'),
      });
    });

    it('Then there is no fastest or slowest run if no run has been completed yet', () => {
      // Arrange
      insertSession(rawDb, { id: 'session-1', totalSessionTime: 0 });
      insertRun(rawDb, {
        id: 'run-1',
        sessionId: 'session-1',
        runNumber: 1,
        startTime: '2024-01-01T10:00:00.000Z',
      });

      // Act
      const stats = getOverallRunStatistics(ctx);

      // Assert
      expect(stats.totalRuns).toBe(1);
      expect(stats.averageRunDuration).toBe(0);
      expect(stats.fastestRun).toBeUndefined();
      expect(stats.slowestRun).toBeUndefined();
    });
  });

  describe('If a session is archived', () => {
    it('Then its sessions, runs, time and items are excluded', () => {
      // Arrange
      insertSession(rawDb, { id: 'session-1', totalSessionTime: 600_000 });
      insertSession(rawDb, { id: 'archived', totalSessionTime: 900_000, archived: true });
      insertRun(rawDb, {
        id: 'run-1',
        sessionId: 'session-1',
        runNumber: 1,
        startTime: '2024-01-01T10:00:00.000Z',
        duration: 60_000,
      });
      insertRun(rawDb, {
        id: 'archived-run',
        sessionId: 'archived',
        runNumber: 1,
        startTime: '2024-01-01T09:00:00.000Z',
        duration: 10_000,
      });
      insertRunItem(rawDb, 'archived-item', 'archived-run');

      // Act
      const stats = getOverallRunStatistics(ctx);

      // Assert
      expect(stats.totalSessions).toBe(1);
      expect(stats.totalRuns).toBe(1);
      expect(stats.totalTime).toBe(600_000);
      expect(stats.itemsPerRun).toBe(0);
      expect(stats.fastestRun?.runId).toBe('run-1');
    });
  });
});
