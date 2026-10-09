/**
 * Characters and Holy Grail progress, statistics and filters.
 *
 * Shared by the main process and the renderer; re-exported from `./grail`.
 */
import type { CharacterClass, Difficulty, ItemCategory, ItemType } from './catalog';

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
