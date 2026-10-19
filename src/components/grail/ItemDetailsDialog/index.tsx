import type { Item } from 'electron/types/grail';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemFarmingSources } from '@/components/farming/ItemFarmingSources';
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
import { translations } from '@/i18n/translations';
import { canItemHaveVersion, getProgressVersion } from '@/lib/ethereal';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';
import placeholderUrl from '/images/placeholder-item.svg';
import { getItemQualityTextClass } from '../ItemCard/styles';
import { RuneImages } from '../RuneImages';
import { BookmarkAction } from './BookmarkControls';
import { CharacterProgressTable } from './CharacterProgressTable';
import { ItemCopiesSection } from './ItemCopiesSection';
import { ItemInfoSection } from './ItemInfoSection';
import { isFoundInEveryTrackedVersion, MarkAsFoundDialog } from './MarkAsFoundDialog';
import { ProgressStatusSection } from './ProgressStatusSection';
import { useGrailBookmark } from './useGrailBookmark';

interface ItemDetailsDialogProps {
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Button and prompt for manually recording an item as found.
 * While a tracked version is still missing it is the primary "Mark as found" action; once every
 * tracked version is found it becomes an outline "Add another find" action.
 * Its open state lives here so it resets whenever the details dialog closes (this component
 * unmounts with the dialog content) or is keyed to another item.
 */
function MarkAsFoundAction({ item, anotherFind }: { item: Item; anotherFind: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // The prompt keeps the name it was opened with, so saving the first find doesn't rename it
  // while it closes
  const [promptIsAnotherFind, setPromptIsAnotherFind] = useState(anotherFind);

  const handleOpen = () => {
    setPromptIsAnotherFind(anotherFind);
    setOpen(true);
  };

  return (
    <>
      {anotherFind ? (
        <Button variant="outline" onClick={handleOpen}>
          {t(translations.grail.itemDetails.addAnotherFind)}
        </Button>
      ) : (
        <Button onClick={handleOpen}>{t(translations.grail.itemDetails.markAsFound)}</Button>
      )}
      <MarkAsFoundDialog
        item={item}
        anotherFind={promptIsAnotherFind}
        open={open}
        onOpenChange={setOpen}
      />
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
 * Its centered header reads like the in-game item tooltip: artwork, the name in its quality color,
 * the base item and found status. The item's facts follow as a two-column list. Below that it
 * lists per-character progress and the copies in the user's saves and vault, and lets the user
 * manually record or remove finds.
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

  // The progress records of this item, including finds of versions that aren't tracked. Records
  // of deleted characters or of versions the item can't have are left out, so the status line
  // and the character table always describe the same finds.
  const itemProgress = useMemo(() => {
    if (!item) return [];
    const characterIds = new Set(characters.map((character) => character.id));
    return progress.filter(
      (p) =>
        p.itemId === item.id &&
        characterIds.has(p.characterId) &&
        canItemHaveVersion(item, getProgressVersion(p)),
    );
  }, [item, progress, characters]);

  // Hooks must be called before early return
  const { linkedBookmark, isBookmarkActionPending, toggleBookmark } = useGrailBookmark(item, open);
  const titleId = useId();

  if (!item) {
    return null;
  }

  // Runes are named after their base ("El Rune"), so the base line would only repeat the name
  const baseType = item.type === 'rune' ? undefined : item.itemBase;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100vh-2rem)] flex-col sm:max-w-2xl"
        // Focus the dialog itself (named by its title) rather than its first focusable element,
        // the external item link, so opening the dialog doesn't start on a way out of the app
        initialFocus={() =>
          document.getElementById(titleId)?.closest<HTMLElement>('[role="dialog"]') ?? true
        }
      >
        <DialogHeader className="shrink-0 items-center gap-1 text-center">
          <div className="mb-2 flex justify-center empty:hidden">
            <ItemArtwork item={item} showItemIcons={settings.showItemIcons} />
          </div>
          <DialogTitle
            id={titleId}
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
            <ProgressStatusSection item={item} itemProgress={itemProgress} settings={settings} />
          </div>
        </DialogHeader>

        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-6 px-6">
            <ItemInfoSection item={item} />

            <ItemFarmingSources item={item} characters={characters} />

            {characters.length > 0 && (
              <div className="border-t pt-4">
                <CharacterProgressTable
                  characters={characters}
                  itemProgress={itemProgress}
                  item={item}
                  onRemoveProgress={removeProgress}
                />
              </div>
            )}

            <div className="border-t pt-4">
              <ItemCopiesSection item={item} />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <BookmarkAction
            linkedBookmark={linkedBookmark}
            isPending={isBookmarkActionPending}
            onToggle={toggleBookmark}
          />
          <MarkAsFoundAction
            key={item.id}
            item={item}
            anotherFind={isFoundInEveryTrackedVersion(item, itemProgress, settings)}
          />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t(translations.common.close)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
