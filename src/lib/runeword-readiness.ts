import { gems } from 'electron/items/gems';
import { runewordBaseItemTypes } from 'electron/items/runewordBases';
import type {
  CharacterInventorySnapshot,
  Item,
  ParsedInventoryItem,
  VaultItem,
} from 'electron/types/grail';
import { planRuneUpgrades, type RuneUpgradeStep } from './runeword-upgrades';

/** d2s qualities of the items a runeword is made in: low quality (1), normal (2) and superior (3). */
const BASE_QUALITIES: ReadonlySet<number> = new Set([1, 2, 3]);

const GEM_CODES: ReadonlySet<string> = new Set(gems.map((gem) => gem.code));

/** The fields of a raw d2s item (`rawItemJson`) that decide whether it is a runeword base. */
interface RawBaseFields {
  quality?: number;
  total_nr_of_sockets?: number;
  nr_of_items_in_sockets?: number;
  socketed_items?: unknown[];
  categories?: unknown;
}

/** Where an owned base is: in a save file, or in the vault. */
export type OwnedRunewordBaseLocation =
  | { kind: 'save'; item: ParsedInventoryItem }
  | { kind: 'vault'; item: VaultItem };

/** An owned low quality, normal or superior item whose sockets are all empty. */
export interface OwnedRunewordBase {
  key: string;
  itemName: string;
  /** Item types the d2s parser lists for the item: its own type and every type it counts as */
  itemTypes: string[];
  socketCount: number;
  ethereal: boolean;
  location: OwnedRunewordBaseLocation;
}

/** How close the owned runes, gems and bases are to making a runeword. */
export interface RunewordReadiness {
  /**
   * Rune upgrades that make the missing runes: empty when no rune is missing, `undefined` when the
   * owned runes and gems cannot make them
   */
  upgradePlan?: RuneUpgradeStep[];
  /** Owned bases the runeword can be made in */
  bases: OwnedRunewordBase[];
}

function parseRawBaseFields(rawItemJson: string): RawBaseFields | undefined {
  try {
    return JSON.parse(rawItemJson) as RawBaseFields;
  } catch {
    return undefined;
  }
}

/** Socket count and item types of an item a runeword can be made in, otherwise undefined. */
function readBaseFields(
  rawItemJson: string,
): Pick<OwnedRunewordBase, 'itemTypes' | 'socketCount'> | undefined {
  const raw = parseRawBaseFields(rawItemJson);
  if (
    !raw ||
    raw.quality === undefined ||
    !BASE_QUALITIES.has(raw.quality) ||
    !raw.total_nr_of_sockets ||
    (raw.nr_of_items_in_sockets ?? 0) > 0 ||
    (raw.socketed_items?.length ?? 0) > 0 ||
    !Array.isArray(raw.categories)
  ) {
    return undefined;
  }

  return {
    itemTypes: raw.categories.filter(
      (category): category is string => typeof category === 'string',
    ),
    socketCount: raw.total_nr_of_sockets,
  };
}

/**
 * Collects the owned items a runeword can be made in: low quality, normal or superior items that
 * have sockets, all of them empty. Items socketed into another item are left out.
 * @param snapshots - Inventory snapshots of the latest save file scan
 * @param vaultItems - Vaulted items
 */
export function collectOwnedRunewordBases(
  snapshots: CharacterInventorySnapshot[],
  vaultItems: VaultItem[],
): OwnedRunewordBase[] {
  const bases: OwnedRunewordBase[] = [];

  for (const snapshot of snapshots) {
    for (const item of snapshot.items) {
      const fields = item.isSocketedItem ? undefined : readBaseFields(item.rawItemJson);
      if (fields) {
        bases.push({
          key: item.fingerprint,
          itemName: item.itemName,
          ...fields,
          ethereal: item.ethereal,
          location: { kind: 'save', item },
        });
      }
    }
  }

  for (const item of vaultItems) {
    const fields = item.isSocketedItem ? undefined : readBaseFields(item.rawItemJson);
    if (fields) {
      bases.push({
        key: `vault:${item.id}`,
        itemName: item.itemName,
        ...fields,
        ethereal: item.ethereal,
        location: { kind: 'vault', item },
      });
    }
  }

  return bases;
}

/**
 * The owned bases a runeword can be made in: one of the runeword's item types and exactly one
 * socket per rune.
 */
export function findRunewordBases(runeword: Item, bases: OwnedRunewordBase[]): OwnedRunewordBase[] {
  const allowedTypes = runewordBaseItemTypes[runeword.id];
  const socketCount = runeword.runes?.length ?? 0;
  if (!allowedTypes || socketCount === 0) {
    return [];
  }

  return bases.filter(
    (base) =>
      base.socketCount === socketCount &&
      base.itemTypes.some((itemType) => allowedTypes.includes(itemType)),
  );
}

/**
 * Counts each gem across the given inventory snapshots by gem code. Stacked gems count with their
 * stack size; gems socketed into another item are used up and not counted.
 */
export function countAvailableGems(
  snapshots: CharacterInventorySnapshot[],
): Record<string, number> {
  const gemCounts: Record<string, number> = {};

  for (const snapshot of snapshots) {
    for (const item of snapshot.items) {
      if (item.isSocketedItem || !item.itemCode || !GEM_CODES.has(item.itemCode)) {
        continue;
      }

      gemCounts[item.itemCode] = (gemCounts[item.itemCode] ?? 0) + (item.stackCount ?? 1);
    }
  }

  return gemCounts;
}

/**
 * Works out the upgrade plan and the owned bases of each runeword. Each runeword is looked at on its
 * own: two runewords may count on the same runes, gems or base.
 * @returns Readiness by runeword id
 */
export function getRunewordReadiness(
  runewords: Item[],
  availableRunes: Record<string, number>,
  availableGems: Record<string, number>,
  ownedBases: OwnedRunewordBase[],
): Record<string, RunewordReadiness> {
  const readinessById: Record<string, RunewordReadiness> = {};
  for (const runeword of runewords) {
    readinessById[runeword.id] = {
      upgradePlan: planRuneUpgrades(runeword.runes ?? [], availableRunes, availableGems),
      bases: findRunewordBases(runeword, ownedBases),
    };
  }
  return readinessById;
}
