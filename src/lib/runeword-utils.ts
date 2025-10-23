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
 * Checks if a runeword contains at least one of the selected runes.
 */
function runewordContainsSelectedRunes(
  requiredRuneCounts: Record<string, number>,
  selectedRunes: string[],
): boolean {
  for (const selectedRune of selectedRunes) {
    if (requiredRuneCounts[selectedRune]) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if all required runes for a runeword are available.
 */
function hasAllRequiredRunes(
  requiredRuneCounts: Record<string, number>,
  availableRunes: Record<string, number>,
): boolean {
  for (const [runeId, requiredCount] of Object.entries(requiredRuneCounts)) {
    const availableCount = availableRunes[runeId] || 0;
    if (availableCount < requiredCount) {
      return false;
    }
  }
  return true;
}

/**
 * Filters runewords by selected runes and shows partial or complete matches.
 * @param runewords - Array of runeword items to filter
 * @param selectedRunes - Array of selected rune IDs to filter by
 * @param showPartial - If true, shows all runewords; if false, shows only fully craftable runewords
 * @param availableRunes - Record mapping rune IDs to their available counts
 * @returns Filtered array of runewords based on available runes
 */
export function filterRunewordsByRunes(
  runewords: Item[],
  selectedRunes: string[],
  showPartial: boolean,
  availableRunes: Record<string, number>,
): Item[] {
  return runewords.filter((runeword) => {
    if (!runeword.runes || runeword.runes.length === 0) {
      return false;
    }

    const requiredRuneCounts = countRequiredRunes(runeword.runes);

    // If specific runes are selected, filter by those first
    if (selectedRunes.length > 0) {
      // First check: Does this runeword contain any of the selected runes?
      if (!runewordContainsSelectedRunes(requiredRuneCounts, selectedRunes)) {
        return false;
      }
    }

    // Apply the showPartial toggle
    if (showPartial) {
      // Show all runewords (or those matching selected runes if any are selected)
      return true;
    }

    // Show only if you have ALL required runes to craft this runeword
    return hasAllRequiredRunes(requiredRuneCounts, availableRunes);
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
