# US-002: TypeScript Type Definitions

## User Story

As a developer, I want TypeScript types for run tracking entities so that I can maintain type safety throughout the application.

## Description

Define comprehensive TypeScript types for all run tracking entities including Session, Run, RunItem, and related database types. These types will be used throughout the application to ensure type safety and provide clear interfaces for the run tracking feature.

## Acceptance Criteria

- [ ] Define `Session` type with all required fields
- [ ] Define `Run` type with all required fields
- [ ] Define `RunItem` type for associating items with runs
- [ ] Define database types (`DatabaseSession`, `DatabaseRun`, `DatabaseRunItem`)
- [ ] Define types for statistics and analytics queries
- [ ] Define types for run state and tracking state
- [ ] All types include JSDoc comments
- [ ] Types are exported from appropriate module

## Technical Notes

### Core Types

```typescript
export type Session = {
  id: string;
  characterId?: string;
  startTime: Date;
  endTime?: Date;
  totalRunTime: number; // milliseconds spent in runs
  totalSessionTime: number; // total milliseconds
  runCount: number;
  archived: boolean;
  notes?: string;
  created: Date;
  lastUpdated: Date;
};

export type Run = {
  id: string;
  sessionId: string;
  characterId: string;
  runNumber: number;
  runType?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  area?: string;
  created: Date;
  lastUpdated: Date;
};

export type RunItem = {
  id: string;
  runId: string;
  grailProgressId: string;
  foundTime: Date;
  created: Date;
};
```

### Database Types

```typescript
export type DatabaseSession = {
  id: string;
  character_id: string | null;
  start_time: string; // ISO datetime string
  end_time: string | null;
  total_run_time: number;
  total_session_time: number;
  run_count: number;
  archived: 0 | 1; // SQLite boolean
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DatabaseRun = {
  id: string;
  session_id: string;
  character_id: string;
  run_number: number;
  run_type: string | null;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  area: string | null;
  created_at: string;
  updated_at: string;
};

export type DatabaseRunItem = {
  id: string;
  run_id: string;
  grail_progress_id: string;
  found_time: string;
  created_at: string;
};
```

### Statistics Types

```typescript
export type SessionStats = {
  sessionId: string;
  totalRuns: number;
  totalTime: number;
  totalRunTime: number;
  averageRunDuration: number;
  fastestRun: number;
  slowestRun: number;
  itemsFound: number;
  newGrailItems: number;
};

export type RunStatistics = {
  totalSessions: number;
  totalRuns: number;
  totalTime: number;
  averageRunDuration: number;
  fastestRun: { runId: string; duration: number; timestamp: Date };
  slowestRun: { runId: string; duration: number; timestamp: Date };
  itemsPerRun: number;
  mostCommonRunType: string;
};

export type RunTypeStats = {
  runType: string;
  count: number;
  totalDuration: number;
  averageDuration: number;
  itemsFound: number;
};
```

### State Types

```typescript
export type RunState = {
  isRunning: boolean;
  isPaused: boolean;
  activeSession?: Session;
  activeRun?: Run;
  lastRunEndTime?: Date;
};

export type RunTrackerState = 'idle' | 'running' | 'paused';
```

### Files to Modify

- `electron/types/grail.ts` - Add all run tracking types to existing types file

### Implementation Approach

1. Add types to the existing `electron/types/grail.ts` file
2. Group related types together with comments
3. Include JSDoc comments for each type
4. Use consistent naming conventions
5. Make optional fields explicit with `?`
6. Use union types where appropriate (e.g., `RunTrackerState`)
7. Export all types for use in other modules

## Dependencies

- US-001: Database Schema (types should match database structure)

## Estimated Complexity

Small

## Testing Considerations

- Verify types compile without errors
- Check that types match database schema exactly
- Verify optional fields are correctly marked
- Ensure Date types are used appropriately (vs strings)
- Test type inference in IDE
