import type { ParsedInventoryItem, VaultItem } from 'electron/types/grail';

export interface RawItemLocation {
  locationId?: number;
  altPositionId?: number;
  equippedId?: number;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
}

type ItemWithRawJson = Pick<ParsedInventoryItem | VaultItem, 'rawItemJson'>;

type ParsedRawItem = {
  location_id?: unknown;
  alt_position_id?: unknown;
  equipped_id?: unknown;
  position_x?: unknown;
  position_y?: unknown;
  inv_width?: unknown;
  inv_height?: unknown;
};

function toOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function parseRawItemLocation(rawItemJson: string): RawItemLocation | undefined {
  try {
    const parsed = JSON.parse(rawItemJson) as ParsedRawItem;
    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }

    return {
      locationId: toOptionalNumber(parsed.location_id),
      altPositionId: toOptionalNumber(parsed.alt_position_id),
      equippedId: toOptionalNumber(parsed.equipped_id),
      positionX: toOptionalNumber(parsed.position_x),
      positionY: toOptionalNumber(parsed.position_y),
      width: toOptionalNumber(parsed.inv_width),
      height: toOptionalNumber(parsed.inv_height),
    };
  } catch {
    return undefined;
  }
}

export function getRawItemLocation(item: ItemWithRawJson): RawItemLocation | undefined {
  return parseRawItemLocation(item.rawItemJson);
}

export function isRawBeltItem(location: RawItemLocation | undefined): boolean {
  return location?.locationId === 2;
}
