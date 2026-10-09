import { toast } from 'sonner';
import { translations } from '@/i18n/translations';

const MODERN_STASH_READ_ONLY_ERROR = 'MODERN_STASH_READ_ONLY';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function getErrorMessage(error: unknown): string | undefined {
  if (typeof error === 'string') {
    return error;
  }

  const message = (error as { message?: unknown } | null | undefined)?.message;
  return typeof message === 'string' ? message : undefined;
}

/**
 * Backend refusals that mean the save file (or vault row) no longer matches what the view shows:
 * the explicit "Refresh the inventory" hints, the "<thing> not found in <save/stash/tab>" errors of
 * the save file editor (this includes a target stash tab that the file does not have, because the
 * view then shows a layout the file no longer matches), a missing vault row and a vault row that
 * was already unvaulted elsewhere. Other refusals (for example a bookmark that cannot be unvaulted)
 * keep the generic failure message.
 */
const STALE_ITEM_FRAGMENTS = [
  'Refresh the inventory',
  'not found in',
  'Vault item not found',
  'Vault item is not currently vaulted',
];

function includesAny(message: string | undefined, fragments: string[]): boolean {
  return message !== undefined && fragments.some((fragment) => message.includes(fragment));
}

/**
 * Tells the user why a vault/move/split write was refused. Every refusal means the backend left
 * the save files untouched, so the message says so and the caller reloads the (possibly stale) view.
 */
export function showInventoryOperationErrorToast(error: unknown, t: Translate): void {
  const message = getErrorMessage(error);
  const messages = translations.inventoryBrowser.operationErrors;

  if (includesAny(message, ['GAME_RUNNING'])) {
    toast.error(t(messages.gameRunning));
  } else if (includesAny(message, ['TARGET_CELL_OCCUPIED'])) {
    toast.error(t(messages.targetOccupied));
  } else if (includesAny(message, ['STACK_MOVE_REQUIRES_SPLIT'])) {
    toast.error(t(messages.stackNeedsSplit));
  } else if (includesAny(message, ['target position is required'])) {
    toast.error(t(messages.unvaultNeedsPosition));
  } else if (includesAny(message, STALE_ITEM_FRAGMENTS)) {
    toast.error(t(messages.itemChanged));
  } else {
    toast.error(t(messages.failed));
  }
}

export function isModernStashReadOnlyError(error: unknown): boolean {
  return includesAny(getErrorMessage(error), [MODERN_STASH_READ_ONLY_ERROR]);
}

export function showModernStashReadOnlyToast(t: Translate): void {
  toast.error(t(translations.inventoryBrowser.modernStashReadOnlyError));
}
