import { gems } from 'electron/items/gems';
import { materials } from 'electron/items/materials';
import { runes } from 'electron/items/runes';
import type {
  CharacterInventorySnapshot,
  ParsedInventoryItem,
  StashTabKind,
  VaultItem,
  VaultSourceFileType,
} from 'electron/types/grail';
import { getSortedStashTabs, sortByGridPosition } from '@/components/inventory/spatialLayout';
import { translations } from '@/i18n/translations';

const STASH_SOURCE_FILE_TYPES = new Set<VaultSourceFileType>(['sss', 'd2x', 'd2i']);
const MODERN_STASH_MIN_VERSION = 105;
const MODERN_STASH_TAB_ORDER = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const MODERN_GEMS_TAB_INDEX = 5;
const MODERN_MATERIALS_TAB_INDEX = 6;
const MODERN_RUNES_TAB_INDEX = 7;
const GEM_ITEM_CODES = new Set(gems.map((gem) => gem.code.toLowerCase()));
const MATERIAL_ITEM_CODES = new Set(materials.map((material) => material.code.toLowerCase()));
const RUNE_ITEM_CODES = new Set(
  runes
    .map((rune) => (typeof rune.code === 'string' ? rune.code.toLowerCase() : undefined))
    .filter((code): code is string => code !== undefined),
);

export function normalizeResourceItemCode(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

export function canDropItemCodeInModernResourceTab(itemCode: string, stashTab: number): boolean {
  if (stashTab === MODERN_GEMS_TAB_INDEX) {
    return GEM_ITEM_CODES.has(itemCode);
  }
  if (stashTab === MODERN_MATERIALS_TAB_INDEX) {
    return MATERIAL_ITEM_CODES.has(itemCode);
  }
  if (stashTab === MODERN_RUNES_TAB_INDEX) {
    return RUNE_ITEM_CODES.has(itemCode);
  }

  return false;
}

export function isResourceStackItemCode(itemCode: unknown): boolean {
  const normalizedCode = normalizeResourceItemCode(itemCode);
  return (
    normalizedCode !== undefined &&
    [MODERN_GEMS_TAB_INDEX, MODERN_MATERIALS_TAB_INDEX, MODERN_RUNES_TAB_INDEX].some((stashTab) =>
      canDropItemCodeInModernResourceTab(normalizedCode, stashTab),
    )
  );
}

/**
 * A grid cell holds a single rune/gem/material, so dropping a vaulted stack on a grid takes exactly
 * one unit out of it (the rest stays vaulted). Withdrawing the whole stack into one cell would keep
 * one unit and lose the others, so the backend refuses that.
 */
export function resolveWithdrawCountForGridDrop(
  vaultItem: VaultItem | undefined,
): number | undefined {
  if (!vaultItem || (vaultItem.stackCount ?? 1) <= 1) {
    return undefined;
  }

  return isResourceStackItemCode(vaultItem.itemCode) ? 1 : undefined;
}

export function isStashSourceFileType(sourceFileType: VaultSourceFileType): boolean {
  return STASH_SOURCE_FILE_TYPES.has(sourceFileType);
}

function resolveStashTabKind(items: ParsedInventoryItem[]): StashTabKind | undefined {
  for (const item of items) {
    if (item.stashTabKind) {
      return item.stashTabKind;
    }
  }

  return undefined;
}

export function getStashSectionTitle(
  stashTab: number,
  items: ParsedInventoryItem[],
  t: (key: string, options?: Record<string, unknown>) => string,
  fallbackTabKind?: StashTabKind,
): string {
  const tabKind = fallbackTabKind ?? resolveStashTabKind(items);

  if (tabKind === 'gems') {
    return t(translations.inventoryBrowser.sections.gems);
  }
  if (tabKind === 'materials') {
    return t(translations.inventoryBrowser.sections.materials);
  }
  if (tabKind === 'runes') {
    return t(translations.inventoryBrowser.sections.runes);
  }

  return t(translations.inventoryBrowser.sections.sharedTab, { tab: stashTab + 1 });
}

function resolveModernStashTabKindByIndex(stashTab: number): StashTabKind | undefined {
  if (stashTab >= 0 && stashTab <= 4) {
    return 'shared';
  }
  if (stashTab === 5) {
    return 'gems';
  }
  if (stashTab === 6) {
    return 'materials';
  }
  if (stashTab === 7) {
    return 'runes';
  }

  return undefined;
}

export interface StashTabsToRenderEntry {
  stashTab: number;
  items: ParsedInventoryItem[];
  fallbackTabKind?: StashTabKind;
}

export function buildStashTabsToRender(
  snapshot: CharacterInventorySnapshot,
  stashByTab: Map<number, ParsedInventoryItem[]>,
): StashTabsToRenderEntry[] {
  const isModernStashSnapshot =
    snapshot.sourceFileType === 'd2i' &&
    (snapshot.sourceFileVersion ?? 0) >= MODERN_STASH_MIN_VERSION;

  if (isModernStashSnapshot) {
    return MODERN_STASH_TAB_ORDER.map((stashTab) => ({
      stashTab,
      items: sortByGridPosition(stashByTab.get(stashTab) ?? []),
      fallbackTabKind: resolveModernStashTabKindByIndex(stashTab),
    }));
  }

  const stashTabs = getSortedStashTabs(stashByTab);
  if (stashTabs.length > 0) {
    return stashTabs.map(({ stashTab, items }) => ({
      stashTab,
      items,
      fallbackTabKind: undefined,
    }));
  }

  return [{ stashTab: 0, items: [], fallbackTabKind: undefined }];
}
