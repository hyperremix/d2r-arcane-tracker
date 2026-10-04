import { toast } from 'sonner';
import { translations } from '@/i18n/translations';

type Translate = (key: string, options?: Record<string, unknown>) => string;

function getMessage(error: unknown): string | undefined {
  if (typeof error === 'string') {
    return error;
  }

  const message = (error as { message?: unknown } | null | undefined)?.message;
  return typeof message === 'string' ? message : undefined;
}

function includesAny(message: string | undefined, fragments: string[]): boolean {
  return message !== undefined && fragments.some((fragment) => message.includes(fragment));
}

/**
 * Tells the user why a vault/move/split write was refused. Every refusal means the backend left
 * the save files untouched, so the message says so and the caller reloads the (possibly stale) view.
 */
export function showInventoryOperationErrorToast(error: unknown, t: Translate): void {
  const message = getMessage(error);
  const messages = translations.inventoryBrowser.operationErrors;

  if (includesAny(message, ['GAME_RUNNING'])) {
    toast.error(t(messages.gameRunning));
  } else if (includesAny(message, ['TARGET_CELL_OCCUPIED'])) {
    toast.error(t(messages.targetOccupied));
  } else if (includesAny(message, ['STACK_MOVE_REQUIRES_SPLIT'])) {
    toast.error(t(messages.stackNeedsSplit));
  } else if (includesAny(message, ['target position is required'])) {
    toast.error(t(messages.unvaultNeedsPosition));
  } else if (includesAny(message, ['Refresh the inventory', 'not found'])) {
    toast.error(t(messages.itemChanged));
  } else {
    toast.error(t(messages.failed));
  }
}
