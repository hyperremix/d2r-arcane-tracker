# US-007: IPC Handlers for Run Management

## User Story

As a developer, I want IPC handlers for run tracking operations so that the frontend can communicate with the run tracking service.

## Description

Implement IPC handlers in the main process to expose run tracking functionality to the renderer process. This includes session management, run management, and statistics queries.

## Acceptance Criteria

- [ ] Implement session management handlers
- [ ] Implement run management handlers
- [ ] Implement statistics query handlers
- [ ] All handlers use proper error handling
- [ ] Handlers validate input parameters
- [ ] Handlers return consistent response formats
- [ ] IPC handlers are registered in main process

## Technical Notes

### Handler Examples

```typescript
// electron/ipc-handlers/runTrackerHandlers.ts

export function initializeRunTrackerHandlers(): void {
  // Session handlers
  ipcMain.handle('runTracker:startSession', async (_, characterId?: string) => {
    return runTrackerService.startSession(characterId);
  });
  
  ipcMain.handle('runTracker:endSession', async () => {
    runTrackerService.endSession();
    return { success: true };
  });
  
  // Run handlers
  ipcMain.handle('runTracker:startRun', async (_, characterId: string) => {
    return runTrackerService.startRun(characterId, true);
  });
  
  // ... more handlers
}
```

### Files to Create

- `electron/ipc-handlers/runTrackerHandlers.ts`

### Files to Modify

- `electron/main.ts` - Initialize handlers

## Dependencies

- US-005: Run Tracker Service

## Estimated Complexity

Medium

## Testing Considerations

- Test all handler endpoints
- Test error handling
- Test input validation
- Test response formats
