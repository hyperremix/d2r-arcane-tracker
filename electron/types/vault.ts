/**
 * Item vault: vaulted items, their source locations and vault search.
 *
 * Shared by the main process and the renderer; re-exported from `./grail`.
 */

/**
 * Save file type an item was read from.
 */
export type VaultSourceFileType = 'd2s' | 'sss' | 'd2x' | 'd2i';

/**
 * Where an item sits in its save file.
 */
export type VaultLocationContext =
  | 'equipped'
  | 'inventory'
  | 'stash'
  | 'mercenary'
  | 'corpse'
  | 'unknown';

/**
 * Kind of a stash tab: a regular shared tab or one of the modern stash resource tabs.
 */
export type StashTabKind = 'shared' | 'gems' | 'materials' | 'runes';

export interface VaultItem {
  id: string;
  fingerprint: string;
  itemName: string;
  itemCode?: string;
  type?: string;
  quality: string;
  ethereal: boolean;
  socketCount?: number;
  stackCount?: number;
  rawItemJson: string;
  sourceCharacterId?: string;
  sourceCharacterName?: string;
  sourceFileType: VaultSourceFileType;
  sourceFilePath?: string;
  locationContext: VaultLocationContext;
  stashTab?: number;
  gridX?: number;
  gridY?: number;
  gridWidth?: number;
  gridHeight?: number;
  equippedSlotId?: number;
  iconFileName?: string;
  isSocketedItem?: boolean;
  grailItemId?: string;
  isPresentInLatestScan: boolean;
  lastSeenAt?: Date;
  vaultedAt?: Date;
  unvaultedAt?: Date;
  created: Date;
  lastUpdated: Date;
}

export interface VaultItemUpsertInput {
  id?: string;
  fingerprint: string;
  itemName: string;
  itemCode?: string;
  type?: string;
  quality: string;
  ethereal: boolean;
  socketCount?: number;
  stackCount?: number;
  rawItemJson: string;
  sourceCharacterId?: string;
  sourceCharacterName?: string;
  sourceFileType: VaultSourceFileType;
  sourceFilePath?: string;
  locationContext: VaultLocationContext;
  stashTab?: number;
  gridX?: number;
  gridY?: number;
  gridWidth?: number;
  gridHeight?: number;
  equippedSlotId?: number;
  iconFileName?: string;
  isSocketedItem?: boolean;
  grailItemId?: string;
  isPresentInLatestScan?: boolean;
  lastSeenAt?: Date;
  vaultedAt?: Date;
  unvaultedAt?: Date;
}

export interface VaultItemFilter {
  text?: string;
  characterId?: string;
  locationContext?: VaultLocationContext;
  sourceFileType?: VaultSourceFileType;
  includeSocketed?: boolean;
  presentState?: 'all' | 'present' | 'missing';
  vaultedState?: 'all' | 'vaulted' | 'unvaulted';
  page?: number;
  pageSize?: number;
  sortBy?: 'itemName' | 'lastSeenAt' | 'createdAt' | 'updatedAt' | 'vaultedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface VaultItemSearchResult {
  items: VaultItem[];
  total: number;
  page: number;
  pageSize: number;
}
