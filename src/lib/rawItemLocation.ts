import type { ParsedInventoryItem, VaultItem } from 'electron/types/grail';
import { toFiniteNumber } from 'electron/utils/d2rFormat';
import { parseRawItemJson } from 'electron/utils/rawItemJson';

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

interface ParsedRawItem {
  location_id?: unknown;
  alt_position_id?: unknown;
  equipped_id?: unknown;
  position_x?: unknown;
  position_y?: unknown;
  inv_width?: unknown;
  inv_height?: unknown;
}

function parseRawItemLocation(rawItemJson: string): RawItemLocation | undefined {
  const parsed = parseRawItemJson<ParsedRawItem>(rawItemJson);
  if (!parsed) {
    return undefined;
  }

  return {
    locationId: toFiniteNumber(parsed.location_id),
    altPositionId: toFiniteNumber(parsed.alt_position_id),
    equippedId: toFiniteNumber(parsed.equipped_id),
    positionX: toFiniteNumber(parsed.position_x),
    positionY: toFiniteNumber(parsed.position_y),
    width: toFiniteNumber(parsed.inv_width),
    height: toFiniteNumber(parsed.inv_height),
  };
}

export function getRawItemLocation(item: ItemWithRawJson): RawItemLocation | undefined {
  return parseRawItemLocation(item.rawItemJson);
}

export function isRawBeltItem(location: RawItemLocation | undefined): boolean {
  return location?.locationId === 2;
}
