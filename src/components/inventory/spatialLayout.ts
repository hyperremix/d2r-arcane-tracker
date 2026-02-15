import type { VaultLocationContext } from 'electron/types/grail';

export interface GridSize {
  columns: number;
  rows: number;
}

export interface SpatialItemLike {
  locationContext: VaultLocationContext;
  stashTab?: number;
  gridX?: number;
  gridY?: number;
  gridWidth?: number;
  gridHeight?: number;
  equippedSlotId?: number;
}

export const DEFAULT_INVENTORY_GRID_SIZE: GridSize = {
  // Canonical D2 inventory footprint: 4 rows x 10 columns.
  columns: 10,
  rows: 4,
};

export const DEFAULT_STASH_GRID_SIZE: GridSize = {
  columns: 10,
  rows: 10,
};

export const DEFAULT_BELT_GRID_SIZE: GridSize = {
  columns: 4,
  rows: 4,
};

export const EQUIPPED_BOARD_SIZE: GridSize = {
  columns: 14,
  rows: 10,
};

export const EQUIPPED_SLOT_IDS = {
  head: 1,
  amulet: 2,
  armor: 3,
  rightHand: 4,
  leftHand: 5,
  rightRing: 6,
  leftRing: 7,
  belt: 8,
  boots: 9,
  gloves: 10,
  switchRight: 11,
  switchLeft: 12,
  altRight: 13,
  altLeft: 14,
} as const;

export type EquippedSlotKey = keyof typeof EQUIPPED_SLOT_IDS;

export type PaperDollSlotKey =
  | 'head'
  | 'amulet'
  | 'armor'
  | 'rightHand'
  | 'leftHand'
  | 'rightRing'
  | 'leftRing'
  | 'belt'
  | 'boots'
  | 'gloves';

export type EquippedWeaponSet = 'i' | 'ii';

export const EQUIPPED_WEAPON_SET_ORDER: EquippedWeaponSet[] = ['i', 'ii'];

export interface EquippedSlotLayout {
  column: number;
  row: number;
  width: number;
  height: number;
}

const PAPER_DOLL_SLOT_BY_ID: Record<number, PaperDollSlotKey> = {
  1: 'head',
  2: 'amulet',
  3: 'armor',
  4: 'rightHand',
  5: 'leftHand',
  6: 'rightRing',
  7: 'leftRing',
  8: 'belt',
  9: 'boots',
  10: 'gloves',
  11: 'rightHand',
  12: 'leftHand',
  13: 'rightHand',
  14: 'leftHand',
};

export const PAPER_DOLL_SLOT_ORDER: PaperDollSlotKey[] = [
  'head',
  'amulet',
  'leftHand',
  'armor',
  'rightHand',
  'leftRing',
  'belt',
  'rightRing',
  'gloves',
  'boots',
];

export const EQUIPPED_SLOT_LAYOUT: Record<PaperDollSlotKey, EquippedSlotLayout> = {
  head: { column: 7, row: 1, width: 2, height: 2 },
  amulet: { column: 9, row: 2, width: 1, height: 1 },
  armor: { column: 7, row: 3, width: 2, height: 3 },
  rightHand: { column: 13, row: 1, width: 2, height: 4 },
  leftHand: { column: 1, row: 1, width: 2, height: 4 },
  rightRing: { column: 9, row: 8, width: 1, height: 1 },
  leftRing: { column: 6, row: 8, width: 1, height: 1 },
  belt: { column: 7, row: 8, width: 2, height: 1 },
  boots: { column: 11, row: 9, width: 2, height: 2 },
  gloves: { column: 3, row: 9, width: 2, height: 2 },
};

export interface GroupedSpatialItems<T extends SpatialItemLike> {
  equipped: T[];
  inventory: T[];
  mercenary: T[];
  corpse: T[];
  stashByTab: Map<number, T[]>;
  unknown: T[];
}

export type UnplacedReason = 'missingPosition' | 'missingDimensions' | 'outOfBounds' | 'overlap';

export interface UnplacedBoardItem<T extends SpatialItemLike> {
  item: T;
  reason: UnplacedReason;
}

export interface BoardItemClassification<T extends SpatialItemLike> {
  placed: T[];
  unplaced: UnplacedBoardItem<T>[];
}

export interface GridOrigin {
  x: number;
  y: number;
}

export interface OverflowBoardLayout<T extends SpatialItemLike, TKey extends string | number> {
  items: T[];
  itemKeys: Set<TKey>;
  gridSize?: GridSize;
  origin?: GridOrigin;
}

export interface EquippedSlotMapping<T extends SpatialItemLike> {
  slotItems: Map<PaperDollSlotKey, T>;
  unplaced: T[];
}

export function resolveEquippedSlotKey(slotId: number | undefined): EquippedSlotKey | undefined {
  if (slotId === undefined) {
    return undefined;
  }

  const entry = Object.entries(EQUIPPED_SLOT_IDS).find(([, value]) => value === slotId);
  return entry?.[0] as EquippedSlotKey | undefined;
}

export function resolvePaperDollSlotKey(slotId: number | undefined): PaperDollSlotKey | undefined {
  if (slotId === undefined) {
    return undefined;
  }

  return PAPER_DOLL_SLOT_BY_ID[slotId];
}

export function getGridWidth(item: SpatialItemLike): number {
  return Math.max(1, item.gridWidth ?? 1);
}

export function getGridHeight(item: SpatialItemLike): number {
  return Math.max(1, item.gridHeight ?? 1);
}

function hasGridDimensions(item: SpatialItemLike): boolean {
  return (
    typeof item.gridWidth === 'number' &&
    typeof item.gridHeight === 'number' &&
    item.gridWidth > 0 &&
    item.gridHeight > 0
  );
}

export function hasGridPosition(item: SpatialItemLike): boolean {
  return typeof item.gridX === 'number' && typeof item.gridY === 'number';
}

export function createBoardCellIndexes(gridSize: GridSize): number[] {
  return Array.from({ length: gridSize.columns * gridSize.rows }, (_, index) => index);
}

export function isWithinBounds(item: SpatialItemLike, gridSize: GridSize): boolean {
  if (!hasGridPosition(item) || !hasGridDimensions(item)) {
    return false;
  }

  const x = item.gridX as number;
  const y = item.gridY as number;
  const width = item.gridWidth as number;
  const height = item.gridHeight as number;

  if (x < 0 || y < 0) {
    return false;
  }

  return x + width <= gridSize.columns && y + height <= gridSize.rows;
}

export function classifyBoardItems<T extends SpatialItemLike>(
  items: T[],
  gridSize: GridSize,
): BoardItemClassification<T> {
  const orderedItems = sortByGridPosition(items);
  const placed: T[] = [];
  const unplaced: UnplacedBoardItem<T>[] = [];
  const occupiedCells = new Set<string>();

  for (const item of orderedItems) {
    if (!hasGridPosition(item)) {
      unplaced.push({ item, reason: 'missingPosition' });
      continue;
    }

    if (!hasGridDimensions(item)) {
      unplaced.push({ item, reason: 'missingDimensions' });
      continue;
    }

    if (!isWithinBounds(item, gridSize)) {
      unplaced.push({ item, reason: 'outOfBounds' });
      continue;
    }

    if (hasOccupiedCellOverlap(item, occupiedCells)) {
      unplaced.push({ item, reason: 'overlap' });
      continue;
    }

    occupyItemCells(item, occupiedCells);
    placed.push(item);
  }

  return {
    placed,
    unplaced,
  };
}

export function buildOverflowBoardLayout<T extends SpatialItemLike, TKey extends string | number>(
  unplacedItems: UnplacedBoardItem<T>[],
  keySelector: (item: T) => TKey,
): OverflowBoardLayout<T, TKey> {
  const items = unplacedItems
    .filter(
      ({ item, reason }) =>
        reason === 'outOfBounds' &&
        typeof item.gridX === 'number' &&
        item.gridX >= 0 &&
        typeof item.gridY === 'number' &&
        item.gridY >= 0 &&
        typeof item.gridWidth === 'number' &&
        item.gridWidth > 0 &&
        typeof item.gridHeight === 'number' &&
        item.gridHeight > 0,
    )
    .map(({ item }) => item);
  const itemKeys = new Set(items.map((item) => keySelector(item)));

  if (items.length === 0) {
    return { items, itemKeys, gridSize: undefined, origin: undefined };
  }

  const minX = items.reduce(
    (min, item) => Math.min(min, item.gridX as number),
    Number.MAX_SAFE_INTEGER,
  );
  const minY = items.reduce(
    (min, item) => Math.min(min, item.gridY as number),
    Number.MAX_SAFE_INTEGER,
  );
  const maxX = items.reduce(
    (max, item) => Math.max(max, (item.gridX as number) + getGridWidth(item)),
    0,
  );
  const maxY = items.reduce(
    (max, item) => Math.max(max, (item.gridY as number) + getGridHeight(item)),
    0,
  );

  return {
    items,
    itemKeys,
    gridSize: {
      columns: Math.max(1, maxX - minX),
      rows: Math.max(1, maxY - minY),
    },
    origin: {
      x: minX,
      y: minY,
    },
  };
}

function createCellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function hasOccupiedCellOverlap(item: SpatialItemLike, occupiedCells: Set<string>): boolean {
  const gridX = item.gridX as number;
  const gridY = item.gridY as number;
  const width = getGridWidth(item);
  const height = getGridHeight(item);

  for (let x = gridX; x < gridX + width; x += 1) {
    for (let y = gridY; y < gridY + height; y += 1) {
      if (occupiedCells.has(createCellKey(x, y))) {
        return true;
      }
    }
  }

  return false;
}

function occupyItemCells(item: SpatialItemLike, occupiedCells: Set<string>): void {
  const gridX = item.gridX as number;
  const gridY = item.gridY as number;
  const width = getGridWidth(item);
  const height = getGridHeight(item);

  for (let x = gridX; x < gridX + width; x += 1) {
    for (let y = gridY; y < gridY + height; y += 1) {
      occupiedCells.add(createCellKey(x, y));
    }
  }
}

export function getUnplacedGridItems<T extends SpatialItemLike>(items: T[]): T[] {
  return items.filter((item) => !hasGridPosition(item));
}

function resolveStaticPaperDollSlotKey(slotId: number): PaperDollSlotKey | undefined {
  if ((slotId >= 1 && slotId <= 3) || (slotId >= 6 && slotId <= 10)) {
    return resolvePaperDollSlotKey(slotId);
  }

  return undefined;
}

function resolveWeaponSetSlotKey(
  slotId: number,
  weaponSet: EquippedWeaponSet,
  hasSetIIRight: boolean,
  hasSetIILeft: boolean,
): PaperDollSlotKey | undefined {
  if (weaponSet === 'i') {
    if (slotId === 4 || slotId === 5) {
      return resolvePaperDollSlotKey(slotId);
    }

    return undefined;
  }

  if (slotId === 11 || slotId === 12) {
    return resolvePaperDollSlotKey(slotId);
  }

  if (slotId === 13 && !hasSetIIRight) {
    return 'rightHand';
  }

  if (slotId === 14 && !hasSetIILeft) {
    return 'leftHand';
  }

  return undefined;
}

function resolvePaperDollSlotForSet(
  slotId: number,
  weaponSet: EquippedWeaponSet,
  hasSetIIRight: boolean,
  hasSetIILeft: boolean,
): PaperDollSlotKey | undefined {
  return (
    resolveStaticPaperDollSlotKey(slotId) ??
    resolveWeaponSetSlotKey(slotId, weaponSet, hasSetIIRight, hasSetIILeft)
  );
}

export function buildEquippedSlotMapForSet<T extends SpatialItemLike>(
  items: T[],
  weaponSet: EquippedWeaponSet,
): EquippedSlotMapping<T> {
  const slotItems = new Map<PaperDollSlotKey, T>();
  const unplaced: T[] = [];
  const hasSetIIRight = items.some((item) => item.equippedSlotId === 11);
  const hasSetIILeft = items.some((item) => item.equippedSlotId === 12);

  for (const item of items) {
    const slotId = item.equippedSlotId;
    if (slotId === undefined) {
      unplaced.push(item);
      continue;
    }

    const slotKey = resolvePaperDollSlotForSet(slotId, weaponSet, hasSetIIRight, hasSetIILeft);

    if (!slotKey || slotItems.has(slotKey)) {
      unplaced.push(item);
      continue;
    }

    slotItems.set(slotKey, item);
  }

  return {
    slotItems,
    unplaced,
  };
}

export function groupSpatialItems<T extends SpatialItemLike>(items: T[]): GroupedSpatialItems<T> {
  const grouped: GroupedSpatialItems<T> = {
    equipped: [],
    inventory: [],
    mercenary: [],
    corpse: [],
    stashByTab: new Map<number, T[]>(),
    unknown: [],
  };

  for (const item of items) {
    switch (item.locationContext) {
      case 'equipped': {
        grouped.equipped.push(item);
        break;
      }
      case 'inventory': {
        grouped.inventory.push(item);
        break;
      }
      case 'mercenary': {
        grouped.mercenary.push(item);
        break;
      }
      case 'corpse': {
        grouped.corpse.push(item);
        break;
      }
      case 'stash': {
        const stashTab = item.stashTab ?? 0;
        const existing = grouped.stashByTab.get(stashTab) ?? [];
        existing.push(item);
        grouped.stashByTab.set(stashTab, existing);
        break;
      }
      default: {
        grouped.unknown.push(item);
        break;
      }
    }
  }

  return grouped;
}

export function sortByGridPosition<T extends SpatialItemLike>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ay = a.gridY ?? Number.MAX_SAFE_INTEGER;
    const by = b.gridY ?? Number.MAX_SAFE_INTEGER;

    if (ay !== by) {
      return ay - by;
    }

    const ax = a.gridX ?? Number.MAX_SAFE_INTEGER;
    const bx = b.gridX ?? Number.MAX_SAFE_INTEGER;

    return ax - bx;
  });
}

export function getSortedStashTabs<T extends SpatialItemLike>(
  stashByTab: Map<number, T[]>,
): Array<{ stashTab: number; items: T[] }> {
  return [...stashByTab.entries()]
    .sort(([left], [right]) => left - right)
    .map(([stashTab, items]) => ({ stashTab, items: sortByGridPosition(items) }));
}
