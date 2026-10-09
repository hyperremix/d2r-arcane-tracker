import { describe, expect, it } from 'vitest';
import {
  getResourceStackAttributeValue,
  isGemCode,
  isMaterialCode,
  isModernStashVersion,
  isResourceCodeOfKind,
  isResourceItemCode,
  isRuneCode,
  MAX_RESOURCE_STACK_COUNT,
  normalizeItemCode,
  normalizeItemCodeKey,
  RESOURCE_STASH_TAB_BY_KIND,
  type ResourceStashTabKind,
  resolveResourceStashTabKind,
  resolveStackCount,
  toFiniteNumber,
} from './d2rFormat';

describe('When isModernStashVersion is called', () => {
  it('Then only versions from 105 on count as modern', () => {
    // Arrange
    const versions = [undefined, 97, 104, 105, 106];

    // Act
    const result = versions.map((version) => isModernStashVersion(version));

    // Assert
    expect(result).toEqual([false, false, false, true, true]);
  });
});

describe('When item codes are normalized', () => {
  it('Then padding and NUL bytes are removed and the case is kept', () => {
    // Arrange
    const raw = ' R01\0\0';

    // Act
    const code = normalizeItemCode(raw);
    const key = normalizeItemCodeKey(raw);

    // Assert
    expect(code).toBe('R01');
    expect(key).toBe('r01');
  });

  it('Then empty and non-string codes yield undefined', () => {
    // Arrange
    const values: unknown[] = ['', '  ', '\0', 42, undefined];

    // Act
    const result = values.map((value) => normalizeItemCode(value));

    // Assert
    expect(result).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });
});

describe('When resource item codes are classified', () => {
  it('Then rune codes match case-insensitively and other codes do not', () => {
    // Arrange
    const codes = ['r01', 'R33', 'r30 ', 'rin', 'gcr', undefined];

    // Act
    const result = codes.map((code) => isRuneCode(code));

    // Assert
    expect(result).toEqual([true, true, true, false, false, false]);
  });

  it('Then runes, gems and materials are resource codes but regular items are not', () => {
    // Arrange
    const codes = ['r01', 'gcr', 'GPW', 'pk1', 'uap'];

    // Act
    const result = codes.map((code) => isResourceItemCode(code));

    // Assert
    expect(result).toEqual([true, true, true, true, false]);
  });

  it('Then each resource tab kind only accepts its own codes', () => {
    // Arrange
    const cases: [string, ResourceStashTabKind][] = [
      ['gcr', 'gems'],
      ['gcr', 'runes'],
      ['pk1', 'materials'],
      ['pk1', 'gems'],
      ['r10', 'runes'],
      ['r10', 'materials'],
    ];

    // Act
    const result = cases.map(([code, kind]) => isResourceCodeOfKind(code, kind));

    // Assert
    expect(result).toEqual([true, false, true, false, true, false]);
  });

  it('Then gem codes match case-insensitively and padded, and other codes do not', () => {
    // Arrange
    const codes = ['gcr', 'GPW', ' gsb\0', 'r01', 'pk1', '', undefined, 7];

    // Act
    const result = codes.map((code) => isGemCode(code));

    // Assert
    expect(result).toEqual([true, true, true, false, false, false, false, false]);
  });

  it('Then material codes match case-insensitively and padded, and other codes do not', () => {
    // Arrange
    const codes = ['pk1', 'RVS', ' xa1\0', 'gcr', 'r01', '', undefined, 7];

    // Act
    const result = codes.map((code) => isMaterialCode(code));

    // Assert
    expect(result).toEqual([true, true, true, false, false, false, false, false]);
  });
});

describe('When resolveResourceStashTabKind is called', () => {
  it('Then the resource tabs map to their kind and shared tabs map to nothing', () => {
    // Arrange
    const tabs = [0, 4, RESOURCE_STASH_TAB_BY_KIND.gems, 6, 7, 8, undefined];

    // Act
    const result = tabs.map((tab) => resolveResourceStashTabKind(tab));

    // Assert
    expect(result).toEqual([
      undefined,
      undefined,
      'gems',
      'materials',
      'runes',
      undefined,
      undefined,
    ]);
  });
});

describe('When toFiniteNumber is called', () => {
  it('Then only finite numbers pass through', () => {
    // Arrange
    const values: unknown[] = [3, 0, Number.NaN, Number.POSITIVE_INFINITY, '3', undefined];

    // Act
    const result = values.map((value) => toFiniteNumber(value));

    // Assert
    expect(result).toEqual([3, 0, undefined, undefined, undefined, undefined]);
  });
});

describe('When getResourceStackAttributeValue is called', () => {
  it('Then it reads the value of attribute 381 and ignores malformed attributes', () => {
    // Arrange
    const withAttribute = { magic_attributes: [{ id: 17 }, { id: 381, values: [12] }] };
    const withoutValues = { magic_attributes: [{ id: 381 }] };
    const withoutAttributes = { magic_attributes: 'broken' };

    // Act
    const values = [withAttribute, withoutValues, withoutAttributes].map((item) =>
      getResourceStackAttributeValue(item),
    );

    // Assert
    expect(values).toEqual([12, undefined, undefined]);
  });
});

describe('When resolveStackCount reads a simple_item resource with quantity set by the v105 field', () => {
  it('Then it returns the item.quantity value as the stack count', () => {
    // Arrange: simple resource items have simple_item=1, no magic_attributes.
    // The d2s v105 conditional field populates item.quantity for these items.
    const simpleRuneWithCount = {
      type: 'r05',
      quantity: 7,
    } as unknown as Parameters<typeof resolveStackCount>[0];

    const simpleRuneWithMaxCount = {
      type: 'r20',
      quantity: 255,
    } as unknown as Parameters<typeof resolveStackCount>[0];

    // Act
    const countFromQuantity = resolveStackCount(simpleRuneWithCount);
    const countFromMaxQuantity = resolveStackCount(simpleRuneWithMaxCount);

    // Assert
    expect(countFromQuantity).toBe(7);
    expect(countFromMaxQuantity).toBe(255);
  });
});

describe('When resolveStackCount checks stackable sources', () => {
  it('Then it only accepts explicit quantity values for modern stash', () => {
    // Arrange
    const fromQuantity = {
      type: 'r01',
      quantity: 9,
    };
    const fallbackToOne = {
      type: 'r03',
      magic_attributes: [{ id: 381, name: 'unknown_381', values: [0] }],
    } as unknown as Parameters<typeof resolveStackCount>[0];
    const fromMagicAttr = {
      type: 'r01',
      magic_attributes: [{ id: 381, name: 'item_quantity_r', values: [42] }],
    } as unknown as Parameters<typeof resolveStackCount>[0];

    const attr381TakesPriorityOverQuantity = {
      type: 'key', // 'key' IS in stackables — quantity would normally be used
      quantity: 3,
      magic_attributes: [{ id: 381, name: 'item_quantity_r', values: [42] }],
    } as unknown as Parameters<typeof resolveStackCount>[0];

    // Act
    const quantityCount = resolveStackCount(fromQuantity);
    const fallbackCount = resolveStackCount(fallbackToOne);
    const magicAttrCount = resolveStackCount(fromMagicAttr);
    const priorityCount = resolveStackCount(attr381TakesPriorityOverQuantity);

    // Assert
    expect(quantityCount).toBe(9);
    expect(fallbackCount).toBe(1);
    expect(magicAttrCount).toBe(42);
    expect(priorityCount).toBe(42);
  });
});

describe('When resolveStackCount reads quantities at the 9-bit boundaries', () => {
  it('Then quantities of 0 and above the 9-bit range count as one item and 1 and 511 are kept', () => {
    // Arrange
    const quantities = [0, 1, MAX_RESOURCE_STACK_COUNT, MAX_RESOURCE_STACK_COUNT + 1];

    // Act
    const result = quantities.map((quantity) => resolveStackCount({ quantity }));

    // Assert
    expect(MAX_RESOURCE_STACK_COUNT).toBe(511);
    expect(result).toEqual([1, 1, 511, 1]);
  });

  it('Then fractional, negative and non-numeric quantities count as one item', () => {
    // Arrange
    const quantities: unknown[] = [2.5, -3, '7', Number.NaN, undefined];

    // Act
    const result = quantities.map((quantity) => resolveStackCount({ quantity }));

    // Assert
    expect(result).toEqual([1, 1, 1, 1, 1]);
  });
});
