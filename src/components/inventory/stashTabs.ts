import type {
  CharacterInventorySnapshot,
  ParsedInventoryItem,
  StashTabKind,
  VaultItem,
  VaultSourceFileType,
} from 'electron/types/grail';
import {
  isModernStashVersion,
  isResourceCodeOfKind,
  isResourceItemCode,
  RESOURCE_STASH_TAB_BY_KIND,
  resolveResourceStashTabKind,
  SHARED_TAB_COUNT,
} from 'electron/utils/d2rFormat';
import { getSortedStashTabs, sortByGridPosition } from '@/components/inventory/spatialLayout';
import { translations } from '@/i18n/translations';

const STASH_SOURCE_FILE_TYPES = new Set<VaultSourceFileType>(['sss', 'd2x', 'd2i']);
const MODERN_STASH_TAB_ORDER: readonly number[] = [
  ...Array.from({ length: SHARED_TAB_COUNT }, (_, stashTab) => stashTab),
  ...Object.values(RESOURCE_STASH_TAB_BY_KIND),
];

/**
 * True when an item with this code may be dropped on the given modern stash tab: the tab must be
 * a resource tab (gems, materials, runes) and the code must belong to that tab.
 */
export function canDropItemCodeInModernResourceTab(itemCode: unknown, stashTab: number): boolean {
  const kind = resolveResourceStashTabKind(stashTab);
  return kind !== undefined && isResourceCodeOfKind(itemCode, kind);
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

  return isResourceItemCode(vaultItem.itemCode) ? 1 : undefined;
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
  if (stashTab >= 0 && stashTab < SHARED_TAB_COUNT) {
    return 'shared';
  }

  return resolveResourceStashTabKind(stashTab);
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
    snapshot.sourceFileType === 'd2i' && isModernStashVersion(snapshot.sourceFileVersion);

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
