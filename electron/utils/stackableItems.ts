/**
 * Utility functions for detecting and counting stackable items (runes, gems, materials).
 * These work on raw JSON strings as stored in vault_items.raw_item_json.
 */

import {
  getResourceStackAttributeValue,
  isResourceItemCode,
  resolveStackCount,
  type StackCountSource,
} from './d2rFormat';

interface RawItemJson extends StackCountSource {
  code?: unknown;
  type?: unknown;
}

function parseRawItem(rawItemJson: string): RawItemJson | undefined {
  try {
    const parsed = JSON.parse(rawItemJson);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as RawItemJson;
    }
  } catch {
    // Ignore
  }
  return undefined;
}

/**
 * True for items that live as a counted stack in the vault: runes, gems, materials and anything
 * carrying the D2R resource-stash count attribute. Only these may be merged into one vault row,
 * because only their count can be restored exactly when withdrawing. Natively stackable items
 * (keys, arrows, tomes) keep their own row so a withdrawn item never exceeds the game's per-item
 * stack limit.
 */
export function isResourceStackFromRawJson(rawItemJson: string, itemCode?: string): boolean {
  if (isResourceItemCode(itemCode)) {
    return true;
  }

  const parsed = parseRawItem(rawItemJson);
  if (!parsed) {
    return false;
  }

  const code =
    typeof parsed.code === 'string'
      ? parsed.code
      : typeof parsed.type === 'string'
        ? parsed.type
        : undefined;
  if (isResourceItemCode(code)) {
    return true;
  }

  const stackAttributeValue = getResourceStackAttributeValue(parsed);
  return stackAttributeValue !== undefined && stackAttributeValue >= 1;
}

export function resolveStackCountFromRawJson(rawItemJson: string): number {
  const parsed = parseRawItem(rawItemJson);
  return parsed ? resolveStackCount(parsed) : 1;
}
