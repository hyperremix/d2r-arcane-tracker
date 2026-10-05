import type {
  CharacterInventorySnapshot,
  VaultItem,
  VaultItemFilter,
  VaultLocationContext,
} from 'electron/types/grail';

export interface InventorySearchAllResponse {
  inventory: {
    snapshots: CharacterInventorySnapshot[];
    totalSnapshots: number;
    totalItems: number;
  };
  vault: {
    items: VaultItem[];
    total: number;
    page: number;
    pageSize: number;
  };
}

function getVaultItemLastUpdatedMs(item: VaultItem): number {
  const rawValue = item.lastUpdated as unknown;
  if (rawValue instanceof Date) {
    return rawValue.getTime();
  }

  if (typeof rawValue === 'string') {
    const parsed = Date.parse(rawValue);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function compareVaultItems(a: VaultItem, b: VaultItem): number {
  const timeDiff = getVaultItemLastUpdatedMs(b) - getVaultItemLastUpdatedMs(a);
  if (timeDiff !== 0) {
    return timeDiff;
  }

  return a.fingerprint.localeCompare(b.fingerprint);
}

function mergeAndSortVaultItems(pages: VaultItem[][]): VaultItem[] {
  const deduped = new Map<string, VaultItem>();

  for (const pageItems of pages) {
    for (const item of pageItems) {
      const key = item.id || item.fingerprint;
      deduped.set(key, item);
    }
  }

  return [...deduped.values()].sort(compareVaultItems);
}

async function fetchAllVaultItemsForFilter(
  filter: VaultItemFilter,
  initialVault: InventorySearchAllResponse['vault'],
): Promise<VaultItem[]> {
  const initialItems = initialVault.items ?? [];
  const pageSize = Math.max(initialVault.pageSize, 1);
  const totalPages = Math.ceil(initialVault.total / pageSize);

  if (totalPages <= 1) {
    return mergeAndSortVaultItems([initialItems]);
  }

  const remainingPageRequests: Promise<InventorySearchAllResponse['vault']>[] = [];
  for (let page = 2; page <= totalPages; page += 1) {
    remainingPageRequests.push(
      window.electronAPI.vault.search({
        ...filter,
        page,
        pageSize,
      }),
    );
  }

  const remainingPages = await Promise.all(remainingPageRequests);
  return mergeAndSortVaultItems([initialItems, ...remainingPages.map((page) => page.items)]);
}

function resolveCharacterFilter(characterId: string): string | undefined {
  if (characterId === 'all') {
    return undefined;
  }

  if (characterId.startsWith('name:')) {
    return characterId.slice('name:'.length);
  }

  return characterId;
}

export function buildInventorySearchFilter(
  searchText: string,
  characterId: string,
  locationContext: 'all' | VaultLocationContext,
): VaultItemFilter {
  return {
    text: searchText.trim() || undefined,
    characterId: resolveCharacterFilter(characterId),
    locationContext: locationContext === 'all' ? undefined : locationContext,
    includeSocketed: false,
    vaultedState: 'vaulted',
    page: 1,
    pageSize: 200,
  };
}

function withMergedVaultItems(
  response: InventorySearchAllResponse,
  allVaultItems: VaultItem[],
): InventorySearchAllResponse {
  return {
    ...response,
    vault: {
      ...response.vault,
      items: allVaultItems,
    },
  };
}

export async function loadInventorySearchResponse(
  filter: VaultItemFilter,
): Promise<InventorySearchAllResponse> {
  const response = await window.electronAPI.inventory.searchAll(filter);
  const allVaultItems = await fetchAllVaultItemsForFilter(filter, response.vault);
  return withMergedVaultItems(response, allVaultItems);
}
