import type { Item } from 'electron/types/grail';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useItemIcon } from '@/hooks/useItemIcon';
import { useProgressLookup } from '@/hooks/useProgressLookup';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';
import placeholderUrl from '/images/placeholder-item.png';
import { RuneImages } from '../RuneImages';
import { CharacterProgressTable } from './CharacterProgressTable';
import { ItemInfoSection } from './ItemInfoSection';
import { ProgressStatusSection } from './ProgressStatusSection';

interface ItemDetailsDialogProps {
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ItemDetailsDialog component that displays comprehensive information about a Holy Grail item.
 * Shows item metadata, icon, and per-character progress with toggle actions.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex dialog component with many features
export function ItemDetailsDialog({ itemId, open, onOpenChange }: ItemDetailsDialogProps) {
  const { t } = useTranslation();
  const { items, progress, characters, selectedCharacterId, toggleItemFound, settings } =
    useGrailStore();

  // Find the item by ID
  const item = useMemo(() => {
    if (!itemId) return null;
    return items.find((i) => i.id === itemId) || null;
  }, [items, itemId]);

  // Get progress lookup for this item
  const progressLookup = useProgressLookup(
    item ? [item] : [],
    progress,
    settings,
    selectedCharacterId,
  );
  const itemProgress = useMemo(
    () => (item ? progressLookup.get(item.id) : null),
    [item, progressLookup],
  );

  // Get icon for the item (must be called before early return)
  // Create a placeholder item for the hook when item is null
  const placeholderItem: Item = {
    id: '',
    name: '',
    link: '',
    etherealType: 'none',
    type: 'unique',
    category: 'weapons',
    subCategory: '1h_swords',
    treasureClass: 'normal',
  };
  const { iconUrl, isLoading } = useItemIcon(item || placeholderItem);

  // Handle toggle found action
  const handleToggleFound = useCallback(() => {
    if (!item || !selectedCharacterId) return;
    toggleItemFound(item.id, selectedCharacterId, true);
  }, [item, selectedCharacterId, toggleItemFound]);

  if (!item) {
    return null;
  }

  const isFound = itemProgress?.overallFound || false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex justify-between gap-4">
            {/* Item Icon or Rune Images */}
            {item.type === 'runeword' && item.runes && item.runes.length > 0 ? (
              <div className="flex items-center">
                <RuneImages runeIds={item.runes} viewMode="grid" />
              </div>
            ) : settings.showItemIcons && item.type !== 'runeword' ? (
              <div className="relative h-20 w-20">
                <img
                  src={iconUrl}
                  alt={item.name}
                  className={cn('h-full w-full object-contain', isLoading && 'opacity-0')}
                  onError={(e) => {
                    if (e.currentTarget.src !== `${window.location.origin}${placeholderUrl}`) {
                      e.currentTarget.src = placeholderUrl;
                    }
                  }}
                />
                {isLoading && (
                  <div className="absolute inset-0 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                )}
              </div>
            ) : null}

            <div>
              <DialogTitle className="font-bold text-2xl">{item.name}</DialogTitle>
            </div>
            {((item.type === 'runeword' && item.runes && item.runes.length > 0) ||
              (settings.showItemIcons && item.type !== 'runeword')) && (
              <div className="relative w-20" />
            )}
          </div>
        </DialogHeader>

        {/* Item Information and Progress Status */}
        <div className="-mx-6 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-4 px-6">
            <ItemInfoSection item={item} />
            <ProgressStatusSection item={item} itemProgress={itemProgress} />
            {characters.length > 0 && (
              <CharacterProgressTable characters={characters} progress={progress} item={item} />
            )}
          </div>
        </div>

        <DialogFooter>
          {selectedCharacterId && (
            <Button onClick={handleToggleFound} variant={isFound ? 'outline' : 'default'}>
              {isFound
                ? t(translations.grail.itemDetails.markAsNotFound)
                : t(translations.grail.itemDetails.markAsFound)}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t(translations.common.close)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
