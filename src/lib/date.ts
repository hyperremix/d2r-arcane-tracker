import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with plugins
dayjs.extend(duration);
dayjs.extend(relativeTime);

/**
 * Formats a duration in milliseconds into a human-readable time string.
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} Formatted time string (e.g., "2h 34m 12s", "45m 30s", "1m 5s")
 */
export function formatDuration(durationMs?: number): string {
  if (durationMs === undefined || durationMs === null || durationMs < 0) return '0s';

  const d = dayjs.duration(durationMs);
  const hours = d.hours();
  const minutes = d.minutes();
  const seconds = d.seconds();

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
 * Formats a date as a relative time string (e.g., "2 days ago", "5 hours ago").
 * @param {Date | string | number} date - The date to format
 * @returns {string} A human-readable relative time string
 */
export function formatTimeAgo(date: Date | string | number | undefined): string {
  if (!date) return 'Never';
  return dayjs(date).fromNow();
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

export function formatSessionDateRelative(date: Date | string | number | undefined): string {
  const now = dayjs();
  const sessionDay = dayjs(date);

  if (sessionDay.isSame(now, 'day')) {
    return 'Today';
  } else if (sessionDay.isSame(now.subtract(1, 'day'), 'day')) {
    return 'Yesterday';
  } else if (now.diff(sessionDay, 'day') < 7) {
    return formatTimeAgo(date);
  } else {
    return formatSessionDate(date);
  }
}
