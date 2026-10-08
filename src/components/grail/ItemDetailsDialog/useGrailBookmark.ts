import type { Item, VaultItem, VaultItemUpsertInput } from 'electron/types/grail';
import { GRAIL_BOOKMARK_FINGERPRINT_PREFIX } from 'electron/utils/vaultState';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { translations } from '@/i18n/translations';

const BOOKMARK_LOOKUP_PAGE_SIZE = 100;

function toGrailBookmarkFingerprint(item: Item): string {
  return `${GRAIL_BOOKMARK_FINGERPRINT_PREFIX}${item.id}`;
}

// Vault rows store the item quality (normal/magic/rare/set/unique/crafted). Only unique and set
// grail items carry that quality; runes and runeword bases are plain 'normal' items in the game.
function toBookmarkQuality(item: Item): string {
  return item.type === 'unique' || item.type === 'set' ? item.type : 'normal';
}

function toBookmarkUpsertInput(item: Item): VaultItemUpsertInput {
  return {
    fingerprint: toGrailBookmarkFingerprint(item),
    itemName: item.name,
    itemCode: item.code,
    type: item.type,
    quality: toBookmarkQuality(item),
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

interface GrailBookmarkState {
  linkedBookmark: VaultItem | undefined;
  isBookmarkActionPending: boolean;
  toggleBookmark: () => Promise<void>;
}

interface LinkedBookmarkEntry {
  itemId: string;
  bookmark: VaultItem | undefined;
}

/**
 * Loads and toggles the grail bookmark of an item while the details dialog is open.
 * A bookmark is a vault row that never touches a save file.
 *
 * The dialog stays mounted while the user switches items, so bookmark state is tied to the item
 * it was loaded for and responses that arrive after the item or open state changed are ignored.
 */
export function useGrailBookmark(item: Item | null, open: boolean): GrailBookmarkState {
  const { t } = useTranslation();
  const [isBookmarkActionPending, setIsBookmarkActionPending] = useState(false);
  const [linkedEntry, setLinkedEntry] = useState<LinkedBookmarkEntry | undefined>(undefined);
  // Bumped whenever the item or open state changes; async work started earlier must not apply.
  const generationRef = useRef(0);

  const itemId = item?.id;
  const linkedBookmark = open && linkedEntry?.itemId === itemId ? linkedEntry?.bookmark : undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: itemId and open are the triggers that invalidate in-flight bookmark work
  useEffect(() => {
    generationRef.current += 1;
    setLinkedEntry(undefined);

    return () => {
      generationRef.current += 1;
    };
  }, [itemId, open]);

  const loadBookmarkMetadata = useCallback(async (): Promise<void> => {
    if (!item || !open || !window.electronAPI?.vault) {
      return;
    }

    const generation = generationRef.current;

    // The search API has no fingerprint filter, so page through the name matches until the
    // bookmark row shows up instead of trusting that it is on the first page.
    for (let page = 1; ; page += 1) {
      const searchResult = await window.electronAPI.vault.search({
        text: item.name,
        presentState: 'all',
        page,
        pageSize: BOOKMARK_LOOKUP_PAGE_SIZE,
      });

      if (generation !== generationRef.current) {
        return;
      }

      const bookmark = findLinkedBookmark(searchResult.items, item);
      const isLastPage =
        searchResult.items.length < BOOKMARK_LOOKUP_PAGE_SIZE ||
        page * BOOKMARK_LOOKUP_PAGE_SIZE >= searchResult.total;
      if (bookmark || isLastPage) {
        setLinkedEntry({ itemId: item.id, bookmark });
        return;
      }
    }
  }, [item, open]);

  useEffect(() => {
    loadBookmarkMetadata().catch((error: unknown) => {
      console.error('Failed to load bookmark metadata', error);
      toast.error(t(translations.grail.itemDetails.bookmarkLoadError));
    });
  }, [loadBookmarkMetadata, t]);

  const toggleBookmark = useCallback(async (): Promise<void> => {
    if (!item || isBookmarkActionPending || !window.electronAPI?.vault) {
      return;
    }

    const generation = generationRef.current;
    const isCurrent = () => generation === generationRef.current;
    const setBookmark = (bookmark: VaultItem | undefined) => {
      if (isCurrent()) {
        setLinkedEntry({ itemId: item.id, bookmark });
      }
    };

    setIsBookmarkActionPending(true);
    const previousBookmark = linkedBookmark;

    try {
      if (linkedBookmark) {
        setBookmark(undefined);
        await window.electronAPI.vault.removeItem(linkedBookmark.id);
      } else {
        const newBookmark = await window.electronAPI.vault.addItem(toBookmarkUpsertInput(item));
        setBookmark(newBookmark);
      }

      // The write already succeeded: a failed refresh must not roll the optimistic state back.
      // (Skipped when the dialog moved on: the refresh would otherwise run for the wrong item.)
      if (!isCurrent()) {
        return;
      }
      await loadBookmarkMetadata().catch((error: unknown) => {
        console.error('Failed to refresh bookmark metadata', error);
        toast.error(t(translations.grail.itemDetails.bookmarkLoadError));
      });
    } catch (error) {
      console.error('Failed to update bookmark', error);
      toast.error(t(translations.grail.itemDetails.bookmarkActionFailed));
      setBookmark(previousBookmark);
    } finally {
      setIsBookmarkActionPending(false);
    }
  }, [isBookmarkActionPending, item, linkedBookmark, loadBookmarkMetadata, t]);

  return { linkedBookmark, isBookmarkActionPending, toggleBookmark };
}
