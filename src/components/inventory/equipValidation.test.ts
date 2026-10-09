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

/** Representative items of every slot family, including class-specific and two-handed items. */
const REPRESENTATIVE_ITEM_CODES = [
  'cap', // Cap (helm)
  'uap', // Shako (helm)
  'ci0', // Circlet
  'ci3', // Diadem
  'dr1', // Wolf Head (druid pelt)
  'ba1', // Jawbone Cap (barbarian helm)
  'uh9', // Bone Visage
  'qui', // Quilted Armor
  'uui', // Dusk Shroud
  'lgl', // Leather Gloves
  'hgl', // Gauntlets
  'lbt', // Boots
  'uvb', // Scarabshell Boots
  'lbl', // Sash
  'vbl', // Light Belt
  'buc', // Buckler
  'lrg', // Large Shield
  'pa1', // Targe (paladin shield)
  'ne1', // Preserved Head (necromancer shield)
  'ssd', // Short Sword
  '2hs', // Two-Handed Sword
  '7gd', // Colossus Blade
  '7wa', // Berserker Axe
  'ktr', // Katar (assassin claw)
  'ob1', // Eagle Orb (sorceress)
  'am1', // Stag Bow (amazon)
  'sbw', // Short Bow
  '6cs', // Elder Staff
  'jav', // Javelin
  'rin', // Ring
  'amu', // Amulet
  'r01', // El Rune (not equippable)
  'gsv', // Amethyst (not equippable)
];

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

describe('When the browser highlights equipment slots for a dragged item', () => {
  it.each([
    ['v99', constants99 as unknown as ConstantTables],
    ['v105', constants105 as unknown as ConstantTables],
  ])('Then it allows exactly the slots the save file editor accepts (%s parse)', (_version, constants) => {
    for (const code of REPRESENTATIVE_ITEM_CODES) {
      // Arrange: d2s stores the item type categories of its constant data on the parsed item.
      const rawItemJson = JSON.stringify({
        type: code,
        categories: findItemTable(constants, code)?.c,
      });

      // Act
      const rendererSlots = toPaperDollSlotIds(resolveEligibleEquipmentSlots({ rawItemJson }));

      // Assert
      expect({ code, slots: rendererSlots }).toEqual({ code, slots: mainProcessSlotIds(code) });
    }
  });

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
