import type { ParsedInventorySnapshot } from '../../types/grail';
import { isRune } from '../../utils/objects';
import { resolveGrailLookupName } from '../itemNormalizer';

function snapshotKey(snapshot: ParsedInventorySnapshot): string {
  return `${snapshot.sourceFileType}:${snapshot.sourceFilePath}`;
}

/**
 * Combines the snapshots of the previous scan with the snapshots of the files parsed in this scan.
 * A file that was parsed successfully replaces its previous snapshot; a file that was not parsed
 * (unchanged or failed) keeps it. Snapshots of files that are no longer part of the scan are dropped.
 * @param previousSnapshots - The snapshots of the previous scan.
 * @param allFilePaths - Every save file of this scan.
 * @param parsedFilePaths - The save files that were parsed in this scan.
 * @param successfulSnapshots - The snapshots of the files that were parsed successfully.
 */
export function mergeInventorySnapshots(
  previousSnapshots: ParsedInventorySnapshot[],
  allFilePaths: string[],
  parsedFilePaths: string[],
  successfulSnapshots: ParsedInventorySnapshot[],
): ParsedInventorySnapshot[] {
  const knownFilePathSet = new Set(allFilePaths);
  const parsedFilePathSet = new Set(parsedFilePaths);
  const successfulSnapshotKeySet = new Set(successfulSnapshots.map(snapshotKey));
  const mergedByKey = new Map<string, ParsedInventorySnapshot>();

  for (const snapshot of previousSnapshots) {
    if (!knownFilePathSet.has(snapshot.sourceFilePath)) {
      continue;
    }

    const key = snapshotKey(snapshot);
    if (parsedFilePathSet.has(snapshot.sourceFilePath) && successfulSnapshotKeySet.has(key)) {
      continue;
    }

    mergedByKey.set(key, snapshot);
  }

  for (const snapshot of successfulSnapshots) {
    mergedByKey.set(snapshotKey(snapshot), snapshot);
  }

  return [...mergedByKey.values()];
}

/**
 * Counts each available rune across the given inventory snapshots.
 * Stacked runes count with their stack size. Runes socketed into another item are used up and
 * therefore not available for runewords.
 * @returns {Record<string, number>} A record mapping rune IDs to their counts.
 */
export function countAvailableRunes(snapshots: ParsedInventorySnapshot[]): Record<string, number> {
  const runeCounts: Record<string, number> = {};

  for (const snapshot of snapshots) {
    for (const item of snapshot.items) {
      const rawItem = item.rawParsedItem;
      if (item.isSocketedItem || rawItem.socketed || !isRune(rawItem)) {
        continue;
      }

      const runeId = resolveGrailLookupName(rawItem);
      if (runeId === '') {
        continue;
      }

      runeCounts[runeId] = (runeCounts[runeId] ?? 0) + (item.stackCount ?? 1);
    }
  }

  return runeCounts;
}
