import { basename } from 'node:path';
import { items } from '../items';

function normalizeLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeCodeKey(value: string): string {
  return value.trim().toLowerCase();
}

function stripKnownImageExtension(value: string): string {
  return value.replace(/\.(png|sprite|dc6|dds|jpg|jpeg|webp)$/i, '');
}

export function normalizeIconFilename(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}.png`;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const safeBasename = basename(trimmed);
  const withoutExtension = stripKnownImageExtension(safeBasename).trim().toLowerCase();
  if (!withoutExtension) {
    return undefined;
  }

  return `${withoutExtension}.png`;
}

export function toSnakeCaseIconFilename(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

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

const iconByGrailItemId = new Map<string, string>();
const iconByItemCode = new Map<string, string>();
const iconByNameKey = new Map<string, string>();

for (const item of items) {
  const iconFilename = normalizeIconFilename(item.imageFilename);
  if (!iconFilename) {
    continue;
  }

  iconByGrailItemId.set(item.id, iconFilename);

  if (item.code) {
    const codeKey = normalizeCodeKey(item.code);
    if (codeKey && !iconByItemCode.has(codeKey)) {
      iconByItemCode.set(codeKey, iconFilename);
    }
  }

  const nameCandidates = [item.name, item.id];
  for (const nameCandidate of nameCandidates) {
    if (!nameCandidate) {
      continue;
    }

    const lookupKey = normalizeLookupKey(nameCandidate);
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

    const lookupKey = normalizeLookupKey(candidate);
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

  const code = input.itemCode?.trim();
  if (code) {
    const codeIcon = iconByItemCode.get(normalizeCodeKey(code));
    if (codeIcon) {
      return codeIcon;
    }
  }

  const nameIcon = resolveIconByName([
    input.itemName,
    input.uniqueName,
    input.setName,
    input.parsedName,
  ]);
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
