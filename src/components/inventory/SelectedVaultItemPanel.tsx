import type { VaultItem } from 'electron/types/grail';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isVaultedFromSaveFile,
  resolveVaultRestoreTarget,
} from '@/components/inventory/vaultRestore';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';

export interface SelectedVaultItemPanelProps {
  item: VaultItem;
  isUnvaulting: boolean;
  onUnvault: (item: VaultItem) => void;
}

/**
 * Name of the selected vault item and how to take it out of the vault. An item taken out of a save
 * file can only go back into one: to its original spot with a button when that spot is known,
 * anywhere else by dragging it onto a board. Other rows are unvaulted with a plain button.
 */
export function SelectedVaultItemPanel({
  item,
  isUnvaulting,
  onUnvault,
}: SelectedVaultItemPanelProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const fromSaveFile = isVaultedFromSaveFile(item);
  const canRestore = fromSaveFile && resolveVaultRestoreTarget(item) !== undefined;

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="font-medium text-sm">{item.itemName}</div>
      {!fromSaveFile && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isUnvaulting}
          onClick={() => onUnvault(item)}
        >
          {t(translations.vault.unvaultAction)}
        </Button>
      )}
      {canRestore && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isUnvaulting}
          aria-describedby={hintId}
          onClick={() => onUnvault(item)}
        >
          {t(translations.inventoryBrowser.vaultFeedback.restoreAction)}
        </Button>
      )}
      {fromSaveFile && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {canRestore
            ? t(translations.inventoryBrowser.vaultFeedback.restoreHint)
            : t(translations.inventoryBrowser.vaultFeedback.dragHint)}
        </p>
      )}
    </div>
  );
}
