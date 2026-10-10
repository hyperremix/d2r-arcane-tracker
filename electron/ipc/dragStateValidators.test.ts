import { describe, expect, it } from 'vitest';
import { inventoryDragStatePayload, vaultDragStatePayload } from './dragStateValidators';
import { IpcValidationError } from './validation';

function captureError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

const validInventoryPayload = {
  active: true,
  fingerprint: 'fp-1',
  sourceFilePath: '/saves/Hero.d2s',
  sourceFileType: 'd2s',
  sourceLocationContext: 'stash',
  rawItemJson: '{"id":1}',
};

describe('When an inventory drag state is validated', () => {
  it('If only the required fields are present, Then grid sizes default to 1x1 and optional fields are dropped', () => {
    // Arrange
    const payload = { ...validInventoryPayload };

    // Act
    const result = inventoryDragStatePayload(payload);

    // Assert
    expect(result).toEqual({
      active: true,
      fingerprint: 'fp-1',
      sourceFilePath: '/saves/Hero.d2s',
      sourceFileType: 'd2s',
      sourceLocationContext: 'stash',
      rawItemJson: '{"id":1}',
      itemCode: undefined,
      sourceStashTab: undefined,
      sourceGridX: undefined,
      sourceGridY: undefined,
      sourceEquippedSlotId: undefined,
      gridWidth: 1,
      gridHeight: 1,
      stackPickup: undefined,
      stackPickupCount: undefined,
      stackPickupMaxCount: undefined,
      stackPickupItemName: undefined,
      stackPickupIconFileName: undefined,
    });
  });

  it('If strings have surrounding whitespace, Then the identifying fields are trimmed and the raw item JSON is kept as sent', () => {
    // Arrange
    const payload = {
      ...validInventoryPayload,
      fingerprint: '  fp-1  ',
      sourceFilePath: ' /saves/Hero.d2s ',
      sourceLocationContext: ' stash ',
      rawItemJson: ' {"id":1} ',
      itemCode: ' hax ',
      stackPickupItemName: ' Ber Rune ',
    };

    // Act
    const result = inventoryDragStatePayload(payload);

    // Assert
    expect(result).toMatchObject({
      fingerprint: 'fp-1',
      sourceFilePath: '/saves/Hero.d2s',
      sourceLocationContext: 'stash',
      rawItemJson: ' {"id":1} ',
      itemCode: 'hax',
      stackPickupItemName: 'Ber Rune',
    });
  });

  it('If the optional numbers are valid, Then positions are kept and a stack pickup is normalized', () => {
    // Arrange
    const payload = {
      ...validInventoryPayload,
      sourceStashTab: 2,
      sourceGridX: 0,
      sourceGridY: 3,
      sourceEquippedSlotId: 4,
      gridWidth: 2,
      gridHeight: 3,
      stackPickup: true,
      stackPickupCount: 5,
      stackPickupMaxCount: 99,
      stackPickupIconFileName: 'r30.png',
    };

    // Act
    const result = inventoryDragStatePayload(payload);

    // Assert
    expect(result).toMatchObject({
      sourceStashTab: 2,
      sourceGridX: 0,
      sourceGridY: 3,
      sourceEquippedSlotId: 4,
      gridWidth: 2,
      gridHeight: 3,
      stackPickup: true,
      stackPickupCount: 5,
      stackPickupMaxCount: 99,
      stackPickupIconFileName: 'r30.png',
    });
  });

  it('If the optional numbers are unusable, Then grid sizes fall back to 1 and the other numbers are dropped', () => {
    // Arrange
    const payload = {
      ...validInventoryPayload,
      sourceStashTab: '2',
      sourceGridX: 1.5,
      sourceGridY: null,
      sourceEquippedSlotId: Number.NaN,
      gridWidth: 0,
      gridHeight: -2,
      stackPickup: 'yes',
      stackPickupCount: 0,
      stackPickupMaxCount: -1,
      stackPickupItemName: '   ',
      itemCode: '   ',
    };

    // Act
    const result = inventoryDragStatePayload(payload);

    // Assert
    expect(result).toMatchObject({
      sourceStashTab: undefined,
      sourceGridX: undefined,
      sourceGridY: undefined,
      sourceEquippedSlotId: undefined,
      gridWidth: 1,
      gridHeight: 1,
      stackPickup: undefined,
      stackPickupCount: undefined,
      stackPickupMaxCount: undefined,
      stackPickupItemName: undefined,
      itemCode: undefined,
    });
  });

  it('If unknown fields are sent, Then they are not passed on', () => {
    // Arrange
    const payload = { ...validInventoryPayload, injected: 'value' };

    // Act
    const result = inventoryDragStatePayload(payload);

    // Assert
    expect(result).not.toHaveProperty('injected');
  });

  it.each<[string, unknown]>([
    ['it is not an object', 'payload'],
    ['it is null', null],
    ['active is not a boolean', { ...validInventoryPayload, active: 'true' }],
    ['the fingerprint is blank', { ...validInventoryPayload, fingerprint: '  ' }],
    ['the fingerprint is not a string', { ...validInventoryPayload, fingerprint: 7 }],
    ['the source file path is missing', { ...validInventoryPayload, sourceFilePath: undefined }],
    ['the source file path is blank', { ...validInventoryPayload, sourceFilePath: ' ' }],
    ['the source file type is unknown', { ...validInventoryPayload, sourceFileType: 'zip' }],
    ['the source file type is not a string', { ...validInventoryPayload, sourceFileType: 1 }],
    ['the source location is blank', { ...validInventoryPayload, sourceLocationContext: ' ' }],
    ['the raw item JSON is blank', { ...validInventoryPayload, rawItemJson: '  ' }],
    ['the raw item JSON is missing', { ...validInventoryPayload, rawItemJson: undefined }],
  ])('If %s, Then it is rejected as an invalid inventory drag state', (_scenario, payload) => {
    // Arrange
    const run = () => inventoryDragStatePayload(payload);

    // Act
    const error = captureError(run);

    // Assert
    expect(error).toBeInstanceOf(IpcValidationError);
    expect((error as IpcValidationError).message).toBe('Invalid inventory drag state');
  });
});

describe('When a vault drag state is validated', () => {
  it('If the payload is valid, Then the id is trimmed and the grid size is kept', () => {
    // Arrange
    const payload = { active: false, id: ' row-1 ', gridWidth: 2, gridHeight: 4, extra: 'x' };

    // Act
    const result = vaultDragStatePayload(payload);

    // Assert
    expect(result).toEqual({ active: false, id: 'row-1', gridWidth: 2, gridHeight: 4 });
  });

  it('If the grid size is missing or unusable, Then it defaults to 1x1', () => {
    // Arrange
    const payload = { active: true, id: 'row-1', gridWidth: 1.5, gridHeight: 0 };

    // Act
    const result = vaultDragStatePayload(payload);

    // Assert
    expect(result).toEqual({ active: true, id: 'row-1', gridWidth: 1, gridHeight: 1 });
  });

  it.each<[string, unknown]>([
    ['it is not an object', 5],
    ['it is null', null],
    ['active is not a boolean', { active: 1, id: 'row-1' }],
    ['the id is blank', { active: true, id: '  ' }],
    ['the id is not a string', { active: true, id: 3 }],
  ])('If %s, Then it is rejected as an invalid vault drag state', (_scenario, payload) => {
    // Arrange
    const run = () => vaultDragStatePayload(payload);

    // Act
    const error = captureError(run);

    // Assert
    expect(error).toBeInstanceOf(IpcValidationError);
    expect((error as IpcValidationError).message).toBe('Invalid vault drag state');
  });
});
