import type { types as d2sTypes } from '@dschu012/d2s';
import { describe, expect, it } from 'vitest';
import { RESOURCE_STASH_STACK_ATTR_ID } from '../../utils/d2rFormat';
import {
  applyWriteQuantity,
  assertStackMoveIsLossless,
  isResourceCodeAllowedForTab,
  shouldKeepQuantity,
  stripResourceStashStackMetadata,
  withReducedQuantity,
  withUpdatedResourceStackCount,
} from './resourceStacks';

function item(fields: Record<string, unknown>): d2sTypes.IItem {
  return fields as unknown as d2sTypes.IItem;
}

function runeStack(count: number): d2sTypes.IItem {
  return item({
    id: 9,
    code: 'r01',
    quantity: count,
    magic_attributes: [
      { id: RESOURCE_STASH_STACK_ATTR_ID, values: [count] },
      { id: 7, values: [1] },
    ],
  });
}

describe('When a resource stack leaves its resource tab', () => {
  describe('If the stack holds more than one unit', () => {
    it('Then only a target that keeps stack counts accepts the whole stack', () => {
      // Act
      const toSharedTab = () => assertStackMoveIsLossless(runeStack(50), false);
      const toResourceTab = () => assertStackMoveIsLossless(runeStack(50), true);
      const singleRune = () => assertStackMoveIsLossless(runeStack(1), false);

      // Assert
      expect(toSharedTab).toThrow('STACK_MOVE_REQUIRES_SPLIT');
      expect(toResourceTab).not.toThrow();
      expect(singleRune).not.toThrow();
    });
  });

  describe('If a quantity is requested for the write', () => {
    it('Then resource items get that stack count and other items stay unchanged', () => {
      // Arrange
      const tome = item({ code: 'tbk', quantity: 12 });

      // Act
      const runes = applyWriteQuantity(runeStack(10), 3, true);
      const unchangedTome = applyWriteQuantity(tome, 3, false);
      const tooManyForSharedTab = () => applyWriteQuantity(runeStack(10), 3, false);

      // Assert
      expect((runes as unknown as { quantity: number }).quantity).toBe(3);
      expect(unchangedTome).toBe(tome);
      expect(tooManyForSharedTab).toThrow('STACK_MOVE_REQUIRES_SPLIT');
    });
  });
});

describe('When the stack metadata of a resource item is changed', () => {
  it('Then stripping it keeps one unit without the stack attribute and id', () => {
    // Act
    const stripped = stripResourceStashStackMetadata(runeStack(5)) as unknown as {
      id?: number;
      quantity: number;
      magic_attributes: Array<{ id: number }>;
    };

    // Assert
    expect(stripped.id).toBeUndefined();
    expect(stripped.quantity).toBe(1);
    expect(stripped.magic_attributes.map((attribute) => attribute.id)).toEqual([7]);
  });

  it('Then updating the count changes both the stack attribute and the quantity', () => {
    // Act
    const updated = withUpdatedResourceStackCount(runeStack(5), 2) as unknown as {
      quantity: number;
      magic_attributes: Array<{ id: number; values: number[] }>;
    };

    // Assert
    expect(updated.quantity).toBe(2);
    expect(updated.magic_attributes[0]?.values).toEqual([2]);
    expect(updated.magic_attributes[1]?.values).toEqual([1]);
  });
});

describe('When quantities of stackable items are computed', () => {
  it('Then shared tabs keep native stacks but only one unit of a resource stack', () => {
    // Act & Assert
    expect(shouldKeepQuantity(item({ code: 'tbk', quantity: 12 }))).toBe(12);
    expect(shouldKeepQuantity(runeStack(12))).toBe(1);
    expect(shouldKeepQuantity(item({ code: 'tbk' }))).toBe(1);
  });

  it('Then a reduced quantity never drops below zero', () => {
    // Act
    const reduced = withReducedQuantity(item({ quantity: 2 }), 5) as unknown as {
      quantity: number;
    };

    // Assert
    expect(reduced.quantity).toBe(0);
  });
});

describe('When an item code is checked against a resource tab', () => {
  it('Then gems, materials and runes only fit their own tab', () => {
    // Act & Assert
    expect(isResourceCodeAllowedForTab('r01', 7)).toBe(true);
    expect(isResourceCodeAllowedForTab('r01', 5)).toBe(false);
    expect(isResourceCodeAllowedForTab('r01', 0)).toBe(false);
  });
});
