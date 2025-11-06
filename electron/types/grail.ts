import type * as d2s from '@dschu012/d2s';

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
  | '1h_swords'
  | '2h_swords'
  | '1h_axes'
  | '2h_axes'
  | '1h_maces'
  | '2h_maces'
  | '1h_clubs'
  | 'bows'
  | 'crossbows'
  | 'daggers'
  | 'javelins'
  | 'polearms'
  | 'scepters'
  | 'spears'
  | 'staves'
  | 'throwing'
  | 'wands'
  | 'hammers'
  | 'mauls'
  | 'maces'
  | 'javelins';

/**
 * Type representing the subcategories of armor items.
 */
export type ArmorSubCategory = 'helms' | 'body_armor' | 'shields' | 'gloves' | 'boots' | 'belts';

/**
 * Type representing the subcategories of jewelry items.
 */
export type JewelrySubCategory = 'amulets' | 'rings' | 'rainbow_facets' | 'dies';

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
export type RunewordSubCategory = 'runewords';

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
  | 'sorceress'
  | 'shared_stash';

export type ItemSet =
  | 'Angelic Raiment'
  | "Arcanna's Tricks"
  | 'Arctic Gear'
  | "Berserker's Arsenal"
  | "Cathan's Traps"
  | "Civerb's Vestments"
  | "Cleglaw's Brace"
  | "Death's Disguise"
  | "Hsaru's Defense"
  | 'Infernal Tools'
  | "Iratha's Finery"
  | "Isenhart's Armory"
  | "Milabrega's Regalia"
  | "Sigon's Complete Steel"
  | "Tancred's Battlegear"
  | "Vidala's Rig"
  | "Aldur's Watchtower"
  | "Bul-Kathos' Children"
  | "Cow King's Leathers"
  | "Griswold's Legacy"
  | "Heaven's Brethren"
  | "Hwanin's Majesty"
  | 'Immortal King'
  | "M'avina's Battle Hymn"
  | "Naj's Ancient Vestige"
  | "Natalya's Odium"
  | "Orphan's Call"
  | "Sander's Folly"
  | "Sazabi's Grand Tribute"
  | "Tal Rasha's Wrappings"
  | 'The Disciple'
  | "Trang-Oul's Avatar";

export type ItemSubCategory =
  | WeaponSubCategory
  | ArmorSubCategory
  | JewelrySubCategory
  | CharmSubCategory
  | RuneSubCategory
  | RunewordSubCategory
  | CharacterClass;

export type ItemTreasureClass = 'normal' | 'exceptional' | 'elite';

export interface Item {
  id: string;
  name: string;
  link: string;
  code?: string;
  itemBase?: string;
  imageFilename?: string;
  etherealType: EtherealType;
  type: ItemType;
  category: ItemCategory;
  subCategory: ItemSubCategory;
  treasureClass: ItemTreasureClass;
  setName?: ItemSet;
  runes?: string[];
}

/**
 * Type representing an item as stored in the database.
 * SQLite-compatible types: booleans as 0/1, undefined as null
 */
export type DatabaseItem = {
  id: string;
  name: string;
  link: string;
  code: string | null;
  item_base: string | null;
  image_filename: string | null;
  ethereal_type: EtherealType;
  type: ItemType;
  category: ItemCategory;
  sub_category: ItemSubCategory;
  treasure_class: ItemTreasureClass;
  set_name: ItemSet | null;
  runes: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Interface representing a Diablo 2 character with all its properties.
 */
export interface Character {
  id: string;
  name: string;
  characterClass: CharacterClass;
  level: number;
  hardcore: boolean;
  expansion: boolean;
  saveFilePath?: string;
  lastUpdated: Date;
  created: Date;
  deleted?: Date;
}

/**
 * Type representing a character as stored in the database.
 * SQLite-compatible types: booleans as 0/1, undefined as null
 */
export type DatabaseCharacter = {
  id: string;
  name: string;
  character_class: CharacterClass;
  level: number;
  hardcore: 0 | 1;
  expansion: 0 | 1;
  save_file_path: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Interface representing the progress of finding a Holy Grail item.
 */
export interface GrailProgress {
  id: string;
  characterId: string;
  itemId: string;
  foundDate?: Date;
  foundBy?: string; // character name that found it
  manuallyAdded: boolean;
  difficulty?: Difficulty;
  notes?: string;
  isEthereal: boolean;
  fromInitialScan?: boolean; // true if found during initial application startup scan
}

/**
 * Type representing grail progress as stored in the database.
 * SQLite-compatible types: booleans as 0/1, undefined as null
 */
export type DatabaseGrailProgress = {
  id: string;
  character_id: string;
  item_id: string;
  found_date: string | null;
  manually_added: 0 | 1;
  auto_detected: 0 | 1;
  difficulty: 'normal' | 'nightmare' | 'hell' | null;
  notes: string | null;
  is_ethereal: 0 | 1;
  from_initial_scan: 0 | 1;
  created_at: string;
  updated_at: string;
};

/**
 * Interface representing Holy Grail completion statistics.
 */
export interface GrailStatistics {
  totalItems: number;
  foundItems: number;
  completionPercentage: number;
  recentFinds: number;
  normalItems: {
    total: number;
    found: number;
  };
  etherealItems: {
    total: number;
    found: number;
  };
  currentStreak: number;
  maxStreak: number;
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
  sortBy: 'name' | 'category' | 'type' | 'found_date';
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

/**
 * Type representing statistics for save files, mapping filenames to item counts.
 */
export type SaveFileStats = {
  [filename: string]: number | null;
};

/**
 * Type representing an item found in save files with its locations.
 */
export type SaveFileItem = {
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
  d2sItem?: d2s.types.IItem;
};

/**
 * Type representing a mapping of item names to their Item objects.
 */
export type ItemsInSaves = {
  [itemName: string]: SaveFileItem;
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
 * Type representing available runes mapped by their rune ID.
 */
export type AvailableRunes = { [runeId: string]: SaveFileItem };

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
  showItemIcons: boolean;
  d2rInstallPath?: string; // Path to D2R installation
  iconConversionStatus?: 'not_started' | 'in_progress' | 'completed' | 'failed';
  iconConversionProgress?: { current: number; total: number };
  // Advanced monitoring settings (optional, with defaults)
  tickReaderIntervalMs?: number; // Default: 500
  chokidarPollingIntervalMs?: number; // Default: 1000
  fileStabilityThresholdMs?: number; // Default: 300
  fileChangeDebounceMs?: number; // Default: 2000
  // Widget settings
  widgetEnabled?: boolean; // Whether the widget is enabled
  widgetDisplay?: 'overall' | 'split' | 'all'; // Widget display mode (overall only, normal+ethereal, or all three)
  widgetPosition?: { x: number; y: number }; // Widget position on screen
  widgetOpacity?: number; // Widget opacity (0.0 to 1.0)
  widgetSizeOverall?: { width: number; height: number }; // Custom size for overall mode
  widgetSizeSplit?: { width: number; height: number }; // Custom size for split mode
  widgetSizeAll?: { width: number; height: number }; // Custom size for all mode
  // Wizard settings
  wizardCompleted?: boolean; // Whether the setup wizard has been completed
  wizardSkipped?: boolean; // Whether the user skipped the setup wizard
  // Terror zone configuration
  terrorZoneConfig?: Record<number, boolean>; // Zone ID -> enabled state
  terrorZoneBackupCreated?: boolean; // Whether backup has been created
};

/**
 * Type representing a setting as stored in the database.
 */
export type DatabaseSetting = {
  key: string;
  value: string | null;
  updated_at: string;
};

/**
 * Interface representing a terror zone configuration.
 */
export interface TerrorZone {
  id: number;
  name: string;
  levels: Array<{ level_id: number; waypoint_level_id?: number }>;
}

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
/**
 * Event emitted when a grail item is detected in a save file.
 */
export type ItemDetectionEvent = {
  type: 'item-found';
  item: D2Item;
  grailItem: Item;
  /**
   * When true, suppresses all user-facing notifications for this detection.
   * Inherited from SaveFileEvent.silent.
   *
   * Effects when true:
   * - No sound notification played
   * - No native OS notification shown
   * - No in-app notification popup displayed
   * - No grail progress update event sent to renderer
   * - Item is still saved to database
   * - Item is still tracked for duplicate detection
   *
   * This allows bulk operations (startup, re-scan) to process items
   * without overwhelming the user with notifications.
   */
  silent?: boolean;
  /**
   * When true, marks this item as being found during the initial application
   * startup scan. Inherited from SaveFileEvent.isInitialScan.
   *
   * Items with this flag will be excluded from statistics like:
   * - Recent Finds
   * - Current Streak
   * - Avg per Day
   */
  isInitialScan?: boolean;
  d2sItemId?: string | number;
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
  hardcore: boolean;
  expansion: boolean;
};

/**
 * Type representing an event related to save file changes.
 */
/**
 * Event emitted when a save file is created, modified, or deleted.
 */
export type SaveFileEvent = {
  type: 'created' | 'modified' | 'deleted';
  file: D2SaveFile;
  extractedItems?: d2s.types.IItem[];
  /**
   * When true, suppresses all user-facing notifications for this event.
   * Used during initial startup parsing and user-initiated force re-scans
   * to prevent notification spam for items that were already found.
   *
   * Set to true when:
   * - Initial parsing on application startup (isInitialParsing=true)
   * - User manually triggers "Re-scan all files" (forceParseAll=true)
   *
   * Set to false when:
   * - Normal gameplay file changes (user actually found a new item)
   *
   * Note: Items are ALWAYS saved to database regardless of silent flag.
   * Only notifications are suppressed.
   */
  silent?: boolean;
  /**
   * When true, marks items found during this event as being from the initial
   * application startup scan. These items will be excluded from statistics
   * like Recent Finds, Current Streak, and Avg per Day.
   *
   * Set to true ONLY when:
   * - Initial parsing on application startup (isInitialParsing=true)
   *
   * Set to false when:
   * - User manually triggers "Re-scan all files" (forceParseAll=true)
   * - Normal gameplay file changes
   */
  isInitialScan?: boolean;
};

/**
 * Interface representing the state of a save file for tracking modifications.
 */
export interface SaveFileState {
  id: string;
  filePath: string;
  lastModified: Date;
  lastParsed: Date;
  created: Date;
  updated: Date;
}

/**
 * Type representing a save file state as stored in the database.
 * SQLite-compatible types: dates as strings
 */
export type DatabaseSaveFileState = {
  id: string;
  file_path: string;
  last_modified: string;
  last_parsed: string;
  created_at: string;
  updated_at: string;
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
 * Information about an available update.
 */
export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  downloadedPercent?: number;
}

/**
 * Current status of the application update process.
 */
export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error?: string;
  info?: UpdateInfo;
}
