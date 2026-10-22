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

/**
 * Formats a duration in milliseconds as a stopwatch-style clock string.
 * Uses fixed-width segments so the value does not jump around while it ticks.
 * @param durationMs - Duration in milliseconds
 * @returns Clock string (e.g., "0:05", "12:34", "1:02:03")
 */
export function formatClockDuration(durationMs?: number): string {
  const totalSeconds =
    durationMs === undefined || durationMs < 0 ? 0 : Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
}
