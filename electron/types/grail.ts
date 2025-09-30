import type { IEthGrailData } from 'd2-holy-grail/client/src/common/definitions/union/IEthGrailData';

/**
 * Type representing the different categories of items in Diablo 2.
 */
export type ItemType = 'unique' | 'set' | 'rune' | 'runeword';

/**
 * Type representing the ethereal status of items.
 */
export type EtherealType = 'none' | 'optional' | 'only';

/**
 * Type representing the main categories of items in the Holy Grail.
 */
export type ItemCategory = 'weapons' | 'armor' | 'jewelry' | 'charms' | 'runes' | 'runewords';

/**
 * Type representing the subcategories of weapon items.
 */
export type WeaponSubCategory =
  | 'axes'
  | 'bows'
  | 'crossbows'
  | 'daggers'
  | 'javelins'
  | 'maces'
  | 'polearms'
  | 'scepters'
  | 'spears'
  | 'staves'
  | 'swords'
  | 'throwing'
  | 'wands';

/**
 * Type representing the subcategories of armor items.
 */
export type ArmorSubCategory = 'helms' | 'armor' | 'shields' | 'gloves' | 'boots' | 'belts';

/**
 * Type representing the subcategories of jewelry items.
 */
export type JewelrySubCategory = 'amulets' | 'rings';

/**
 * Type representing the subcategories of charm items.
 */
export type CharmSubCategory = 'small_charms' | 'large_charms' | 'grand_charms';

/**
 * Type representing the subcategory of rune items.
 */
export type RuneSubCategory = 'runes';

/**
 * Type representing the subcategories of runeword items.
 */
export type RunewordSubCategory =
  | 'weapon_runewords'
  | 'armor_runewords'
  | 'shield_runewords'
  | 'helm_runewords';

/**
 * Type representing the difficulty levels in Diablo 2.
 */
export type Difficulty = 'normal' | 'nightmare' | 'hell';

/**
 * Type representing the character classes in Diablo 2.
 */
export type CharacterClass =
  | 'amazon'
  | 'assassin'
  | 'barbarian'
  | 'druid'
  | 'necromancer'
  | 'paladin'
  | 'sorceress';

/**
 * Interface representing a Holy Grail item with all its properties.
 */
export interface HolyGrailItem {
  id: string;
  name: string;
  type: ItemType;
  category: ItemCategory;
  subCategory:
    | WeaponSubCategory
    | ArmorSubCategory
    | JewelrySubCategory
    | CharmSubCategory
    | RuneSubCategory
    | RunewordSubCategory;
  setName?: string;
  etherealType: EtherealType;
}

/**
 * Interface representing a Diablo 2 character with all its properties.
 */
export interface Character {
  id: string;
  name: string;
  characterClass: CharacterClass;
  level: number;
  difficulty: Difficulty;
  hardcore: boolean;
  expansion: boolean;
  saveFilePath?: string;
  lastUpdated: Date;
  created: Date;
  deleted?: Date;
}

/**
 * Interface representing the progress of finding a Holy Grail item.
 */
export interface GrailProgress {
  id: string;
  characterId: string;
  itemId: string;
  found: boolean;
  foundDate?: Date;
  foundBy?: string; // character name that found it
  manuallyAdded: boolean;
  difficulty?: Difficulty;
  notes?: string;
}

/**
 * Interface representing Holy Grail completion statistics.
 */
export interface GrailStatistics {
  totalItems: number;
  foundItems: number;
  completionPercentage: number;
  recentFinds: GrailProgress[];
}

/**
 * Interface representing filter options for Holy Grail items.
 */
export interface GrailFilter {
  categories?: ItemCategory[];
  subCategories?: string[];
  types?: ItemType[];
  difficulties?: Difficulty[];
  foundStatus?: 'all' | 'found' | 'missing';
  searchTerm?: string;
  rarity?: ('common' | 'rare' | 'very_rare' | 'extremely_rare')[];
}

/**
 * Interface representing advanced filter options for Holy Grail items with sorting and search capabilities.
 */
export interface AdvancedGrailFilter {
  rarities: string[];
  difficulties: Difficulty[];
  levelRange: { min: number; max: number };
  requiredLevelRange: { min: number; max: number };
  sortBy: 'name' | 'category' | 'type' | 'level' | 'rarity' | 'found_date';
  sortOrder: 'asc' | 'desc';
  fuzzySearch: boolean;
}
/**
 * Interface representing the status of save file monitoring.
 */
export interface MonitoringStatus {
  isMonitoring: boolean;
  directory: string | null;
}

import type { IHolyGrailData } from 'd2-holy-grail/client/src/common/definitions/union/IHolyGrailData';

/**
 * Type representing statistics for save files, mapping filenames to item counts.
 */
export type SaveFileStats = {
  [filename: string]: number | null;
};

/**
 * Type representing an item found in save files with its locations.
 */
export type Item = {
  name: string;
  type: string;
  inSaves: { [saveName: string]: ItemDetails[] };
};

/**
 * Type representing detailed properties of an item found in a save file.
 */
export type ItemDetails = {
  ethereal: boolean;
  ilevel: number | null;
  socketed: boolean;
};

/**
 * Type representing a mapping of item names to their Item objects.
 */
export type ItemsInSaves = {
  [itemName: string]: Item;
};

/**
 * Type representing the response from parsing save files, containing all found items and statistics.
 */
export type FileReaderResponse = {
  items: ItemsInSaves;
  ethItems: ItemsInSaves;
  stats: SaveFileStats;
  availableRunes: AvailableRunes;
};

/**
 * Type representing all possible rune types in Diablo 2 (El through Zod).
 */
export type RuneType =
  | 'r01'
  | 'r02'
  | 'r03'
  | 'r04'
  | 'r05'
  | 'r06'
  | 'r07'
  | 'r08'
  | 'r09'
  | 'r10'
  | 'r11'
  | 'r12'
  | 'r13'
  | 'r14'
  | 'r15'
  | 'r16'
  | 'r17'
  | 'r18'
  | 'r19'
  | 'r20'
  | 'r21'
  | 'r22'
  | 'r23'
  | 'r24'
  | 'r25'
  | 'r26'
  | 'r27'
  | 'r28'
  | 'r29'
  | 'r30'
  | 'r31'
  | 'r32'
  | 'r33';

/**
 * Type representing available runes mapped by their rune ID.
 */
export type AvailableRunes = { [runeId: string]: Item };

/**
 * Enum representing the different game modes for Holy Grail tracking.
 */
/* eslint-disable no-unused-vars */
export enum GameMode {
  Both = 'both',
  Softcore = 'softcore',
  Hardcore = 'hardcore',
  Manual = 'manual',
}

/**
 * Enum representing the different versions of Diablo 2.
 */
export enum GameVersion {
  Resurrected = 'Resurrected',
  Classic = 'Classic',
}
/* eslint-enable no-unused-vars */

/**
 * Type representing all application settings.
 */
export type Settings = {
  saveDir: string;
  lang: string;
  gameMode: GameMode;
  grailNormal: boolean;
  grailEthereal: boolean;
  grailRunes: boolean;
  grailRunewords: boolean;
  gameVersion: GameVersion;
  enableSounds: boolean;
  notificationVolume: number;
  inAppNotifications: boolean;
  nativeNotifications: boolean;
  needsSeeding: boolean;
  theme: 'light' | 'dark' | 'system';
};

/**
 * Type representing the Holy Grail seed data with additional rune and runeword mappings.
 */
export type HolyGrailSeed = IHolyGrailData & {
  runes?: Record<RuneType, string>;
  runewords?: { [runewordId: string]: string };
};

/**
 * Type representing comprehensive Holy Grail statistics.
 */
export type HolyGrailStats = {
  normal: SubStats;
  ethereal: SubStats;
  runes: Stats;
  runewords: Stats;
};

/**
 * Type representing basic statistics for a category of items.
 */
export type Stats = {
  exists: number;
  owned: number;
  remaining: number;
  percent: number;
};

/**
 * Type representing sub-statistics broken down by item categories.
 */
export type SubStats = {
  armor: Stats;
  weapon: Stats;
  other: Stats;
  sets: Stats;
  total: Stats;
};

/**
 * Type representing a raw item from a D2 save file as parsed by the d2s library.
 */
export type D2SItem = {
  id?: string | number;
  type?: string;
  type_name?: string;
  code?: string;
  name?: string;
  unique_name?: string;
  set_name?: string;
  rare_name?: string;
  rare_name2?: string;
  runeword_name?: string;
  level?: number;
  ethereal?: number;
  quality?: number;
  location?: string;
  equipped?: boolean;
  socketed?: number;
  socket_count?: number;
  socketed_items?: D2SItem[];
  gems?: unknown[];
  magic_attributes?: Array<{ name: string; value?: unknown }>;
};

/**
 * Type representing a simplified item structure for internal use.
 */
export type D2Item = {
  id: string;
  name: string;
  type: string;
  quality: 'normal' | 'magic' | 'rare' | 'set' | 'unique' | 'crafted';
  level: number;
  ethereal: boolean;
  sockets: number;
  timestamp: Date;
  characterName: string;
  location: 'inventory' | 'stash' | 'equipment';
};

/**
 * Type representing an item detection event when a Holy Grail item is found.
 */
export type ItemDetectionEvent = {
  type: 'item-found';
  item: D2Item;
  grailItem: HolyGrailItem;
};

/**
 * Type representing a Diablo 2 save file with character information.
 */
export type D2SaveFile = {
  name: string;
  path: string;
  lastModified: Date;
  characterClass: string;
  level: number;
  difficulty: 'normal' | 'nightmare' | 'hell';
  hardcore: boolean;
  expansion: boolean;
};

/**
 * Type representing an event related to save file changes.
 */
export type SaveFileEvent = {
  type: 'created' | 'modified' | 'deleted';
  file: D2SaveFile;
};

/**
 * Type representing magic attributes on items.
 */
export type MagicAttribute = {
  name: string;
  [key: string]: unknown;
};

/**
 * Type representing an item that includes magic attributes.
 */
export type ItemWithMagicAttributes = {
  magic_attributes: MagicAttribute[];
  [key: string]: unknown;
};

/**
 * Type representing a flat mapping of items for efficient lookup.
 */
export type FlatItemsMap = {
  [key: string]: unknown;
};

/**
 * Type representing Holy Grail items in a nested structure.
 */
export type GrailItems = Record<string, Record<string, unknown>>;
/**
 * Type representing Holy Grail tiers containing items.
 */
export type GrailTiers = Record<string, GrailItems>;
/**
 * Type representing a Holy Grail category.
 */
export type GrailCategory = Record<string, unknown>;
/**
 * Type representing Holy Grail data (either normal or ethereal).
 */
export type GrailData = IHolyGrailData | IEthGrailData;

/**
 * Type representing an item as stored in the database.
 */
export type DatabaseItem = {
  id: string;
  name: string;
  type: 'unique' | 'set' | 'rune' | 'runeword';
  category: string;
  sub_category: string;
  set_name?: string;
  ethereal_type: EtherealType;
  created_at: string;
  updated_at: string;
};

/**
 * Type representing a character as stored in the database.
 */
export type DatabaseCharacter = {
  id: string;
  name: string;
  character_class: string;
  level: number;
  difficulty: 'normal' | 'nightmare' | 'hell';
  hardcore: boolean;
  expansion: boolean;
  save_file_path?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
};

/**
 * Type representing grail progress as stored in the database.
 */
export type DatabaseGrailProgress = {
  id: string;
  character_id: string;
  item_id: string;
  found: boolean;
  found_date?: string;
  manually_added: boolean;
  auto_detected: boolean;
  difficulty?: 'normal' | 'nightmare' | 'hell';
  notes?: string;
  created_at: string;
  updated_at: string;
};

/**
 * Type representing a setting as stored in the database.
 */
export type DatabaseSetting = {
  key: string;
  value: string | null;
  updated_at: string;
};
