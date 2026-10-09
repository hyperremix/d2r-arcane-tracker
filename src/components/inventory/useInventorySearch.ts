import type { VaultLocationContext } from 'electron/types/grail';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildInventorySearchFilter,
  type InventorySearchAllResponse,
  loadInventorySearchResponse,
} from '@/components/inventory/inventorySearch';
import { onMainEvent } from '@/lib/ipcEvents';

/** Delay before a save-file event reloads the search, so a burst of writes reloads once. */
const SAVE_FILE_EVENT_RELOAD_DELAY_MS = 250;

export interface InventorySearchParams {
  searchText: string;
  characterId: string;
  locationContext: 'all' | VaultLocationContext;
}

export interface InventorySearchState {
  isLoading: boolean;
  inventoryResponse: InventorySearchAllResponse | null;
  /** Runs the search again; only the result of the latest request is applied. */
  loadInventorySearch: () => Promise<void>;
  /** Asks main to rescan the save files after a write, then reloads the search. */
  reloadInventoryAfterSaveWrite: () => Promise<void>;
}

/**
 * Loads inventory snapshots and vault items for the given filter, and reloads them when the
 * main process reports a save file change.
 *
 * @param params - Search text, character and location filter
 * @returns The latest response, loading state and reload functions
 */
export function useInventorySearch({
  searchText,
  characterId,
  locationContext,
}: InventorySearchParams): InventorySearchState {
  const [isLoading, setIsLoading] = useState(true);
  const [inventoryResponse, setInventoryResponse] = useState<InventorySearchAllResponse | null>(
    null,
  );
  const latestSearchRequestRef = useRef(0);

  const loadInventorySearch = useCallback(async (): Promise<void> => {
    const requestId = latestSearchRequestRef.current + 1;
    latestSearchRequestRef.current = requestId;
    const filter = buildInventorySearchFilter(searchText, characterId, locationContext);

    setIsLoading(true);
    try {
      const response = await loadInventorySearchResponse(filter);
      if (requestId === latestSearchRequestRef.current) {
        setInventoryResponse(response);
      }
    } catch (error) {
      if (requestId === latestSearchRequestRef.current) {
        console.error('Failed to load inventory search results', error);
      }
    } finally {
      if (requestId === latestSearchRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [characterId, locationContext, searchText]);

  useEffect(() => {
    void loadInventorySearch();
  }, [loadInventorySearch]);

  useEffect(() => {
    let reloadTimeout: ReturnType<typeof setTimeout> | undefined;

    const handleSaveFileEvent = () => {
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }

      reloadTimeout = setTimeout(() => {
        void loadInventorySearch();
      }, SAVE_FILE_EVENT_RELOAD_DELAY_MS);
    };

    const unsubscribe = onMainEvent('save-file-event', handleSaveFileEvent);

    return () => {
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }
      unsubscribe();
    };
  }, [loadInventorySearch]);

  const reloadInventoryAfterSaveWrite = useCallback(async (): Promise<void> => {
    try {
      await window.electronAPI.saveFile.refreshSaveFiles();
    } catch (error) {
      console.warn('Failed to refresh save files after write', error);
    }

    await loadInventorySearch();
  }, [loadInventorySearch]);

  return { isLoading, inventoryResponse, loadInventorySearch, reloadInventoryAfterSaveWrite };
}
