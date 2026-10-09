import type { CharacterClass } from '../types/grail';

/**
 * Equipment slot rules shared by the save file editor (which enforces them) and the inventory
 * browser (which highlights the slots an item may be dropped on). Pure: no Node, Electron or d2s
 * imports, so the renderer can use it.
 *
 * Slot ids follow d2s `equipped_id`: 1 head, 2 amulet, 3 body armor, 4 right hand, 5 left hand,
 * 6 right ring, 7 left ring, 8 belt, 9 boots, 10 gloves, 11/12 weapon set II right/left hand.
 */

/** Reasons the save file editor refuses an equip move, sent as `EQUIP_VALIDATION:<code>`. */
const EQUIP_VALIDATION_CODE_LIST = [
  'INVALID_SLOT',
  'CLASS_RESTRICTED',
  'OFFHAND_WEAPON_RESTRICTED',
  'TWO_HANDED_REQUIRES_RIGHT_HAND',
  'TWO_HANDED_OFFHAND_OCCUPIED',
  'OFFHAND_BLOCKED_BY_TWO_HANDED',
  'TARGET_SLOT_OCCUPIED',
] as const;

export type EquipValidationCode = (typeof EQUIP_VALIDATION_CODE_LIST)[number];

export const EQUIP_VALIDATION_PREFIX = 'EQUIP_VALIDATION';

export const EQUIP_VALIDATION_CODES: ReadonlySet<EquipValidationCode> = new Set(
  EQUIP_VALIDATION_CODE_LIST,
);

const CLASS_SPECIFIC_CATEGORY_TO_CLASS: Record<string, Exclude<CharacterClass, 'shared_stash'>> = {
  'amazon item': 'amazon',
  'assassin item': 'assassin',
  'barbarian item': 'barbarian',
  'druid item': 'druid',
  'necromancer item': 'necromancer',
  'paladin item': 'paladin',
  'sorceress item': 'sorceress',
};

/** Item table entry of d2s constant data (`c` holds the item type categories). */
interface ConstantItemDefinition {
  c?: unknown;
  mind?: unknown;
  maxd?: unknown;
  min2d?: unknown;
  max2d?: unknown;
}

/** The item tables of d2s constant data. */
interface ConstantDataWithItems {
  armor_items?: Record<string, ConstantItemDefinition>;
  weapon_items?: Record<string, ConstantItemDefinition>;
  other_items?: Record<string, ConstantItemDefinition>;
}

export interface ItemEquipMetadata {
  /** Lower-cased item type categories, for example `helm`, `any armor`, `druid item`. */
  categories?: Set<string>;
  hasOneHandDamage: boolean;
  hasTwoHandDamage: boolean;
}

function toPositiveNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function addNormalizedCategories(target: Set<string>, rawCategories: unknown[]): void {
  for (const category of rawCategories) {
    if (typeof category === 'string') {
      const normalizedCategory = category.trim().toLowerCase();
      if (normalizedCategory.length > 0) {
        target.add(normalizedCategory);
      }
    }
  }
}

/**
 * Normalizes a list of item type categories (as d2s stores them on parsed items).
 *
 * @param rawCategories - Category names, for example `["Helm", "Any Armor"]`
 * @returns Lower-cased categories, or `undefined` when the value is not an array
 */
export function normalizeEquipCategories(rawCategories: unknown): Set<string> | undefined {
  if (!Array.isArray(rawCategories)) {
    return undefined;
  }

  const categories = new Set<string>();
  addNormalizedCategories(categories, rawCategories);
  return categories;
}

function hasPositiveValue(...values: unknown[]): boolean {
  return values.some((value) => toPositiveNumber(value) !== undefined);
}

function mergeItemDefinition(
  existing: ItemEquipMetadata | undefined,
  itemDefinition: ConstantItemDefinition,
): ItemEquipMetadata {
  let categories = existing?.categories;
  if (Array.isArray(itemDefinition.c)) {
    categories = categories ?? new Set<string>();
    addNormalizedCategories(categories, itemDefinition.c);
  }

  return {
    categories,
    hasOneHandDamage:
      (existing?.hasOneHandDamage ?? false) ||
      hasPositiveValue(itemDefinition.mind, itemDefinition.maxd),
    hasTwoHandDamage:
      (existing?.hasTwoHandDamage ?? false) ||
      hasPositiveValue(itemDefinition.min2d, itemDefinition.max2d),
  };
}

/**
 * Builds the equip metadata of every item code from d2s constant data. When several tables know
 * a code, their categories and damage flags are merged.
 *
 * @param constantDataList - d2s constant data, for example of versions 99 and 96
 * @returns Metadata by lower-cased item code
 */
export function buildItemEquipMetadataByCode(
  constantDataList: unknown[],
): Map<string, ItemEquipMetadata> {
  const map = new Map<string, ItemEquipMetadata>();

  for (const constantData of constantDataList) {
    const typedConstantData = constantData as ConstantDataWithItems;
    const records = [
      typedConstantData.armor_items,
      typedConstantData.weapon_items,
      typedConstantData.other_items,
    ];

    for (const record of records) {
      for (const [code, itemDefinition] of Object.entries(record ?? {})) {
        const normalizedCode = code.toLowerCase();
        map.set(normalizedCode, mergeItemDefinition(map.get(normalizedCode), itemDefinition));
      }
    }
  }

  return map;
}

function hasCategoryContaining(categories: Set<string> | undefined, fragment: string): boolean {
  return (
    categories !== undefined && [...categories].some((category) => category.includes(fragment))
  );
}

export function isWeaponLikeCategorySet(categories: Set<string> | undefined): boolean {
  return hasCategoryContaining(categories, 'weapon');
}

export function isShieldCategorySet(categories: Set<string> | undefined): boolean {
  return hasCategoryContaining(categories, 'shield');
}

export function isSwordCategorySet(categories: Set<string> | undefined): boolean {
  return hasCategoryContaining(categories, 'sword');
}

export function isClawCategorySet(categories: Set<string> | undefined): boolean {
  return hasCategoryContaining(categories, 'hand to hand');
}

/** Class that may equip the item, for class-specific items such as pelts or orbs. */
export function resolveRequiredCharacterClass(
  categories: Set<string> | undefined,
): Exclude<CharacterClass, 'shared_stash'> | undefined {
  if (!categories) {
    return undefined;
  }

  for (const [category, characterClass] of Object.entries(CLASS_SPECIFIC_CATEGORY_TO_CLASS)) {
    if (categories.has(category)) {
      return characterClass;
    }
  }

  return undefined;
}

/** Maps the alternate slot ids 13/14 onto the weapon set II slots 11/12. */
export function normalizeOccupiedWeaponSetSlotId(slotId: number): number {
  if (slotId === 13) {
    return 11;
  }

  if (slotId === 14) {
    return 12;
  }

  return slotId;
}

/** Maps every weapon set slot onto the set I right (4) and left (5) hand slots. */
export function normalizeWeaponSetSlotId(slotId: number): number {
  if (slotId === 11 || slotId === 13) {
    return 4;
  }

  if (slotId === 12 || slotId === 14) {
    return 5;
  }

  return slotId;
}

/**
 * Slots an item may be equipped in by its item type categories, before class and two-handed
 * rules. Weapon set slots are reported as the set I hand slots 4 and 5.
 *
 * @param categories - Normalized item type categories
 * @returns Eligible slot ids, or `undefined` when the categories are unknown
 */
export function resolveEligibleEquippedSlotIds(
  categories: Set<string> | undefined,
): Set<number> | undefined {
  const slots = new Set<number>();

  if (!categories || categories.size === 0) {
    return undefined;
  }

  const isRing = categories.has('ring');
  const isAmulet = categories.has('amulet');
  const isHelm = categories.has('helm');
  const isGloves = categories.has('gloves');
  const isBoots = categories.has('boots');
  const isBelt = categories.has('belt');
  const isShield = categories.has('shield') || categories.has('any shield');
  const isWeaponLike = isWeaponLikeCategorySet(categories);
  const isBodyArmor = categories.has('armor') || categories.has('any armor');
  const hasSpecificArmorPieceCategory = isHelm || isGloves || isBoots || isBelt || isShield;

  if (isRing) {
    slots.add(6);
    slots.add(7);
  }

  if (isAmulet) {
    slots.add(2);
  }

  if (isHelm) {
    slots.add(1);
  }

  if (isGloves) {
    slots.add(10);
  }

  if (isBoots) {
    slots.add(9);
  }

  if (isBelt) {
    slots.add(8);
  }

  if (isShield) {
    slots.add(5);
  }

  if (isWeaponLike) {
    slots.add(4);
    slots.add(5);
  }

  if (isBodyArmor && !hasSpecificArmorPieceCategory) {
    slots.add(3);
  }

  return slots;
}
