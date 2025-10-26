# US-001: Database Schema for Run Tracking

## User Story

As a developer, I want to create database tables for run tracking so that we can persist session and run data.

## Description

Implement the database schema for the run counter feature by creating three new tables: `sessions`, `runs`, and `run_items`. These tables will store all data related to gaming sessions, individual runs, and the association between runs and discovered items.

## Acceptance Criteria

- [ ] Create `sessions` table with columns for tracking session state
- [ ] Create `runs` table with columns for tracking individual runs
- [ ] Create `run_items` table for associating items with runs
- [ ] Add appropriate indexes for query performance
- [ ] Add triggers for automatic timestamp updates
- [ ] Add foreign key constraints to maintain referential integrity
- [ ] Schema updates are backwards compatible with existing database
- [ ] Database migration handles existing databases gracefully

## Technical Notes

### Table Structure

#### Sessions Table

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  character_id TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  total_run_time INTEGER DEFAULT 0, -- milliseconds
  total_session_time INTEGER DEFAULT 0, -- milliseconds
  run_count INTEGER DEFAULT 0,
  archived BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (character_id) REFERENCES characters(id)
);
```

#### Runs Table

```sql
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  run_number INTEGER NOT NULL, -- sequential within session
  run_type TEXT, -- e.g., "Mephisto", "Chaos", "Cows"
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  duration INTEGER, -- milliseconds
  area TEXT, -- last known area/act
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id)
);
```

#### Run Items Table

```sql
CREATE TABLE IF NOT EXISTS run_items (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  grail_progress_id TEXT NOT NULL,
  found_time DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
  FOREIGN KEY (grail_progress_id) REFERENCES grail_progress(id) ON DELETE CASCADE
);
```

### Indexes

```sql
-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_character ON sessions(character_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_archived ON sessions(archived);

-- Runs indexes
CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id);
CREATE INDEX IF NOT EXISTS idx_runs_character ON runs(character_id);
CREATE INDEX IF NOT EXISTS idx_runs_start_time ON runs(start_time);
CREATE INDEX IF NOT EXISTS idx_runs_session_number ON runs(session_id, run_number);

-- Run items indexes
CREATE INDEX IF NOT EXISTS idx_run_items_run ON run_items(run_id);
CREATE INDEX IF NOT EXISTS idx_run_items_progress ON run_items(grail_progress_id);
```

### Triggers

```sql
-- Update timestamps for sessions
CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp
  AFTER UPDATE ON sessions
  BEGIN
    UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- Update timestamps for runs
CREATE TRIGGER IF NOT EXISTS update_runs_timestamp
  AFTER UPDATE ON runs
  BEGIN
    UPDATE runs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
```

### Files to Modify

- `electron/database/database.ts` - Add schema creation to `createSchema()` method

### Implementation Approach

1. Add the SQL schema to the existing `createSchema()` method
2. Place new table definitions after existing tables
3. Ensure all foreign keys reference existing tables
4. Use `IF NOT EXISTS` for idempotent schema creation
5. Test migration on existing database to ensure compatibility

## Dependencies

- None (foundational story)

## Estimated Complexity

Medium

## Testing Considerations

- Test schema creation on fresh database
- Test schema updates on existing databases (no data loss)
- Verify foreign key constraints work correctly
- Verify CASCADE deletes work when deleting sessions
- Test trigger updates for timestamp fields
- Verify indexes improve query performance
