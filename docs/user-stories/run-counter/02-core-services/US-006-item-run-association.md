# US-006: Item-Run Association

## User Story

As a user, I want items I find to be automatically associated with the current run so that I can see which items were found in each run.

## Description

Modify the item detection handler to check for an active run when a grail item is found, and create a run_items entry to associate the item with the current run.

## Acceptance Criteria

- [ ] Modified item detection checks for active run
- [ ] Creates run_items entry when active run exists
- [ ] Stores accurate found time for each item
- [ ] Handles items found when no active run exists
- [ ] Links grail_progress to runs correctly
- [ ] Does not create duplicate associations
- [ ] Integration works with both auto and manual detection

## Technical Notes

### Modification to Item Detection Handler

```typescript
// In handleAutomaticGrailProgress function (electron/ipc-handlers/saveFileHandlers.ts)

// After creating grail progress entry
if (event.type === 'item-found' && event.item) {
  handleAutomaticGrailProgress(event);
  
  // NEW: Check for active run and associate item
  const activeRun = runTrackerService?.getActiveRun();
  if (activeRun) {
    const runItem: RunItem = {
      id: `run_item_${activeRun.id}_${grailProgress.id}`,
      runId: activeRun.id,
      grailProgressId: grailProgress.id,
      foundTime: new Date(),
      created: new Date()
    };
    grailDatabase.addRunItem(runItem);
    
    // Emit event for UI updates
    eventBus.emit('run-item-added', {
      runId: activeRun.id,
      grailProgress,
      item: event.item
    });
  }
}
```

### Files to Modify

- `electron/ipc-handlers/saveFileHandlers.ts` - Add run association logic
- `electron/services/runTracker.ts` - Export getActiveRun method

## Dependencies

- US-005: Run Tracker Service

## Estimated Complexity

Small

## Testing Considerations

- Test item association with active run
- Test item without active run (no association)
- Test multiple items in same run
- Test items across multiple runs
- Verify run_items entries created correctly
- Test with manual item detection
- Test run end mid-find scenario
