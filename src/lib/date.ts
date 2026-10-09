import dayjs from 'dayjs';
import type { TFunction } from 'i18next';
import { translations } from '@/i18n/translations';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

/** Units for relative times, largest first; the largest unit that fits the difference is used. */
const RELATIVE_TIME_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', YEAR_MS],
  ['month', MONTH_MS],
  ['day', DAY_MS],
  ['hour', HOUR_MS],
  ['minute', MINUTE_MS],
];

/**
 * Formats a duration in milliseconds into a human-readable time string.
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} Formatted time string (e.g., "2h 34m 12s", "45m 30s", "1m 5s")
 */
export function formatDuration(durationMs?: number): string {
  if (durationMs === undefined || durationMs === null || durationMs < 0) return '0s';

  // Use total hours: dayjs duration components wrap at day/month boundaries (24h would become 0).
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(' ');
}

/**
 * Formats a duration in milliseconds as a stopwatch-style clock string.
 * Uses fixed-width segments so the value does not jump around while it ticks.
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} Clock string (e.g., "0:05", "12:34", "1:02:03")
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

/**
 * Formats the time between a date and now in the given locale (e.g. "2 days ago", "in 5 hours",
 * "yesterday"), using the largest unit that fits.
 * @param {Date | string | number} date - The date to format
 * @param {string} [locale] - BCP 47 locale to format with (e.g. the app's `i18n.language`)
 * @param {number} [now=Date.now()] - Reference time
 * @returns {string} The localized relative time
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale?: string,
  now: number = Date.now(),
): string {
  const difference = new Date(date).getTime() - now;
  const [unit, unitMs] = RELATIVE_TIME_UNITS.find(([, size]) => Math.abs(difference) >= size) ?? [
    'second',
    SECOND_MS,
  ];
  const value = Math.round(difference / unitMs);
  const options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' };

  try {
    return new Intl.RelativeTimeFormat(locale, options).format(value, unit);
  } catch {
    return new Intl.RelativeTimeFormat(undefined, options).format(value, unit);
  }
}

/**
 * Formats a date as a localized relative time string (e.g. "2 days ago", "5 hours ago").
 * @param {Date | string | number | undefined} date - The date to format
 * @param {TFunction} t - Translation function, used when there is no date
 * @param {string} [locale] - BCP 47 locale to format with (e.g. the app's `i18n.language`)
 * @returns {string} A human-readable relative time string, or the translated "Never"
 */
export function formatTimeAgo(
  date: Date | string | number | undefined,
  t: TFunction,
  locale?: string,
): string {
  if (!date) return t(translations.common.never);
  return formatRelativeTime(date, locale);
}

/**
 * Formats a date for display in a consistent format.
 * @param {Date | string | number | undefined} date - The date to format
 * @param {string} [format='MMM D, YYYY h:mm A'] - The format string (default: "MMM D, YYYY h:mm A")
 * @returns {string} Formatted date string or "Never" if date is undefined
 */
export function formatDate(
  date: Date | string | number | undefined,
  format: string = 'MMM D, YYYY h:mm A',
): string {
  if (!date) return 'Never';
  return dayjs(date).format(format);
}

/**
 * Formats a date as a short date string (e.g., "Jan 15, 2024").
 * @param {Date | string | number | undefined} date - The date to format
 * @returns {string} Formatted date string or "Never" if date is undefined
 */
export function formatShortDate(date: Date | string | number | undefined): string {
  if (!date) return 'Never';
  return dayjs(date).format('MMM D, YYYY');
}

/**
 * Formats a date as a localized date string using the given locale
 * (e.g. "Jan 15, 2024" for "en", "15.01.2024" for "de").
 * Falls back to the runtime default locale if the given locale is not supported.
 * @param {Date | string | number | undefined} date - The date to format
 * @param {string} [locale] - BCP 47 locale to format with (e.g. the app's `i18n.language`)
 * @param {Intl.DateTimeFormatOptions} [options={ dateStyle: 'medium' }] - Intl formatting options
 * @returns {string} Localized date string or "-" if the date is undefined or invalid
 */
export function formatLocalizedDate(
  date: Date | string | number | undefined,
  locale?: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  if (date === undefined) return '-';
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '-';

  try {
    return new Intl.DateTimeFormat(locale, options).format(value);
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(value);
  }
}

/**
 * Formats a date as a long date string (e.g., "Monday, January 15, 2024").
 * @param {Date | string | number | undefined} date - The date to format
 * @returns {string} Formatted date string or "Never" if date is undefined
 */
export function formatLongDate(date: Date | string | number | undefined): string {
  if (!date) return 'Never';
  return dayjs(date).format('dddd, MMMM D, YYYY');
}

/**
 * Formats a time as a short time string (e.g., "2:30 PM").
 * @param {Date | string | number | undefined} date - The date to format
 * @returns {string} Formatted time string or "-" if date is undefined
 */
export function formatTime(date: Date | string | number | undefined): string {
  if (!date) return '-';
  return dayjs(date).format('h:mm A');
}

/**
 * Formats a timestamp for display in tables (e.g., "2:30:45 PM").
 * @param {Date | string | number | undefined} date - The date to format
 * @returns {string} Formatted timestamp string or "-" if date is undefined
 */
export function formatTimestamp(date: Date | string | number | undefined): string {
  if (!date) return '-';
  return dayjs(date).format('h:mm:ss A');
}

/**
 * Formats a date for session display (e.g., "Monday, January 15, 2024").
 * @param {Date | string | number | undefined} date - The date to format
 * @returns {string} Formatted date string
 */
export function formatSessionDate(date: Date | string | number | undefined): string {
  if (!date) return 'Never';
  return dayjs(date).format('dddd, MMMM D, YYYY');
}

/**
 * Determines if a find is recent based on the found date.
 * @param {Date | string | number | undefined} foundDate - The date when the item was found (can be undefined)
 * @param {number} [recentThresholdDays=7] - Number of days to consider as "recent" (default: 7)
 * @returns {boolean} True if the find is within the recent threshold, false otherwise or if date is undefined
 */
export function isRecentFind(
  foundDate: Date | string | number | undefined,
  recentThresholdDays: number = 7,
): boolean {
  if (!foundDate) return false;

  const now = dayjs();
  const found = dayjs(foundDate);
  return now.diff(found, 'day') < recentThresholdDays;
}

/**
 * Formats the day of a session relative to today: "Today", "Yesterday", the relative time within
 * the last week (e.g. "3 days ago"), and the full localized date before that.
 * @param {Date | string | number | undefined} date - Start of the session
 * @param {TFunction} t - Translation function
 * @param {string} [locale] - BCP 47 locale to format with (e.g. the app's `i18n.language`)
 * @returns {string} The localized session day
 */
export function formatSessionDateRelative(
  date: Date | string | number | undefined,
  t: TFunction,
  locale?: string,
): string {
  if (!date) return t(translations.common.never);
  const now = dayjs();
  const sessionDay = dayjs(date);

  if (sessionDay.isSame(now, 'day')) {
    return t(translations.common.today);
  }
  if (sessionDay.isSame(now.subtract(1, 'day'), 'day')) {
    return t(translations.common.yesterday);
  }
  if (now.diff(sessionDay, 'day') < 7) {
    return formatTimeAgo(date, t, locale);
  }
  return formatLocalizedDate(date, locale, { dateStyle: 'full' });
}
