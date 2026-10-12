import { describe, expect, it } from 'vitest';
import { GrailProgressBuilder, HolyGrailItemBuilder, RunBuilder } from '@/fixtures';
import {
  buildCumulativeFinds,
  buildSessionDurations,
  buildWeeklyFinds,
  type CumulativeFindsPoint,
  durationTicks,
  formatDayIndex,
  hasProgressFinds,
  hasWeeklyFinds,
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
    const { points, baseline } = buildCumulativeFinds(progress, items, NORMAL_ONLY);

    // Assert
    expect(points).toEqual([
      { day: toLocalDayIndex(new Date(2026, 0, 1)), total: 2 },
      { day: toLocalDayIndex(new Date(2026, 0, 5)), total: 3 },
    ]);
    expect(baseline).toBeUndefined();
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
    const { points } = buildCumulativeFinds(progress, items, NORMAL_ONLY);

    // Assert
    expect(points).toEqual([{ day: toLocalDayIndex(new Date(2026, 0, 2)), total: 1 }]);
  });

  it('If nothing was found, Then there are no points', () => {
    // Arrange
    const items = [HolyGrailItemBuilder.new().withId('a').build()];
    const progress = [GrailProgressBuilder.new().withItemId('a').withoutFoundDate().build()];

    // Act
    const { points, baseline } = buildCumulativeFinds(progress, items, NORMAL_ONLY);

    // Assert
    expect(points).toEqual([]);
    expect(baseline).toBeUndefined();
  });

  it('If the initial scan found items on the first day, Then they form the baseline and later finds add to it', () => {
    // Arrange
    const items = ['a', 'b', 'c', 'd'].map((id) => HolyGrailItemBuilder.new().withId(id).build());
    const progress = [
      ...['a', 'b'].map((itemId) =>
        GrailProgressBuilder.new()
          .withId(`scan-${itemId}`)
          .withItemId(itemId)
          .withFoundDate(new Date(2026, 0, 1, 10))
          .asFromInitialScan()
          .build(),
      ),
      GrailProgressBuilder.new()
        .withId('same-day')
        .withItemId('c')
        .withFoundDate(new Date(2026, 0, 1, 20))
        .build(),
      GrailProgressBuilder.new()
        .withId('later')
        .withItemId('d')
        .withFoundDate(new Date(2026, 0, 4, 9))
        .build(),
    ];

    // Act
    const { points, baseline } = buildCumulativeFinds(progress, items, NORMAL_ONLY);

    // Assert
    expect(baseline).toEqual({ day: toLocalDayIndex(new Date(2026, 0, 1)), count: 2 });
    expect(points).toEqual([
      { day: toLocalDayIndex(new Date(2026, 0, 1)), total: 3 },
      { day: toLocalDayIndex(new Date(2026, 0, 4)), total: 4 },
    ]);
  });

  it('If the first discoveries are from a startup scan on a later day, Then they form the baseline on that day', () => {
    // Arrange: the scans before found nothing, so this scan is the first one recorded in the history
    const items = ['a', 'b'].map((id) => HolyGrailItemBuilder.new().withId(id).build());
    const progress = ['a', 'b'].map((itemId) =>
      GrailProgressBuilder.new()
        .withId(`scan-${itemId}`)
        .withItemId(itemId)
        .withFoundDate(new Date(2026, 2, 20, 9))
        .asFromInitialScan()
        .build(),
    );

    // Act
    const { points, baseline } = buildCumulativeFinds(progress, items, NORMAL_ONLY);

    // Assert
    expect(baseline).toEqual({ day: toLocalDayIndex(new Date(2026, 2, 20)), count: 2 });
    expect(points).toEqual([{ day: toLocalDayIndex(new Date(2026, 2, 20)), total: 2 }]);
  });

  it('If a later startup scan finds more items, Then they count on the day of that scan and not in the baseline', () => {
    // Arrange
    const items = ['a', 'b', 'c'].map((id) => HolyGrailItemBuilder.new().withId(id).build());
    const progress = [
      ['a', new Date(2026, 0, 1, 9)],
      ['b', new Date(2026, 0, 1, 9)],
      ['c', new Date(2026, 0, 8, 9)],
    ].map(([itemId, foundDate]) =>
      GrailProgressBuilder.new()
        .withId(`scan-${itemId}`)
        .withItemId(itemId as string)
        .withFoundDate(foundDate as Date)
        .asFromInitialScan()
        .build(),
    );

    // Act
    const { points, baseline } = buildCumulativeFinds(progress, items, NORMAL_ONLY);

    // Assert
    expect(baseline).toEqual({ day: toLocalDayIndex(new Date(2026, 0, 1)), count: 2 });
    expect(points.map((point) => point.total)).toEqual([2, 3]);
  });

  it('If only a later startup scan found items, Then there is no baseline', () => {
    // Arrange
    const items = ['a', 'b'].map((id) => HolyGrailItemBuilder.new().withId(id).build());
    const progress = [
      GrailProgressBuilder.new()
        .withId('tracked')
        .withItemId('a')
        .withFoundDate(new Date(2026, 0, 1))
        .build(),
      GrailProgressBuilder.new()
        .withId('rescan')
        .withItemId('b')
        .withFoundDate(new Date(2026, 0, 3))
        .asFromInitialScan()
        .build(),
    ];

    // Act
    const { points, baseline } = buildCumulativeFinds(progress, items, NORMAL_ONLY);

    // Assert
    expect(baseline).toBeUndefined();
    expect(points.map((point) => point.total)).toEqual([1, 2]);
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

describe('When deciding whether the finds charts have anything to show', () => {
  it('If there are no progress points, Then the progress chart has no finds', () => {
    // Arrange
    const points: CumulativeFindsPoint[] = [];

    // Act
    const result = hasProgressFinds(points);

    // Assert
    expect(result).toBe(false);
  });

  it('If there is a progress point, Then the progress chart has finds', () => {
    // Arrange
    const points: CumulativeFindsPoint[] = [{ day: 20000, total: 1 }];

    // Act
    const result = hasProgressFinds(points);

    // Assert
    expect(result).toBe(true);
  });

  it('If every week has zero finds, Then the weekly chart has no finds', () => {
    // Arrange
    const weeks = buildWeeklyFinds([], new Date(2026, 9, 10, 12), 3);

    // Act
    const result = hasWeeklyFinds(weeks);

    // Assert
    expect(result).toBe(false);
  });

  it('If any week has a find, Then the weekly chart has finds', () => {
    // Arrange
    const progress = [
      GrailProgressBuilder.new()
        .withId('p1')
        .withItemId('a')
        .withFoundDate(new Date(2026, 9, 9, 9))
        .build(),
    ];
    const weeks = buildWeeklyFinds(progress, new Date(2026, 9, 10, 12), 3);

    // Act
    const result = hasWeeklyFinds(weeks);

    // Assert
    expect(result).toBe(true);
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

  it('If the range starts above zero, Then the ticks start at the round value below the minimum', () => {
    // Arrange & Act & Assert
    expect(niceTicks(205, { min: 186 })).toEqual([185, 190, 195, 200, 205]);
    expect(niceTicks(300, { min: 5 })).toEqual([0, 100, 200, 300]);
  });

  it('If the minimum is a round value, Then the ticks start below it so the minimum is not on the bottom edge', () => {
    // Arrange & Act & Assert
    expect(niceTicks(210, { min: 190 })).toEqual([185, 190, 195, 200, 205, 210]);
  });

  it('If the range above zero is empty, Then the axis still spans a few values around the minimum', () => {
    // Arrange & Act
    const ticks = niceTicks(190, { min: 190 });

    // Assert
    expect(ticks).toEqual([189, 190, 191, 192, 193, 194]);
  });

  it('If the number of intervals is given, Then it sets the approximate tick count', () => {
    // Arrange & Act & Assert
    expect(niceTicks(100, { targetCount: 2 })).toEqual([0, 50, 100]);
  });

  it('If durations are shown, Then the ticks use round time steps covering the maximum', () => {
    // Arrange & Act & Assert
    expect(durationTicks(80_000)).toEqual([0, 30_000, 60_000, 90_000]);
    expect(durationTicks(0)).toEqual([0, 5_000]);
  });
});

describe('When formatting a day index', () => {
  it('If the local day is the 10th, Then the date shows the 10th regardless of the time zone', () => {
    // Arrange
    const day = toLocalDayIndex(new Date(2026, 9, 10, 23, 30));

    // Act
    const formatted = formatDayIndex(day, 'en', { dateStyle: 'medium' });

    // Assert
    expect(formatted).toBe('Oct 10, 2026');
  });

  it('If durations exceed an hour, Then the ticks step in whole hours', () => {
    // Arrange & Act & Assert
    expect(durationTicks(4 * 3_600_000 * 2)).toEqual([
      0, 7_200_000, 14_400_000, 21_600_000, 28_800_000,
    ]);
  });
});
