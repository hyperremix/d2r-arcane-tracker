import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translations } from '@/i18n/translations';
import { showInventoryOperationErrorToast } from './operationErrors';

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

const messages = translations.inventoryBrowser.operationErrors;
const t = (key: string) => key;

describe('When showInventoryOperationErrorToast is called', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe.each([
    ['the game is running', new Error('GAME_RUNNING: close the game'), messages.gameRunning],
    ['the target cell is occupied', new Error('TARGET_CELL_OCCUPIED'), messages.targetOccupied],
    [
      'a stack move needs a split',
      new Error('STACK_MOVE_REQUIRES_SPLIT'),
      messages.stackNeedsSplit,
    ],
    [
      'an unvault has no target position',
      new Error('A target position is required'),
      messages.unvaultNeedsPosition,
    ],
    [
      'the save changed since the scan',
      new Error('Refresh the inventory and try again'),
      messages.itemChanged,
    ],
    ['the item was not found', new Error('Item not found in save file'), messages.itemChanged],
    ['the error is unknown', new Error('boom'), messages.failed],
  ])('If %s', (_scenario, error, expectedKey) => {
    it('Then the matching message is shown as an error toast', () => {
      // Arrange / Act
      showInventoryOperationErrorToast(error, t);

      // Assert
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(expectedKey);
    });
  });

  describe('If the error is a plain string', () => {
    it('Then the string is matched like an error message', () => {
      // Arrange / Act
      showInventoryOperationErrorToast('GAME_RUNNING', t);

      // Assert
      expect(toast.error).toHaveBeenCalledWith(messages.gameRunning);
    });
  });

  describe('If the error carries no message', () => {
    it('Then the generic failure message is shown', () => {
      // Arrange / Act
      showInventoryOperationErrorToast(undefined, t);

      // Assert
      expect(toast.error).toHaveBeenCalledWith(messages.failed);
    });
  });
});
