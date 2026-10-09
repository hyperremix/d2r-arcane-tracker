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
      // Arrange
      const stack = runeStack(50);
      const singleRuneStack = runeStack(1);

      // Act
      const toSharedTab = () => assertStackMoveIsLossless(stack, false);
      const toResourceTab = () => assertStackMoveIsLossless(stack, true);
      const singleRune = () => assertStackMoveIsLossless(singleRuneStack, false);

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
      const stack = runeStack(10);

      // Act
      const runes = applyWriteQuantity(stack, 3, true);
      const unchangedTome = applyWriteQuantity(tome, 3, false);
      const tooManyForSharedTab = () => applyWriteQuantity(stack, 3, false);

      // Assert
      expect((runes as unknown as { quantity: number }).quantity).toBe(3);
      expect(unchangedTome).toBe(tome);
      expect(tooManyForSharedTab).toThrow('STACK_MOVE_REQUIRES_SPLIT');
    });
  });
});

describe('When the stack metadata of a resource item is changed', () => {
  it('Then stripping it keeps one unit without the stack attribute and id', () => {
    // Arrange
    const stack = runeStack(5);

    // Act
    const stripped = stripResourceStashStackMetadata(stack) as unknown as {
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
    // Arrange
    const stack = runeStack(5);

    // Act
    const updated = withUpdatedResourceStackCount(stack, 2) as unknown as {
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
    // Arrange
    const tomeStack = item({ code: 'tbk', quantity: 12 });
    const runes = runeStack(12);
    const tomeWithoutQuantity = item({ code: 'tbk' });

    // Act
    const tomeQuantity = shouldKeepQuantity(tomeStack);
    const runeQuantity = shouldKeepQuantity(runes);
    const defaultQuantity = shouldKeepQuantity(tomeWithoutQuantity);

    // Assert
    expect(tomeQuantity).toBe(12);
    expect(runeQuantity).toBe(1);
    expect(defaultQuantity).toBe(1);
  });

  it('Then a reduced quantity never drops below zero', () => {
    // Arrange
    const stack = item({ quantity: 2 });

    // Act
    const reduced = withReducedQuantity(stack, 5) as unknown as {
      quantity: number;
    };

    // Assert
    expect(reduced.quantity).toBe(0);
  });
});

describe('When an item code is checked against a resource tab', () => {
  it('Then gems, materials and runes only fit their own tab', () => {
    // Arrange
    const runeCode = 'r01';

    // Act
    const inRuneTab = isResourceCodeAllowedForTab(runeCode, 7);
    const inGemTab = isResourceCodeAllowedForTab(runeCode, 5);
    const inSharedTab = isResourceCodeAllowedForTab(runeCode, 0);

    // Assert
    expect(inRuneTab).toBe(true);
    expect(inGemTab).toBe(false);
    expect(inSharedTab).toBe(false);
  });
});
