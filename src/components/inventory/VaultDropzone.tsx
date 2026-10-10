import { type DragEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';

export interface VaultDropzoneProps {
  /** Called with the drop event; the dropzone has already prevented the default action. */
  onDropItem: (event: DragEvent<HTMLElement>) => void | Promise<void>;
}

/**
 * Drop target that vaults the inventory item dropped on it. It only reacts to drag and drop, so it
 * is a labelled region rather than a button; keyboard users vault an item with the **Vault** button
 * of the selected item card in a character window.
 */
export function VaultDropzone({ onDropItem }: VaultDropzoneProps) {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const labelId = useId();

  return (
    <section
      aria-labelledby={labelId}
      data-testid="vault-dropzone"
      className={[
        'rounded-lg border border-dashed p-3 text-center text-sm transition-colors',
        isDragOver ? 'border-primary bg-primary/10' : 'border-border text-muted-foreground',
      ].join(' ')}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        void onDropItem(event);
      }}
    >
      <p id={labelId}>{t(translations.inventoryBrowser.dropToVault)}</p>
    </section>
  );
}
