import type { Run } from 'electron/types/grail';

/**
 * State of the live session shown in the run tracker header.
 */
export type LiveSessionState = 'running' | 'paused' | 'idle' | 'noSession';

/** Number of finished runs shown in the active session's recent runs list. */
export const RECENT_RUNS_LIMIT = 5;

interface LiveSessionStateInput {
  hasSession: boolean;
  hasActiveRun: boolean;
  isPaused: boolean;
}

/**
 * Derives the live session state from the tracker flags.
 * A session without an in-progress run is `idle`; a run is either `running` or `paused`.
 */
export function getLiveSessionState({
  hasSession,
  hasActiveRun,
  isPaused,
}: LiveSessionStateInput): LiveSessionState {
  if (!hasSession) {
    return 'noSession';
  }
  if (!hasActiveRun) {
    return 'idle';
  }
  return isPaused ? 'paused' : 'running';
}

interface LiveEfficiencyInput {
  /** Time spent in finished runs, in milliseconds. */
  completedRunTime: number;
  /** Elapsed time of the in-progress run, in milliseconds (0 if none). */
  currentRunElapsed: number;
  /** Elapsed time since the session started, in milliseconds. */
  sessionElapsed: number;
}

/**
 * Calculates the share of the session spent in runs, including the in-progress run,
 * as a percentage between 0 and 100.
 */
export function calculateLiveEfficiency({
  completedRunTime,
  currentRunElapsed,
  sessionElapsed,
}: LiveEfficiencyInput): number {
  if (sessionElapsed <= 0) {
    return 0;
  }
  const runTime = Math.max(0, completedRunTime) + Math.max(0, currentRunElapsed);
  return Math.min(100, (runTime / sessionElapsed) * 100);
}

/**
 * Returns the most recent finished runs, newest first.
 */
export function getRecentRuns(runs: Run[], limit = RECENT_RUNS_LIMIT): Run[] {
  return runs
    .filter((run) => Boolean(run.endTime))
    .sort((a, b) => b.runNumber - a.runNumber)
    .slice(0, limit);
}
