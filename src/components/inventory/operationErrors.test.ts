import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { translations } from '@/i18n/translations';
import { showInventoryOperationErrorToast } from './operationErrors';

const messages = translations.inventoryBrowser.operationErrors;
// Tags every translated key so the tests prove each message is passed through `t(...)`.
const t = (key: string) => `t:${key}`;

// Spy on the real toast instead of mocking 'sonner': test files share one module registry
// (isolate: false), so a private sonner mock would leak into modules other suites load.
let toastError: MockInstance<typeof toast.error>;

describe('When showInventoryOperationErrorToast is called', () => {
  beforeEach(() => {
    toastError = vi.spyOn(toast, 'error').mockImplementation(() => 'toast-id');
  });

  afterEach(() => {
    toastError.mockRestore();
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
    [
      'the item was not found',
      new Error('Source item not found in save file'),
      messages.itemChanged,
    ],
    [
      'a stack was not found in a stash',
      new Error("Stack item 'r01' not found in modern resource sectors"),
      messages.itemChanged,
    ],
    ['the vault row was not found', new Error('Vault item not found'), messages.itemChanged],
    [
      'the target stash tab is missing from the file',
      new Error('Stash tab 3 not found in modern stash (2 JM sectors)'),
      messages.itemChanged,
    ],
    [
      'the vault row is no longer vaulted',
      new Error('Vault item is not currently vaulted'),
      messages.itemChanged,
    ],
    [
      'the vault row is already being unvaulted',
      new Error('This vault item is already being unvaulted'),
      messages.failed,
    ],
    [
      'a grail bookmark is unvaulted',
      new Error('A grail bookmark holds no item data and cannot be unvaulted into a save file'),
      messages.failed,
    ],
    ['the error is unknown', new Error('boom'), messages.failed],
  ])('If %s', (_scenario, error, expectedKey) => {
    it('Then the matching message is shown as an error toast', () => {
      // Arrange
      const translate = vi.fn(t);

      // Act
      showInventoryOperationErrorToast(error, translate);

      // Assert
      expect(toastError).toHaveBeenCalledTimes(1);
      expect(toastError).toHaveBeenCalledWith(`t:${expectedKey}`);
      expect(translate).toHaveBeenCalledWith(expectedKey);
    });
  });

  describe('If the error is a plain string', () => {
    it('Then the string is matched like an error message', () => {
      // Arrange
      const error = 'GAME_RUNNING';

      // Act
      showInventoryOperationErrorToast(error, t);

      // Assert
      expect(toastError).toHaveBeenCalledWith(`t:${messages.gameRunning}`);
    });
  });

  describe('If the error carries no message', () => {
    it('Then the generic failure message is shown', () => {
      // Arrange
      const error = undefined;

      // Act
      showInventoryOperationErrorToast(error, t);

      // Assert
      expect(toastError).toHaveBeenCalledWith(`t:${messages.failed}`);
    });
  });
});
