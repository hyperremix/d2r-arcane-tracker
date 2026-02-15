import type { Item, ParsedInventoryItem, VaultItem } from 'electron/types/grail';

type SpatialIconItemLike = Pick<
  ParsedInventoryItem | VaultItem,
  'iconFileName' | 'grailItemId' | 'itemCode' | 'itemName' | 'rawItemJson'
>;

type RawItemShape = {
  inv_file?: unknown;
  unique_name?: unknown;
  set_name?: unknown;
  type_name?: unknown;
  name?: unknown;
  code?: unknown;
  type?: unknown;
};

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

function normalizeLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeCodeKey(value: string): string {
  return value.trim().toLowerCase();
}

function toSnakeCaseFilename(value: string): string | undefined {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/['`]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!slug) {
    return undefined;
  }

  return `${slug}.png`;
}

function parseRawItem(rawItemJson: string): RawItemShape | undefined {
  try {
    const parsed = JSON.parse(rawItemJson);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as RawItemShape;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function addLookupCandidate(
  candidates: Set<string>,
  lookupMap: Map<string, string>,
  value: unknown,
): void {
  if (typeof value !== 'string') {
    return;
  }

  const key = normalizeLookupKey(value);
  if (!key) {
    return;
  }

  addCandidate(candidates, lookupMap.get(key));
}

function hasLookupNameMatch(lookup: SpriteIconLookupIndex, value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const key = normalizeLookupKey(value);
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

  const normalizedCode = normalizeCodeKey(code);
  const skipAmbiguousCharmCodeLookup =
    ambiguousCharmCodeKeys.has(normalizedCode) && !hasExplicitUniqueSignal;
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
  addCandidate(candidates, toSnakeCaseFilename(value));
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
      const codeKey = normalizeLookupKey(item.code);
      if (codeKey && !byCode.has(codeKey)) {
        byCode.set(codeKey, item.imageFilename);
      }
    }

    const nameKey = normalizeLookupKey(item.name);
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
  const hasItemLevelUniqueSignal =
    Boolean(item.grailItemId) || hasLookupNameMatch(lookup, item.itemName);

  addCandidate(candidates, item.iconFileName);

  if (item.grailItemId) {
    addCandidate(candidates, lookup.byItemId.get(item.grailItemId));
  }

  addCodeLookupCandidate(candidates, lookup, item.itemCode, hasItemLevelUniqueSignal);
  addLookupCandidate(candidates, lookup.byName, item.itemName);
  addNameDerivedCandidates(candidates, item.itemName);

  const rawItem = parseRawItem(item.rawItemJson);
  if (!rawItem) {
    return [...candidates];
  }

  const hasRawLevelUniqueSignal =
    hasItemLevelUniqueSignal ||
    hasLookupNameMatch(lookup, rawItem.unique_name) ||
    hasLookupNameMatch(lookup, rawItem.set_name) ||
    hasLookupNameMatch(lookup, rawItem.name);

  addCandidate(candidates, rawItem.inv_file);
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
