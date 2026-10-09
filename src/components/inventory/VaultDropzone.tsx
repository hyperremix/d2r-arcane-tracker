import { type DragEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';

export interface VaultDropzoneProps {
  /** Called with the drop event; the dropzone has already prevented the default action. */
  onDropItem: (event: DragEvent<HTMLButtonElement>) => void | Promise<void>;
}

/** Drop target that vaults the inventory item dropped on it. */
export function VaultDropzone({ onDropItem }: VaultDropzoneProps) {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <button
      type="button"
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
      {t(translations.inventoryBrowser.dropToVault)}
    </button>
  );
}
