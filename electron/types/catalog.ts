/**
 * Item catalog definitions: the Holy Grail item model and its classification unions.
 *
 * Shared by the main process and the renderer; re-exported from `./grail`.
 */

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
