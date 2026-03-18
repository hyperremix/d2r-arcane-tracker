import { enhanceItems } from '@dschu012/d2s/lib/d2/attribute_enhancer';
import { readItem } from '@dschu012/d2s/lib/d2/items';
import { constants as constants105 } from '@dschu012/d2s/lib/data/versions/105_constant_data';
import type { D2SItem } from '../types/grail';
import { createBoundedBitReader } from './boundedBitReader';
import { type D2iMetadata, readD2iMetadata } from './stashFormat';

// Extend magical_properties to cover D2R resource-stash attribute 381 (stack count).
// Indices 359–380: stubs (sB: 0) assumed never written for resource-sector items.
// Index 381: D2R resource-stash item quantity (9-bit unsigned, no bias).
export const constants105Extended = {
  ...constants105,
  magical_properties: (() => {
    const arr = [
      ...(constants105.magical_properties as Array<{
        s: string;
        sB: number;
        np?: number;
        bias?: number;
      }>),
    ];
    while (arr.length < 381) {
      arr.push({ s: `unknown_${arr.length}`, sB: 0 });
    }
    arr.push({ s: 'item_quantity_r', sB: 9 }); // index 381
    return arr;
  })(),
};

const MODERN_STASH_MIN_VERSION = 105;
export const SHARED_TAB_COUNT = 5;
const STASH_GRID_WIDTH = 10;
const STASH_GRID_HEIGHT = 10;

type ReadonlyConstants = typeof constants105;

const RESOURCE_STASH_TAB_BY_KIND = {
  gems: 5,
  materials: 6,
  runes: 7,
} as const;

export type StashTabKind = 'shared' | 'gems' | 'materials' | 'runes';

export interface ModernStashParsedItem {
  item: D2SItem;
  stashTab: number;
  stashTabKind: StashTabKind;
  stackCount: number;
  sectorIndex: number;
}

export interface ModernStashParseResult {
  version: number;
  hardcore: boolean;
  items: ModernStashParsedItem[];
  metadata: D2iMetadata;
}

interface ParsedSector {
  sectorIndex: number;
  items: D2SItem[];
}

interface PendingResourceItem {
  item: D2SItem;
  stashTabKind: Exclude<StashTabKind, 'shared'>;
  stackCount: number;
  sectorIndex: number;
  decodeIndex: number;
}

interface ItemWithCategories extends D2SItem {
  categories?: string[];
}

function normalizeItemCode(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().replace(/\0/g, '');
  return normalized.length > 0 ? normalized : undefined;
}

function resolveDimension(primary: unknown, fallback: unknown): number | undefined {
  if (typeof primary === 'number' && Number.isFinite(primary) && primary > 0) {
    return primary;
  }

  if (typeof fallback === 'number' && Number.isFinite(fallback) && fallback > 0) {
    return fallback;
  }

  return undefined;
}

function getItemDefinition(
  typeCode: string | undefined,
  constants: ReadonlyConstants,
):
  | {
      c?: string[];
      n?: string;
      iw?: number;
      ih?: number;
      w?: number;
      h?: number;
    }
  | undefined {
  if (!typeCode) {
    return undefined;
  }

  const armorItems = constants.armor_items as Record<
    string,
    { c?: string[]; n?: string; iw?: number; ih?: number; w?: number; h?: number }
  >;
  const weaponItems = constants.weapon_items as Record<
    string,
    { c?: string[]; n?: string; iw?: number; ih?: number; w?: number; h?: number }
  >;
  const otherItems = constants.other_items as Record<
    string,
    { c?: string[]; n?: string; iw?: number; ih?: number; w?: number; h?: number }
  >;

  return armorItems[typeCode] || weaponItems[typeCode] || otherItems[typeCode];
}

function normalizeDimensions(item: D2SItem): D2SItem {
  const extendedItem = item as ItemWithCategories;
  const normalizedCode = normalizeItemCode(item.code ?? item.type);
  if (normalizedCode) {
    item.code = normalizedCode;
    if (!normalizeItemCode(item.type)) {
      item.type = normalizedCode;
    }
  }

  const itemDefinition = getItemDefinition(normalizedCode, constants105);
  if (!extendedItem.categories && Array.isArray(itemDefinition?.c)) {
    extendedItem.categories = itemDefinition.c;
  }
  if (!item.type_name && typeof itemDefinition?.n === 'string') {
    item.type_name = itemDefinition.n;
  }

  const width = resolveDimension(
    item.inv_width,
    resolveDimension(itemDefinition?.iw, itemDefinition?.w),
  );
  const height = resolveDimension(
    item.inv_height,
    resolveDimension(itemDefinition?.ih, itemDefinition?.h),
  );

  item.inv_width = width ?? 1;
  item.inv_height = height ?? 1;
  return item;
}

function isOccupiedModernItem(item: D2SItem): boolean {
  return normalizeItemCode(item.code ?? item.type) !== undefined;
}

function isRuneItem(item: D2SItem): boolean {
  const normalized = normalizeItemCode(item.code ?? item.type);
  return normalized !== undefined && /^r[0-3][0-9]$/i.test(normalized);
}

function hasCategory(categories: unknown, category: string): boolean {
  return Array.isArray(categories) && categories.some((value) => value === category);
}

function isGemItem(item: D2SItem): boolean {
  if (hasCategory((item as ItemWithCategories).categories, 'Gem')) {
    return true;
  }

  const normalized = normalizeItemCode(item.code ?? item.type);
  const details = getItemDefinition(normalized, constants105);
  return hasCategory(details?.c, 'Gem');
}

function resolveResourceKind(item: D2SItem): Exclude<StashTabKind, 'shared'> {
  if (isRuneItem(item)) {
    return 'runes';
  }
  if (isGemItem(item)) {
    return 'gems';
  }
  return 'materials';
}

export function resolveStackCount(item: D2SItem): number {
  // D2R resource stash encodes stack count as magic attribute 381.
  // Check this first — it is authoritative for resource-sector items and
  // must take priority over the classic stackable quantity field.
  const attrs = item.magic_attributes as Array<{ id: number; values: number[] }> | undefined;
  const attr381 = attrs?.find((a) => a.id === 381);
  if (attr381 && typeof attr381.values[0] === 'number' && attr381.values[0] >= 1) {
    return attr381.values[0];
  }

  if (
    typeof item.quantity === 'number' &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    item.quantity <= 511
  ) {
    return item.quantity;
  }

  return 1;
}

export async function readSectorItems(payload: Uint8Array, version: number): Promise<D2SItem[]> {
  if (payload.length < 4) {
    return [];
  }

  const header = Buffer.from(payload.subarray(0, 4));
  if (header.toString('ascii', 0, 2) !== 'JM') {
    return [];
  }

  const expectedCount = header.readUInt16LE(2);
  const reader = createBoundedBitReader(payload, 'readSectorItems');
  // Skip "JM" + count
  reader.ReadString(2);
  reader.ReadUInt16();

  const parsed: D2SItem[] = [];
  const config = {
    extendedStash: false,
    sortProperties: true,
  };

  for (let i = 0; i < expectedCount; i += 1) {
    try {
      const item = (await readItem(
        reader,
        version,
        constants105Extended as unknown as Parameters<typeof readItem>[2],
        config,
      )) as D2SItem;
      parsed.push(item);
    } catch {
      // Shared tabs can contain unsupported/modded properties. Keep items parsed so far
      // instead of dropping the whole sector.
      break;
    }
  }

  const normalizedItems = parsed.map(normalizeDimensions).filter(isOccupiedModernItem);

  if (normalizedItems.length > 0) {
    try {
      // Ensure tooltip-ready fields like displayed_combined_magic_attributes are present.
      await enhanceItems(
        normalizedItems as unknown as Parameters<typeof enhanceItems>[0],
        constants105Extended as unknown as Parameters<typeof enhanceItems>[1],
        1,
        { sortProperties: true },
      );
    } catch {
      // Keep already parsed items even if enhancement fails for unknown/modded stats.
    }
  }

  return normalizedItems;
}

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isResourcePlacementValid(items: PendingResourceItem[]): boolean {
  const occupied = new Set<string>();

  for (const entry of items) {
    const x = toFiniteNumber(entry.item.position_x);
    const y = toFiniteNumber(entry.item.position_y);
    const width = toFiniteNumber(entry.item.inv_width);
    const height = toFiniteNumber(entry.item.inv_height);

    if (
      x === undefined ||
      y === undefined ||
      width === undefined ||
      height === undefined ||
      x < 0 ||
      y < 0 ||
      width <= 0 ||
      height <= 0 ||
      x + width > STASH_GRID_WIDTH ||
      y + height > STASH_GRID_HEIGHT
    ) {
      return false;
    }

    for (let dx = 0; dx < width; dx += 1) {
      for (let dy = 0; dy < height; dy += 1) {
        const key = `${x + dx},${y + dy}`;
        if (occupied.has(key)) {
          return false;
        }
        occupied.add(key);
      }
    }
  }

  return true;
}

function applyDeterministicResourcePlacement(items: PendingResourceItem[]): void {
  const ordered = items.slice().sort((left, right) => {
    const leftCode = normalizeItemCode(left.item.code ?? left.item.type) ?? '';
    const rightCode = normalizeItemCode(right.item.code ?? right.item.type) ?? '';

    const codeCompare = leftCode.localeCompare(rightCode);
    if (codeCompare !== 0) {
      return codeCompare;
    }

    const sectorCompare = left.sectorIndex - right.sectorIndex;
    if (sectorCompare !== 0) {
      return sectorCompare;
    }

    return left.decodeIndex - right.decodeIndex;
  });

  ordered.forEach((entry, index) => {
    entry.item.position_x = index % STASH_GRID_WIDTH;
    entry.item.position_y = Math.floor(index / STASH_GRID_WIDTH);
    entry.item.location_id = 0;
    entry.item.alt_position_id = 5;
    entry.item.equipped_id = 0;
    entry.item.inv_width = 1;
    entry.item.inv_height = 1;
  });
}

async function parseJmSectors(buffer: Buffer, metadata: D2iMetadata): Promise<ParsedSector[]> {
  const jmSectors = metadata.sectors
    .map((sector, index) => ({
      sectorIndex: index,
      ...sector,
    }))
    .filter((sector) => sector.payloadSignature === 'JM')
    .sort((left, right) => left.sectorIndex - right.sectorIndex);

  const parsedSectors: ParsedSector[] = [];

  for (const sector of jmSectors) {
    const payload = buffer.subarray(
      sector.payloadOffset,
      sector.payloadOffset + sector.payloadSize,
    );
    try {
      const items = await readSectorItems(payload, metadata.version);
      parsedSectors.push({ sectorIndex: sector.sectorIndex, items });
    } catch {
      // If a sector fails to parse (e.g. items with stats not in constants105),
      // emit empty items for this sector rather than aborting all sectors.
      // Resource stash sectors (runes/gems/materials) contain only simple items
      // and will succeed; shared stash sectors with complex modded items may fail.
      parsedSectors.push({ sectorIndex: sector.sectorIndex, items: [] });
    }
  }

  return parsedSectors;
}

function buildSharedItems(parsedSectors: ParsedSector[]): ModernStashParsedItem[] {
  const sharedSectors = parsedSectors.slice(0, SHARED_TAB_COUNT);
  const result: ModernStashParsedItem[] = [];

  sharedSectors.forEach((sector, sharedIndex) => {
    sector.items.forEach((item) => {
      result.push({
        item,
        stashTab: sharedIndex,
        stashTabKind: 'shared',
        stackCount: 1,
        sectorIndex: sector.sectorIndex,
      });
    });
  });

  return result;
}

function buildResourceItems(parsedSectors: ParsedSector[]): ModernStashParsedItem[] {
  const resourceSectors = parsedSectors.slice(SHARED_TAB_COUNT);
  const groupedByKind: Record<Exclude<StashTabKind, 'shared'>, PendingResourceItem[]> = {
    gems: [],
    materials: [],
    runes: [],
  };

  resourceSectors.forEach((sector) => {
    sector.items.forEach((item, decodeIndex) => {
      const stashTabKind = resolveResourceKind(item);
      groupedByKind[stashTabKind].push({
        item,
        stashTabKind,
        stackCount: resolveStackCount(item),
        sectorIndex: sector.sectorIndex,
        decodeIndex,
      });
    });
  });

  for (const stashTabKind of Object.keys(groupedByKind) as Exclude<StashTabKind, 'shared'>[]) {
    const items = groupedByKind[stashTabKind];
    if (items.length === 0) {
      continue;
    }

    if (!isResourcePlacementValid(items)) {
      applyDeterministicResourcePlacement(items);
    }
  }

  const result: ModernStashParsedItem[] = [];
  for (const stashTabKind of Object.keys(groupedByKind) as Exclude<StashTabKind, 'shared'>[]) {
    const stashTab = RESOURCE_STASH_TAB_BY_KIND[stashTabKind];
    const entries = groupedByKind[stashTabKind]
      .slice()
      .sort(
        (left, right) =>
          left.sectorIndex - right.sectorIndex || left.decodeIndex - right.decodeIndex,
      );

    entries.forEach((entry) => {
      result.push({
        item: entry.item,
        stashTab,
        stashTabKind,
        stackCount: entry.stackCount,
        sectorIndex: entry.sectorIndex,
      });
    });
  }

  return result;
}

export async function parseModernStash(buffer: Buffer): Promise<ModernStashParseResult> {
  const metadata = readD2iMetadata(buffer);

  if (metadata.version < MODERN_STASH_MIN_VERSION) {
    throw new Error(
      `parseModernStash requires modern stash version >= ${MODERN_STASH_MIN_VERSION}, got ${metadata.version}`,
    );
  }

  const parsedSectors = await parseJmSectors(buffer, metadata);
  const items = [...buildSharedItems(parsedSectors), ...buildResourceItems(parsedSectors)];

  return {
    version: metadata.version,
    hardcore: metadata.hardcore,
    items,
    metadata,
  };
}
