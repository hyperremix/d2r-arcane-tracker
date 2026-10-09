/**
 * Shared constants and predicates for the D2R save file formats, in particular the modern
 * (v105+) shared stash with its resource tabs for gems, materials and runes.
 */

import { gems } from '../items/gems';
import { materials } from '../items/materials';
import type { VaultSourceFileType } from '../types/grail';

/**
 * Save file types the app reads and writes: the lower-case file extension without its dot.
 * Character saves (.d2s), legacy shared stashes (.sss/.d2x) and D2R shared stashes (.d2i).
 */
export const SAVE_FILE_TYPES: readonly VaultSourceFileType[] = ['d2s', 'sss', 'd2x', 'd2i'];

/** File extensions (lower-case, with the dot) of the save files the app reads and writes. */
export const SAVE_FILE_EXTENSIONS: ReadonlySet<string> = new Set(
  SAVE_FILE_TYPES.map((fileType) => `.${fileType}`),
);

/** Save file type of a file extension (`.D2S` and `d2s` both work), or undefined when unsupported. */
export function saveFileTypeFromExtension(extension: string): VaultSourceFileType | undefined {
  const fileType = extension.toLowerCase().replace(/^\./, '');
  return SAVE_FILE_TYPES.find((supported) => supported === fileType);
}

/** First .d2i version that uses the modern sector layout with resource tabs. */
export const MODERN_STASH_MIN_VERSION = 105;

/** Number of regular (grid) tabs at the start of a modern shared stash. */
export const SHARED_TAB_COUNT = 5;

/** Stash tab index of each resource tab in a modern shared stash. */
export const RESOURCE_STASH_TAB_BY_KIND = {
  gems: 5,
  materials: 6,
  runes: 7,
} as const;

export type ResourceStashTabKind = keyof typeof RESOURCE_STASH_TAB_BY_KIND;

/** Magic attribute id D2R uses for the stack count of resource-stash items (9-bit, no bias). */
export const RESOURCE_STASH_STACK_ATTR_ID = 381;

/** Largest stack count the 9-bit resource-stash quantity field can hold. */
export const MAX_RESOURCE_STACK_COUNT = 511;

/** Rune item codes (`r00`-`r39`, which covers the r01-r33 base game runes); matched case-insensitively. */
const RUNE_CODE_PATTERN = /^r[0-3][0-9]$/i;

const GEM_ITEM_CODES: ReadonlySet<string> = new Set(
  gems.map((gem) => gem.code.trim().toLowerCase()),
);
const MATERIAL_ITEM_CODES: ReadonlySet<string> = new Set(
  materials.map((material) => material.code.trim().toLowerCase()),
);

/** True when a .d2i file of this version uses the modern (v105+) stash layout. */
export function isModernStashVersion(version: number | undefined): boolean {
  return version !== undefined && version >= MODERN_STASH_MIN_VERSION;
}

/** Returns the value when it is a finite number, otherwise undefined. */
export function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Normalizes a raw item code from a save file: trims it and strips NUL padding.
 * Returns undefined for anything that is not a non-empty string. The case is preserved.
 */
export function normalizeItemCode(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().replace(/\0/g, '');
  return normalized.length > 0 ? normalized : undefined;
}

/** Like `normalizeItemCode`, but lower-cased so codes can be compared. */
export function normalizeItemCodeKey(value: unknown): string | undefined {
  return normalizeItemCode(value)?.toLowerCase();
}

/** True for rune item codes (case-insensitive, surrounding padding ignored). */
export function isRuneCode(code: unknown): boolean {
  const normalized = normalizeItemCode(code);
  return normalized !== undefined && RUNE_CODE_PATTERN.test(normalized);
}

/** True for gem item codes from the item catalog (case-insensitive, padding ignored). */
export function isGemCode(code: unknown): boolean {
  const key = normalizeItemCodeKey(code);
  return key !== undefined && GEM_ITEM_CODES.has(key);
}

/** True for crafting material item codes from the item catalog (case-insensitive, padding ignored). */
export function isMaterialCode(code: unknown): boolean {
  const key = normalizeItemCodeKey(code);
  return key !== undefined && MATERIAL_ITEM_CODES.has(key);
}

/** True for item codes that belong on a resource tab: runes, gems and crafting materials. */
export function isResourceItemCode(code: unknown): boolean {
  return isRuneCode(code) || isGemCode(code) || isMaterialCode(code);
}

/** True when the item code belongs on the given resource tab kind. */
export function isResourceCodeOfKind(code: unknown, kind: ResourceStashTabKind): boolean {
  switch (kind) {
    case 'gems':
      return isGemCode(code);
    case 'materials':
      return isMaterialCode(code);
    case 'runes':
      return isRuneCode(code);
  }
}

/** Resolves which resource tab kind a stash tab index is, if any. */
export function resolveResourceStashTabKind(
  stashTab: number | undefined,
): ResourceStashTabKind | undefined {
  for (const [kind, tab] of Object.entries(RESOURCE_STASH_TAB_BY_KIND)) {
    if (tab === stashTab) {
      return kind as ResourceStashTabKind;
    }
  }
  return undefined;
}

/** Minimal item shape needed to read a resource-stash stack count. */
export interface StackCountSource {
  magic_attributes?: unknown;
  quantity?: unknown;
}

/** Reads the value of the resource-stash stack count attribute (381), if the item carries it. */
export function getResourceStackAttributeValue(item: StackCountSource): number | undefined {
  if (!Array.isArray(item.magic_attributes)) {
    return undefined;
  }

  const attributes = item.magic_attributes as Array<{ id?: unknown; values?: unknown } | null>;
  const attribute = attributes.find((candidate) => candidate?.id === RESOURCE_STASH_STACK_ATTR_ID);
  if (attribute && Array.isArray(attribute.values) && typeof attribute.values[0] === 'number') {
    return attribute.values[0];
  }
  return undefined;
}

/**
 * Resolves how many units an item stack holds.
 * The D2R resource-stash attribute 381 is authoritative and wins over the classic `quantity`
 * field, which is only trusted within the 9-bit range. Anything else counts as one item.
 */
export function resolveStackCount(item: StackCountSource): number {
  const attributeCount = getResourceStackAttributeValue(item);
  if (attributeCount !== undefined && attributeCount >= 1) {
    return attributeCount;
  }

  if (
    typeof item.quantity === 'number' &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    item.quantity <= MAX_RESOURCE_STACK_COUNT
  ) {
    return item.quantity;
  }

  return 1;
}
