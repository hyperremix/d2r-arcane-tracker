import { useMemo } from 'react';
import {
  createSpriteIconLookupIndex,
  type SpriteIconLookupIndex,
} from '@/lib/spriteIconCandidates';
import { useGrailStore } from '@/stores/grailStore';

/**
 * Builds the sprite icon lookup for inventory tiles from the grail items in the store. Every
 * window that shows inventories loads those items on startup (see `useWindowBootstrap`).
 *
 * @returns Icon lookup index built from the grail items
 */
export function useInventoryIconLookup(): SpriteIconLookupIndex {
  const grailItems = useGrailStore((state) => state.items);

  return useMemo(() => createSpriteIconLookupIndex(grailItems), [grailItems]);
}
