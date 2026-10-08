import type { Run } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import { calculateLiveEfficiency, getLiveSessionState, getRecentRuns } from './liveSession';

const makeRun = (runNumber: number, finished = true): Run => ({
  id: `run-${runNumber}`,
  sessionId: 'session-1',
  runNumber,
  startTime: new Date('2024-01-01T10:00:00Z'),
  endTime: finished ? new Date('2024-01-01T10:01:00Z') : undefined,
  duration: finished ? 60000 : undefined,
  created: new Date('2024-01-01T10:00:00Z'),
  lastUpdated: new Date('2024-01-01T10:01:00Z'),
});

describe('getLiveSessionState', () => {
  it('If there is no session, Then the state is noSession', () => {
    // Arrange & Act
    const state = getLiveSessionState({ hasSession: false, hasActiveRun: false, isPaused: false });

    // Assert
    expect(state).toBe('noSession');
  });

  it('When a session has no active run, Then the state is idle', () => {
    // Arrange & Act
    const state = getLiveSessionState({ hasSession: true, hasActiveRun: false, isPaused: true });

    // Assert
    expect(state).toBe('idle');
  });

  it('When a run is active, Then the state reflects whether it is paused', () => {
    // Arrange & Act
    const running = getLiveSessionState({ hasSession: true, hasActiveRun: true, isPaused: false });
    const paused = getLiveSessionState({ hasSession: true, hasActiveRun: true, isPaused: true });

    // Assert
    expect(running).toBe('running');
    expect(paused).toBe('paused');
  });
});

describe('calculateLiveEfficiency', () => {
  it('If the session has not elapsed any time, Then efficiency is 0', () => {
    // Arrange & Act
    const efficiency = calculateLiveEfficiency({
      completedRunTime: 1000,
      currentRunElapsed: 0,
      sessionElapsed: 0,
    });

    // Assert
    expect(efficiency).toBe(0);
  });

  it('When a run is in progress, Then its elapsed time counts as run time', () => {
    // Arrange & Act
    const efficiency = calculateLiveEfficiency({
      completedRunTime: 60_000,
      currentRunElapsed: 60_000,
      sessionElapsed: 240_000,
    });

    // Assert
    expect(efficiency).toBe(50);
  });

  it('If run time exceeds session time due to clock skew, Then efficiency is capped at 100', () => {
    // Arrange & Act
    const efficiency = calculateLiveEfficiency({
      completedRunTime: 120_000,
      currentRunElapsed: 10_000,
      sessionElapsed: 100_000,
    });

    // Assert
    expect(efficiency).toBe(100);
  });
});

describe('getRecentRuns', () => {
  it('When runs are given, Then only finished runs are returned newest first up to the limit', () => {
    // Arrange
    const runs = [makeRun(1), makeRun(3), makeRun(2), makeRun(4, false)];

    // Act
    const recent = getRecentRuns(runs, 2);

    // Assert
    expect(recent.map((run) => run.runNumber)).toEqual([3, 2]);
  });

  it('When runs are given, Then the input array is not mutated', () => {
    // Arrange
    const runs = [makeRun(1), makeRun(2)];

    // Act
    getRecentRuns(runs);

    // Assert
    expect(runs.map((run) => run.runNumber)).toEqual([1, 2]);
  });
});
