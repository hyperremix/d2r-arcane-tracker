import type { GrailProgress, Item, Run } from 'electron/types/grail';
import { DAY_MS, formatLocalizedDate, HOUR_MS } from '@/lib/date';
import type { GrailStatisticsSettings } from '@/lib/grailStatistics';
import { findFirstDiscoveries } from '@/lib/sessionStats';

/** Number of weeks shown by the finds-per-week chart. */
export const WEEKLY_FINDS_WEEKS = 12;

/** Number of most recent sessions shown by the run duration chart. */
export const RUN_DURATION_SESSIONS = 12;

const DAYS_PER_WEEK = 7;

/**
 * Index of the local calendar day of a date, so consecutive days differ by exactly one
 * regardless of daylight saving time.
 * @param date - The date
 * @returns The day index
 */
export function toLocalDayIndex(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

/**
 * Converts a day index back to a date. The result is UTC midnight of that calendar day, so format
 * it with `timeZone: 'UTC'` to show the right day.
 * @param dayIndex - Day index from {@link toLocalDayIndex}
 * @returns UTC midnight of the day
 */
export function dayIndexToUtcDate(dayIndex: number): Date {
  return new Date(dayIndex * DAY_MS);
}

/**
 * Formats a day index as a date. Day indexes are UTC midnights, so the date is formatted in UTC.
 * @param dayIndex - Day index from {@link toLocalDayIndex}
 * @param locale - Locale of the formatted date
 * @param options - Date format options
 * @returns The formatted date
 */
export function formatDayIndex(
  dayIndex: number,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return formatLocalizedDate(dayIndexToUtcDate(dayIndex), locale, { ...options, timeZone: 'UTC' });
}

/** Number of grail entries found by the end of a day. */
export interface CumulativeFindsPoint {
  day: number;
  total: number;
}

/** Grail entries the first save file scan found, before the tracker could see them being found. */
export interface TrackingBaseline {
  /** Day index of the first save file scan. */
  day: number;
  /** Number of grail entries the scan found. */
  count: number;
}

/** Cumulative grail finds over time. */
export interface CumulativeFinds {
  /** One point per day with at least one new entry, in chronological order. */
  points: CumulativeFindsPoint[];
  /**
   * Entries from the initial save file scan on the first day of the chart, if any. They are
   * included in the totals of the points.
   */
  baseline: TrackingBaseline | undefined;
}

/**
 * Builds the cumulative number of grail entries found, one point per day with at least one new
 * entry. Each tracked item version counts once, on the day it was first found; finds from the
 * initial save file scan count on the day of the scan. The entries the scan found on the first day
 * are reported as the baseline, since they were found before tracking began.
 * @param progress - All progress records
 * @param items - Tracked items
 * @param settings - Which item versions are tracked
 * @returns The points and the baseline
 */
export function buildCumulativeFinds(
  progress: GrailProgress[],
  items: Item[],
  settings: GrailStatisticsSettings,
): CumulativeFinds {
  const newEntriesByDay = new Map<number, number>();
  const initialScanEntriesByDay = new Map<number, number>();
  for (const record of findFirstDiscoveries(progress, items, settings).values()) {
    if (!record.foundDate) continue;
    const day = toLocalDayIndex(new Date(record.foundDate));
    newEntriesByDay.set(day, (newEntriesByDay.get(day) ?? 0) + 1);
    if (record.fromInitialScan) {
      initialScanEntriesByDay.set(day, (initialScanEntriesByDay.get(day) ?? 0) + 1);
    }
  }

  let total = 0;
  const points = [...newEntriesByDay]
    .sort(([a], [b]) => a - b)
    .map(([day, count]) => {
      total += count;
      return { day, total };
    });

  const firstDay = points[0]?.day;
  const baselineCount = firstDay === undefined ? 0 : (initialScanEntriesByDay.get(firstDay) ?? 0);
  return {
    points,
    baseline: baselineCount > 0 ? { day: firstDay, count: baselineCount } : undefined,
  };
}

/** Number of finds in a week (seven calendar days). */
export interface WeeklyFinds {
  /** Day index of the first day of the week. */
  startDay: number;
  /** Day index of the last day of the week. */
  endDay: number;
  count: number;
}

/**
 * Counts finds per week for the most recent weeks, the last week ending today. Like the recent
 * finds statistic, every find made while the tracker was running counts and finds from the initial
 * save file scan do not.
 * @param progress - All progress records
 * @param now - Reference time
 * @param weeks - Number of weeks
 * @returns Weeks in chronological order
 */
export function buildWeeklyFinds(
  progress: GrailProgress[],
  now: Date,
  weeks: number = WEEKLY_FINDS_WEEKS,
): WeeklyFinds[] {
  const today = toLocalDayIndex(now);
  const firstDay = today - weeks * DAYS_PER_WEEK + 1;
  const result: WeeklyFinds[] = Array.from({ length: weeks }, (_, index) => ({
    startDay: firstDay + index * DAYS_PER_WEEK,
    endDay: firstDay + index * DAYS_PER_WEEK + DAYS_PER_WEEK - 1,
    count: 0,
  }));

  for (const record of progress) {
    if (!record.foundDate || record.fromInitialScan) continue;
    const day = toLocalDayIndex(new Date(record.foundDate));
    if (day < firstDay || day > today) continue;
    result[Math.floor((day - firstDay) / DAYS_PER_WEEK)].count++;
  }

  return result;
}

/** Distribution of the completed run durations of a session, in milliseconds. */
export interface SessionDurationSummary {
  sessionId: string;
  startTime: Date;
  /** Number of completed runs. */
  runCount: number;
  fastest: number;
  lowerQuartile: number;
  median: number;
  upperQuartile: number;
  slowest: number;
}

/**
 * Returns the quantile of sorted values using linear interpolation between the closest ranks.
 */
function quantile(sorted: number[], fraction: number): number {
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/** A session with its runs. */
export interface SessionRuns {
  id: string;
  startTime: Date;
  runs: Run[];
}

/**
 * Summarizes the completed run durations of each session. Sessions without a completed run are
 * left out.
 * @param sessions - Sessions with their runs
 * @returns One summary per session with completed runs, in chronological order
 */
export function buildSessionDurations(sessions: SessionRuns[]): SessionDurationSummary[] {
  const summaries: SessionDurationSummary[] = [];
  for (const session of sessions) {
    const durations = session.runs
      .map((run) => run.duration)
      .filter((duration): duration is number => duration !== undefined && duration !== null)
      .sort((a, b) => a - b);
    if (durations.length === 0) continue;
    summaries.push({
      sessionId: session.id,
      startTime: new Date(session.startTime),
      runCount: durations.length,
      fastest: durations[0],
      lowerQuartile: quantile(durations, 0.25),
      median: quantile(durations, 0.5),
      upperQuartile: quantile(durations, 0.75),
      slowest: durations[durations.length - 1],
    });
  }
  return summaries.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

/**
 * Returns evenly spaced, round axis ticks that cover a range, starting at the largest round value
 * at or below the minimum (e.g. 0, 5, 10, 15 for 0 to 13, or 180, 190, 200, 210 for 186 to 205).
 * @param max - Largest value to cover
 * @param targetCount - Approximate number of intervals
 * @param min - Smallest value to cover; defaults to zero
 * @returns Ticks in ascending order
 */
export function niceTicks(max: number, targetCount = 4, min = 0): number[] {
  const span = max - min;
  if (!(span > 0)) return [min, min + 1];
  const roughStep = span / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step =
    [1, 2, 5, 10].map((factor) => factor * magnitude).find((value) => value >= roughStep) ??
    10 * magnitude;
  // Counts are whole numbers, so never step by less than one
  const roundedStep = Math.max(step, 1);
  const ticks: number[] = [];
  for (let value = Math.floor(min / roundedStep) * roundedStep; ; value += roundedStep) {
    ticks.push(value);
    if (value >= max) break;
  }
  return ticks;
}

/** Round duration steps for the duration axis, in milliseconds. */
const DURATION_STEPS_MS = [
  5_000,
  10_000,
  15_000,
  30_000,
  60_000,
  120_000,
  300_000,
  600_000,
  900_000,
  1_800_000,
  HOUR_MS,
];

/**
 * Returns round duration axis ticks from zero that cover the maximum duration
 * (e.g. 0:00, 0:30, 1:00, 1:30 for a maximum of 80 seconds).
 * @param maxMs - Longest duration to cover, in milliseconds
 * @param targetCount - Approximate number of intervals
 * @returns Ticks in milliseconds, ascending, starting at zero
 */
export function durationTicks(maxMs: number, targetCount = 4): number[] {
  if (!(maxMs > 0)) return [0, DURATION_STEPS_MS[0]];
  const roughStep = maxMs / targetCount;
  const step =
    DURATION_STEPS_MS.find((value) => value >= roughStep) ??
    Math.ceil(roughStep / HOUR_MS) * HOUR_MS;
  const ticks: number[] = [];
  for (let value = 0; ; value += step) {
    ticks.push(value);
    if (value >= maxMs) break;
  }
  return ticks;
}
