import { toast } from 'sonner';
import type { ActiveInventoryDragItem } from '@/components/inventory/dragPayloads';
import {
  EQUIPPED_SLOT_IDS,
  type EquippedWeaponSet,
  PAPER_DOLL_SLOT_ORDER,
  type PaperDollSlotKey,
  resolvePaperDollSlotKey,
} from '@/components/inventory/spatialLayout';
import { translations } from '@/i18n/translations';

export type EquipValidationCode =
  | 'INVALID_SLOT'
  | 'CLASS_RESTRICTED'
  | 'OFFHAND_WEAPON_RESTRICTED'
  | 'TWO_HANDED_REQUIRES_RIGHT_HAND'
  | 'TWO_HANDED_OFFHAND_OCCUPIED'
  | 'OFFHAND_BLOCKED_BY_TWO_HANDED'
  | 'TARGET_SLOT_OCCUPIED';
const EQUIP_VALIDATION_ERROR_PATTERN = /EQUIP_VALIDATION:([A-Z_]+)/;
const EQUIP_VALIDATION_CODES = new Set<EquipValidationCode>([
  'INVALID_SLOT',
  'CLASS_RESTRICTED',
  'OFFHAND_WEAPON_RESTRICTED',
  'TWO_HANDED_REQUIRES_RIGHT_HAND',
  'TWO_HANDED_OFFHAND_OCCUPIED',
  'OFFHAND_BLOCKED_BY_TWO_HANDED',
  'TARGET_SLOT_OCCUPIED',
]);

function resolveEquipValidationReasonTranslationKey(code: EquipValidationCode): string {
  switch (code) {
    case 'INVALID_SLOT':
      return translations.inventoryBrowser.equipValidation.reasons.invalidSlot;
    case 'CLASS_RESTRICTED':
      return translations.inventoryBrowser.equipValidation.reasons.classRestricted;
    case 'OFFHAND_WEAPON_RESTRICTED':
      return translations.inventoryBrowser.equipValidation.reasons.offhandWeaponRestricted;
    case 'TWO_HANDED_REQUIRES_RIGHT_HAND':
      return translations.inventoryBrowser.equipValidation.reasons.twoHandedRequiresRightHand;
    case 'TWO_HANDED_OFFHAND_OCCUPIED':
      return translations.inventoryBrowser.equipValidation.reasons.twoHandedOffhandOccupied;
    case 'OFFHAND_BLOCKED_BY_TWO_HANDED':
      return translations.inventoryBrowser.equipValidation.reasons.offhandBlockedByTwoHanded;
    case 'TARGET_SLOT_OCCUPIED':
      return translations.inventoryBrowser.equipValidation.reasons.targetSlotOccupied;
    default:
      return translations.inventoryBrowser.equipValidation.reasons.invalidSlot;
  }
}

export function parseEquipValidationCode(error: unknown): EquipValidationCode | undefined {
  const message =
    typeof error === 'string'
      ? error
      : typeof (error as { message?: unknown })?.message === 'string'
        ? (error as { message: string }).message
        : undefined;
  if (!message) {
    return undefined;
  }

  const match = EQUIP_VALIDATION_ERROR_PATTERN.exec(message);
  if (!match?.[1]) {
    return undefined;
  }

  const code = match[1] as EquipValidationCode;
  return EQUIP_VALIDATION_CODES.has(code) ? code : undefined;
}

export function showEquipValidationToastIfPresent(
  error: unknown,
  t: (key: string, options?: Record<string, unknown>) => string,
): boolean {
  const equipValidationCode = parseEquipValidationCode(error);
  if (!equipValidationCode) {
    return false;
  }

  toast.error(t(translations.inventoryBrowser.equipValidation.title), {
    description: t(resolveEquipValidationReasonTranslationKey(equipValidationCode)),
  });
  return true;
}

export function resolveTargetEquippedSlotId(
  slotKey: PaperDollSlotKey,
  weaponSet: EquippedWeaponSet,
): number {
  if (slotKey === 'rightHand') {
    return weaponSet === 'ii' ? 11 : 4;
  }

  if (slotKey === 'leftHand') {
    return weaponSet === 'ii' ? 12 : 5;
  }

  return EQUIPPED_SLOT_IDS[slotKey];
}

function parseRawTypeName(rawItemJson: string): string {
  try {
    const parsed = JSON.parse(rawItemJson) as {
      type_name?: unknown;
      name?: unknown;
      type?: unknown;
    };

    if (typeof parsed.type_name === 'string' && parsed.type_name.trim().length > 0) {
      return parsed.type_name.toLowerCase();
    }

    if (typeof parsed.name === 'string' && parsed.name.trim().length > 0) {
      return parsed.name.toLowerCase();
    }

    if (typeof parsed.type === 'string' && parsed.type.trim().length > 0) {
      return parsed.type.toLowerCase();
    }
  } catch {
    // Use fallback below.
  }

  return '';
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Equipment-slot inference intentionally combines code, raw tooltip name hints, and equipped-slot fallbacks.
export function resolveEligibleEquipmentSlots(
  item: ActiveInventoryDragItem,
): Set<PaperDollSlotKey> {
  const slots = new Set<PaperDollSlotKey>();
  const sourceSlot = resolvePaperDollSlotKey(item.sourceEquippedSlotId);
  const sourceCode = item.itemCode?.toLowerCase();
  const typeText = parseRawTypeName(item.rawItemJson);
  const hasKeyword = (keyword: string) => typeText.includes(keyword);

  if (sourceCode === 'rin' || typeText === 'ring' || hasKeyword(' ring')) {
    slots.add('leftRing');
    slots.add('rightRing');
  }

  if (sourceCode === 'amu' || hasKeyword('amulet')) {
    slots.add('amulet');
  }

  if (
    hasKeyword('helm') ||
    hasKeyword('coronet') ||
    hasKeyword('circlet') ||
    hasKeyword('tiara') ||
    hasKeyword('diadem') ||
    hasKeyword('mask') ||
    hasKeyword('crown') ||
    hasKeyword('pelt')
  ) {
    slots.add('head');
  }

  if (hasKeyword('glove') || hasKeyword('gauntlet') || hasKeyword('bracer') || hasKeyword('mitt')) {
    slots.add('gloves');
  }

  if (hasKeyword('boot') || hasKeyword('greaves')) {
    slots.add('boots');
  }

  if (hasKeyword('belt') || hasKeyword('sash') || hasKeyword('girdle') || hasKeyword('coil')) {
    slots.add('belt');
  }

  if (hasKeyword('shield')) {
    slots.add('leftHand');
  }

  const isLikelyWeapon =
    hasKeyword('sword') ||
    hasKeyword('axe') ||
    hasKeyword('mace') ||
    hasKeyword('staff') ||
    hasKeyword('wand') ||
    hasKeyword('spear') ||
    hasKeyword('polearm') ||
    hasKeyword('bow') ||
    hasKeyword('crossbow') ||
    hasKeyword('orb') ||
    hasKeyword('javelin') ||
    hasKeyword('dagger') ||
    hasKeyword('flail') ||
    hasKeyword('hammer') ||
    hasKeyword('claw') ||
    hasKeyword('knife');

  if (isLikelyWeapon) {
    slots.add('rightHand');
    slots.add('leftHand');
  }

  const isLikelyArmor =
    hasKeyword('armor') ||
    hasKeyword('mail') ||
    hasKeyword('plate') ||
    hasKeyword('robe') ||
    hasKeyword('skin') ||
    hasKeyword('harness') ||
    hasKeyword('cuirass') ||
    hasKeyword('shell');
  if (isLikelyArmor && !slots.has('head') && !slots.has('belt') && !slots.has('boots')) {
    slots.add('armor');
  }

  if (sourceSlot) {
    if (sourceSlot === 'leftRing' || sourceSlot === 'rightRing') {
      slots.add('leftRing');
      slots.add('rightRing');
    } else if (sourceSlot === 'leftHand' || sourceSlot === 'rightHand') {
      slots.add('leftHand');
      slots.add('rightHand');
    } else {
      slots.add(sourceSlot);
    }
  }

  if (slots.size === 0) {
    return new Set(PAPER_DOLL_SLOT_ORDER);
  }

  return slots;
}
