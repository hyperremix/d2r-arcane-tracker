import type { Item, ParsedInventoryItem, VaultItem } from 'electron/types/grail';
import { normalizeItemCodeKey } from 'electron/utils/d2rFormat';
import { normalizeIconFilename, toSnakeCaseIconFilename } from 'electron/utils/iconFilename';
import { simplifyItemName } from 'electron/utils/objects';
import { parseRawItemJson } from 'electron/utils/rawItemJson';

type SpatialIconItemLike = Pick<
  ParsedInventoryItem | VaultItem,
  'iconFileName' | 'grailItemId' | 'itemCode' | 'itemName' | 'rawItemJson'
>;

interface RawItemShape {
  inv_file?: unknown;
  unique_name?: unknown;
  set_name?: unknown;
  type_name?: unknown;
  name?: unknown;
  code?: unknown;
  type?: unknown;
}

export interface SpriteIconLookupIndex {
  byItemId: Map<string, string>;
  byCode: Map<string, string>;
  byName: Map<string, string>;
}

const ambiguousCharmCodeKeys = new Set(['cm1', 'cm2']);

function addCandidate(candidates: Set<string>, value: unknown): void {
  if (typeof value !== 'string') {
    return;
  }

  const trimmed = value.trim();
  if (trimmed) {
    candidates.add(trimmed);
  }
}

function addParserInvFileCandidates(candidates: Set<string>, value: unknown): void {
  if (typeof value === 'string') {
    addCandidate(candidates, value);
  }

  addCandidate(candidates, normalizeIconFilename(value));
}

function addLookupCandidate(
  candidates: Set<string>,
  lookupMap: Map<string, string>,
  value: unknown,
): void {
  if (typeof value !== 'string') {
    return;
  }

  const key = simplifyItemName(value);
  if (!key) {
    return;
  }

  addCandidate(candidates, lookupMap.get(key));
}

function hasLookupNameMatch(lookup: SpriteIconLookupIndex, value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const key = simplifyItemName(value);
  if (!key) {
    return false;
  }

  return lookup.byName.has(key);
}

function addCodeLookupCandidate(
  candidates: Set<string>,
  lookup: SpriteIconLookupIndex,
  code: unknown,
  hasExplicitUniqueSignal: boolean,
): void {
  if (typeof code !== 'string') {
    return;
  }

  const normalizedCode = normalizeItemCodeKey(code);
  const skipAmbiguousCharmCodeLookup =
    normalizedCode !== undefined &&
    ambiguousCharmCodeKeys.has(normalizedCode) &&
    !hasExplicitUniqueSignal;
  if (skipAmbiguousCharmCodeLookup) {
    return;
  }

  addLookupCandidate(candidates, lookup.byCode, code);
}

function addNameDerivedCandidates(candidates: Set<string>, value: unknown): void {
  if (typeof value !== 'string') {
    return;
  }

  addCandidate(candidates, value);
  addCandidate(candidates, toSnakeCaseIconFilename(value));
}

export function createSpriteIconLookupIndex(items: Item[]): SpriteIconLookupIndex {
  const byItemId = new Map<string, string>();
  const byCode = new Map<string, string>();
  const byName = new Map<string, string>();

  for (const item of items) {
    if (!item.imageFilename) {
      continue;
    }

    byItemId.set(item.id, item.imageFilename);

    if (item.code) {
      const codeKey = simplifyItemName(item.code);
      if (codeKey && !byCode.has(codeKey)) {
        byCode.set(codeKey, item.imageFilename);
      }
    }

    const nameKey = simplifyItemName(item.name);
    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, item.imageFilename);
    }
  }

  return { byItemId, byCode, byName };
}

export function createSpatialIconCandidates(
  item: SpatialIconItemLike,
  lookup: SpriteIconLookupIndex,
): string[] {
  const candidates = new Set<string>();
  const rawItem = parseRawItemJson<RawItemShape>(item.rawItemJson);
  addParserInvFileCandidates(candidates, rawItem?.inv_file);

  const hasItemLevelUniqueSignal =
    Boolean(item.grailItemId) || hasLookupNameMatch(lookup, item.itemName);

  addCandidate(candidates, item.iconFileName);

  if (item.grailItemId) {
    addCandidate(candidates, lookup.byItemId.get(item.grailItemId));
  }

  addCodeLookupCandidate(candidates, lookup, item.itemCode, hasItemLevelUniqueSignal);
  addLookupCandidate(candidates, lookup.byName, item.itemName);
  addNameDerivedCandidates(candidates, item.itemName);

  if (!rawItem) {
    return [...candidates];
  }

  const hasRawLevelUniqueSignal =
    hasItemLevelUniqueSignal ||
    hasLookupNameMatch(lookup, rawItem.unique_name) ||
    hasLookupNameMatch(lookup, rawItem.set_name) ||
    hasLookupNameMatch(lookup, rawItem.name);

  addCodeLookupCandidate(candidates, lookup, rawItem.code, hasRawLevelUniqueSignal);
  addLookupCandidate(candidates, lookup.byName, rawItem.unique_name);
  addLookupCandidate(candidates, lookup.byName, rawItem.set_name);
  addLookupCandidate(candidates, lookup.byName, rawItem.name);
  addLookupCandidate(candidates, lookup.byName, rawItem.type_name);
  addNameDerivedCandidates(candidates, rawItem.unique_name);
  addNameDerivedCandidates(candidates, rawItem.set_name);
  addNameDerivedCandidates(candidates, rawItem.name);
  addNameDerivedCandidates(candidates, rawItem.type_name);
  addNameDerivedCandidates(candidates, rawItem.type);

  return [...candidates];
}
