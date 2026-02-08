import { Loader2, Plus } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { translations } from '@/i18n/translations';

interface ManualItemEntryProps {
  hasRuns: boolean;
  loading: boolean;
  addManualRunItem: (name: string) => Promise<void>;
}

export function ManualItemEntry({ hasRuns, loading, addManualRunItem }: ManualItemEntryProps) {
  const { t } = useTranslation();
  const manualItemNameId = useId();
  const [manualItemName, setManualItemName] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  const handleAddManualItem = useCallback(async () => {
    if (!manualItemName.trim()) {
      return;
    }

    setAddingItem(true);
    try {
      await addManualRunItem(manualItemName.trim());
      setManualItemName('');
    } catch (error) {
      console.error('Failed to add manual item:', error);
    } finally {
      setAddingItem(false);
    }
  }, [manualItemName, addManualRunItem]);

  const handleManualItemKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && !addingItem && manualItemName.trim()) {
        handleAddManualItem();
      }
    },
    [addingItem, manualItemName, handleAddManualItem],
  );

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={manualItemNameId} className="font-medium text-muted-foreground text-sm">
        {t(translations.runTracker.controls.addItemManually)}
      </label>
      <div className="flex gap-2">
        <Input
          id={manualItemNameId}
          type="text"
          placeholder={
            hasRuns
              ? t(translations.runTracker.controls.enterItemName)
              : t(translations.runTracker.controls.startRunFirst)
          }
          value={manualItemName}
          onChange={(e) => setManualItemName(e.target.value)}
          onKeyDown={handleManualItemKeyDown}
          disabled={addingItem || loading || !hasRuns}
          className="flex-1"
        />
        <Button
          onClick={handleAddManualItem}
          disabled={!manualItemName.trim() || addingItem || loading || !hasRuns}
          variant="outline"
          className="flex items-center gap-2"
        >
          {addingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t(translations.common.add)}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {hasRuns
          ? t(translations.runTracker.controls.itemsAddedToCurrentRun)
          : t(translations.runTracker.controls.startRunToAddItems)}
      </p>
    </div>
  );
}
