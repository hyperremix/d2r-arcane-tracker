/**
 * Utility functions for detecting and counting stackable items (runes, gems, materials).
 * These work on raw JSON strings as stored in vault_items.raw_item_json.
 */

import { gems } from '../items/gems';
import { materials } from '../items/materials';

const RUNE_CODE_PATTERN = /^r[0-3][0-9]$/i;
const GEM_AND_MATERIAL_CODES = new Set(
  [...gems, ...materials].map((entry) => entry.code.trim().toLowerCase()),
);

type RawItemJson = {
  code?: unknown;
  type?: unknown;
  quantity?: unknown;
  magic_attributes?: Array<{ id?: unknown; values?: unknown[] }>;
};

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

function getAttr381Value(parsed: RawItemJson): number | undefined {
  if (!Array.isArray(parsed.magic_attributes)) {
    return undefined;
  }
  const attr = parsed.magic_attributes.find((a) => a.id === 381);
  if (attr && Array.isArray(attr.values) && typeof attr.values[0] === 'number') {
    return attr.values[0];
  }
  return undefined;
}

export function isStackableFromRawJson(rawItemJson: string, itemCode?: string): boolean {
  // Rune codes match r01–r39
  if (itemCode && RUNE_CODE_PATTERN.test(itemCode)) {
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
        : '';
  if (code && RUNE_CODE_PATTERN.test(code)) {
    return true;
  }

  // Has magic attribute 381 (stack count attribute used by D2R resource stash)
  const attr381 = getAttr381Value(parsed);
  if (attr381 !== undefined && attr381 >= 1) {
    return true;
  }

  // Classic quantity field > 1
  if (
    typeof parsed.quantity === 'number' &&
    Number.isInteger(parsed.quantity) &&
    parsed.quantity > 1
  ) {
    return true;
  }

  return false;
}

/**
 * True for items that live as a counted stack in the vault: runes, gems, materials and anything
 * carrying the D2R resource-stash count attribute. Only these may be merged into one vault row,
 * because only their count can be restored exactly when withdrawing. Natively stackable items
 * (keys, arrows, tomes) keep their own row so a withdrawn item never exceeds the game's per-item
 * stack limit.
 */
export function isResourceStackFromRawJson(rawItemJson: string, itemCode?: string): boolean {
  const isResourceCode = (code: string | undefined): boolean =>
    code !== undefined &&
    (RUNE_CODE_PATTERN.test(code) || GEM_AND_MATERIAL_CODES.has(code.trim().toLowerCase()));

  if (isResourceCode(itemCode)) {
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
  if (isResourceCode(code)) {
    return true;
  }

  const attr381 = getAttr381Value(parsed);
  return attr381 !== undefined && attr381 >= 1;
}

export function resolveStackCountFromRawJson(rawItemJson: string): number {
  const parsed = parseRawItem(rawItemJson);
  if (!parsed) {
    return 1;
  }

  // Attr 381 takes priority (D2R resource stash encoding)
  const attr381 = getAttr381Value(parsed);
  if (attr381 !== undefined && attr381 >= 1) {
    return attr381;
  }

  if (
    typeof parsed.quantity === 'number' &&
    Number.isInteger(parsed.quantity) &&
    parsed.quantity >= 1 &&
    parsed.quantity <= 511
  ) {
    return parsed.quantity;
  }

  return 1;
}
