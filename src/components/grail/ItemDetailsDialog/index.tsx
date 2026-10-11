import type { Item } from 'electron/types/grail';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useItemIcon } from '@/hooks/useItemIcon';
import { useProgressLookup } from '@/hooks/useProgressLookup';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';
import placeholderUrl from '/images/placeholder-item.svg';
import { getItemQualityTextClass } from '../ItemCard/styles';
import { RuneImages } from '../RuneImages';
import { BookmarkAction } from './BookmarkControls';
import { CharacterProgressTable } from './CharacterProgressTable';
import { ItemInfoSection } from './ItemInfoSection';
import { MarkAsFoundDialog } from './MarkAsFoundDialog';
import { ProgressStatusSection } from './ProgressStatusSection';
import { useGrailBookmark } from './useGrailBookmark';

interface ItemDetailsDialogProps {
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Button and prompt for manually recording an item as found.
 * Its open state lives here so it resets whenever the details dialog closes (this component
 * unmounts with the dialog content) or is keyed to another item.
 */
function MarkAsFoundAction({ item }: { item: Item }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t(translations.grail.itemDetails.markAsFound)}</Button>
      <MarkAsFoundDialog item={item} open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * The item's artwork above its name: the runes of a runeword, or the item icon when item icons
 * are enabled. The icon is decorative because the dialog title already names the item.
 */
function ItemArtwork({ item, showItemIcons }: { item: Item; showItemIcons: boolean }) {
  // Hooks must run unconditionally, so the icon is resolved even when it isn't shown
  const { iconUrl, isLoading } = useItemIcon(item);

  if (item.type === 'runeword') {
    return item.runes && item.runes.length > 0 ? (
      <RuneImages runeIds={item.runes} viewMode="grid" />
    ) : null;
  }

  if (!showItemIcons) return null;

  return (
    <div className="relative h-20 w-20">
      <img
        src={iconUrl}
        alt=""
        className={cn('h-full w-full object-contain', isLoading && 'opacity-0')}
        onError={(e) => {
          if (e.currentTarget.src !== `${window.location.origin}${placeholderUrl}`) {
            e.currentTarget.src = placeholderUrl;
          }
        }}
      />
      {isLoading && <div className="absolute inset-0 animate-pulse rounded bg-muted" />}
    </div>
  );
}

/**
 * ItemDetailsDialog component that displays comprehensive information about a Holy Grail item.
 * It reads like the in-game item tooltip: artwork, the name in its quality color, the base item
 * and found status, then the item's facts as plain text lines. Below that it lists per-character
 * progress and lets the user manually record or remove finds.
 */
export function ItemDetailsDialog({ itemId, open, onOpenChange }: ItemDetailsDialogProps) {
  const { t } = useTranslation();
  // Narrow selectors so unrelated store updates (filters, view mode, ...) don't re-render the dialog
  const items = useGrailStore((state) => state.items);
  const progress = useGrailStore((state) => state.progress);
  const characters = useGrailStore((state) => state.characters);
  const removeProgress = useGrailStore((state) => state.removeProgress);
  const settings = useGrailStore((state) => state.settings);

  // Find the item by ID
  const item = useMemo(() => {
    if (!itemId) return null;
    return items.find((i) => i.id === itemId) || null;
  }, [items, itemId]);

  // Get progress lookup for this item
  const progressLookup = useProgressLookup(item ? [item] : [], progress, settings);
  const itemProgress = useMemo(
    () => (item ? progressLookup.get(item.id) : null),
    [item, progressLookup],
  );

  // Hook must be called before early return
  const { linkedBookmark, isBookmarkActionPending, toggleBookmark } = useGrailBookmark(item, open);

  if (!item) {
    return null;
  }

  // Runes are named after their base ("El Rune"), so the base line would only repeat the name
  const baseType = item.type === 'rune' ? undefined : item.itemBase;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col sm:max-w-2xl">
        <DialogHeader className="shrink-0 items-center gap-1 text-center">
          <div className="mb-2 flex justify-center empty:hidden">
            <ItemArtwork item={item} showItemIcons={settings.showItemIcons} />
          </div>
          <DialogTitle
            className={cn(
              'text-balance font-display font-semibold text-2xl leading-tight',
              getItemQualityTextClass(item.type),
            )}
          >
            {item.name}
          </DialogTitle>
          {baseType && (
            <DialogDescription className="text-base text-muted-foreground">
              {baseType}
            </DialogDescription>
          )}
          <div className="mt-2">
            <ProgressStatusSection item={item} itemProgress={itemProgress} />
          </div>
        </DialogHeader>

        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-6 px-6">
            <ItemInfoSection item={item} />

            {characters.length > 0 && (
              <div className="border-t pt-4">
                <CharacterProgressTable
                  characters={characters}
                  progress={progress}
                  item={item}
                  onRemoveProgress={removeProgress}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <BookmarkAction
            linkedBookmark={linkedBookmark}
            isPending={isBookmarkActionPending}
            onToggle={toggleBookmark}
          />
          <MarkAsFoundAction key={item.id} item={item} />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t(translations.common.close)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
