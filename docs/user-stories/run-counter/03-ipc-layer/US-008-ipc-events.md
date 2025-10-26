# US-008: IPC Event Emission

## User Story

As a developer, I want IPC events for run state changes so that the frontend can update in real-time.

## Description

Set up IPC event emission from the main process to notify renderer processes when run tracking state changes occur (session started, run ended, etc.).

## Acceptance Criteria

- [ ] Emit events when sessions start/end
- [ ] Emit events when runs start/end
- [ ] Emit events when run state changes
- [ ] Events include relevant state data
- [ ] Event listeners clean up properly
- [ ] Events filtered to window type renderers

## Technical Notes

```typescript
// In runTrackerService
eventBus.emit('run-tracker:session-started', { session });
eventBus.emit('run-tracker:run-started', { run });
eventBus.emit('run-tracker:run-ended', { run, duration });

// Forward to renderer
webContents.getAllWebContents().forEach(wc => {
  if (wc.getType() === 'window') {
    wc.send('run-tracker:run-started', { run });
  }
});
```

### Events to Implement

- `run-tracker:session-started`
- `run-tracker:session-ended`
- `run-tracker:run-started`
- `run-tracker:run-ended`
- `run-tracker:run-paused`
- `run-tracker:run-resumed`
- `run-tracker:state-changed`

## Dependencies

- US-007: IPC Handlers

## Estimated Complexity

Small

## Testing Considerations

- Test event emission
- Test event cleanup
- Test multiple renderer processes
- Verify event data structure
