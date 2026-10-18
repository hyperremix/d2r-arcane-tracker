/**
 * Where the super uniques and bosses of the game data stand. The game places them through its map
 * presets, not through the data tables the farming advisor reads, so the areas are listed here by
 * levels.txt Id. Super uniques the game doesn't place in a fixed area (for example the ones only
 * quests spawn) are left out.
 */

/** Area of each super unique, by its superuniques.txt `Superunique` key. */
export const SUPER_UNIQUE_AREA_IDS: Readonly<Record<string, number>> = {
  Bishibosh: 3,
  Bonebreak: 18,
  Coldcrow: 9,
  Rakanishu: 4,
  'Treehead WoodFist': 5,
  Griswold: 38,
  'The Countess': 25,
  'Pitspawn Fouldog': 30,
  Boneash: 33,
  Radament: 49,
  'Bloodwitch the Wild': 60,
  Fangskin: 61,
  Beetleburst: 43,
  Leatherarm: 59,
  'Coldworm the Burrower': 64,
  'Fire Eye': 54,
  'Dark Elder': 44,
  // Ancient Kaa stands in the true Tal Rasha's Tomb, which is one of seven tombs of the same level
  'Ancient Kaa the Soulless': 66,
  'The Smith': 28,
  'Web Mage the Burning': 85,
  'Witch Doctor Endugu': 91,
  Stormtree: 78,
  'Sarina the Battlemaid': 94,
  'Icehawk Riftwing': 92,
  'Ismail Vilehand': 83,
  'Geleb Flamefinger': 83,
  'Toorc Icefist': 83,
  'Bremm Sparkfist': 102,
  'Wyand Voidfinger': 102,
  'Maffer Dragonhand': 102,
  'Infector of Souls': 108,
  'Lord De Seis': 108,
  'Grand Vizier of Chaos': 108,
  'The Cow King': 39,
  Corpsefire: 8,
  'The Feature Creep': 107,
  'Siege Boss': 110,
  'Dac Farren': 110,
  'Megaflow Rectifier': 111,
  'Eyeback Unleashed': 111,
  'Sharp Tooth Sayer': 111,
  'Threash Socket': 112,
  Frozenstein: 114,
  'Bonesaw Breaker': 115,
  'Snapchip Shatter': 119,
  Pindleskin: 121,
  'Nihlathak Boss': 124,
  'Baal Subject 1': 131,
  'Baal Subject 2': 131,
  'Baal Subject 3': 131,
  'Baal Subject 4': 131,
  'Baal Subject 5': 131,
};

/**
 * Area of each boss that isn't a super unique, by monstats.txt Id. The bosses of the Uber
 * Tristram and Pandemonium events are left out; the Colossal Summit ancients of Reign of the
 * Warlock are included because their treasure classes are the drop source of the colossal jewels.
 * Hephasto the Armorer is in the super uniques above as The Feature Creep (monster hephasto,
 * River of Flame, area 107).
 */
export const BOSS_AREA_IDS: Readonly<Record<string, number>> = {
  bloodraven: 17,
  andariel: 37,
  duriel: 73,
  summoner: 74,
  mephisto: 102,
  izual: 105,
  diablo: 108,
  baalcrab: 132,
  colossal1: 137,
  colossal2: 137,
  colossal3: 137,
};
