import type { VaultItemUpsertInput } from 'electron/types/grail';

export const INVENTORY_DRAG_MIME = 'application/x-d2r-arcane-tracker-inventory-item';
export const VAULT_DRAG_MIME = 'application/x-d2r-arcane-tracker-vault-item';

const INVENTORY_TEXT_PREFIX = 'd2r-arcane-tracker:inventory-item:';
const VAULT_TEXT_PREFIX = 'd2r-arcane-tracker:vault-item:';

export interface VaultDragTextPayload {
  id: string;
  gridWidth: number;
  gridHeight: number;
}

interface InventoryDragPayload
  extends Omit<VaultItemUpsertInput, 'lastSeenAt' | 'vaultedAt' | 'unvaultedAt'> {
  lastSeenAt?: Date | string;
  vaultedAt?: Date | string;
  unvaultedAt?: Date | string;
}

function normalizeOptionalDate(value: Date | string | undefined): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeVaultGridDimension(value: unknown): number {
  return Number.isInteger(value) && value && (value as number) > 0 ? (value as number) : 1;
}

function toVaultDragTextPayload(
  parsed: Partial<VaultDragTextPayload>,
): VaultDragTextPayload | undefined {
  if (typeof parsed.id !== 'string' || parsed.id.trim().length === 0) {
    return undefined;
  }

  return {
    id: parsed.id.trim(),
    gridWidth: normalizeVaultGridDimension(parsed.gridWidth),
    gridHeight: normalizeVaultGridDimension(parsed.gridHeight),
  };
}

export function serializeInventoryTextPayload(itemInput: VaultItemUpsertInput): string {
  return `${INVENTORY_TEXT_PREFIX}${JSON.stringify(itemInput)}`;
}

export function parseInventoryTextPayload(rawValue: string): VaultItemUpsertInput | undefined {
  if (!rawValue.startsWith(INVENTORY_TEXT_PREFIX)) {
    return undefined;
  }

  const payload = rawValue.slice(INVENTORY_TEXT_PREFIX.length);

  try {
    const parsed = JSON.parse(payload) as InventoryDragPayload;

    if (
      typeof parsed.fingerprint !== 'string' ||
      parsed.fingerprint.length === 0 ||
      typeof parsed.itemName !== 'string' ||
      parsed.itemName.length === 0 ||
      typeof parsed.rawItemJson !== 'string' ||
      parsed.rawItemJson.length === 0 ||
      typeof parsed.sourceFileType !== 'string' ||
      typeof parsed.locationContext !== 'string'
    ) {
      return undefined;
    }

    const normalizedLastSeenAt = normalizeOptionalDate(parsed.lastSeenAt);
    if (parsed.lastSeenAt !== undefined && !normalizedLastSeenAt) {
      return undefined;
    }

    const normalizedVaultedAt = normalizeOptionalDate(parsed.vaultedAt);
    if (parsed.vaultedAt !== undefined && !normalizedVaultedAt) {
      return undefined;
    }

    const normalizedUnvaultedAt = normalizeOptionalDate(parsed.unvaultedAt);
    if (parsed.unvaultedAt !== undefined && !normalizedUnvaultedAt) {
      return undefined;
    }

    return {
      ...parsed,
      lastSeenAt: normalizedLastSeenAt,
      vaultedAt: normalizedVaultedAt,
      unvaultedAt: normalizedUnvaultedAt,
    };
  } catch {
    return undefined;
  }
}

export function serializeVaultTextPayload(payload: {
  id: string;
  gridWidth?: number;
  gridHeight?: number;
}): string {
  return `${VAULT_TEXT_PREFIX}${JSON.stringify({
    id: payload.id,
    gridWidth: payload.gridWidth ?? 1,
    gridHeight: payload.gridHeight ?? 1,
  })}`;
}

export function parseVaultTextPayload(rawValue: string): VaultDragTextPayload | undefined {
  const trimmedValue = rawValue.trim();
  if (trimmedValue.length === 0 || trimmedValue.startsWith(INVENTORY_TEXT_PREFIX)) {
    return undefined;
  }

  if (!trimmedValue.startsWith(VAULT_TEXT_PREFIX)) {
    if (trimmedValue.startsWith('{')) {
      try {
        return toVaultDragTextPayload(JSON.parse(trimmedValue) as Partial<VaultDragTextPayload>);
      } catch {
        return undefined;
      }
    }

    if (trimmedValue.includes(':')) {
      return undefined;
    }

    return {
      id: trimmedValue,
      gridWidth: 1,
      gridHeight: 1,
    };
  }

  const payload = trimmedValue.slice(VAULT_TEXT_PREFIX.length);

  try {
    return toVaultDragTextPayload(JSON.parse(payload) as Partial<VaultDragTextPayload>);
  } catch {
    return undefined;
  }
}
