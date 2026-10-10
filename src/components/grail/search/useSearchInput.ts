import { useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';

/**
 * Delay in milliseconds before the typed search term is written to the store.
 * Keeps typing responsive while the (potentially expensive) item filtering catches up.
 */
const SEARCH_DEBOUNCE_MS = 150;

interface UseSearchInputOptions {
  /** Search term in the store. */
  searchTerm: string;
  /** Increments whenever the store filters are reset. */
  filterResetCount: number;
  /** Writes a search term to the store. */
  commitSearchTerm: (searchTerm: string) => void;
}

/**
 * Keeps the raw search text locally so typing stays responsive, and writes it to the store after
 * a short debounce. A pending edit is committed on unmount so it is not lost on navigation.
 */
export function useSearchInput({
  searchTerm,
  filterResetCount,
  commitSearchTerm,
}: UseSearchInputOptions) {
  const [searchInput, setSearchInput] = useState(searchTerm);
  const debouncedCommit = useDebouncedCallback(commitSearchTerm, SEARCH_DEBOUNCE_MS, {
    flushOnUnmount: true,
  });

  // When the store filters are reset from elsewhere (e.g. the empty state's "Clear filters"),
  // discard any pending edit so the debounced write cannot re-apply the old search text.
  const seenResetCountRef = useRef(filterResetCount);
  useEffect(() => {
    if (seenResetCountRef.current === filterResetCount) return;
    seenResetCountRef.current = filterResetCount;
    debouncedCommit.cancel();
    setSearchInput('');
  }, [filterResetCount, debouncedCommit]);

  // Sync external store changes (e.g. filters cleared elsewhere) into the input,
  // unless the user has a pending edit that has not been committed yet.
  useEffect(() => {
    if (!debouncedCommit.isPending()) {
      setSearchInput(searchTerm);
    }
  }, [searchTerm, debouncedCommit]);

  /** Updates the input and schedules writing it to the store. */
  const changeSearchInput = (value: string) => {
    setSearchInput(value);
    debouncedCommit(value);
  };

  /** Empties the input and drops a pending edit, without writing to the store. */
  const discardSearchInput = () => {
    debouncedCommit.cancel();
    setSearchInput('');
  };

  return { searchInput, changeSearchInput, discardSearchInput };
}
