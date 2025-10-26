# US-010: Run Tracker Main Component

## User Story

As a user, I want a main run counter interface so that I can see all my run tracking information in one place.

## Description

Create the main RunTracker component that serves as the entry point for the Run Counter tab. This component will integrate SessionCard, RunList, and SessionControls components, handle loading and error states, and provide the overall layout.

## Acceptance Criteria

- [ ] Create RunTracker main component
- [ ] Integrate SessionCard, RunList, SessionControls
- [ ] Handle loading and error states
- [ ] Provide responsive layout
- [ ] Load initial data on mount
- [ ] Display empty states appropriately
- [ ] Follow design system patterns

## Technical Notes

```typescript
// src/components/runtracker/RunTracker.tsx
export function RunTracker() {
  const { activeSession, activeRun, sessions, loading, error } = useRunTrackerStore();
  
  useEffect(() => {
    // Load initial data
    loadSessions();
    loadSessionRuns(activeSession?.id);
  }, []);
  
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  
  return (
    <div className="space-y-6">
      <SessionCard session={activeSession} />
      <SessionControls />
      <RunList runs={runs} />
    </div>
  );
}
```

### Files to Create

- `src/components/runtracker/RunTracker.tsx`

## Dependencies

- US-009: Zustand Store

## Estimated Complexity

Medium

## Testing Considerations

- Test component rendering
- Test loading states
- Test error handling
- Test empty states
- Test data loading
