import type { Character, CharacterInventorySnapshot } from 'electron/types/grail';
import { isSharedStashFileType } from '@/components/inventory/inventoryItemLabels';
import { findSnapshotCharacter } from '@/components/inventory/SnapshotListRow';

/** A snapshot in the characters and stashes list, with its tracked character if known. */
export interface SnapshotListEntry {
  snapshot: CharacterInventorySnapshot;
  character?: Character;
}

export type SnapshotListGroupKind = 'sharedStashes' | 'characters';

export interface SnapshotListGroup {
  kind: SnapshotListGroupKind;
  entries: SnapshotListEntry[];
}

function compareNames(a: SnapshotListEntry, b: SnapshotListEntry): number {
  return a.snapshot.characterName.localeCompare(b.snapshot.characterName);
}

/** Highest level first; saves without a tracked character (no level) last; then by name. */
function compareCharacters(a: SnapshotListEntry, b: SnapshotListEntry): number {
  return (b.character?.level ?? 0) - (a.character?.level ?? 0) || compareNames(a, b);
}

/**
 * Splits the characters and stashes list into shared stashes, then characters (and other saves),
 * leaving out empty groups. Shared stashes are ordered by name, which keeps the softcore and
 * hardcore stash of each kind next to each other; characters by level, highest first, then name.
 */
export function groupSnapshotList(
  snapshots: CharacterInventorySnapshot[],
  characters: Character[],
): SnapshotListGroup[] {
  const sharedStashes: SnapshotListEntry[] = [];
  const characterEntries: SnapshotListEntry[] = [];

  for (const snapshot of snapshots) {
    if (isSharedStashFileType(snapshot.sourceFileType)) {
      sharedStashes.push({ snapshot });
    } else {
      characterEntries.push({ snapshot, character: findSnapshotCharacter(snapshot, characters) });
    }
  }

  const groups: SnapshotListGroup[] = [
    { kind: 'sharedStashes', entries: sharedStashes.sort(compareNames) },
    { kind: 'characters', entries: characterEntries.sort(compareCharacters) },
  ];
  return groups.filter((group) => group.entries.length > 0);
}
