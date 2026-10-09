import type { DragEvent } from 'react';
import { describe, expect, it } from 'vitest';
import {
  type ActiveInventoryDragItem,
  hasInventoryOrVaultDragData,
  INVENTORY_DRAG_MIME,
  isSameInventoryMoveTarget,
  parseInventoryDragStatePayload,
  parseInventoryTextPayload,
  parseVaultDragStatePayload,
  parseVaultTextPayload,
  resolveActiveInventoryDragItem,
  resolveActiveVaultDragItem,
  serializeInventoryTextPayload,
  serializeVaultTextPayload,
  VAULT_DRAG_MIME,
} from './dragPayloads';

describe('When inventory drag payloads are parsed', () => {
  describe('If payload contains ISO date strings', () => {
    it('Then optional date fields are normalized to Date instances', () => {
      // Arrange
      const rawPayload = serializeInventoryTextPayload({
        fingerprint: 'fp-1',
        itemName: 'Shako',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
        lastSeenAt: new Date('2024-01-01T10:00:00.000Z'),
        vaultedAt: new Date('2024-01-01T10:01:00.000Z'),
        unvaultedAt: new Date('2024-01-01T10:02:00.000Z'),
      });

      // Act
      const parsed = parseInventoryTextPayload(rawPayload);

      // Assert
      expect(parsed?.lastSeenAt).toBeInstanceOf(Date);
      expect(parsed?.vaultedAt).toBeInstanceOf(Date);
      expect(parsed?.unvaultedAt).toBeInstanceOf(Date);
      expect(parsed?.lastSeenAt?.toISOString()).toBe('2024-01-01T10:00:00.000Z');
    });
  });

  describe('If payload contains an invalid date string', () => {
    it('Then parsing is rejected and returns undefined', () => {
      // Arrange
      const rawPayload = serializeInventoryTextPayload({
        fingerprint: 'fp-1',
        itemName: 'Shako',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
        lastSeenAt: 'not-a-date' as unknown as Date,
      });

      // Act
      const parsed = parseInventoryTextPayload(rawPayload);

      // Assert
      expect(parsed).toBeUndefined();
    });
  });
});

describe('When vault drag payloads are parsed', () => {
  describe('If payload is a plain vault item id', () => {
    it('Then parsing returns an item id with default dimensions', () => {
      // Arrange
      const rawPayload = 'vault-item-123';

      // Act
      const parsed = parseVaultTextPayload(rawPayload);

      // Assert
      expect(parsed).toEqual({
        id: 'vault-item-123',
        gridWidth: 1,
        gridHeight: 1,
      });
    });
  });
});

function createDragEvent(
  data: Record<string, string>,
  options: { throwOnRead?: boolean } = {},
): DragEvent<HTMLElement> {
  return {
    dataTransfer: {
      types: Object.keys(data),
      getData: (format: string) => {
        if (options.throwOnRead) {
          throw new Error('Drag data is protected');
        }
        return data[format] ?? '';
      },
    },
  } as unknown as DragEvent<HTMLElement>;
}

const inventoryDragItem: ActiveInventoryDragItem = {
  fingerprint: 'fp-1',
  sourceFilePath: '/saves/Sorc.d2s',
  sourceFileType: 'd2s',
  sourceLocationContext: 'inventory',
  sourceGridX: 1,
  sourceGridY: 2,
  rawItemJson: '{"id":1}',
  itemCode: 'uap',
  gridWidth: 2,
  gridHeight: 2,
};

describe('When drag-state payloads from another window are parsed', () => {
  it('Then a vault payload gets a trimmed id and positive integer dimensions', () => {
    // Arrange / Act
    const parsed = parseVaultDragStatePayload({ active: true, id: ' v-1 ', gridWidth: 0 });

    // Assert
    expect(parsed).toEqual({ active: true, id: 'v-1', gridWidth: 1, gridHeight: 1 });
  });

  it('If a vault payload has no id, Then it is rejected', () => {
    // Arrange / Act
    const parsed = parseVaultDragStatePayload({ active: true, id: '  ' });

    // Assert
    expect(parsed).toBeUndefined();
  });

  it('Then an inventory payload keeps valid fields and drops invalid ones', () => {
    // Arrange
    const payload = {
      ...inventoryDragItem,
      active: false,
      sourceStashTab: 1.5,
      stackPickup: true,
      stackPickupCount: 3,
      stackPickupItemName: '  ',
    };

    // Act
    const parsed = parseInventoryDragStatePayload(payload);

    // Assert
    expect(parsed).toMatchObject({
      active: false,
      fingerprint: 'fp-1',
      sourceStashTab: undefined,
      stackPickup: true,
      stackPickupCount: 3,
      stackPickupItemName: undefined,
    });
  });

  it.each([
    ['fingerprint', { fingerprint: '' }],
    ['source file type', { sourceFileType: ' ' }],
    ['raw item JSON', { rawItemJson: '' }],
    ['active flag', { active: 'yes' }],
  ])('If the %s is missing, Then the inventory payload is rejected', (_field, override) => {
    // Arrange / Act
    const parsed = parseInventoryDragStatePayload({
      ...inventoryDragItem,
      active: true,
      ...override,
    });

    // Assert
    expect(parsed).toBeUndefined();
  });

  it.each([
    ['an unknown location', 'belt'],
    ['a padded location', ' stash '],
    ['a wrong-case location', 'Stash'],
  ])('If the source location context is %s, Then the inventory payload is rejected', (_label, sourceLocationContext) => {
    // Arrange
    const payload = { ...inventoryDragItem, active: true, sourceLocationContext };

    // Act
    const parsed = parseInventoryDragStatePayload(payload);

    // Assert
    expect(parsed).toBeUndefined();
  });
});

describe('When the dragged item of a drop event is resolved', () => {
  it('Then a vault text payload wins over the local drag', () => {
    // Arrange
    const event = createDragEvent({
      'text/plain': serializeVaultTextPayload({ id: 'v-2', gridWidth: 2, gridHeight: 3 }),
    });

    // Act
    const resolved = resolveActiveVaultDragItem(event, { id: 'v-1', gridWidth: 1, gridHeight: 1 });

    // Assert
    expect(resolved).toEqual({ id: 'v-2', gridWidth: 2, gridHeight: 3 });
  });

  it('If drag data cannot be read, Then the local vault drag is used', () => {
    // Arrange
    const event = createDragEvent({}, { throwOnRead: true });

    // Act
    const resolved = resolveActiveVaultDragItem(event, { id: 'v-1', gridWidth: 2, gridHeight: 1 });

    // Assert
    expect(resolved).toEqual({ id: 'v-1', gridWidth: 2, gridHeight: 1 });
  });

  it('If the MIME fingerprint belongs to another item, Then no inventory item is resolved', () => {
    // Arrange
    const event = createDragEvent({ [INVENTORY_DRAG_MIME]: 'fp-other' });

    // Act
    const resolved = resolveActiveInventoryDragItem(event, inventoryDragItem);

    // Assert
    expect(resolved).toBeUndefined();
  });

  it('Then an inventory text payload is turned into a drag item', () => {
    // Arrange
    const event = createDragEvent({
      text: serializeInventoryTextPayload({
        fingerprint: 'fp-9',
        itemName: 'Shako',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{"id":9}',
        sourceFileType: 'd2s',
        sourceFilePath: '/saves/Sorc.d2s',
        locationContext: 'stash',
        stashTab: 2,
        gridWidth: 2,
        gridHeight: 2,
      }),
    });

    // Act
    const resolved = resolveActiveInventoryDragItem(event, undefined);

    // Assert
    expect(resolved).toMatchObject({
      fingerprint: 'fp-9',
      sourceLocationContext: 'stash',
      sourceStashTab: 2,
      gridWidth: 2,
    });
  });
});

describe('When a drag is checked for app items', () => {
  it.each([
    ['an inventory MIME type', { [INVENTORY_DRAG_MIME]: 'fp-1' }, true],
    ['a vault MIME type', { [VAULT_DRAG_MIME]: 'v-1' }, true],
    [
      'a prefixed vault text payload',
      { 'text/plain': serializeVaultTextPayload({ id: 'v' }) },
      true,
    ],
    ['a plain vault id', { 'text/plain': 'v-1' }, false],
    ['no data', {}, false],
  ])('Then a drag with %s is recognized: %s', (_label, data, expected) => {
    // Arrange / Act
    const recognized = hasInventoryOrVaultDragData(createDragEvent(data));

    // Assert
    expect(recognized).toBe(expected);
  });
});

describe('When a move target is compared with the drag source', () => {
  it('Then the same grid cell in the same file is the same target', () => {
    // Arrange / Act
    const isSame = isSameInventoryMoveTarget(
      inventoryDragItem,
      '/saves/Sorc.d2s',
      'd2s',
      'inventory',
      undefined,
      1,
      2,
      undefined,
    );

    // Assert
    expect(isSame).toBe(true);
  });

  it('If the stash tab differs, Then it is a different target', () => {
    // Arrange
    const stashItem: ActiveInventoryDragItem = {
      ...inventoryDragItem,
      sourceLocationContext: 'stash',
    };

    // Act
    const isSame = isSameInventoryMoveTarget(
      stashItem,
      '/saves/Sorc.d2s',
      'd2s',
      'stash',
      3,
      1,
      2,
      undefined,
    );

    // Assert
    expect(isSame).toBe(false);
  });
});
