import type { Run } from '../types/runs';

/** The fields of a run that its clock is computed from. */
type RunClock = Pick<Run, 'startTime' | 'pausedAt' | 'pausedDuration'>;

/**
 * Returns the time spent in a run, excluding the time it was paused. While the run is paused
 * the result stays frozen at the moment it was paused.
 * Shared by the main process (run duration) and the renderer (live timers).
 * @param run - The run
 * @param now - Current timestamp in milliseconds
 * @returns The active time of the run in milliseconds, never negative
 */
export function getRunElapsedMs(run: RunClock, now: number): number {
  const activeUntil = run.pausedAt?.getTime() ?? now;
  return Math.max(0, activeUntil - run.startTime.getTime() - (run.pausedDuration ?? 0));
}

/**
 * Returns the run with its clock stopped at `now`. A run that is already paused is returned as is.
 * @param run - The in-progress run
 * @param now - Current timestamp in milliseconds
 */
export function pauseRunClock<T extends RunClock>(run: T, now: number): T {
  if (run.pausedAt) {
    return run;
  }
  return { ...run, pausedAt: new Date(now) };
}

/**
 * Returns the run with its clock running again, adding the time since it was paused to its paused
 * time. A run that is not paused is returned as is.
 * @param run - The in-progress run
 * @param now - Current timestamp in milliseconds
 */
export function resumeRunClock<T extends RunClock>(run: T, now: number): T {
  if (!run.pausedAt) {
    return run;
  }
  const pausedFor = Math.max(0, now - run.pausedAt.getTime());
  return {
    ...run,
    pausedAt: undefined,
    pausedDuration: (run.pausedDuration ?? 0) + pausedFor,
  };
}
