import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Determines if a find is recent based on the found date
 * @param foundDate - The date when the item was found (can be undefined)
 * @param recentThresholdDays - Number of days to consider as "recent" (default: 7)
 * @returns true if the find is within the recent threshold, false otherwise or if date is undefined
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
