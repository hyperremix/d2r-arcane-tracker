import type { ParsedInventoryItem } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import type { ActiveInventoryDragItem } from './dragPayloads';
import {
  isStackPickupDragState,
  resolveStackPickupState,
  toStackPickupDragStatePayload,
} from './stackPickupDragState';
import type { StackPickupState } from './useStackPickup';

const sourceItem = {
  fingerprint: 'fp-el',
  sourceFilePath: '/saves/Shared.d2i',
  sourceFileType: 'd2i',
  locationContext: 'stash',
  stashTab: 7,
  rawItemJson: '{"type":"r01"}',
} as ParsedInventoryItem;

const localPickup: StackPickupState = {
  itemCode: 'r01',
  sourceItem,
  count: 3,
  maxCount: 10,
  iconFileName: 'r01.png',
  itemName: 'El Rune',
  gridWidth: 1,
  gridHeight: 1,
};

const relayedPickup: ActiveInventoryDragItem = {
  fingerprint: 'fp-tal',
  sourceFilePath: '/saves/Shared.d2i',
  sourceFileType: 'd2i',
  sourceLocationContext: 'stash',
  rawItemJson: '{"type":"r07"}',
  itemCode: 'r07',
  gridWidth: 1,
  gridHeight: 1,
  stackPickup: true,
  stackPickupCount: 2,
  stackPickupMaxCount: 5,
};

describe('When a stack pickup is relayed to other windows', () => {
  it('Then the payload carries the pickup count and source position', () => {
    // Arrange / Act
    const payload = toStackPickupDragStatePayload(localPickup);

    // Assert
    expect(payload).toMatchObject({
      active: true,
      fingerprint: 'fp-el',
      sourceStashTab: 7,
      itemCode: 'r01',
      stackPickup: true,
      stackPickupCount: 3,
      stackPickupMaxCount: 10,
    });
  });

  it('If the source item has no file path, Then nothing is relayed', () => {
    // Arrange
    const pickup = { ...localPickup, sourceItem: { ...sourceItem, sourceFilePath: '' } };

    // Act
    const payload = toStackPickupDragStatePayload(pickup);

    // Assert
    expect(payload).toBeUndefined();
  });

  it('If the relayed drag has no item code, Then it is not a stack pickup', () => {
    // Arrange / Act
    const isPickup = isStackPickupDragState({ ...relayedPickup, itemCode: ' ' });

    // Assert
    expect(isPickup).toBe(false);
  });
});

describe('When the active stack pickup is resolved', () => {
  it('Then a pickup relayed from another window wins over the local one', () => {
    // Arrange / Act
    const resolved = resolveStackPickupState(localPickup, relayedPickup);

    // Assert
    expect(resolved).toMatchObject({
      fingerprint: 'fp-tal',
      sourceStashTab: 0,
      itemCode: 'r07',
      count: 2,
      itemName: 'r07',
    });
  });

  it('If only a local pickup exists, Then it is used', () => {
    // Arrange / Act
    const resolved = resolveStackPickupState(localPickup, null);

    // Assert
    expect(resolved).toMatchObject({ fingerprint: 'fp-el', sourceStashTab: 7, count: 3 });
  });

  it('If no pickup exists, Then it resolves to undefined', () => {
    // Arrange / Act
    const resolved = resolveStackPickupState(undefined, { ...relayedPickup, stackPickup: false });

    // Assert
    expect(resolved).toBeUndefined();
  });
});
