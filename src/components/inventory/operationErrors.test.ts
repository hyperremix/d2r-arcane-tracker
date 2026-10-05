import type { toast as sonnerToast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translations } from '@/i18n/translations';
import type { showInventoryOperationErrorToast as showToast } from './operationErrors';

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

const messages = translations.inventoryBrowser.operationErrors;
// Tags every translated key so the tests prove each message is passed through `t(...)`.
const t = (key: string) => `t:${key}`;

let toast: typeof sonnerToast;
let showInventoryOperationErrorToast: typeof showToast;

describe('When showInventoryOperationErrorToast is called', () => {
  beforeEach(async () => {
    // Vitest runs with isolate: false, so re-import the module to bind it to this file's sonner mock.
    vi.resetModules();
    vi.clearAllMocks();
    ({ toast } = await import('sonner'));
    ({ showInventoryOperationErrorToast } = await import('./operationErrors'));
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
      'an unrelated entity was not found',
      new Error('Vault category not found: cat-1'),
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
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(`t:${expectedKey}`);
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
      expect(toast.error).toHaveBeenCalledWith(`t:${messages.gameRunning}`);
    });
  });

  describe('If the error carries no message', () => {
    it('Then the generic failure message is shown', () => {
      // Arrange
      const error = undefined;

      // Act
      showInventoryOperationErrorToast(error, t);

      // Assert
      expect(toast.error).toHaveBeenCalledWith(`t:${messages.failed}`);
    });
  });
});
