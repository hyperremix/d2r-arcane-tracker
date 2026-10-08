import { runes } from 'electron/items/runes';
import type { Item } from 'electron/types/grail';

/**
 * Filters runewords by name using case-insensitive substring matching.
 * @param runewords - Array of runeword items to filter
 * @param searchTerm - Search term to match against runeword names
 * @returns Filtered array of runewords matching the search term
 */
export function filterRunewordsByName(runewords: Item[], searchTerm: string): Item[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return runewords;
  }

  const lowerSearchTerm = searchTerm.toLowerCase().trim();
  return runewords.filter((runeword) => runeword.name.toLowerCase().includes(lowerSearchTerm));
}

/**
 * Counts required runes for a runeword.
 */
function countRequiredRunes(runes: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const rune of runes) {
    counts[rune] = (counts[rune] || 0) + 1;
  }
  return counts;
}

/**
 * Checks if a runeword contains every one of the selected runes.
 */
function runewordContainsAllSelectedRunes(
  requiredRuneCounts: Record<string, number>,
  selectedRunes: string[],
): boolean {
  return selectedRunes.every((selectedRune) => Boolean(requiredRuneCounts[selectedRune]));
}

/**
 * Counts how many required rune instances are not covered by the available runes.
 */
function countMissingRunes(
  requiredRuneCounts: Record<string, number>,
  availableRunes: Record<string, number>,
): number {
  let missing = 0;
  for (const [runeId, requiredCount] of Object.entries(requiredRuneCounts)) {
    const availableCount = availableRunes[runeId] || 0;
    missing += Math.max(0, requiredCount - availableCount);
  }
  return missing;
}

/**
 * Availability tiers for the runeword calculator.
 * - `craftable`: every required rune is available
 * - `missingOne`: at most one required rune is missing (includes craftable runewords)
 * - `all`: no availability restriction
 */
export type RunewordAvailabilityFilter = 'craftable' | 'missingOne' | 'all';

/**
 * Maximum number of missing runes allowed for each availability tier.
 */
const maxMissingRunesByFilter: Record<RunewordAvailabilityFilter, number> = {
  craftable: 0,
  missingOne: 1,
  all: Number.POSITIVE_INFINITY,
};

/**
 * Filters runewords by selected runes and rune availability.
 * @param runewords - Array of runeword items to filter
 * @param selectedRunes - Selected rune IDs; a runeword must contain all of them to match
 * @param availability - Availability tier limiting how many runes may be missing
 * @param availableRunes - Record mapping rune IDs to their available counts
 * @returns Filtered array of runewords based on selected and available runes
 */
export function filterRunewordsByRunes(
  runewords: Item[],
  selectedRunes: string[],
  availability: RunewordAvailabilityFilter,
  availableRunes: Record<string, number>,
): Item[] {
  const maxMissing = maxMissingRunesByFilter[availability];

  return runewords.filter((runeword) => {
    if (!runeword.runes || runeword.runes.length === 0) {
      return false;
    }

    const requiredRuneCounts = countRequiredRunes(runeword.runes);

    if (
      selectedRunes.length > 0 &&
      !runewordContainsAllSelectedRunes(requiredRuneCounts, selectedRunes)
    ) {
      return false;
    }

    return countMissingRunes(requiredRuneCounts, availableRunes) <= maxMissing;
  });
}

/**
 * Sorts runewords so craftable ones come first, then by fewest missing runes, then by name.
 * Returns a new array and leaves the input untouched.
 * @param runewords - Array of runeword items to sort
 * @param availableRunes - Record mapping rune IDs to their available counts
 * @returns Sorted copy of the runewords
 */
export function sortRunewordsByCraftability(
  runewords: Item[],
  availableRunes: Record<string, number>,
): Item[] {
  const missingById = new Map<string, number>();
  for (const runeword of runewords) {
    missingById.set(
      runeword.id,
      countMissingRunes(countRequiredRunes(runeword.runes ?? []), availableRunes),
    );
  }

  return [...runewords].sort((a, b) => {
    const missingDiff = (missingById.get(a.id) ?? 0) - (missingById.get(b.id) ?? 0);
    if (missingDiff !== 0) {
      return missingDiff;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Interface for runeword completion status.
 */
export interface RunewordCompletionStatus {
  /** Whether all required runes are available to craft this runeword */
  complete: boolean;
  /** Array of rune IDs that are missing or insufficient */
  missingRunes: string[];
  /** Number of required runes that are available */
  availableCount: number;
  /** Total number of required runes */
  totalCount: number;
}

/**
 * Calculates the completion status of a runeword based on available runes.
 * @param runeword - The runeword item to check
 * @param availableRunes - Record mapping rune IDs to their available counts
 * @returns Completion status object with details about missing runes
 */
export function getRunewordCompletionStatus(
  runeword: Item,
  availableRunes: Record<string, number>,
): RunewordCompletionStatus {
  if (!runeword.runes || runeword.runes.length === 0) {
    return {
      complete: false,
      missingRunes: [],
      availableCount: 0,
      totalCount: 0,
    };
  }

  // Count how many of each rune is required
  const requiredRuneCounts: Record<string, number> = {};
  for (const rune of runeword.runes) {
    requiredRuneCounts[rune] = (requiredRuneCounts[rune] || 0) + 1;
  }

  const missingRunes: string[] = [];
  let availableCount = 0;
  const totalCount = runeword.runes.length;

  // Check each unique rune type
  for (const [runeId, requiredCount] of Object.entries(requiredRuneCounts)) {
    const available = availableRunes[runeId] || 0;
    if (available >= requiredCount) {
      // We have enough of this rune type
      availableCount += requiredCount;
    } else {
      // We're missing some of this rune type
      availableCount += available;
      // Add to missing runes (one entry per missing rune)
      for (let i = 0; i < requiredCount - available; i++) {
        missingRunes.push(runeId);
      }
    }
  }

  return {
    complete: missingRunes.length === 0,
    missingRunes,
    availableCount,
    totalCount,
  };
}

/**
 * Gets the name of a rune by its ID
 */
export function getRuneName(runeId: string): string {
  const rune = runes.find((r) => r.id === runeId);
  return rune?.name || runeId;
}
