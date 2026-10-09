import type { types as d2sTypes } from '@dschu012/d2s';

/**
 * Reads raw d2s item fields (code, id) that are stored in more than one shape.
 */

export function resolveItemCode(item: d2sTypes.IItem): string | undefined {
  const rawCode =
    (item as { code?: unknown; type?: unknown }).code ?? (item as { type?: unknown }).type;
  if (typeof rawCode !== 'string' || rawCode.trim().length === 0) {
    return undefined;
  }

  return rawCode.toLowerCase();
}

export function normalizeItemId(rawId: unknown): number | undefined {
  if (typeof rawId === 'number' && Number.isInteger(rawId)) {
    return rawId;
  }

  if (typeof rawId === 'string' && rawId.trim().length > 0) {
    const parsed = Number.parseInt(rawId, 10);
    return Number.isInteger(parsed) ? parsed : undefined;
  }

  return undefined;
}
