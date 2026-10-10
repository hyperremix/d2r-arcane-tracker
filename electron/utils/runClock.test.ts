import { describe, expect, it } from 'vitest';
import type { Run } from '../types/runs';
import { getRunElapsedMs, pauseRunClock, resumeRunClock } from './runClock';

type RunClock = Pick<Run, 'startTime' | 'pausedAt' | 'pausedDuration'>;

const START = new Date('2024-01-01T10:00:00Z');
const at = (minutes: number) => START.getTime() + minutes * 60_000;

describe('When the elapsed time of a run is computed', () => {
  it('If the run was never paused, Then it is the time since the start', () => {
    // Arrange
    const run = { startTime: START };

    // Act
    const elapsed = getRunElapsedMs(run, at(5));

    // Assert
    expect(elapsed).toBe(5 * 60_000);
  });

  it('If the run is paused, Then the elapsed time stays frozen at the pause', () => {
    // Arrange
    const run = pauseRunClock({ startTime: START }, at(2));

    // Act
    const early = getRunElapsedMs(run, at(3));
    const late = getRunElapsedMs(run, at(30));

    // Assert
    expect(early).toBe(2 * 60_000);
    expect(late).toBe(2 * 60_000);
  });

  it('If the run was paused and resumed, Then the paused time is excluded', () => {
    // Arrange
    const run: RunClock = { startTime: START };
    const paused = pauseRunClock(run, at(2));
    const resumed = resumeRunClock(paused, at(5));

    // Act
    const elapsed = getRunElapsedMs(resumed, at(7));

    // Assert
    expect(resumed.pausedAt).toBeUndefined();
    expect(resumed.pausedDuration).toBe(3 * 60_000);
    expect(elapsed).toBe(4 * 60_000);
  });

  it('If the current time is before the run start, Then the elapsed time is never negative', () => {
    // Arrange
    const run = { startTime: START };

    // Act
    const elapsed = getRunElapsedMs(run, at(-1));

    // Assert
    expect(elapsed).toBe(0);
  });
});

describe('When a run clock is paused or resumed twice', () => {
  it('If it is already paused, Then pausing again keeps the first pause time', () => {
    // Arrange
    const paused = pauseRunClock({ startTime: START }, at(1));

    // Act
    const pausedAgain = pauseRunClock(paused, at(4));

    // Assert
    expect(pausedAgain).toBe(paused);
  });

  it('If it is not paused, Then resuming leaves it unchanged', () => {
    // Arrange
    const run = { startTime: START, pausedDuration: 1000 };

    // Act
    const resumed = resumeRunClock(run, at(4));

    // Assert
    expect(resumed).toBe(run);
  });
});
