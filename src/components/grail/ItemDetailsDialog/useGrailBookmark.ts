import type { Item, VaultItem, VaultItemUpsertInput } from 'electron/types/grail';
import { GRAIL_BOOKMARK_FINGERPRINT_PREFIX } from 'electron/utils/vaultState';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { translations } from '@/i18n/translations';

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

interface GrailBookmarkState {
  linkedBookmark: VaultItem | undefined;
  isBookmarkActionPending: boolean;
  toggleBookmark: () => Promise<void>;
}

/**
 * Loads and toggles the grail bookmark of an item while the details dialog is open.
 * A bookmark is a vault row that never touches a save file.
 */
export function useGrailBookmark(item: Item | null, open: boolean): GrailBookmarkState {
  const { t } = useTranslation();
  const [isBookmarkActionPending, setIsBookmarkActionPending] = useState(false);
  const [linkedBookmark, setLinkedBookmark] = useState<VaultItem | undefined>(undefined);

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

  const toggleBookmark = useCallback(async (): Promise<void> => {
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

  return { linkedBookmark, isBookmarkActionPending, toggleBookmark };
}
