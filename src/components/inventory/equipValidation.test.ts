import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import { constants as constants105 } from '@dschu012/d2s/lib/data/versions/105_constant_data';
import {
  buildItemEquipMetadataByCode,
  resolveEligibleEquippedSlotIds,
} from 'electron/utils/equipSlots';
import { describe, expect, it } from 'vitest';
import {
  parseEquipValidationCode,
  resolveEligibleEquipmentSlots,
  resolveTargetEquippedSlotId,
} from '@/components/inventory/equipValidation';
import { EQUIPPED_SLOT_IDS, type PaperDollSlotKey } from '@/components/inventory/spatialLayout';
import { REPRESENTATIVE_ITEM_CODES } from '@/test/equipRepresentativeItems';

interface ItemTable {
  c?: unknown;
}

interface ConstantTables {
  armor_items: Record<string, ItemTable>;
  weapon_items: Record<string, ItemTable>;
  other_items: Record<string, ItemTable>;
}

/** The save file editor looks item codes up in the v99 and v96 tables. */
const MAIN_PROCESS_METADATA = buildItemEquipMetadataByCode([constants99, constants96]);

function findItemTable(constants: ConstantTables, code: string): ItemTable | undefined {
  return constants.armor_items[code] ?? constants.weapon_items[code] ?? constants.other_items[code];
}

function toPaperDollSlotIds(slots: Set<PaperDollSlotKey>): number[] {
  return [...slots].map((slot) => EQUIPPED_SLOT_IDS[slot]).sort((left, right) => left - right);
}

function mainProcessSlotIds(code: string): number[] {
  const slots = resolveEligibleEquippedSlotIds(MAIN_PROCESS_METADATA.get(code)?.categories);
  return [...(slots ?? [])].sort((left, right) => left - right);
}

/**
 * Data plumbing parity only: the d2s item table categories (which the save file editor reads) and
 * the categories d2s stores on a parsed item (`rawItemJson.categories`, which the browser reads)
 * must resolve to the same slots. Both sides use the shared `resolveEligibleEquippedSlotIds`, so
 * this does not test the rules themselves; the editor's real accept/reject behavior is covered by
 * `saveFileEditor.equipEligibility.test.ts`.
 */
describe('When the item table categories and the parsed item categories resolve equip slots', () => {
  const versions = [
    ['v99', constants99 as unknown as ConstantTables],
    ['v105', constants105 as unknown as ConstantTables],
  ] as const;
  const cases = versions.flatMap(([version, constants]) =>
    REPRESENTATIVE_ITEM_CODES.map((code) => [version, code, constants] as const),
  );

  it.each(
    cases,
  )('Then the %s parse of item %s allows the slots of its table entry', (_version, code, constants) => {
    // Arrange: d2s stores the item type categories of its constant data on the parsed item.
    const rawItemJson = JSON.stringify({
      type: code,
      categories: findItemTable(constants, code)?.c,
    });

    // Act
    const rendererSlots = toPaperDollSlotIds(resolveEligibleEquipmentSlots({ rawItemJson }));

    // Assert
    expect(rendererSlots).toEqual(mainProcessSlotIds(code));
  });
});

describe('When the browser highlights equipment slots for a dragged item', () => {
  it.each([
    ['uap', ['head']],
    ['dr1', ['head']],
    ['uui', ['armor']],
    ['lrg', ['leftHand']],
    ['2hs', ['leftHand', 'rightHand']],
    ['rin', ['leftRing', 'rightRing']],
    ['vbl', ['belt']],
  ])('Then item %s may go to %j', (code, expectedSlots) => {
    // Arrange
    const rawItemJson = JSON.stringify({
      type: code,
      categories: findItemTable(constants99 as unknown as ConstantTables, code)?.c,
    });

    // Act
    const slots = resolveEligibleEquipmentSlots({ rawItemJson });

    // Assert
    expect([...slots].sort()).toEqual([...expectedSlots].sort());
  });

  it('If the raw item has no categories, Then no slot is eligible', () => {
    // Arrange
    const rawItemJson = JSON.stringify({ type_name: 'Shako', code: 'uap' });

    // Act
    const slots = resolveEligibleEquipmentSlots({ rawItemJson });

    // Assert
    expect(slots.size).toBe(0);
  });

  it('If the raw item JSON is invalid, Then no slot is eligible', () => {
    // Arrange / Act
    const slots = resolveEligibleEquipmentSlots({ rawItemJson: '{not json' });

    // Assert
    expect(slots.size).toBe(0);
  });
});

describe('When a paper doll slot is turned into a save file slot id', () => {
  it.each([
    ['rightHand', 'i', 4],
    ['leftHand', 'i', 5],
    ['rightHand', 'ii', 11],
    ['leftHand', 'ii', 12],
    ['head', 'ii', 1],
  ] as const)('Then %s in weapon set %s is slot %i', (slotKey, weaponSet, expectedSlotId) => {
    // Arrange / Act
    const slotId = resolveTargetEquippedSlotId(slotKey, weaponSet);

    // Assert
    expect(slotId).toBe(expectedSlotId);
  });
});

describe('When an equip validation error is parsed', () => {
  it('Then the code is read from an Error message', () => {
    // Arrange / Act
    const code = parseEquipValidationCode(new Error('EQUIP_VALIDATION:CLASS_RESTRICTED'));

    // Assert
    expect(code).toBe('CLASS_RESTRICTED');
  });

  it('If the code is unknown, Then it returns undefined', () => {
    // Arrange / Act
    const code = parseEquipValidationCode('EQUIP_VALIDATION:SOMETHING_ELSE');

    // Assert
    expect(code).toBeUndefined();
  });

  it('If the error is not an equip validation error, Then it returns undefined', () => {
    // Arrange / Act
    const code = parseEquipValidationCode(new Error('TARGET_CELL_OCCUPIED'));

    // Assert
    expect(code).toBeUndefined();
  });
});
