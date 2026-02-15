import type { D2SItem, VaultLocationContext, VaultSourceFileType } from '../types/grail';

export interface ResolvedSpatialLocation {
  locationContext: VaultLocationContext;
  stashTab?: number;
  gridX?: number;
  gridY?: number;
  gridWidth?: number;
  gridHeight?: number;
  equippedSlotId?: number;
}

const INVENTORY_COLUMNS = 10;
const INVENTORY_ROWS = 4;
const BELT_COLUMNS = 4;

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function hasPositiveDimensions(width: number | undefined, height: number | undefined): boolean {
  return typeof width === 'number' && width > 0 && typeof height === 'number' && height > 0;
}

function hasPosition(x: number | undefined, y: number | undefined): boolean {
  return typeof x === 'number' && x >= 0 && typeof y === 'number' && y >= 0;
}

export function fitsCanonicalInventoryBounds(params: {
  gridX?: number;
  gridY?: number;
  gridWidth?: number;
  gridHeight?: number;
}): boolean {
  const { gridX, gridY, gridWidth, gridHeight } = params;
  if (!hasPosition(gridX, gridY) || !hasPositiveDimensions(gridWidth, gridHeight)) {
    return false;
  }

  const x = gridX as number;
  const y = gridY as number;
  const width = gridWidth as number;
  const height = gridHeight as number;

  return x + width <= INVENTORY_COLUMNS && y + height <= INVENTORY_ROWS;
}

function inferLegacyLocationContext(
  item: D2SItem,
  fallbackLocation: VaultLocationContext,
): VaultLocationContext {
  if (item.location === 'equipped' || item.equipped) return 'equipped';
  if (item.location === 'stash') return 'stash';
  if (item.location === 'inventory') return 'inventory';
  if (item.location === 'mercenary') return 'mercenary';
  if (item.location === 'corpse') return 'corpse';
  return fallbackLocation;
}

function buildResolvedLocation(
  locationContext: VaultLocationContext,
  spatial: {
    stashTab?: number;
    gridX?: number;
    gridY?: number;
    gridWidth?: number;
    gridHeight?: number;
    equippedSlotId?: number;
  },
): ResolvedSpatialLocation {
  const normalizedSpatial = normalizeInventorySpatial(locationContext, spatial);

  return {
    locationContext,
    stashTab: normalizedSpatial.stashTab,
    gridX: normalizedSpatial.gridX,
    gridY: normalizedSpatial.gridY,
    gridWidth: normalizedSpatial.gridWidth,
    gridHeight: normalizedSpatial.gridHeight,
    equippedSlotId: normalizedSpatial.equippedSlotId,
  };
}

function normalizeInventorySpatial(
  locationContext: VaultLocationContext,
  spatial: {
    stashTab?: number;
    gridX?: number;
    gridY?: number;
    gridWidth?: number;
    gridHeight?: number;
    equippedSlotId?: number;
  },
) {
  if (locationContext !== 'inventory') {
    return spatial;
  }

  if (
    typeof spatial.gridX !== 'number' ||
    typeof spatial.gridY !== 'number' ||
    typeof spatial.gridWidth !== 'number' ||
    typeof spatial.gridHeight !== 'number'
  ) {
    return spatial;
  }

  if (
    fitsCanonicalInventoryBounds({
      gridX: spatial.gridX,
      gridY: spatial.gridY,
      gridWidth: spatial.gridWidth,
      gridHeight: spatial.gridHeight,
    })
  ) {
    return spatial;
  }

  const candidateOffsets = [
    { xOffset: 0, yOffset: -1 },
    { xOffset: -1, yOffset: 0 },
    { xOffset: -1, yOffset: -1 },
  ];

  for (const { xOffset, yOffset } of candidateOffsets) {
    const nextX = spatial.gridX + xOffset;
    const nextY = spatial.gridY + yOffset;

    if (
      fitsCanonicalInventoryBounds({
        gridX: nextX,
        gridY: nextY,
        gridWidth: spatial.gridWidth,
        gridHeight: spatial.gridHeight,
      })
    ) {
      return {
        ...spatial,
        gridX: nextX,
        gridY: nextY,
      };
    }
  }

  return spatial;
}

function resolveBeltLocation(
  positionX: number | undefined,
  equippedSlotId: number | undefined,
): ResolvedSpatialLocation {
  const normalizedBeltX =
    typeof positionX === 'number' && positionX >= 0 ? positionX % BELT_COLUMNS : undefined;
  const normalizedBeltY =
    typeof positionX === 'number' && positionX >= 0
      ? Math.floor(positionX / BELT_COLUMNS)
      : undefined;

  return buildResolvedLocation('unknown', {
    gridX: normalizedBeltX,
    gridY: normalizedBeltY,
    gridWidth: 1,
    gridHeight: 1,
    equippedSlotId,
  });
}

function resolveLocationIdZero(params: {
  altPositionId: number | undefined;
  sourceFileType: VaultSourceFileType;
  fallbackStashTab?: number;
  positionX: number | undefined;
  positionY: number | undefined;
  gridWidth: number | undefined;
  gridHeight: number | undefined;
  equippedSlotId: number | undefined;
}): ResolvedSpatialLocation | undefined {
  const {
    altPositionId,
    sourceFileType,
    fallbackStashTab,
    positionX,
    positionY,
    gridWidth,
    gridHeight,
    equippedSlotId,
  } = params;

  if (altPositionId === 5) {
    return buildResolvedLocation('stash', {
      stashTab: sourceFileType === 'd2s' ? 0 : fallbackStashTab,
      gridX: positionX,
      gridY: positionY,
      gridWidth,
      gridHeight,
      equippedSlotId,
    });
  }

  if (altPositionId !== 1) {
    return undefined;
  }

  if (sourceFileType === 'd2s') {
    return buildResolvedLocation('inventory', {
      gridX: positionX,
      gridY: positionY,
      gridWidth,
      gridHeight,
      equippedSlotId,
    });
  }

  return undefined;
}

export function resolveSpatialLocation(params: {
  item: D2SItem;
  sourceFileType: VaultSourceFileType;
  fallbackLocation: VaultLocationContext;
  fallbackStashTab?: number;
}): ResolvedSpatialLocation {
  const { item, sourceFileType, fallbackLocation, fallbackStashTab } = params;
  const locationId = toFiniteNumber(item.location_id);
  const altPositionId = toFiniteNumber(item.alt_position_id);
  const positionX = toFiniteNumber(item.position_x);
  const positionY = toFiniteNumber(item.position_y);
  const gridWidth = toFiniteNumber(item.inv_width);
  const gridHeight = toFiniteNumber(item.inv_height);
  const equippedSlotId = toFiniteNumber(item.equipped_id);
  const spatial = {
    gridX: positionX,
    gridY: positionY,
    gridWidth,
    gridHeight,
    equippedSlotId,
  };

  if (locationId === 1) {
    return buildResolvedLocation('equipped', spatial);
  }

  if (locationId === 2) {
    return resolveBeltLocation(positionX, equippedSlotId);
  }

  if (locationId === 0) {
    const resolvedLocationIdZero = resolveLocationIdZero({
      altPositionId,
      sourceFileType,
      fallbackStashTab,
      positionX,
      positionY,
      gridWidth,
      gridHeight,
      equippedSlotId,
    });
    if (resolvedLocationIdZero) {
      return resolvedLocationIdZero;
    }
  }

  const inferredLocation = inferLegacyLocationContext(item, fallbackLocation);

  return buildResolvedLocation(inferredLocation, {
    stashTab: inferredLocation === 'stash' ? fallbackStashTab : undefined,
    ...spatial,
  });
}
