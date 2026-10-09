import type * as d2s from '@dschu012/d2s';
import { runesByCode, runewordsByNameSimple } from '../items/indexes';
import type {
  D2Item,
  D2SaveFile,
  D2SItem,
  ParsedInventoryItem,
  StashTabKind,
  VaultLocationContext,
  VaultSourceFileType,
} from '../types/grail';
import { getGrailItemId, resolveRainbowFacetName } from '../utils/grailItemUtils';
import { normalizeIconFilename, resolveCanonicalIconFilename } from '../utils/iconFilenameResolver';
import { isRune, simplifyItemName } from '../utils/objects';
import { resolveSpatialLocation } from '../utils/spatialLocationResolver';

/**
 * Single place that turns raw d2s items into the app's item shapes.
 *
 * Every save file item is normalized once into a `ParsedInventoryItem` (inventory snapshots, vault
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

function getFingerprintFieldValue<K extends keyof ParsedInventoryItem['fingerprintInputs']>(
  item: ParsedInventoryItem,
  key: K,
): ParsedInventoryItem['fingerprintInputs'][K] {
  const itemValue = item[key as keyof ParsedInventoryItem];
  if (itemValue !== undefined) {
    return itemValue as ParsedInventoryItem['fingerprintInputs'][K];
  }

  return item.fingerprintInputs[key];
}

/** Builds the location-dependent fingerprint vault rows are keyed by. */
export function createItemFingerprint(item: ParsedInventoryItem): string {
  const stashTab = getFingerprintFieldValue(item, 'stashTab');
  const gridX = getFingerprintFieldValue(item, 'gridX');
  const gridY = getFingerprintFieldValue(item, 'gridY');
  const gridWidth = getFingerprintFieldValue(item, 'gridWidth');
  const gridHeight = getFingerprintFieldValue(item, 'gridHeight');
  const equippedSlotId = getFingerprintFieldValue(item, 'equippedSlotId');
  const iconFileName = item.fingerprintInputs.iconFileName ?? item.iconFileName ?? '';
  const isSocketedItem = getFingerprintFieldValue(item, 'isSocketedItem') ?? false;
  const itemCode = getFingerprintFieldValue(item, 'itemCode') ?? '';
  const itemName = getFingerprintFieldValue(item, 'itemName');
  const stash = stashTab !== undefined ? String(stashTab) : '';

  return [
    getFingerprintFieldValue(item, 'sourceFileType'),
    getFingerprintFieldValue(item, 'characterName'),
    getFingerprintFieldValue(item, 'locationContext'),
    itemCode,
    getFingerprintFieldValue(item, 'quality'),
    String(getFingerprintFieldValue(item, 'ethereal')),
    String(getFingerprintFieldValue(item, 'socketCount')),
    stash,
    gridX ?? '',
    gridY ?? '',
    gridWidth ?? '',
    gridHeight ?? '',
    equippedSlotId ?? '',
    iconFileName,
    String(isSocketedItem),
    itemName,
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
export function normalizeInventoryItem(params: NormalizeInventoryItemParams): ParsedInventoryItem {
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

  const parsed: ParsedInventoryItem = {
    fingerprint: '',
    fingerprintInputs: {
      sourceFileType: params.sourceFileType,
      characterName: params.saveName,
      locationContext,
      itemCode,
      quality,
      ethereal: !!params.item.ethereal,
      socketCount,
      stashTab,
      gridX: spatialMetadata.gridX,
      gridY: spatialMetadata.gridY,
      gridWidth: spatialMetadata.gridWidth,
      gridHeight: spatialMetadata.gridHeight,
      equippedSlotId: spatialMetadata.equippedSlotId,
      iconFileName: legacyParserIconFileName,
      isSocketedItem: spatialMetadata.isSocketedItem,
      itemName,
    },
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

  parsed.fingerprint = createItemFingerprint(parsed);
  return parsed;
}

/**
 * Normalizes a list of items and, right after each one, the items socketed into it (depth first,
 * as they are stored in the save file). Socketed items carry no stack count of their own.
 */
export function normalizeItemsWithSocketedItems(
  items: D2SItem[],
  params: Omit<NormalizeInventoryItemParams, 'item'>,
): ParsedInventoryItem[] {
  const normalized: ParsedInventoryItem[] = [];

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
 * Name the grail detection matches against grail item ids: the simplified unique or set name,
 * the rune name, or the simplified runeword name. Unlike `getGrailItemId` it does not repair the
 * d2s "Love" runeword name and falls back to the parser's item name.
 */
export function resolveDetectionName(item: D2SItem): string {
  let name = simplifyItemName(item.unique_name || item.set_name || '');

  if (name.includes('rainbowfacet')) {
    name = resolveRainbowFacetName(item, name);
  } else if (item.type && runesByCode[item.type]) {
    name = runesByCode[item.type].name.toLowerCase();
  } else if (item.runeword_name) {
    name = simplifyItemName(item.runeword_name);
  }

  return name || item.name || item.type_name || item.code || 'Unknown Item';
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
export function selectDetectionCandidates(items: ParsedInventoryItem[]): ParsedInventoryItem[] {
  const itemsByRawItem = new Map(items.map((item) => [item.rawParsedItem, item]));
  const groupsByEthereal = [
    new Map<string, ParsedInventoryItem[]>(),
    new Map<string, ParsedInventoryItem[]>(),
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

  const candidates: ParsedInventoryItem[] = [];
  const addWithSocketedItems = (item: ParsedInventoryItem): void => {
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
export function toDetectedItem(item: ParsedInventoryItem, saveFile: D2SaveFile): D2Item {
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
