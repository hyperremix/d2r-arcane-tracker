# US-004: Database CRUD Methods

## User Story

As a developer, I want database CRUD methods for sessions, runs, and run items so that I can persist and retrieve run tracking data.

## Description

Implement comprehensive database methods in the GrailDatabase class for creating, reading, updating, and deleting sessions, runs, and run items. These methods will use the mappers defined in US-003 to convert between TypeScript and database types.

## Acceptance Criteria

- [ ] Implement session CRUD methods (create, read, update, delete, archive)
- [ ] Implement run CRUD methods (create, read, update, delete)
- [ ] Implement run_item methods (create, read, query by run/session)
- [ ] Support batch operations where appropriate
- [ ] All methods use transactions for data integrity
- [ ] All methods use mappers for type conversion
- [ ] Methods handle errors gracefully
- [ ] Methods follow existing database patterns

## Technical Notes

### Session Methods

```typescript
// In GrailDatabase class

/**
 * Retrieves all non-archived sessions for a character.
 */
getSessionsByCharacter(characterId: string): Session[] {
  const stmt = this.db.prepare(
    'SELECT * FROM sessions WHERE character_id = ? AND archived = 0 ORDER BY start_time DESC'
  );
  const dbSessions = stmt.all(characterId) as DatabaseSession[];
  return dbSessions.map(mapDatabaseSessionToSession);
}

/**
 * Retrieves a session by ID.
 */
getSessionById(sessionId: string): Session | null {
  const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
  const dbSession = stmt.get(sessionId) as DatabaseSession | undefined;
  return dbSession ? mapDatabaseSessionToSession(dbSession) : null;
}

/**
 * Retrieves the active session (not archived, no end time).
 */
getActiveSession(): Session | null {
  const stmt = this.db.prepare(
    'SELECT * FROM sessions WHERE archived = 0 AND end_time IS NULL ORDER BY start_time DESC LIMIT 1'
  );
  const dbSession = stmt.get() as DatabaseSession | undefined;
  return dbSession ? mapDatabaseSessionToSession(dbSession) : null;
}

/**
 * Inserts or updates a session.
 */
upsertSession(session: Session): void {
  const stmt = this.db.prepare(`
    INSERT OR REPLACE INTO sessions (id, character_id, start_time, end_time, total_run_time, total_session_time, run_count, archived, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const mapped = mapSessionToDatabase(session);
  stmt.run(
    mapped.id,
    mapped.character_id,
    mapped.start_time,
    mapped.end_time,
    mapped.total_run_time,
    mapped.total_session_time,
    mapped.run_count,
    mapped.archived,
    mapped.notes
  );
}

/**
 * Archives a session.
 */
archiveSession(sessionId: string): void {
  const stmt = this.db.prepare('UPDATE sessions SET archived = 1 WHERE id = ?');
  stmt.run(sessionId);
}

/**
 * Deletes a session and all related runs (CASCADE).
 */
deleteSession(sessionId: string): void {
  const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
  stmt.run(sessionId);
}
```

### Run Methods

```typescript
/**
 * Retrieves all runs for a session.
 */
getRunsBySession(sessionId: string): Run[] {
  const stmt = this.db.prepare(
    'SELECT * FROM runs WHERE session_id = ? ORDER BY run_number ASC'
  );
  const dbRuns = stmt.all(sessionId) as DatabaseRun[];
  return dbRuns.map(mapDatabaseRunToRun);
}

/**
 * Retrieves the active run for a session.
 */
getActiveRun(sessionId: string): Run | null {
  const stmt = this.db.prepare(
    'SELECT * FROM runs WHERE session_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1'
  );
  const dbRun = stmt.get(sessionId) as DatabaseRun | undefined;
  return dbRun ? mapDatabaseRunToRun(dbRun) : null;
}

/**
 * Inserts or updates a run.
 */
upsertRun(run: Run): void {
  const stmt = this.db.prepare(`
    INSERT INTO runs (id, session_id, character_id, run_number, start_time, end_time, duration)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      session_id = excluded.session_id,
      character_id = excluded.character_id,
      run_number = excluded.run_number,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      duration = excluded.duration,
      updated_at = CURRENT_TIMESTAMP
  `);
  const mapped = mapRunToDatabase(run);
  stmt.run(
    mapped.id,
    mapped.session_id,
    mapped.character_id,
    mapped.run_number,
    mapped.start_time,
    mapped.end_time,
    mapped.duration
  );
}

/**
 * Deletes a run and all related items (CASCADE).
 */
deleteRun(runId: string): void {
  const stmt = this.db.prepare('DELETE FROM runs WHERE id = ?');
  stmt.run(runId);
}
```

### RunItem Methods

```typescript
/**
 * Retrieves all items for a run.
 */
getRunItems(runId: string): RunItem[] {
  const stmt = this.db.prepare(
    'SELECT * FROM run_items WHERE run_id = ? ORDER BY found_time ASC'
  );
  const dbItems = stmt.all(runId) as DatabaseRunItem[];
  return dbItems.map(mapDatabaseRunItemToRunItem);
}

/**
 * Retrieves all items for a session (across all runs).
 */
getSessionItems(sessionId: string): RunItem[] {
  const stmt = this.db.prepare(`
    SELECT ri.* FROM run_items ri
    INNER JOIN runs r ON ri.run_id = r.id
    WHERE r.session_id = ?
    ORDER BY ri.found_time ASC
  `);
  const dbItems = stmt.all(sessionId) as DatabaseRunItem[];
  return dbItems.map(mapDatabaseRunItemToRunItem);
}

/**
 * Inserts a run item.
 */
addRunItem(runItem: RunItem): void {
  const stmt = this.db.prepare(`
    INSERT INTO run_items (id, run_id, grail_progress_id, found_time)
    VALUES (?, ?, ?, ?)
  `);
  const mapped = mapRunItemToDatabase(runItem);
  stmt.run(mapped.id, mapped.run_id, mapped.grail_progress_id, mapped.found_time);
}

/**
 * Deletes a run item.
 */
deleteRunItem(itemId: string): void {
  const stmt = this.db.prepare('DELETE FROM run_items WHERE id = ?');
  stmt.run(itemId);
}
```

### Files to Modify

- `electron/database/database.ts` - Add all CRUD methods to GrailDatabase class

### Implementation Approach

1. Add methods to the existing `GrailDatabase` class
2. Follow existing patterns (e.g., `upsertProgress`, `getAllCharacters`)
3. Group related methods together
4. Use transactions for multi-step operations
5. Include JSDoc comments for all methods
6. Handle edge cases (null returns, empty results)
7. Use prepared statements for performance and safety
8. Export database types if needed

## Dependencies

- US-001: Database Schema
- US-002: TypeScript Type Definitions
- US-003: Database Type Mappers

## Estimated Complexity

Medium

## Testing Considerations

- Test CRUD operations with valid data
- Test retrieval of non-existent records
- Test foreign key constraints (delete sessions with runs)
- Test CASCADE deletes
- Test transaction rollback on errors
- Test batch operations performance
- Verify data integrity after operations
- Test with null and undefined values
- Test query performance with indexes
