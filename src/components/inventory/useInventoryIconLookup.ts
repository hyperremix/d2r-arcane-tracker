import { useEffect, useMemo } from 'react';
import {
  createSpriteIconLookupIndex,
  type SpriteIconLookupIndex,
} from '@/lib/spriteIconCandidates';
import { useGrailStore } from '@/stores/grailStore';

/**
 * Builds the sprite icon lookup for inventory tiles. Loads the grail items first when the store
 * is still empty (for example in a snapshot window that opened on its own).
 *
 * @returns Icon lookup index built from the grail items
 */
export function useInventoryIconLookup(): SpriteIconLookupIndex {
  const grailItems = useGrailStore((state) => state.items);
  const setGrailItems = useGrailStore((state) => state.setItems);

  useEffect(() => {
    if (grailItems.length > 0 || !window.electronAPI?.grail?.getItems) {
      return;
    }

    let cancelled = false;

    void window.electronAPI.grail
      .getItems()
      .then((items) => {
        if (cancelled || !items) {
          return;
        }

        setGrailItems(items);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load grail items for inventory icon lookup', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [grailItems.length, setGrailItems]);

  return useMemo(() => createSpriteIconLookupIndex(grailItems), [grailItems]);
}
