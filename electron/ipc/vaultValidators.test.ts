import { describe, expect, it } from 'vitest';
import { IpcValidationError } from './validation';
import {
  inventoryItemMoveInput,
  inventorySnapshotWindowTarget,
  inventoryStackSplitInput,
  unvaultTargetOptions,
  vaultItemFilter,
  vaultItemUpsertInput,
  withdrawCount,
} from './vaultValidators';

function captureError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

const validMove = {
  sourceFilePath: '/saves/Sorc.d2s',
  sourceFileType: 'd2s',
  rawItemJson: '{"id":42}',
  targetFilePath: '/saves/Barb.d2s',
  targetFileType: 'd2s',
  targetLocationContext: 'inventory',
  targetGridX: 3,
  targetGridY: 1,
};

const validSplit = {
  sourceFilePath: '/saves/Shared.d2i',
  sourceFileType: 'd2i',
  sourceStashTab: 7,
  sourceItemCode: 'r19',
  splitCount: 1,
  targets: [
    {
      targetFilePath: '/saves/Sorc.d2s',
      targetFileType: 'd2s',
      targetLocationContext: 'inventory',
      targetGridX: 3,
      targetGridY: 2,
    },
  ],
};

const validUpsert = {
  fingerprint: 'fp-1',
  itemName: 'Shako',
  quality: 'unique',
  ethereal: false,
  rawItemJson: '{"id":1}',
  sourceFileType: 'd2s',
  locationContext: 'inventory',
};

describe('When vault and inventory IPC arguments are validated', () => {
  it.each<[string, () => unknown, string]>([
    ['a filter that is not an object', () => vaultItemFilter('shako'), 'expected an object'],
    [
      'a filter with an unknown sort key',
      () => vaultItemFilter({ sortBy: 'bogus' }),
      'sortBy must be one of: itemName, lastSeenAt, createdAt, updatedAt, vaultedAt',
    ],
    [
      'a filter with a too long search text',
      () => vaultItemFilter({ text: 'x'.repeat(121) }),
      'Search text must be <= 120 characters',
    ],
    ['a filter with a page size of 0', () => vaultItemFilter({ pageSize: 0 }), 'Page size'],
    [
      'a vault item without a fingerprint',
      () => vaultItemUpsertInput({ ...validUpsert, fingerprint: '' }),
      'Missing fingerprint',
    ],
    [
      'a vault item with an invalid date',
      () => vaultItemUpsertInput({ ...validUpsert, lastSeenAt: 'invalid-date-value' }),
      'lastSeenAt must be a valid date',
    ],
    [
      'a vault item with a non-boolean ethereal flag',
      () => vaultItemUpsertInput({ ...validUpsert, ethereal: 'no' }),
      'ethereal must be a boolean',
    ],
    [
      'a vault item with a non-numeric grid position',
      () => vaultItemUpsertInput({ ...validUpsert, gridX: '3' }),
      'gridX must be an integer',
    ],
    ['a withdraw count of 0', () => withdrawCount(0), 'withdrawCount must be a positive integer'],
    [
      'an equipped unvault target without a slot',
      () =>
        unvaultTargetOptions({
          targetFilePath: '/saves/Sorc.d2s',
          targetFileType: 'd2s',
          targetLocationContext: 'equipped',
          targetGridX: 0,
          targetGridY: 0,
        }),
      'targetOptions.targetEquippedSlotId must be one of: 1-12',
    ],
    [
      'a shared stash unvault target outside the stash',
      () =>
        unvaultTargetOptions({
          targetFilePath: '/saves/Shared.d2i',
          targetFileType: 'd2i',
          targetLocationContext: 'inventory',
          targetGridX: 0,
          targetGridY: 0,
        }),
      'Shared stash targets must use targetLocationContext=stash',
    ],
    [
      'a move to an equipped slot outside 1-12',
      () =>
        inventoryItemMoveInput({
          ...validMove,
          targetLocationContext: 'equipped',
          targetEquippedSlotId: 13,
        }),
      'targetEquippedSlotId must be one of: 1-12',
    ],
    [
      'a move with a stash tab for an inventory target',
      () => inventoryItemMoveInput({ ...validMove, targetStashTab: 1 }),
      'targetStashTab is only allowed when targetLocationContext=stash',
    ],
    [
      'a move without raw item JSON',
      () => inventoryItemMoveInput({ ...validMove, rawItemJson: ' ' }),
      'rawItemJson is required',
    ],
    [
      'a split with a negative target grid coordinate',
      () =>
        inventoryStackSplitInput({
          ...validSplit,
          targets: [{ ...validSplit.targets[0], targetGridX: -1 }],
        }),
      'Each target targetGridX must be >= 0',
    ],
    [
      'a split without targets',
      () => inventoryStackSplitInput({ ...validSplit, targets: [] }),
      'targets must be non-empty',
    ],
    [
      'a snapshot window target with an unknown file type',
      () =>
        inventorySnapshotWindowTarget({
          sourceFilePath: '/saves/Sorc.d2s',
          sourceFileType: 'zip',
          characterName: 'Sorc',
        }),
      'sourceFileType must be one of: d2s, sss, d2x, d2i',
    ],
  ])('If %s is received, Then it is rejected with "%s"', (_label, run, message) => {
    // Arrange (inline in the table)

    // Act
    const error = captureError(run);

    // Assert
    expect(error).toBeInstanceOf(IpcValidationError);
    expect((error as IpcValidationError).message).toContain(message);
  });

  describe('If a search filter is valid', () => {
    it('Then only the known filter fields are kept', () => {
      // Arrange
      const filter = { text: 'shako', page: 1, pageSize: 20, unexpected: 'x' };

      // Act
      const result = vaultItemFilter(filter);

      // Assert
      expect(result).toEqual({ text: 'shako', page: 1, pageSize: 20 });
    });

    it('Then an omitted filter stays undefined', () => {
      // Arrange
      const filter = undefined;

      // Act
      const result = vaultItemFilter(filter);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('If a vault item carries its dates as ISO strings', () => {
    it('Then they are converted to Dates', () => {
      // Arrange
      const item = {
        ...validUpsert,
        lastSeenAt: '2024-01-01T10:00:00.000Z',
        vaultedAt: '2024-01-01T10:01:00.000Z',
      };

      // Act
      const result = vaultItemUpsertInput(item);

      // Assert
      expect(result.lastSeenAt).toEqual(new Date('2024-01-01T10:00:00.000Z'));
      expect(result.vaultedAt).toEqual(new Date('2024-01-01T10:01:00.000Z'));
    });
  });

  describe('If an unvault target is valid', () => {
    it('Then its file path is trimmed', () => {
      // Arrange
      const target = {
        targetFilePath: '  /saves/Shared.d2i ',
        targetFileType: 'd2i',
        targetLocationContext: 'stash',
        targetStashTab: 2,
        targetGridX: 4,
        targetGridY: 5,
      };

      // Act
      const result = unvaultTargetOptions(target);

      // Assert
      expect(result).toEqual({ ...target, targetFilePath: '/saves/Shared.d2i' });
    });
  });

  describe('If a move targets the stash without a tab', () => {
    it('Then the first tab is used', () => {
      // Arrange
      const move = {
        ...validMove,
        targetFilePath: ' /saves/Shared.d2i ',
        targetFileType: 'd2i',
        targetLocationContext: 'stash',
      };

      // Act
      const result = inventoryItemMoveInput(move);

      // Assert
      expect(result.targetFilePath).toBe('/saves/Shared.d2i');
      expect(result.targetStashTab).toBe(0);
    });
  });

  describe('If a move targets an equipped slot', () => {
    it('Then the grid position is dropped and an unusable source tab is ignored', () => {
      // Arrange
      const move = {
        ...validMove,
        sourceStashTab: -1,
        targetLocationContext: 'equipped',
        targetEquippedSlotId: 4,
      };

      // Act
      const result = inventoryItemMoveInput(move);

      // Assert
      expect(result).toEqual({
        sourceFilePath: '/saves/Sorc.d2s',
        sourceFileType: 'd2s',
        rawItemJson: '{"id":42}',
        targetFilePath: '/saves/Barb.d2s',
        targetFileType: 'd2s',
        targetLocationContext: 'equipped',
        targetEquippedSlotId: 4,
      });
    });
  });

  describe('If a split request is valid', () => {
    it('Then paths and the item code are trimmed and an empty raw item is dropped', () => {
      // Arrange
      const split = {
        ...validSplit,
        sourceFilePath: ' /saves/Shared.d2i ',
        sourceItemCode: ' r19 ',
        sourceRawItemJson: '   ',
      };

      // Act
      const result = inventoryStackSplitInput(split);

      // Assert
      expect(result.sourceFilePath).toBe('/saves/Shared.d2i');
      expect(result.sourceItemCode).toBe('r19');
      expect(result).not.toHaveProperty('sourceRawItemJson');
      expect(result.targets).toEqual(validSplit.targets);
    });
  });
});
