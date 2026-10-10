/**
 * Run tracking: sessions, runs, run statistics and run tracker hotkeys.
 *
 * Shared by the main process and the renderer; re-exported from `./grail`.
 */

/**
 * Interface representing a run tracking session.
 */
export interface Session {
  id: string;
  startTime: Date;
  endTime?: Date;
  totalRunTime: number; // milliseconds spent in runs
  totalSessionTime: number; // total milliseconds
  runCount: number;
  archived: boolean;
  notes?: string;
  created: Date;
  lastUpdated: Date;
}

/**
 * Interface representing a single run within a session.
 */
export interface Run {
  id: string;
  sessionId: string;
  characterId?: string;
  runNumber: number;
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  created: Date;
  lastUpdated: Date;
}

/**
 * Interface representing an item found during a run.
 */
export interface RunItem {
  id: string;
  runId: string;
  grailProgressId?: string;
  name?: string;
  foundTime: Date;
  created: Date;
}

/**
 * Interface representing statistics for a single session.
 */
export interface SessionStats {
  sessionId: string;
  totalRuns: number;
  totalTime: number;
  totalRunTime: number;
  averageRunDuration: number;
  fastestRun: number;
  slowestRun: number;
  itemsFound: number;
  newGrailItems: number;
}

/**
 * Interface representing a single highlighted run (e.g. the fastest or slowest one).
 */
export interface RunHighlight {
  runId: string;
  duration: number;
  timestamp: Date;
}

/**
 * Interface representing overall run statistics across all sessions.
 */
export interface RunStatistics {
  totalSessions: number;
  totalRuns: number;
  totalTime: number;
  averageRunDuration: number;
  /** Shortest completed run, or `undefined` if no run has been completed yet. */
  fastestRun?: RunHighlight;
  /** Longest completed run, or `undefined` if no run has been completed yet. */
  slowestRun?: RunHighlight;
  itemsPerRun: number;
}

/**
 * Type representing the state of the run tracker.
 */
export type RunTrackerState = 'idle' | 'running' | 'paused';

/**
 * Run tracker actions that can be bound to a keyboard shortcut.
 */
export type RunTrackerShortcutAction = 'startRun' | 'pauseRun' | 'endRun' | 'endSession';

/**
 * Outcome of registering a run tracker shortcut as a global hotkey.
 * - `registered`: the hotkey is registered with the operating system.
 * - `conflict`: another application (or another action) already uses the combination.
 * - `unsupported`: the combination cannot be used globally (e.g. no Ctrl/Alt modifier).
 */
export type GlobalHotkeyRegistrationState = 'registered' | 'conflict' | 'unsupported';

/**
 * Registration result for a single run tracker shortcut.
 */
export interface GlobalHotkeyRegistration {
  action: RunTrackerShortcutAction;
  shortcut: string;
  state: GlobalHotkeyRegistrationState;
}

/**
 * Current state of the run tracker global hotkeys.
 */
export interface GlobalHotkeyStatus {
  /** Whether the user enabled global hotkeys in the settings. */
  enabled: boolean;
  /** Result of the most recent registration attempt per action (empty when disabled). */
  registrations: GlobalHotkeyRegistration[];
}
