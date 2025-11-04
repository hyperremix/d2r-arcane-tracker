import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function for merging Tailwind CSS classes with conditional logic.
 * Combines clsx for conditional class names with tailwind-merge to handle conflicting Tailwind classes.
 * @param {...ClassValue[]} inputs - Class names or conditional class objects to merge
 * @returns {string} Merged and deduplicated class names string
 * @example
 * cn('px-2 py-1', condition && 'bg-blue-500', { 'font-bold': isActive })
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Determines if a find is recent based on the found date.
 * @param {Date | undefined} foundDate - The date when the item was found (can be undefined)
 * @param {number} [recentThresholdDays=7] - Number of days to consider as "recent" (default: 7)
 * @returns {boolean} True if the find is within the recent threshold, false otherwise or if date is undefined
 */
export function isRecentFind(
  foundDate: Date | undefined,
  recentThresholdDays: number = 7,
): boolean {
  if (!foundDate) return false;

  const now = Date.now();
  const foundTime = foundDate.getTime();
  const thresholdMs = recentThresholdDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds

  return now - foundTime < thresholdMs;
}

/**
 * Formats a duration in milliseconds into a human-readable time string.
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} Formatted time string (e.g., "2h 34m 12s", "45m 30s", "1m 5s")
 */
export function formatDuration(durationMs?: number): string {
  if (durationMs === undefined || durationMs === null || durationMs < 0) return '0s';

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
