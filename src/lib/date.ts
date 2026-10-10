import i18n, { type TFunction } from 'i18next';
import { translations } from '@/i18n/translations';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

/**
 * Returns the locale of the active UI language, used when no locale is passed to the formatters.
 * @returns {string | undefined} The active i18n language, if i18n is initialised
 */
export function getActiveLocale(): string | undefined {
  return i18n.resolvedLanguage ?? i18n.language;
}

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

  // Use total hours so durations of a day or longer do not wrap (24h must not become 0h).
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
 * @param {string} [locale] - BCP 47 locale to format with (defaults to the active UI language)
 * @param {number} [now=Date.now()] - Reference time
 * @returns {string} The localized relative time
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale: string | undefined = getActiveLocale(),
  now: number = Date.now(),
): string {
  const difference = toDate(date).getTime() - now;
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
 * @param {string} [locale] - BCP 47 locale to format with (defaults to the active UI language)
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
 * Formats a date and time in the given locale (e.g. "Jan 15, 2024, 2:30 PM" in English).
 * @param {Date | string | number | undefined} date - The date to format
 * @param {string} [locale] - BCP 47 locale to format with (defaults to the active UI language)
 * @returns {string} Formatted date and time, or the translated "Never" if there is no date
 */
export function formatDate(date: Date | string | number | undefined, locale?: string): string {
  if (!date) return i18n.t(translations.common.never);
  return formatLocalizedDate(date, locale, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Formats a date as a short date in the given locale (e.g. "Jan 15, 2024" in English).
 * @param {Date | string | number | undefined} date - The date to format
 * @param {string} [locale] - BCP 47 locale to format with (defaults to the active UI language)
 * @returns {string} Formatted date, or the translated "Never" if there is no date
 */
export function formatShortDate(date: Date | string | number | undefined, locale?: string): string {
  if (!date) return i18n.t(translations.common.never);
  return formatLocalizedDate(date, locale);
}

/**
 * Formats a date as a localized date string using the given locale
 * (e.g. "Jan 15, 2024" for "en", "15.01.2024" for "de").
 * Falls back to the runtime default locale if the given locale is not supported.
 * @param {Date | string | number | undefined} date - The date to format
 * @param {string} [locale] - BCP 47 locale to format with (defaults to the active UI language)
 * @param {Intl.DateTimeFormatOptions} [options={ dateStyle: 'medium' }] - Intl formatting options
 * @returns {string} Localized date string or "-" if the date is undefined or invalid
 */
export function formatLocalizedDate(
  date: Date | string | number | undefined,
  locale: string | undefined = getActiveLocale(),
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  if (date === undefined) return '-';
  const value = toDate(date);
  if (Number.isNaN(value.getTime())) return '-';

  try {
    return new Intl.DateTimeFormat(locale, options).format(value);
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(value);
  }
}

/**
 * Formats a time as a short time string in the given locale (e.g. "2:30 PM" in English).
 * @param {Date | string | number | undefined} date - The date to format
 * @param {string} [locale] - BCP 47 locale to format with (defaults to the active UI language)
 * @returns {string} Formatted time string or "-" if date is undefined
 */
export function formatTime(date: Date | string | number | undefined, locale?: string): string {
  if (!date) return '-';
  return formatLocalizedDate(date, locale, { timeStyle: 'short' });
}

/**
 * Formats a timestamp with seconds for display in tables (e.g. "2:30:45 PM" in English).
 * @param {Date | string | number | undefined} date - The date to format
 * @param {string} [locale] - BCP 47 locale to format with (defaults to the active UI language)
 * @returns {string} Formatted timestamp string or "-" if date is undefined
 */
export function formatTimestamp(date: Date | string | number | undefined, locale?: string): string {
  if (!date) return '-';
  return formatLocalizedDate(date, locale, { timeStyle: 'medium' });
}

/**
 * Formats a date for session display (e.g. "Monday, January 15, 2024" in English).
 * @param {Date | string | number | undefined} date - The date to format
 * @param {string} [locale] - BCP 47 locale to format with (defaults to the active UI language)
 * @returns {string} Formatted date string, or the translated "Never" if there is no date
 */
export function formatSessionDate(
  date: Date | string | number | undefined,
  locale?: string,
): string {
  if (!date) return i18n.t(translations.common.never);
  return formatLocalizedDate(date, locale, { dateStyle: 'full' });
}

/**
 * Formats a date as `YYYY-MM-DD` in local time: the value format of `<input type="date">`, also
 * used to date file names.
 * @param {Date} [date=new Date()] - The date to format
 * @returns {string} The local calendar date, e.g. "2024-01-15"
 */
export function toLocalIsoDate(date: Date = new Date()): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a `YYYY-MM-DD` value (e.g. from `<input type="date">`) as midnight in local time;
 * the inverse of {@link toLocalIsoDate}. `new Date(value)` would parse it as UTC instead.
 * @param {string} value - The local calendar date
 * @returns {Date} Local midnight of that day (an invalid date if the value is malformed)
 */
export function parseLocalIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts a date value to a `Date`. A date-only `YYYY-MM-DD` string is read as local midnight
 * (as dayjs did), whereas `new Date(value)` would read it as UTC midnight. Every other string
 * form is parsed by `new Date(value)`.
 */
function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) return parseLocalIsoDate(value);
  return new Date(value);
}

/**
 * Returns local midnight of the day a date falls on.
 */
function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Number of whole local calendar days (truncated towards zero) from one date to another. The
 * elapsed time is corrected for a change of UTC offset between the two dates, so a day that is
 * 23 or 25 hours long because of daylight saving time still counts as one day (as dayjs's
 * `diff(..., 'day')` did).
 */
function wholeDaysBetween(from: Date, to: Date): number {
  const offsetChangeMs = (to.getTimezoneOffset() - from.getTimezoneOffset()) * MINUTE_MS;
  return Math.trunc((to.getTime() - from.getTime() - offsetChangeMs) / DAY_MS);
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

  return wholeDaysBetween(toDate(foundDate), new Date()) < recentThresholdDays;
}

/**
 * Formats the day of a session relative to today: "Today", "Yesterday", the relative time within
 * the last week (e.g. "3 days ago"), and the full localized date before that.
 * @param {Date | string | number | undefined} date - Start of the session
 * @param {TFunction} t - Translation function
 * @param {string} [locale] - BCP 47 locale to format with (defaults to the active UI language)
 * @returns {string} The localized session day
 */
export function formatSessionDateRelative(
  date: Date | string | number | undefined,
  t: TFunction,
  locale?: string,
): string {
  if (!date) return t(translations.common.never);
  const now = new Date();
  const sessionStart = toDate(date);
  const sessionDay = startOfLocalDay(sessionStart).getTime();

  if (sessionDay === startOfLocalDay(now).getTime()) {
    return t(translations.common.today);
  }
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sessionDay === yesterday.getTime()) {
    return t(translations.common.yesterday);
  }
  if (wholeDaysBetween(sessionStart, now) < 7) {
    return formatTimeAgo(date, t, locale);
  }
  return formatLocalizedDate(date, locale, { dateStyle: 'full' });
}
