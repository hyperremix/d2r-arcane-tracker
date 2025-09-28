import type { IEthGrailData } from 'd2-holy-grail/client/src/common/definitions/union/IEthGrailData';

export type ItemType = 'unique' | 'set' | 'rune' | 'runeword';

export type EtherealType = 'none' | 'optional' | 'only';

export type ItemCategory = 'weapons' | 'armor' | 'jewelry' | 'charms' | 'runes' | 'runewords';

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

export type ArmorSubCategory = 'helms' | 'armor' | 'shields' | 'gloves' | 'boots' | 'belts';

export type JewelrySubCategory = 'amulets' | 'rings';

export type CharmSubCategory = 'small_charms' | 'large_charms' | 'grand_charms';

export type RuneSubCategory = 'runes';

export type RunewordSubCategory =
  | 'weapon_runewords'
  | 'armor_runewords'
  | 'shield_runewords'
  | 'helm_runewords';

export type Difficulty = 'normal' | 'nightmare' | 'hell';

export type CharacterClass =
  | 'amazon'
  | 'assassin'
  | 'barbarian'
  | 'druid'
  | 'necromancer'
  | 'paladin'
  | 'sorceress';

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

export interface GrailStatistics {
  totalItems: number;
  foundItems: number;
  completionPercentage: number;
  recentFinds: GrailProgress[];
}

export interface GrailFilter {
  categories?: ItemCategory[];
  subCategories?: string[];
  types?: ItemType[];
  difficulties?: Difficulty[];
  foundStatus?: 'all' | 'found' | 'missing';
  searchTerm?: string;
  rarity?: ('common' | 'rare' | 'very_rare' | 'extremely_rare')[];
}

export interface AdvancedGrailFilter {
  rarities: string[];
  difficulties: Difficulty[];
  levelRange: { min: number; max: number };
  requiredLevelRange: { min: number; max: number };
  sortBy: 'name' | 'category' | 'type' | 'level' | 'rarity' | 'found_date';
  sortOrder: 'asc' | 'desc';
  fuzzySearch: boolean;
}
export interface MonitoringStatus {
  isMonitoring: boolean;
  directory: string | null;
}

import type { IHolyGrailData } from 'd2-holy-grail/client/src/common/definitions/union/IHolyGrailData';

export type SaveFileStats = {
  [filename: string]: number | null;
};

export type Item = {
  name: string;
  type: string;
  inSaves: { [saveName: string]: ItemDetails[] };
};

export type ItemDetails = {
  ethereal: boolean;
  ilevel: number | null;
  socketed: boolean;
};

export type ItemsInSaves = {
  [itemName: string]: Item;
};

export type FileReaderResponse = {
  items: ItemsInSaves;
  ethItems: ItemsInSaves;
  stats: SaveFileStats;
  availableRunes: AvailableRunes;
};

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

export type AvailableRunes = { [runeId: string]: Item };

/* eslint-disable no-unused-vars */
export enum GameMode {
  Both = 'both',
  Softcore = 'softcore',
  Hardcore = 'hardcore',
  Manual = 'manual',
}

export enum GameVersion {
  Resurrected = 'Resurrected',
  Classic = 'Classic',
}
/* eslint-enable no-unused-vars */

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
};

export type HolyGrailSeed = IHolyGrailData & {
  runes?: Record<RuneType, string>;
  runewords?: { [runewordId: string]: string };
};

export type HolyGrailStats = {
  normal: SubStats;
  ethereal: SubStats;
  runes: Stats;
  runewords: Stats;
};

export type Stats = {
  exists: number;
  owned: number;
  remaining: number;
  percent: number;
};

export type SubStats = {
  armor: Stats;
  weapon: Stats;
  other: Stats;
  sets: Stats;
  total: Stats;
};

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

// Simplified item structure
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

// Simplified event structure - only item-found events
export type ItemDetectionEvent = {
  type: 'item-found';
  item: D2Item;
  grailItem: HolyGrailItem;
};

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

export type SaveFileEvent = {
  type: 'created' | 'modified' | 'deleted';
  file: D2SaveFile;
};

// Type for magic attributes
export type MagicAttribute = {
  name: string;
  [key: string]: unknown;
};

// Type for item with magic attributes
export type ItemWithMagicAttributes = {
  magic_attributes: MagicAttribute[];
  [key: string]: unknown;
};

// Type for flat items mapping
export type FlatItemsMap = {
  [key: string]: unknown;
};

export type GrailItems = Record<string, Record<string, unknown>>;
export type GrailTiers = Record<string, GrailItems>;
export type GrailCategory = Record<string, unknown>;
export type GrailData = IHolyGrailData | IEthGrailData;

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

export type DatabaseSetting = {
  key: string;
  value: string | null;
  updated_at: string;
};
