import { describe, expect, it } from 'vitest';
import { GrailProgressBuilder, HolyGrailItemBuilder, RunBuilder } from '@/fixtures';
import {
  buildCumulativeFinds,
  buildSessionDurations,
  buildWeeklyFinds,
  durationTicks,
  niceTicks,
  toLocalDayIndex,
} from './chartData';

const NORMAL_ONLY = { grailNormal: true, grailEthereal: false };

describe('When building the cumulative grail finds', () => {
  it('If items were found on different days, Then each day adds its new entries to the total', () => {
    // Arrange
    const items = ['a', 'b', 'c'].map((id) => HolyGrailItemBuilder.new().withId(id).build());
    const progress = [
      GrailProgressBuilder.new()
        .withId('p1')
        .withItemId('a')
        .withFoundDate(new Date(2026, 0, 1, 10))
        .build(),
      GrailProgressBuilder.new()
        .withId('p2')
        .withItemId('b')
        .withFoundDate(new Date(2026, 0, 1, 18))
        .build(),
      GrailProgressBuilder.new()
        .withId('p3')
        .withItemId('c')
        .withFoundDate(new Date(2026, 0, 5, 9))
        .build(),
    ];

    // Act
    const points = buildCumulativeFinds(progress, items, NORMAL_ONLY);

    // Assert
    expect(points).toEqual([
      { day: toLocalDayIndex(new Date(2026, 0, 1)), total: 2 },
      { day: toLocalDayIndex(new Date(2026, 0, 5)), total: 3 },
    ]);
  });

  it('If an item was found again later, Then only its first find counts', () => {
    // Arrange
    const items = [HolyGrailItemBuilder.new().withId('a').build()];
    const progress = [
      GrailProgressBuilder.new()
        .withId('later')
        .withItemId('a')
        .withFoundDate(new Date(2026, 0, 9))
        .build(),
      GrailProgressBuilder.new()
        .withId('first')
        .withItemId('a')
        .withFoundDate(new Date(2026, 0, 2))
        .build(),
    ];

    // Act
    const points = buildCumulativeFinds(progress, items, NORMAL_ONLY);

    // Assert
    expect(points).toEqual([{ day: toLocalDayIndex(new Date(2026, 0, 2)), total: 1 }]);
  });

  it('If nothing was found, Then there are no points', () => {
    // Arrange
    const items = [HolyGrailItemBuilder.new().withId('a').build()];
    const progress = [GrailProgressBuilder.new().withItemId('a').withoutFoundDate().build()];

    // Act
    const points = buildCumulativeFinds(progress, items, NORMAL_ONLY);

    // Assert
    expect(points).toEqual([]);
  });
});

describe('When counting finds per week', () => {
  it('If finds fall into different weeks, Then each week ending today counts its own finds', () => {
    // Arrange
    const now = new Date(2026, 9, 10, 12);
    const progress = [
      GrailProgressBuilder.new()
        .withId('today')
        .withFoundDate(new Date(2026, 9, 10, 8))
        .build(),
      GrailProgressBuilder.new()
        .withId('6-days')
        .withFoundDate(new Date(2026, 9, 4, 8))
        .build(),
      GrailProgressBuilder.new()
        .withId('7-days')
        .withFoundDate(new Date(2026, 9, 3, 8))
        .build(),
      GrailProgressBuilder.new()
        .withId('old')
        .withFoundDate(new Date(2026, 5, 1))
        .build(),
    ];

    // Act
    const weeks = buildWeeklyFinds(progress, now, 3);

    // Assert
    expect(weeks.map((week) => week.count)).toEqual([0, 1, 2]);
    expect(weeks[2]).toMatchObject({
      startDay: toLocalDayIndex(new Date(2026, 9, 4)),
      endDay: toLocalDayIndex(new Date(2026, 9, 10)),
    });
  });

  it('If a find comes from the initial scan, Then it does not count', () => {
    // Arrange
    const now = new Date(2026, 9, 10, 12);
    const progress = [
      GrailProgressBuilder.new()
        .withFoundDate(new Date(2026, 9, 9))
        .asFromInitialScan()
        .build(),
    ];

    // Act
    const weeks = buildWeeklyFinds(progress, now, 2);

    // Assert
    expect(weeks.map((week) => week.count)).toEqual([0, 0]);
  });
});

describe('When summarizing run durations per session', () => {
  it('If a session has completed runs, Then the median and quartiles are interpolated', () => {
    // Arrange
    const runs = [60_000, 120_000, 90_000, 180_000].map((duration, index) =>
      RunBuilder.new().withId(`run-${index}`).withDuration(duration).build(),
    );

    // Act
    const [summary] = buildSessionDurations([{ id: 's1', startTime: new Date(2026, 0, 1), runs }]);

    // Assert
    expect(summary).toMatchObject({
      sessionId: 's1',
      runCount: 4,
      fastest: 60_000,
      lowerQuartile: 82_500,
      median: 105_000,
      upperQuartile: 135_000,
      slowest: 180_000,
    });
  });

  it('If a session has no completed run, Then it is left out and the rest are oldest first', () => {
    // Arrange
    const completedRun = RunBuilder.new().withDuration(60_000).build();
    const runningRun = RunBuilder.new().withoutDuration().build();

    // Act
    const summaries = buildSessionDurations([
      { id: 'newer', startTime: new Date(2026, 0, 3), runs: [completedRun] },
      { id: 'running', startTime: new Date(2026, 0, 4), runs: [runningRun] },
      { id: 'older', startTime: new Date(2026, 0, 1), runs: [completedRun] },
    ]);

    // Assert
    expect(summaries.map((summary) => summary.sessionId)).toEqual(['older', 'newer']);
  });
});

describe('When computing axis ticks', () => {
  it('If counts are shown, Then the ticks are round whole numbers covering the maximum', () => {
    // Arrange & Act & Assert
    expect(niceTicks(13)).toEqual([0, 5, 10, 15]);
    expect(niceTicks(2)).toEqual([0, 1, 2]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });

  it('If durations are shown, Then the ticks use round time steps covering the maximum', () => {
    // Arrange & Act & Assert
    expect(durationTicks(80_000)).toEqual([0, 30_000, 60_000, 90_000]);
    expect(durationTicks(0)).toEqual([0, 5_000]);
  });
});
