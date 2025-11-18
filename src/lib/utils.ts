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

// Re-export date utilities from date.ts for backward compatibility
export {
  formatDate,
  formatDuration,
  formatLongDate,
  formatSessionDate,
  formatSessionDateRelative,
  formatShortDate,
  formatTime,
  formatTimeAgo,
  formatTimestamp,
  isRecentFind,
} from './date';
