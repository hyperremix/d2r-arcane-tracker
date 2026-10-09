import type { types as d2sTypes } from '@dschu012/d2s';
import { describe, expect, it } from 'vitest';
import type { CharacterClass } from '../../types/grail';
import { assertEquipValidationRules, resolveTargetCharacterClass } from './equipValidation';

// Slot ids: 1 head, 2 neck, 3 torso, 4 right hand, 5 left hand, 6/7 rings, 8 belt, 9 feet,
// 10 gloves, 11/12 second weapon set.
function item(code: string, equippedSlotId?: number): d2sTypes.IItem {
  return { code, type: code, equipped_id: equippedSlotId } as unknown as d2sTypes.IItem;
}

function validationError(
  candidate: d2sTypes.IItem,
  targetSlotId: number,
  characterClass: CharacterClass | undefined = 'sorceress',
  equippedItems: d2sTypes.IItem[] = [],
): string | undefined {
  try {
    assertEquipValidationRules(candidate, targetSlotId, equippedItems, characterClass);
    return undefined;
  } catch (error) {
    return (error as Error).message;
  }
}

describe('When an item is validated for an equipped slot', () => {
  describe('If armor pieces and jewelry go to their own slots', () => {
    it('Then they are accepted', () => {
      // Arrange
      const placements: [string, number][] = [
        ['cap', 1],
        ['amu', 2],
        ['qui', 3],
        ['rin', 6],
        ['rin', 7],
        ['lbl', 8],
        ['lbt', 9],
        ['lgl', 10],
        ['buc', 5],
      ];

      // Act
      const errors = placements.map(([code, slot]) => validationError(item(code), slot));

      // Assert
      expect(errors).toEqual(placements.map(() => undefined));
    });
  });

  describe('If an item goes to a slot it does not fit', () => {
    it('Then it is rejected as an invalid slot', () => {
      // Arrange
      const ring = item('rin');
      const helm = item('cap');
      const unknown = item('zzz');

      // Act
      const ringOnHead = validationError(ring, 1);
      const helmOnNeck = validationError(helm, 2);
      const unknownItem = validationError(unknown, 4);

      // Assert
      expect(ringOnHead).toBe('EQUIP_VALIDATION:INVALID_SLOT');
      expect(helmOnNeck).toBe('EQUIP_VALIDATION:INVALID_SLOT');
      expect(unknownItem).toBe('EQUIP_VALIDATION:INVALID_SLOT');
    });
  });

  describe('If the target slot is already occupied', () => {
    it('Then it is rejected, also for the second weapon set', () => {
      // Arrange
      const helm = item('cap');
      const equippedHelm = item('cap', 1);
      const sword = item('ssd');
      const equippedSwapSword = item('lsd', 11);

      // Act
      const occupiedHead = validationError(helm, 1, 'sorceress', [equippedHelm]);
      const occupiedSwapHand = validationError(sword, 11, 'sorceress', [equippedSwapSword]);

      // Assert
      expect(occupiedHead).toBe('EQUIP_VALIDATION:TARGET_SLOT_OCCUPIED');
      expect(occupiedSwapHand).toBe('EQUIP_VALIDATION:TARGET_SLOT_OCCUPIED');
    });
  });

  describe('If a class-specific item is equipped', () => {
    it('Then only the matching class may wear it', () => {
      // Arrange
      const amazonBow = item('am1');

      // Act
      const amazonBowOnSorceress = validationError(amazonBow, 4, 'sorceress');
      const amazonBowOnAmazon = validationError(amazonBow, 4, 'amazon');

      // Assert
      expect(amazonBowOnSorceress).toBe('EQUIP_VALIDATION:CLASS_RESTRICTED');
      expect(amazonBowOnAmazon).toBeUndefined();
    });
  });

  describe('If a two-handed weapon is equipped', () => {
    it('Then it needs the right hand and a free left hand', () => {
      // Arrange
      const twoHander = item('gix');
      const equippedShield = item('buc', 5);

      // Act
      const inLeftHand = validationError(twoHander, 5);
      const inSwapLeftHand = validationError(twoHander, 12);
      const besideShield = validationError(twoHander, 4, 'sorceress', [equippedShield]);
      const inFreeRightHand = validationError(twoHander, 4);

      // Assert
      expect(inLeftHand).toBe('EQUIP_VALIDATION:TWO_HANDED_REQUIRES_RIGHT_HAND');
      expect(inSwapLeftHand).toBe('EQUIP_VALIDATION:TWO_HANDED_REQUIRES_RIGHT_HAND');
      expect(besideShield).toBe('EQUIP_VALIDATION:TWO_HANDED_OFFHAND_OCCUPIED');
      expect(inFreeRightHand).toBeUndefined();
    });

    it('Then nothing can go to the left hand of the same weapon set', () => {
      // Arrange
      const shield = item('buc');
      const equippedTwoHander = item('gix', 4);

      // Act
      const shieldBesideTwoHander = validationError(shield, 5, 'sorceress', [equippedTwoHander]);
      const shieldInOtherSet = validationError(shield, 12, 'sorceress', [equippedTwoHander]);

      // Assert
      expect(shieldBesideTwoHander).toBe('EQUIP_VALIDATION:OFFHAND_BLOCKED_BY_TWO_HANDED');
      expect(shieldInOtherSet).toBeUndefined();
    });
  });

  describe('If a weapon goes to the left hand', () => {
    it('Then only barbarians (one-handed and two-handed swords) and assassins (claws) may do it', () => {
      // Arrange
      const sword = item('ssd');
      const twoHandedSword = item('clm');
      const claw = item('ktr');

      // Act
      const sorceressSword = validationError(sword, 5, 'sorceress');
      const barbarianSword = validationError(sword, 5, 'barbarian');
      const barbarianTwoHandedSword = validationError(twoHandedSword, 5, 'barbarian');
      const assassinClaw = validationError(claw, 5, 'assassin');

      // Assert
      expect(sorceressSword).toBe('EQUIP_VALIDATION:OFFHAND_WEAPON_RESTRICTED');
      expect(barbarianSword).toBeUndefined();
      expect(barbarianTwoHandedSword).toBeUndefined();
      expect(assassinClaw).toBeUndefined();
    });
  });
});

describe('When the character class of a save is resolved', () => {
  it('Then full names, short names and casing are normalized', () => {
    // Arrange
    const save = (characterClass: unknown) =>
      ({ header: { class: characterClass } }) as unknown as d2sTypes.ID2S;

    // Act
    const resolved = ['Barbarian', 'barb', 'Sorc', 'Shared Stash', 'Unknown', 42, undefined].map(
      (characterClass) => resolveTargetCharacterClass(save(characterClass)),
    );

    // Assert
    expect(resolved).toEqual([
      'barbarian',
      'barbarian',
      'sorceress',
      'shared_stash',
      undefined,
      undefined,
      undefined,
    ]);
  });
});
