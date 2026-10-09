import type * as d2s from '@dschu012/d2s';
import { runewordsByNameSimple } from '../items/indexes';
import type {
  D2Item,
  D2SaveFile,
  D2SItem,
  ParsedInventoryItem,
  ParsedInventoryItemWithRaw,
  StashTabKind,
  VaultLocationContext,
  VaultSourceFileType,
} from '../types/grail';
import { getGrailItemId } from '../utils/grailItemUtils';
import { normalizeIconFilename, resolveCanonicalIconFilename } from '../utils/iconFilenameResolver';
import { isRune, simplifyItemName } from '../utils/objects';
import { resolveSpatialLocation } from '../utils/spatialLocationResolver';

/**
 * Single place that turns raw d2s items into the app's item shapes.
 *
 * Every save file item is normalized once into a `ParsedInventoryItemWithRaw` (inventory snapshots, vault
 * reconciliation, rune counts) and the grail detection reads its `D2Item` view from that result
 * instead of converting the raw d2s item again.
 */

export type ItemQuality = D2Item['quality'];

/** Maps the numeric d2s quality to its name. Unknown and missing values count as normal. */
export function mapItemQuality(quality: number | undefined): ItemQuality {
  switch (quality) {
    case 2:
      return 'magic';
    case 3:
      return 'rare';
    case 4:
      return 'set';
    case 5:
      return 'unique';
    case 6:
      return 'crafted';
    default:
      return 'normal';
  }
}

/** Counts the sockets of an item from the most specific field d2s provides. */
export function resolveSocketCount(item: D2SItem): number {
  if (Array.isArray(item.gems)) {
    return item.gems.length;
  }

  if (typeof item.socket_count === 'number') {
    return item.socket_count;
  }

  return typeof item.socketed === 'number' ? item.socketed : 0;
}

/**
 * Name that identifies an item for grail purposes: its grail item id, otherwise its simplified
 * unique or set name. Empty for items that are neither (regular, magic and rare items).
 */
export function resolveGrailLookupName(item: D2SItem): string {
  const itemId = getGrailItemId(item);
  if (itemId) {
    return itemId;
  }

  return simplifyItemName(item.unique_name || item.set_name || '');
}

/** Returns the runeword name when it is a known runeword, fixing the d2s "Love" -> "Lore" bug. */
function getValidatedRunewordName(item: D2SItem): string | undefined {
  if (!item.runeword_name) {
    return undefined;
  }

  const normalized = item.runeword_name === 'Love' ? 'Lore' : item.runeword_name;
  if (!runewordsByNameSimple[simplifyItemName(normalized)]) {
    return undefined;
  }

  return normalized;
}

function toDisplayString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/\0/g, '').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveFallbackItemName(item: D2SItem): string {
  const candidates = [
    item.name,
    item.unique_name,
    item.set_name,
    item.type_name,
    item.type,
    item.code,
    'unknown',
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return 'unknown';
}

function resolveMagicOrRareDisplayName(item: D2SItem): string | undefined {
  const rareParts = [toDisplayString(item.rare_name), toDisplayString(item.rare_name2)].filter(
    (part): part is string => Boolean(part),
  );
  if (rareParts.length > 0) {
    return rareParts.join(' ');
  }

  const prefix = toDisplayString(item.magic_prefix_name);
  const suffix = toDisplayString(item.magic_suffix_name);
  if (!prefix && !suffix) {
    return undefined;
  }

  const baseName =
    toDisplayString(item.type_name) ??
    toDisplayString(item.name) ??
    toDisplayString(item.type) ??
    toDisplayString(item.code);

  return [prefix, baseName, suffix].filter((part): part is string => Boolean(part)).join(' ');
}

/** Display name of a parsed item: runeword, unique, set, magic/rare name, then a fallback. */
export function resolveParsedItemName(item: D2SItem, runewordName: string | undefined): string {
  const candidates = [
    toDisplayString(runewordName),
    toDisplayString(item.unique_name),
    toDisplayString(item.set_name),
    resolveMagicOrRareDisplayName(item),
    toDisplayString(resolveFallbackItemName(item)),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return 'unknown';
}

function resolveParsedItemType(
  item: D2SItem,
  quality: string,
  runewordName: string | undefined,
): string {
  if (runewordName) {
    return 'runeword';
  }

  if (isRune(item)) {
    return 'rune';
  }

  if (quality === 'unique' || quality === 'set') {
    return quality;
  }

  return item.type ?? 'other';
}

/** Item fields the fingerprint is built from. */
export type ItemFingerprintFields = Pick<
  ParsedInventoryItem,
  | 'sourceFileType'
  | 'characterName'
  | 'locationContext'
  | 'itemCode'
  | 'quality'
  | 'ethereal'
  | 'socketCount'
  | 'stashTab'
  | 'gridX'
  | 'gridY'
  | 'gridWidth'
  | 'gridHeight'
  | 'equippedSlotId'
  | 'iconFileName'
  | 'isSocketedItem'
  | 'itemName'
>;

/**
 * Builds the location-dependent fingerprint vault rows are keyed by.
 * @param item - The normalized item
 * @param fingerprintIconFileName - Icon name to use instead of `item.iconFileName`. Fingerprints
 *   have always used the icon name the d2s parser reports, which can differ from the resolved
 *   icon the UI shows; changing it would orphan existing vault rows.
 */
export function createItemFingerprint(
  item: ItemFingerprintFields,
  fingerprintIconFileName?: string,
): string {
  const iconFileName = fingerprintIconFileName ?? item.iconFileName ?? '';
  const stash = item.stashTab !== undefined ? String(item.stashTab) : '';

  return [
    item.sourceFileType,
    item.characterName,
    item.locationContext,
    item.itemCode ?? '',
    item.quality,
    String(item.ethereal),
    String(item.socketCount),
    stash,
    item.gridX ?? '',
    item.gridY ?? '',
    item.gridWidth ?? '',
    item.gridHeight ?? '',
    item.equippedSlotId ?? '',
    iconFileName,
    String(item.isSocketedItem ?? false),
    item.itemName,
  ].join('|');
}

export interface NormalizeInventoryItemParams {
  filePath: string;
  saveName: string;
  sourceFileType: VaultSourceFileType;
  item: D2SItem;
  fallbackLocation: VaultLocationContext;
  stashTab?: number;
  stashTabKind?: StashTabKind;
  stackCount?: number;
  isSocketedItem?: boolean;
}

/** Converts one raw d2s item of a save file into the app's inventory item. */
export function normalizeInventoryItem(
  params: NormalizeInventoryItemParams,
): ParsedInventoryItemWithRaw {
  const resolvedSpatialLocation = resolveSpatialLocation({
    item: params.item,
    sourceFileType: params.sourceFileType,
    fallbackLocation: params.fallbackLocation,
    fallbackStashTab: params.stashTab,
  });
  const locationContext = resolvedSpatialLocation.locationContext;
  const stashTab = resolvedSpatialLocation.stashTab;
  const quality = mapItemQuality(params.item.quality);
  const runewordName = getValidatedRunewordName(params.item);
  const isSocketedItem = params.isSocketedItem ?? false;
  const itemName = resolveParsedItemName(params.item, runewordName);
  const socketCount = resolveSocketCount(params.item);
  const parsedType = resolveParsedItemType(params.item, quality, runewordName);
  const grailItemId = getGrailItemId(params.item) ?? undefined;
  const itemCode = params.item.code ?? params.item.type ?? undefined;
  const legacyParserIconFileName = normalizeIconFilename(params.item.inv_file);
  const resolvedIconFileName = resolveCanonicalIconFilename({
    grailItemId,
    itemCode: params.item.code ?? params.item.type,
    itemName,
    uniqueName: params.item.unique_name,
    setName: params.item.set_name,
    parsedName: params.item.name,
    typeName: params.item.type_name,
    rawIconFileName: params.item.inv_file,
  });
  const spatialMetadata = {
    gridX: resolvedSpatialLocation.gridX,
    gridY: resolvedSpatialLocation.gridY,
    gridWidth: resolvedSpatialLocation.gridWidth,
    gridHeight: resolvedSpatialLocation.gridHeight,
    equippedSlotId: resolvedSpatialLocation.equippedSlotId,
    iconFileName: resolvedIconFileName ?? legacyParserIconFileName,
    isSocketedItem,
  };

  const parsed: ParsedInventoryItemWithRaw = {
    fingerprint: '',
    characterName: params.saveName,
    sourceFileType: params.sourceFileType,
    sourceFilePath: params.filePath,
    locationContext,
    stashTab,
    stashTabKind: params.stashTabKind,
    ...spatialMetadata,
    itemName,
    itemCode,
    quality,
    type: parsedType,
    ethereal: !!params.item.ethereal,
    socketCount,
    stackCount: params.stackCount,
    grailItemId,
    rawItemJson: JSON.stringify(params.item),
    rawParsedItem: params.item as d2s.types.IItem,
    seenAt: new Date(),
  };

  parsed.fingerprint = createItemFingerprint(parsed, legacyParserIconFileName);
  return parsed;
}

/**
 * Normalizes a list of items and, right after each one, the items socketed into it (depth first,
 * as they are stored in the save file). Socketed items carry no stack count of their own.
 */
export function normalizeItemsWithSocketedItems(
  items: D2SItem[],
  params: Omit<NormalizeInventoryItemParams, 'item'>,
): ParsedInventoryItemWithRaw[] {
  const normalized: ParsedInventoryItemWithRaw[] = [];

  for (const item of items) {
    normalized.push(normalizeInventoryItem({ ...params, item }));

    if (item.socketed_items?.length) {
      normalized.push(
        ...normalizeItemsWithSocketedItems(item.socketed_items, {
          ...params,
          stackCount: undefined,
          isSocketedItem: true,
        }),
      );
    }
  }

  return normalized;
}

/**
 * Name of the grail detection view: the grail lookup name the detection matches grail item ids
 * against (so a d2s "Love" runeword is named "lore"), otherwise the parser's item name.
 */
function resolveDetectionName(item: D2SItem): string {
  return resolveGrailLookupName(item) || item.name || item.type_name || item.code || 'Unknown Item';
}

/** Item type as the grail detection reports it: lower-cased d2s type, or "misc". */
function resolveDetectionType(item: D2SItem): string {
  const type = item.type || item.type_name || item.code || '';
  return type.toLowerCase() || 'misc';
}

/**
 * Picks the parsed items of one save file the grail detection looks at, in the order it checks
 * them: items with a grail lookup name (grail items plus other unique and set items), non-ethereal
 * ones before ethereal ones, items sharing a lookup name together in file order. Each picked item
 * is followed by the items socketed into it.
 */
export function selectDetectionCandidates(
  items: ParsedInventoryItemWithRaw[],
): ParsedInventoryItemWithRaw[] {
  const itemsByRawItem = new Map(items.map((item) => [item.rawParsedItem, item]));
  const groupsByEthereal = [
    new Map<string, ParsedInventoryItemWithRaw[]>(),
    new Map<string, ParsedInventoryItemWithRaw[]>(),
  ];

  for (const item of items) {
    const lookupName = resolveGrailLookupName(item.rawParsedItem);
    if (lookupName === '') {
      continue;
    }

    const group = groupsByEthereal[item.ethereal ? 1 : 0];
    const sameName = group.get(lookupName);
    if (sameName) {
      sameName.push(item);
    } else {
      group.set(lookupName, [item]);
    }
  }

  const candidates: ParsedInventoryItemWithRaw[] = [];
  const addWithSocketedItems = (item: ParsedInventoryItemWithRaw): void => {
    candidates.push(item);
    for (const socketedRawItem of item.rawParsedItem.socketed_items ?? []) {
      const socketedItem = itemsByRawItem.get(socketedRawItem);
      if (socketedItem) {
        addWithSocketedItems(socketedItem);
      }
    }
  };

  for (const group of groupsByEthereal) {
    for (const sameName of group.values()) {
      sameName.forEach(addWithSocketedItems);
    }
  }

  return candidates;
}

/** Grail detection view of an already normalized inventory item. */
export function toDetectedItem(item: ParsedInventoryItemWithRaw, saveFile: D2SaveFile): D2Item {
  const rawItem: D2SItem = item.rawParsedItem;

  return {
    id: `${rawItem.id}`,
    name: resolveDetectionName(rawItem),
    type: resolveDetectionType(rawItem),
    quality: mapItemQuality(rawItem.quality),
    location: 'inventory',
    locationContext: 'inventory',
    characterName: saveFile.name,
    characterClass: saveFile.characterClass as D2Item['characterClass'],
    level: rawItem.level || 1,
    ethereal: item.ethereal,
    sockets: item.socketCount,
    timestamp: new Date(),
  };
}
