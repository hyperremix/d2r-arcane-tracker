import {
  EQUIP_VALIDATION_CODES,
  EQUIP_VALIDATION_PREFIX,
  type EquipValidationCode,
  normalizeEquipCategories,
  resolveEligibleEquippedSlotIds,
} from 'electron/utils/equipSlots';
import { toast } from 'sonner';
import type { ActiveInventoryDragItem } from '@/components/inventory/dragPayloads';
import { getErrorMessage } from '@/components/inventory/operationErrors';
import {
  EQUIPPED_SLOT_IDS,
  type EquippedWeaponSet,
  type PaperDollSlotKey,
  resolvePaperDollSlotKey,
} from '@/components/inventory/spatialLayout';
import { translations } from '@/i18n/translations';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const EQUIP_VALIDATION_ERROR_PATTERN = new RegExp(`${EQUIP_VALIDATION_PREFIX}:([A-Z_]+)`);

const EQUIP_VALIDATION_REASON_KEYS: Record<EquipValidationCode, string> = {
  INVALID_SLOT: translations.inventoryBrowser.equipValidation.reasons.invalidSlot,
  CLASS_RESTRICTED: translations.inventoryBrowser.equipValidation.reasons.classRestricted,
  OFFHAND_WEAPON_RESTRICTED:
    translations.inventoryBrowser.equipValidation.reasons.offhandWeaponRestricted,
  TWO_HANDED_REQUIRES_RIGHT_HAND:
    translations.inventoryBrowser.equipValidation.reasons.twoHandedRequiresRightHand,
  TWO_HANDED_OFFHAND_OCCUPIED:
    translations.inventoryBrowser.equipValidation.reasons.twoHandedOffhandOccupied,
  OFFHAND_BLOCKED_BY_TWO_HANDED:
    translations.inventoryBrowser.equipValidation.reasons.offhandBlockedByTwoHanded,
  TARGET_SLOT_OCCUPIED: translations.inventoryBrowser.equipValidation.reasons.targetSlotOccupied,
};

/**
 * Reads the equip validation code from an `EQUIP_VALIDATION:<code>` error of the save file editor.
 *
 * @returns The code, or `undefined` for any other error
 */
export function parseEquipValidationCode(error: unknown): EquipValidationCode | undefined {
  const message = getErrorMessage(error);
  if (!message) {
    return undefined;
  }

  const match = EQUIP_VALIDATION_ERROR_PATTERN.exec(message);
  const code = match?.[1] as EquipValidationCode | undefined;
  return code && EQUIP_VALIDATION_CODES.has(code) ? code : undefined;
}

/**
 * Shows the "equip blocked" toast with the reason when the error is an equip validation error.
 *
 * @returns `true` when a toast was shown
 */
export function showEquipValidationToastIfPresent(error: unknown, t: Translate): boolean {
  const equipValidationCode = parseEquipValidationCode(error);
  if (!equipValidationCode) {
    return false;
  }

  toast.error(t(translations.inventoryBrowser.equipValidation.title), {
    description: t(EQUIP_VALIDATION_REASON_KEYS[equipValidationCode]),
  });
  return true;
}

/** Save file slot id of a paper doll slot; the hand slots depend on the shown weapon set. */
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

function parseRawItemCategories(rawItemJson: string): Set<string> | undefined {
  try {
    const parsed = JSON.parse(rawItemJson) as { categories?: unknown } | null;
    return normalizeEquipCategories(parsed?.categories);
  } catch {
    return undefined;
  }
}

/**
 * Paper doll slots the dragged item may be dropped on. Uses the same item type rules as the save
 * file editor, applied to the categories d2s stored on the parsed item. Class and two-handed
 * rules are still checked by the save file editor when the item is dropped.
 *
 * @param item - Dragged inventory item
 * @returns Eligible slots; empty when the item cannot be equipped
 */
export function resolveEligibleEquipmentSlots(
  item: Pick<ActiveInventoryDragItem, 'rawItemJson'>,
): Set<PaperDollSlotKey> {
  const slotIds = resolveEligibleEquippedSlotIds(parseRawItemCategories(item.rawItemJson));
  const slots = new Set<PaperDollSlotKey>();

  for (const slotId of slotIds ?? []) {
    const slotKey = resolvePaperDollSlotKey(slotId);
    if (slotKey) {
      slots.add(slotKey);
    }
  }

  return slots;
}
