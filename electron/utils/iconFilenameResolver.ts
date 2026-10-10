import { items } from '../items';
import { normalizeItemCodeKey } from './d2rFormat';
import { normalizeIconFilename, toSnakeCaseIconFilename } from './iconFilename';
import { simplifyItemName } from './objects';

export { normalizeIconFilename } from './iconFilename';

const iconByGrailItemId = new Map<string, string>();
const iconByItemCode = new Map<string, string>();
const iconByNameKey = new Map<string, string>();
const ambiguousCharmCodeKeys = new Set(['cm1', 'cm2']);

for (const item of items) {
  const iconFilename = normalizeIconFilename(item.imageFilename);
  if (!iconFilename) {
    continue;
  }

  iconByGrailItemId.set(item.id, iconFilename);

  if (item.code) {
    const codeKey = normalizeItemCodeKey(item.code);
    if (codeKey && !iconByItemCode.has(codeKey)) {
      iconByItemCode.set(codeKey, iconFilename);
    }
  }

  const nameCandidates = [item.name, item.id];
  for (const nameCandidate of nameCandidates) {
    if (!nameCandidate) {
      continue;
    }

    const lookupKey = simplifyItemName(nameCandidate);
    if (lookupKey && !iconByNameKey.has(lookupKey)) {
      iconByNameKey.set(lookupKey, iconFilename);
    }
  }
}

function resolveIconByName(candidates: Array<string | null | undefined>): string | undefined {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const lookupKey = simplifyItemName(candidate);
    if (!lookupKey) {
      continue;
    }

    const iconFilename = iconByNameKey.get(lookupKey);
    if (iconFilename) {
      return iconFilename;
    }
  }

  return undefined;
}

function resolveIconByCode(input: {
  itemCode?: string | null;
  grailItemId?: string;
  nameIcon?: string;
}): string | undefined {
  const normalizedCode = normalizeItemCodeKey(input.itemCode);
  if (!normalizedCode) {
    return undefined;
  }

  const hasExplicitUniqueSignal = Boolean(input.grailItemId) || Boolean(input.nameIcon);
  const skipAmbiguousCharmCodeLookup =
    ambiguousCharmCodeKeys.has(normalizedCode) && !hasExplicitUniqueSignal;
  if (skipAmbiguousCharmCodeLookup) {
    return undefined;
  }

  return iconByItemCode.get(normalizedCode);
}

export interface CanonicalIconFilenameInput {
  grailItemId?: string | null;
  itemCode?: string | null;
  itemName?: string | null;
  uniqueName?: string | null;
  setName?: string | null;
  parsedName?: string | null;
  typeName?: string | null;
  rawIconFileName?: unknown;
  fallbackIconFileName?: unknown;
}

export function resolveCanonicalIconFilename(
  input: CanonicalIconFilenameInput,
): string | undefined {
  const grailItemId = input.grailItemId?.trim();
  if (grailItemId) {
    const grailIcon = iconByGrailItemId.get(grailItemId);
    if (grailIcon) {
      return grailIcon;
    }
  }

  const nameIcon = resolveIconByName([
    input.itemName,
    input.uniqueName,
    input.setName,
    input.parsedName,
  ]);

  const codeIcon = resolveIconByCode({
    itemCode: input.itemCode,
    grailItemId,
    nameIcon,
  });
  if (codeIcon) {
    return codeIcon;
  }

  if (nameIcon) {
    return nameIcon;
  }

  const slugSources = [
    input.typeName,
    input.parsedName,
    input.itemName,
    input.uniqueName,
    input.setName,
  ];
  for (const source of slugSources) {
    const slugCandidate = toSnakeCaseIconFilename(source);
    if (slugCandidate) {
      return slugCandidate;
    }
  }

  return (
    normalizeIconFilename(input.rawIconFileName) ??
    normalizeIconFilename(input.fallbackIconFileName)
  );
}
