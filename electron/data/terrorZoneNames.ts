/**
 * Mapping of terror zone IDs to human-readable names.
 * Based on the desecratedzones.json structure from Diablo II: Resurrected (Reign of the Warlock expansion).
 */
export const TERROR_ZONE_NAMES: Record<string, string> = {
  'Act1-BurialGrounds': 'Burial Grounds, Crypt, and Mausoleum',
  'Act1-Catacombs': 'Cathedral and Catacombs',
  'Act1-ColdPlains': 'Cold Plains and Cave',
  'Act1-DarkWood': 'Dark Wood and Underground Passage',
  'Act1-BloodMoor': 'Blood Moor and Den of Evil',
  'Act1-Jail': 'Jail and Barracks',
  'Act1-MooMooFarm': 'Moo Moo Farm',
  'Act1-StonyField': 'Stony Field',
  'Act1-BlackMarsh': 'Black Marsh and the Hole',
  'Act1-Tower': 'Forgotten Tower',
  'Act1-Pit': 'Pit',
  'Act1-Tristram': 'Tristram',
  'Act1-Monastery': 'Monastery',
  'Act2-Sewers': 'Lut Gholein Sewers',
  'Act2-RockyWaste': 'Rocky Waste',
  'Act2-DryHills': 'Dry Hills and Halls of the Dead',
  'Act2-FarOasis': 'Far Oasis',
  'Act2-LostCity': 'Lost City',
  'Act2-TalRashas': "Tal Rasha's Tombs",
  'Act2-ArcaneSanctuary': 'Arcane Sanctuary',
  'Act3-SpiderForest': 'Spider Forest',
  'Act3-GreatMarsh': 'Great Marsh',
  'Act3-FlayerJungle': 'Flayer Jungle',
  'Act3-Kurast': 'Kurast',
  'Act3-Travincal': 'Travincal',
  'Act3-DuranceOfHate': 'Durance of Hate',
  Act4_OuterSteppes: 'Outer Steppes',
  'Act4-RiverOfFlame': 'River of Flame',
  'Act4-ChaosSanctuary': 'Chaos Sanctuary',
  'Act5-BloodyFoothils': 'Bloody Foothills',
  'Act5-ArreatPlateau': 'Arreat Plateau',
  'Act5-CrystallinePassage': 'Crystalline Passage',
  'Act5-Halls': "Nihlathak's Temple and Halls",
  'Act5-GlacialTrail': 'Glacial Trail',
  'Act5-AncientsWay': "Ancient's Way",
  'Act5-FrozenTundra': 'Frozen Tundra',
  'Act5-WorldstoneKeep': 'Worldstone Keep',
};

/**
 * Mapping from numeric zone indices to string zone IDs.
 * Uses 1-based indexing following the order of zones in desecratedzones.json.
 * Used for converting legacy numeric IDs (1-34) to current string IDs.
 *
 * The game file has 34 zones in its zones array (zones_0 through zones_33, with gaps).
 * Old user configurations used 1-based numbering (Zone 1, Zone 2, ... Zone 34).
 * This mapping preserves that 1-based convention for backward compatibility.
 */
export const NUMERIC_TO_STRING_ZONE_ID: Record<number, string> = {
  1: 'Act1-BurialGrounds',
  2: 'Act1-Catacombs',
  3: 'Act1-ColdPlains',
  4: 'Act1-DarkWood',
  5: 'Act1-BloodMoor',
  6: 'Act1-Jail',
  7: 'Act1-MooMooFarm',
  8: 'Act1-Tristram',
  9: 'Act1-Tower',
  10: 'Act1-Monastery',
  11: 'Act2-Sewers',
  12: 'Act2-RockyWaste',
  13: 'Act2-DryHills',
  14: 'Act2-FarOasis',
  15: 'Act2-LostCity',
  16: 'Act2-TalRashas',
  17: 'Act2-ArcaneSanctuary',
  18: 'Act3-SpiderForest',
  19: 'Act3-GreatMarsh',
  20: 'Act3-FlayerJungle',
  21: 'Act3-Kurast',
  22: 'Act3-Travincal',
  23: 'Act3-DuranceOfHate',
  24: 'Act4_OuterSteppes',
  25: 'Act4-RiverOfFlame',
  26: 'Act4-ChaosSanctuary',
  27: 'Act5-BloodyFoothils',
  28: 'Act5-ArreatPlateau',
  29: 'Act5-CrystallinePassage',
  30: 'Act5-Halls',
  31: 'Act5-GlacialTrail',
  32: 'Act5-AncientsWay',
  33: 'Act5-FrozenTundra',
  34: 'Act5-WorldstoneKeep',
};
