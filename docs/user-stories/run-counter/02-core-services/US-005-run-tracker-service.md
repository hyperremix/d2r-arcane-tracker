# US-005: Run Tracker Service

## User Story

As a user, I want automatic run tracking based on my game state so that I don't have to manually start and stop each run.

## Description

Create a RunTrackerService that automatically detects when the player enters and exits games by monitoring save file changes. The service will manage session and run lifecycle, track timings, and provide manual controls for precise user control.

## Acceptance Criteria

- [ ] Service detects game entry via save file monitoring
- [ ] Service detects game exit with proper delay threshold
- [ ] Service manages session lifecycle (start, end, archive)
- [ ] Service manages run lifecycle within sessions
- [ ] Service provides manual start/stop controls
- [ ] Service handles pause/resume functionality
- [ ] Service tracks timing data accurately
- [ ] Service emits events for state changes
- [ ] Service integrates with existing save file monitoring

## Technical Notes

### Class Structure

```typescript
class RunTrackerService {
  private currentSession: Session | null = null;
  private currentRun: Run | null = null;
  private lastSaveFileTime: Date | null = null;
  private inGameThreshold = 10000; // 10 seconds
  private paused = false;
  
  constructor(
    private eventBus: EventBus,
    private database: GrailDatabase
  ) {}
  
  // Session management
  startSession(characterId?: string): Session
  endSession(): void
  archiveSession(sessionId: string): void
  
  // Run management
  startRun(characterId: string, manual: boolean = false): Run
  endRun(manual: boolean = false): void
  pauseRun(): void
  resumeRun(): void
  setRunType(runType: string): void
  
  // Save file event handling
  handleSaveFileEvent(event: SaveFileEvent): void
  
  // State queries
  getActiveSession(): Session | null
  getActiveRun(): Run | null
}
```

### Save File Detection Logic

1. When save file is modified:
   - If no active run AND lastSaveFileTime is null or > threshold: START new run
   - If active run AND save file changes: UPDATE lastSaveFileTime

2. When save file unchanged for threshold:
   - If active run: END current run

3. Pause handling:
   - When paused, don't auto-start/stop runs
   - Manual commands still work

### Integration Points

- Hook into existing `save-file-event` from `saveFileMonitor`
- Use EventBus to emit run state changes
- Store state in database via GrailDatabase methods

### Files to Create

- `electron/services/runTracker.ts` - Main service class

### Files to Modify

- `electron/services/saveFileMonitor.ts` - Forward events to run tracker
- `electron/main.ts` - Initialize service

## Dependencies

- US-001: Database Schema
- US-002: TypeScript Types
- US-003: Database Mappers
- US-004: Database Methods

## Estimated Complexity

Large

## Testing Considerations

- Test automatic run detection
- Test threshold timing logic
- Test session lifecycle
- Test run lifecycle within sessions
- Test manual controls
- Test pause/resume functionality
- Test state persistence after app restart
- Test edge cases (rapid save file changes, app crash during run)
- Test integration with save file monitoring
