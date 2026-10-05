import type { Item, VaultItem, VaultItemUpsertInput } from 'electron/types/grail';
import { GRAIL_BOOKMARK_FINGERPRINT_PREFIX } from 'electron/utils/vaultState';
import { Archive, ArchiveRestore } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
import placeholderUrl from '/images/placeholder-item.svg';
import { RuneImages } from '../RuneImages';
import { CharacterProgressTable } from './CharacterProgressTable';
import { ItemInfoSection } from './ItemInfoSection';
import { MarkAsFoundDialog } from './MarkAsFoundDialog';
import { ProgressStatusSection } from './ProgressStatusSection';

interface ItemDetailsDialogProps {
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toGrailBookmarkFingerprint(item: Item): string {
  return `${GRAIL_BOOKMARK_FINGERPRINT_PREFIX}${item.id}`;
}

function toBookmarkUpsertInput(item: Item): VaultItemUpsertInput {
  return {
    fingerprint: toGrailBookmarkFingerprint(item),
    itemName: item.name,
    itemCode: item.code,
    type: item.type,
    quality: item.type,
    ethereal: item.etherealType === 'only',
    rawItemJson: JSON.stringify(item),
    sourceCharacterName: 'Grail Tracker',
    sourceFileType: 'd2s',
    locationContext: 'unknown',
    grailItemId: item.id,
    isPresentInLatestScan: false,
  };
}

// Only the bookmark created by this dialog may be linked (and later deleted). Real vaulted items
// carry the same grailItemId, but their vault row is the only copy of that item.
function findLinkedBookmark(vaultItems: VaultItem[], item: Item): VaultItem | undefined {
  return vaultItems.find((vaultItem) => vaultItem.fingerprint === toGrailBookmarkFingerprint(item));
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
 * ItemDetailsDialog component that displays comprehensive information about a Holy Grail item.
 * Shows item metadata, icon, and per-character progress, and lets the user manually
 * record or remove finds.
 */
export function ItemDetailsDialog({ itemId, open, onOpenChange }: ItemDetailsDialogProps) {
  const { t } = useTranslation();
  const { items, progress, characters, removeProgress, settings } = useGrailStore();
  const [isBookmarkActionPending, setIsBookmarkActionPending] = useState(false);
  const [linkedBookmark, setLinkedBookmark] = useState<VaultItem | undefined>(undefined);

  const item = useMemo(() => {
    if (!itemId) {
      return null;
    }

    return items.find((i) => i.id === itemId) || null;
  }, [items, itemId]);

  // Get progress lookup for this item
  const progressLookup = useProgressLookup(item ? [item] : [], progress, settings);
  const itemProgress = useMemo(
    () => (item ? progressLookup.get(item.id) : null),
    [item, progressLookup],
  );

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

  const loadBookmarkMetadata = useCallback(async (): Promise<void> => {
    if (!item || !open || !window.electronAPI?.vault) {
      return;
    }

    const searchResult = await window.electronAPI.vault.search({
      text: item.name,
      presentState: 'all',
      page: 1,
      pageSize: 100,
    });

    setLinkedBookmark(findLinkedBookmark(searchResult.items, item));
  }, [item, open]);

  useEffect(() => {
    loadBookmarkMetadata().catch((error: unknown) => {
      console.error('Failed to load bookmark metadata', error);
      toast.error(t(translations.grail.itemDetails.bookmarkLoadError));
    });
  }, [loadBookmarkMetadata, t]);

  const handleBookmarkAction = useCallback(async (): Promise<void> => {
    if (!item || isBookmarkActionPending || !window.electronAPI?.vault) {
      return;
    }

    setIsBookmarkActionPending(true);
    const previousBookmark = linkedBookmark;

    try {
      if (linkedBookmark) {
        setLinkedBookmark(undefined);
        await window.electronAPI.vault.removeItem(linkedBookmark.id);
      } else {
        const newBookmark = await window.electronAPI.vault.addItem(toBookmarkUpsertInput(item));
        setLinkedBookmark(newBookmark);
      }

      // The write already succeeded: a failed refresh must not roll the optimistic state back.
      await loadBookmarkMetadata().catch((error: unknown) => {
        console.error('Failed to refresh bookmark metadata', error);
        toast.error(t(translations.grail.itemDetails.bookmarkLoadError));
      });
    } catch (error) {
      console.error('Failed to update bookmark', error);
      toast.error(t(translations.grail.itemDetails.bookmarkActionFailed));
      setLinkedBookmark(previousBookmark);
    } finally {
      setIsBookmarkActionPending(false);
    }
  }, [isBookmarkActionPending, item, linkedBookmark, loadBookmarkMetadata, t]);

  if (!item) {
    return null;
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex justify-between gap-4">
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
                {isLoading && <div className="absolute inset-0 animate-pulse rounded bg-muted" />}
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

        <div className="-mx-6 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-4 px-6">
            <ItemInfoSection item={item} />
            <ProgressStatusSection item={item} itemProgress={itemProgress} />

            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium text-sm">
                  {t(translations.grail.itemDetails.bookmarkStatusTitle)}
                </div>
                <Badge variant={linkedBookmark ? 'default' : 'secondary'}>
                  {linkedBookmark
                    ? t(translations.grail.itemDetails.bookmarked)
                    : t(translations.grail.itemDetails.notBookmarked)}
                </Badge>
              </div>
            </div>

            {characters.length > 0 && (
              <CharacterProgressTable
                characters={characters}
                progress={progress}
                item={item}
                onRemoveProgress={removeProgress}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isBookmarkActionPending}
            onClick={() => void handleBookmarkAction()}
          >
            {linkedBookmark ? (
              <ArchiveRestore className="mr-1 h-4 w-4" />
            ) : (
              <Archive className="mr-1 h-4 w-4" />
            )}
            {linkedBookmark
              ? t(translations.grail.itemDetails.unbookmarkAction)
              : t(translations.grail.itemDetails.bookmarkAction)}
          </Button>
          <MarkAsFoundAction key={item.id} item={item} />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t(translations.common.close)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
