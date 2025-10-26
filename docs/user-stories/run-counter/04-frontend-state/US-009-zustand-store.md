# US-009: Zustand Store for Run Tracking

## User Story

As a developer, I want a Zustand store for run tracking state so that frontend components can access and update run tracking data consistently.

## Description

Create a Zustand store to manage run tracking state on the frontend. This store will handle active sessions, runs, and associated items, provide actions for state updates, and listen to IPC events for real-time updates from the main process.

## Acceptance Criteria

- [ ] Create runTrackerStore with proper state structure
- [ ] Implement actions for session management
- [ ] Implement actions for run management
- [ ] Add IPC event listeners for real-time updates
- [ ] Include computed/derived state values
- [ ] Handle loading and error states
- [ ] Store persists across app lifecycle
- [ ] Store integrates with existing store patterns

## Technical Notes

### Store Structure

```typescript
// src/stores/runTrackerStore.ts
import { create } from 'zustand';

type RunTrackerState = {
  // State
  activeSession: Session | null;
  activeRun: Run | null;
  sessions: Session[];
  runs: Map<string, Run[]>; // sessionId -> runs
  runItems: Map<string, RunItem[]>; // runId -> items
  isTracking: boolean;
  isPaused: boolean;
  loading: boolean;
  error: string | null;
  
  // Actions - Session
  startSession: (characterId?: string) => Promise<void>;
  endSession: () => Promise<void>;
  archiveSession: (sessionId: string) => Promise<void>;
  updateSessionNotes: (sessionId: string, notes: string) => Promise<void>;
  
  // Actions - Run
  startRun: (characterId: string, runType?: string) => Promise<void>;
  endRun: () => Promise<void>;
  pauseRun: () => Promise<void>;
  resumeRun: () => Promise<void>;
  setRunType: (runType: string) => Promise<void>;
  
  // Actions - Data
  loadSessions: () => Promise<void>;
  loadSessionRuns: (sessionId: string) => Promise<void>;
  refreshActiveRun: () => Promise<void>;
  
  // Computed
  getCurrentRunDuration: () => number;
  getSessionStats: (sessionId: string) => SessionStats | null;
};

export const useRunTrackerStore = create<RunTrackerState>((set, get) => ({
  // Initial state
  activeSession: null,
  activeRun: null,
  sessions: [],
  runs: new Map(),
  runItems: new Map(),
  isTracking: false,
  isPaused: false,
  loading: false,
  error: null,
  
  // Session actions
  startSession: async (characterId) => {
    set({ loading: true, error: null });
    try {
      const session = await window.electronAPI?.runTracker.startSession(characterId);
      set({ activeSession: session, isTracking: true, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },
  
  // ... other actions
  
  // Computed values
  getCurrentRunDuration: () => {
    const { activeRun } = get();
    if (!activeRun || activeRun.endTime) return 0;
    return Date.now() - activeRun.startTime.getTime();
  },
}));
```

### IPC Event Listeners

```typescript
// Set up listeners in component
useEffect(() => {
  const unsubscribers = [
    window.ipcRenderer?.on('run-tracker:session-started', handleSessionStarted),
    window.ipcRenderer?.on('run-tracker:run-started', handleRunStarted),
    window.ipcRenderer?.on('run-tracker:run-ended', handleRunEnded),
  ];
  
  return () => unsubscribers.forEach(fn => fn());
}, []);
```

### Files to Create

- `src/stores/runTrackerStore.ts` - Main store

## Dependencies

- US-008: IPC Events

## Estimated Complexity

Medium

## Testing Considerations

- Test state initialization
- Test action implementations
- Test IPC event handling
- Test computed values
- Test error handling
- Test loading states
- Test store persistence
