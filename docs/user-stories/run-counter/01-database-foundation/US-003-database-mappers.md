# US-003: Database Type Mappers

## User Story

As a developer, I want mapper functions to convert between TypeScript and SQLite types so that data can be safely stored and retrieved from the database.

## Description

Create mapper functions to convert between application types (Session, Run, RunItem) and database types (DatabaseSession, DatabaseRun, DatabaseRunItem). These mappers handle type conversions such as Date ↔ string, boolean ↔ 0/1, and snake_case ↔ camelCase.

## Acceptance Criteria

- [ ] Create mapper functions for Session ↔ DatabaseSession
- [ ] Create mapper functions for Run ↔ DatabaseRun
- [ ] Create mapper functions for RunItem ↔ DatabaseRunItem
- [ ] Handle Date to ISO string conversions
- [ ] Handle boolean to 0/1 conversions
- [ ] Handle null/undefined values properly
- [ ] All mappers have proper error handling
- [ ] Mappers follow existing patterns in the codebase

## Technical Notes

### Session Mappers

```typescript
import type { Session, DatabaseSession } from '../types/grail';

export function mapSessionToDatabase(session: Session): Omit<DatabaseSession, 'created_at' | 'updated_at'> {
  return {
    id: session.id,
    character_id: session.characterId || null,
    start_time: session.startTime.toISOString(),
    end_time: session.endTime?.toISOString() || null,
    total_run_time: session.totalRunTime,
    total_session_time: session.totalSessionTime,
    run_count: session.runCount,
    archived: toSqliteBoolean(session.archived),
    notes: toSqliteNull(session.notes),
  };
}

export function mapDatabaseSessionToSession(dbSession: DatabaseSession): Session {
  return {
    id: dbSession.id,
    characterId: dbSession.character_id || undefined,
    startTime: fromSqliteDate(dbSession.start_time),
    endTime: dbSession.end_time ? fromSqliteDate(dbSession.end_time) : undefined,
    totalRunTime: dbSession.total_run_time,
    totalSessionTime: dbSession.total_session_time,
    runCount: dbSession.run_count,
    archived: fromSqliteBoolean(dbSession.archived),
    notes: dbSession.notes || undefined,
    created: fromSqliteDate(dbSession.created_at),
    lastUpdated: fromSqliteDate(dbSession.updated_at),
  };
}
```

### Run Mappers

```typescript
import type { Run, DatabaseRun } from '../types/grail';

export function mapRunToDatabase(run: Run): Omit<DatabaseRun, 'created_at' | 'updated_at'> {
  return {
    id: run.id,
    session_id: run.sessionId,
    character_id: run.characterId,
    run_number: run.runNumber,
    start_time: run.startTime.toISOString(),
    end_time: run.endTime?.toISOString() || null,
    duration: run.duration || null,
  };
}

export function mapDatabaseRunToRun(dbRun: DatabaseRun): Run {
  return {
    id: dbRun.id,
    sessionId: dbRun.session_id,
    characterId: dbRun.character_id,
    runNumber: dbRun.run_number,
    startTime: fromSqliteDate(dbRun.start_time),
    endTime: dbRun.end_time ? fromSqliteDate(dbRun.end_time) : undefined,
    duration: dbRun.duration || undefined,
    created: fromSqliteDate(dbRun.created_at),
    lastUpdated: fromSqliteDate(dbRun.updated_at),
  };
}
```

### RunItem Mappers

```typescript
import type { RunItem, DatabaseRunItem } from '../types/grail';

export function mapRunItemToDatabase(runItem: RunItem): Omit<DatabaseRunItem, 'created_at'> {
  return {
    id: runItem.id,
    run_id: runItem.runId,
    grail_progress_id: runItem.grailProgressId,
    found_time: runItem.foundTime.toISOString(),
  };
}

export function mapDatabaseRunItemToRunItem(dbRunItem: DatabaseRunItem): RunItem {
  return {
    id: dbRunItem.id,
    runId: dbRunItem.run_id,
    grailProgressId: dbRunItem.grail_progress_id,
    foundTime: fromSqliteDate(dbRunItem.found_time),
    created: fromSqliteDate(dbRunItem.created_at),
  };
}
```

### Helper Functions

These helper functions should already exist in `electron/database/mappers.ts`:

```typescript
export function toSqliteBoolean(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

export function fromSqliteBoolean(value: 0 | 1 | number): boolean {
  return value !== 0;
}

export function toSqliteDate(date: Date): string {
  return date.toISOString();
}

export function fromSqliteDate(dateString: string): Date {
  return new Date(dateString);
}

export function toSqliteNull<T>(value: T | null | undefined): T | null {
  if (value === undefined) return null;
  return value;
}
```

### Files to Modify

- `electron/database/mappers.ts` - Add mapper functions for Session, Run, and RunItem

### Implementation Approach

1. Add mapper functions to the existing `mappers.ts` file
2. Follow the same pattern as existing mappers (e.g., `mapProgressToDatabase`)
3. Use existing helper functions for conversions
4. Handle null/undefined values consistently
5. Return objects without timestamp fields for inserts
6. Include timestamp fields in result mappers

## Dependencies

- US-002: TypeScript Type Definitions

## Estimated Complexity

Small

## Testing Considerations

- Test mapper functions with valid data
- Test mapper round-trips (TypeScript → Database → TypeScript)
- Test with null and undefined values
- Test Date conversions (especially timezone handling)
- Test boolean conversions
- Verify all required fields are mapped
- Test edge cases (empty strings, extreme dates)
