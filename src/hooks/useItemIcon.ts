import type { Item } from 'electron/types/grail';
import { useEffect, useRef, useState } from 'react';
import { useGrailStore } from '@/stores/grailStore';
import placeholderUrl from '/images/placeholder-item.png';

// In-memory cache to prevent re-fetching icons across component instances
const iconCache = new Map<string, string>();
const PLACEHOLDER = placeholderUrl;

/**
 * Custom hook to load and cache item icons.
 * Loads icons from converted PNG directory using imageFilename.
 * @param item - The item object containing name and imageFilename
 * @returns Object containing the icon URL and loading state
 */
export function useItemIcon(item: Item) {
  const { settings } = useGrailStore();
  const iconsEnabled = settings.showItemIcons;

  // Use item ID as cache key (more reliable than name)
  const cacheKey = item.id;
  const imageFilename = item.imageFilename;

  // Check cache first to set initial state
  const cachedIcon = iconCache.get(cacheKey);
  const [iconUrl, setIconUrl] = useState<string>(cachedIcon || PLACEHOLDER);
  const [isLoading, setIsLoading] = useState(!cachedIcon && iconsEnabled && !!imageFilename);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Skip if icons are disabled
    if (!iconsEnabled) {
      setIsLoading(false);
      setIconUrl(PLACEHOLDER);
      return;
    }

    // Skip if already loaded
    if (loadedRef.current.has(cacheKey)) {
      setIsLoading(false);
      return;
    }

    // Use cached icon if available
    const cached = iconCache.get(cacheKey);
    if (cached) {
      setIconUrl(cached);
      setIsLoading(false);
      loadedRef.current.add(cacheKey);
      return;
    }

    if (!imageFilename) {
      // No imageFilename available, use placeholder
      setIconUrl(PLACEHOLDER);
      iconCache.set(cacheKey, PLACEHOLDER);
      setIsLoading(false);
      loadedRef.current.add(cacheKey);
      return;
    }

    // Load icon using imageFilename
    let isCancelled = false;

    (async () => {
      try {
        const icon = await window.electronAPI?.icon.getByFilename(imageFilename);
        if (isCancelled) return;

        const iconToUse = icon || PLACEHOLDER;
        setIconUrl(iconToUse);
        iconCache.set(cacheKey, iconToUse);
        setIsLoading(false);
        loadedRef.current.add(cacheKey);
      } catch (err) {
        if (isCancelled) return;

        console.error(`Failed to load icon for ${item.name} (${imageFilename}):`, err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIconUrl(PLACEHOLDER);
        iconCache.set(cacheKey, PLACEHOLDER);
        setIsLoading(false);
        loadedRef.current.add(cacheKey);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [cacheKey, imageFilename, iconsEnabled, item.name]);

  return { iconUrl, isLoading, error };
}

/**
 * Hook to check icon conversion status.
 * Should be called once at app startup.
 * @deprecated Icon preloading is now handled via sprite conversion in settings
 */
export function useIconPreloader() {
  const [d2rAvailable, setD2rAvailable] = useState<boolean | null>(null);
  const [preloaded, setPreloaded] = useState(false);

  useEffect(() => {
    async function initialize() {
      try {
        // Check if D2R path is set
        const d2rPath = await window.electronAPI?.icon.getD2RPath();
        setD2rAvailable(d2rPath !== null);

        // Check conversion status
        const status = await window.electronAPI?.icon.getConversionStatus();
        setPreloaded(status?.status === 'completed');
      } catch (error) {
        console.error('Failed to check icon status:', error);
        setD2rAvailable(false);
      }
    }

    initialize();
  }, []);

  return { d2rAvailable, preloaded };
}
