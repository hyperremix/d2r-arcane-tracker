// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryDatabase } from '../test/helpers/databaseHelpers';
import { createDrizzleDb } from './drizzle';
import { initializeSchema } from './schema';
import { getSessionById, updateSessionNotes, upsertSession } from './sessions';
import type { DatabaseContext } from './types';

function createContext(): DatabaseContext {
  const rawDb = createInMemoryDatabase();
  const ctx: DatabaseContext = { rawDb, db: createDrizzleDb(rawDb), dbPath: ':memory:' };
  initializeSchema(ctx);
  return ctx;
}

describe('When session notes are updated', () => {
  let ctx: DatabaseContext;

  beforeEach(() => {
    ctx = createContext();
    upsertSession(ctx, {
      id: 'session-1',
      startTime: new Date('2024-05-01T10:00:00.000Z'),
      totalRunTime: 0,
      totalSessionTime: 0,
      runCount: 0,
      archived: false,
      notes: 'Old notes',
      created: new Date(),
      lastUpdated: new Date(),
    });
  });

  afterEach(() => {
    ctx.rawDb.close();
  });

  it('Then the new notes are stored', () => {
    // Act
    const updated = updateSessionNotes(ctx, 'session-1', 'Cow runs');

    // Assert
    expect(updated).toBe(true);
    expect(getSessionById(ctx, 'session-1')?.notes).toBe('Cow runs');
  });

  it('If the notes are cleared, Then the session has no notes', () => {
    // Act
    updateSessionNotes(ctx, 'session-1', '');

    // Assert
    expect(getSessionById(ctx, 'session-1')?.notes).toBeUndefined();
  });

  it('If the session does not exist, Then nothing is updated', () => {
    // Act
    const updated = updateSessionNotes(ctx, 'missing', 'Cow runs');

    // Assert
    expect(updated).toBe(false);
  });
});
