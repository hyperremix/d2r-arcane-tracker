import type { types as d2sTypes } from '@dschu012/d2s';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import type { CharacterClass } from '../../types/grail';
import {
  buildItemEquipMetadataByCode,
  EQUIP_VALIDATION_PREFIX,
  type EquipValidationCode,
  type ItemEquipMetadata,
  isClawCategorySet,
  isShieldCategorySet,
  isSwordCategorySet,
  isWeaponLikeCategorySet,
  normalizeOccupiedWeaponSetSlotId,
  normalizeWeaponSetSlotId,
  resolveEligibleEquippedSlotIds,
  resolveRequiredCharacterClass,
} from '../../utils/equipSlots';
import { normalizeItemId, resolveItemCode } from './itemFields';

/**
 * Equip-slot rules for character saves: which slots an item fits, class restrictions, and
 * two-handed / off-hand constraints. Violations throw `EQUIP_VALIDATION:<code>` errors.
 */

const VALID_EQUIPPED_SLOT_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

const ITEM_EQUIP_METADATA_BY_CODE = buildItemEquipMetadataByCode([constants99, constants96]);

function createEquipValidationError(code: EquipValidationCode): Error {
  return new Error(`${EQUIP_VALIDATION_PREFIX}:${code}`);
}

function resolveItemEquipMetadata(item: d2sTypes.IItem): ItemEquipMetadata {
  const code = resolveItemCode(item);
  if (!code) {
    return {
      categories: undefined,
      hasOneHandDamage: false,
      hasTwoHandDamage: false,
    };
  }

  return (
    ITEM_EQUIP_METADATA_BY_CODE.get(code) ?? {
      categories: undefined,
      hasOneHandDamage: false,
      hasTwoHandDamage: false,
    }
  );
}

function normalizeCharacterClass(rawClass: unknown): CharacterClass | undefined {
  if (typeof rawClass !== 'string' || rawClass.trim().length === 0) {
    return undefined;
  }

  const normalized = rawClass.trim().toLowerCase();
  const compact = normalized.replace(/ /g, '').replace(/_/g, '');

  switch (compact) {
    case 'amazon':
    case 'ama':
      return 'amazon';
    case 'assassin':
    case 'ass':
      return 'assassin';
    case 'barbarian':
    case 'barb':
    case 'bar':
      return 'barbarian';
    case 'druid':
    case 'dru':
      return 'druid';
    case 'necromancer':
    case 'necro':
    case 'nec':
      return 'necromancer';
    case 'paladin':
    case 'pal':
      return 'paladin';
    case 'sorceress':
    case 'sorc':
    case 'sor':
      return 'sorceress';
    case 'sharedstash':
      return 'shared_stash';
    default:
      return undefined;
  }
}

export function resolveTargetCharacterClass(data: d2sTypes.ID2S): CharacterClass | undefined {
  return normalizeCharacterClass((data as { header?: { class?: unknown } }).header?.class);
}

function resolveWeaponSet(slotId: number): 'i' | 'ii' | undefined {
  const normalizedSlotId = normalizeOccupiedWeaponSetSlotId(slotId);
  if (normalizedSlotId === 4 || normalizedSlotId === 5) {
    return 'i';
  }

  if (normalizedSlotId === 11 || normalizedSlotId === 12) {
    return 'ii';
  }

  return undefined;
}

function resolveEquippedSlotId(item: d2sTypes.IItem): number | undefined {
  const slotId = normalizeItemId((item as { equipped_id?: unknown }).equipped_id);
  if (!slotId) {
    return undefined;
  }

  const normalizedSlotId = normalizeOccupiedWeaponSetSlotId(slotId);
  if (!VALID_EQUIPPED_SLOT_IDS.has(normalizedSlotId)) {
    return undefined;
  }

  return normalizedSlotId;
}

function buildEquippedSlotMap(items: d2sTypes.IItem[]): Map<number, d2sTypes.IItem> {
  const map = new Map<number, d2sTypes.IItem>();
  for (const item of items) {
    const slotId = resolveEquippedSlotId(item);
    if (!slotId || map.has(slotId)) {
      continue;
    }

    map.set(slotId, item);
  }

  return map;
}

function isTwoHandedRequiredWeaponForCharacter(
  item: d2sTypes.IItem,
  targetCharacterClass: CharacterClass | undefined,
): boolean {
  const metadata = resolveItemEquipMetadata(item);
  const barbarianTwoHandedSwordException =
    targetCharacterClass === 'barbarian' &&
    isSwordCategorySet(metadata.categories) &&
    metadata.hasTwoHandDamage;

  return (
    isWeaponLikeCategorySet(metadata.categories) &&
    metadata.hasTwoHandDamage &&
    !metadata.hasOneHandDamage &&
    !barbarianTwoHandedSwordException
  );
}

function assertEligibleForEquippedSlot(item: d2sTypes.IItem, targetSlotId: number): void {
  const normalizedTargetSlotId = normalizeWeaponSetSlotId(targetSlotId);
  const eligibleSlots = resolveEligibleEquippedSlotIds(resolveItemEquipMetadata(item).categories);
  if (!eligibleSlots || eligibleSlots.size === 0) {
    throw createEquipValidationError('INVALID_SLOT');
  }

  if (!eligibleSlots.has(normalizedTargetSlotId)) {
    throw createEquipValidationError('INVALID_SLOT');
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Equip validation intentionally combines slot, class, and handedness rules.
export function assertEquipValidationRules(
  item: d2sTypes.IItem,
  targetSlotId: number,
  equippedItems: d2sTypes.IItem[],
  targetCharacterClass: CharacterClass | undefined,
): void {
  const normalizedTargetSlotId = normalizeWeaponSetSlotId(targetSlotId);
  const normalizedOccupiedTargetSlotId = normalizeOccupiedWeaponSetSlotId(targetSlotId);
  const equippedSlots = buildEquippedSlotMap(equippedItems);

  if (equippedSlots.has(normalizedOccupiedTargetSlotId)) {
    throw createEquipValidationError('TARGET_SLOT_OCCUPIED');
  }

  assertEligibleForEquippedSlot(item, targetSlotId);

  const metadata = resolveItemEquipMetadata(item);
  const requiredClass = resolveRequiredCharacterClass(metadata.categories);
  if (requiredClass && targetCharacterClass !== requiredClass) {
    throw createEquipValidationError('CLASS_RESTRICTED');
  }

  const targetWeaponSet = resolveWeaponSet(normalizedOccupiedTargetSlotId);
  if (!targetWeaponSet) {
    return;
  }

  const rightSlotId = targetWeaponSet === 'ii' ? 11 : 4;
  const leftSlotId = targetWeaponSet === 'ii' ? 12 : 5;
  const rightHandItem = equippedSlots.get(rightSlotId);

  if (
    normalizedTargetSlotId === 5 &&
    rightHandItem &&
    isTwoHandedRequiredWeaponForCharacter(rightHandItem, targetCharacterClass)
  ) {
    throw createEquipValidationError('OFFHAND_BLOCKED_BY_TWO_HANDED');
  }

  const isWeaponLike = isWeaponLikeCategorySet(metadata.categories);
  const isShieldLike = isShieldCategorySet(metadata.categories);
  const isTwoHandedRequired = isTwoHandedRequiredWeaponForCharacter(item, targetCharacterClass);

  if (isTwoHandedRequired) {
    if (normalizedTargetSlotId !== 4) {
      throw createEquipValidationError('TWO_HANDED_REQUIRES_RIGHT_HAND');
    }

    if (equippedSlots.has(leftSlotId)) {
      throw createEquipValidationError('TWO_HANDED_OFFHAND_OCCUPIED');
    }
  }

  if (normalizedTargetSlotId === 5 && isWeaponLike && !isShieldLike) {
    const barbarianAllowed =
      targetCharacterClass === 'barbarian' &&
      (metadata.hasOneHandDamage ||
        (isSwordCategorySet(metadata.categories) && metadata.hasTwoHandDamage));
    const assassinAllowed =
      targetCharacterClass === 'assassin' && isClawCategorySet(metadata.categories);

    if (!barbarianAllowed && !assassinAllowed) {
      throw createEquipValidationError('OFFHAND_WEAPON_RESTRICTED');
    }
  }
}
