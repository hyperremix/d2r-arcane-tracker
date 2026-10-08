import { describe, expect, it } from 'vitest';
import { createVaultPresenceKey, readItemUidFromRawJson } from './vaultPresence';

const baseFields = {
  sourceFileType: 'd2i',
  itemCode: 'r01',
  quality: 'normal',
  ethereal: false,
  socketCount: 0,
  itemName: 'El Rune',
  isSocketedItem: false,
};

describe('When createVaultPresenceKey describes an item', () => {
  describe('If only fields that are not part of the identity differ', () => {
    it('Then the key is the same', () => {
      // Arrange
      const original = { ...baseFields };
      const movedWithExtraFields = {
        ...baseFields,
        position: { x: 4, y: 7 },
        characterName: 'Renamed',
        locationContext: 'inventory',
      } as typeof baseFields;

      // Act
      const originalKey = createVaultPresenceKey(original);
      const movedKey = createVaultPresenceKey(movedWithExtraFields);

      // Assert
      expect(movedKey).toBe(originalKey);
    });
  });

  describe('If a field that defines the item differs', () => {
    it.each([
      ['code', { itemCode: 'r02' }],
      ['quality', { quality: 'magic' }],
      ['ethereal flag', { ethereal: true }],
      ['socket count', { socketCount: 3 }],
      ['name', { itemName: 'Eld Rune' }],
      ['socketed flag', { isSocketedItem: true }],
      ['game item id', { itemUid: 42 }],
      ['source file type', { sourceFileType: 'd2s' }],
    ])('Then a different %s gives a different key', (_scenario, override) => {
      // Arrange
      const original = createVaultPresenceKey(baseFields);

      // Act
      const changed = createVaultPresenceKey({ ...baseFields, ...override });

      // Assert
      expect(changed).not.toBe(original);
    });
  });

  describe('If the game item id is a number or its numeric string', () => {
    it('Then both produce the same key', () => {
      // Arrange
      const fromNumber = { ...baseFields, itemUid: 1234 };
      const fromString = { ...baseFields, itemUid: '1234' };

      // Act
      const numberKey = createVaultPresenceKey(fromNumber);
      const stringKey = createVaultPresenceKey(fromString);

      // Assert
      expect(stringKey).toBe(numberKey);
    });
  });
});

describe('When readItemUidFromRawJson reads a stored item', () => {
  it.each([
    ['a numeric id', '{"id":77,"code":"uap"}', '77'],
    ['no id (simple item)', '{"code":"r01"}', undefined],
    ['invalid JSON', '{nope', undefined],
    ['a non-object value', '12', undefined],
    ['null input', undefined, undefined],
  ])('Then %s resolves to the expected id', (_scenario, rawJson, expected) => {
    // Arrange
    const input = rawJson;

    // Act
    const uid = readItemUidFromRawJson(input);

    // Assert
    expect(uid).toBe(expected);
  });
});

describe('When createVaultPresenceKey receives an unsupported item id', () => {
  it('Then the key is the same as for an item without an id', () => {
    // Arrange
    const unsupportedIds = [undefined, null, '', '  ', Number.NaN, {}] as unknown as Array<
      number | string | null | undefined
    >;
    const withoutId = createVaultPresenceKey(baseFields);

    // Act
    const keys = unsupportedIds.map((itemUid) =>
      createVaultPresenceKey({ ...baseFields, itemUid }),
    );

    // Assert
    expect(keys.every((key) => key === withoutId)).toBe(true);
  });
});

describe('When createVaultPresenceKey receives a numeric or padded string item id', () => {
  it('Then both spellings produce the same key, which differs from an item without an id', () => {
    // Arrange
    const fromNumber = { ...baseFields, itemUid: 7 };
    const fromPaddedString = { ...baseFields, itemUid: ' 7 ' };

    // Act
    const numberKey = createVaultPresenceKey(fromNumber);
    const stringKey = createVaultPresenceKey(fromPaddedString);

    // Assert
    expect(numberKey).toBe(stringKey);
    expect(numberKey).not.toBe(createVaultPresenceKey(baseFields));
  });
});
