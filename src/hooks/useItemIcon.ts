import { useEffect, useRef, useState } from 'react';
import { useGrailStore } from '@/stores/grailStore';

// In-memory cache to prevent re-fetching icons across component instances
const iconCache = new Map<string, string>();
const PLACEHOLDER = '/images/placeholder-item.png';

/**
 * Custom hook to load and cache item icons.
 * Attempts to load icon from D2R installation, falls back to placeholder.
 * @param itemName - The display name of the item
 * @returns Object containing the icon URL and loading state
 */
export function useItemIcon(itemName: string) {
  const { settings } = useGrailStore();
  const iconsEnabled = settings.showItemIcons;

  // Check cache first to set initial state
  const cachedIcon = iconCache.get(itemName);
  const [iconUrl, setIconUrl] = useState<string>(cachedIcon || PLACEHOLDER);
  const [isLoading, setIsLoading] = useState(!cachedIcon && iconsEnabled);
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
    if (loadedRef.current.has(itemName) || !itemName) {
      setIsLoading(false);
      return;
    }

    // Use cached icon if available
    const cached = iconCache.get(itemName);
    if (cached) {
      setIconUrl(cached);
      setIsLoading(false);
      loadedRef.current.add(itemName);
      return;
    }

    // Load icon from D2R
    let isCancelled = false;

    (async () => {
      try {
        const icon = await window.electronAPI?.icon.getByName(itemName);
        if (isCancelled) return;

        const iconToUse = icon || PLACEHOLDER;
        setIconUrl(iconToUse);
        iconCache.set(itemName, iconToUse);
        setIsLoading(false);
        loadedRef.current.add(itemName);
      } catch (err) {
        if (isCancelled) return;

        console.error(`Failed to load icon for ${itemName}:`, err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIconUrl(PLACEHOLDER);
        iconCache.set(itemName, PLACEHOLDER);
        setIsLoading(false);
        loadedRef.current.add(itemName);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [itemName, iconsEnabled]);

  return { iconUrl, isLoading, error };
}

/**
 * Hook to check if D2R is available and preload popular icons.
 * Should be called once at app startup.
 */
export function useIconPreloader() {
  const [d2rAvailable, setD2rAvailable] = useState<boolean | null>(null);
  const [preloaded, setPreloaded] = useState(false);

  useEffect(() => {
    async function initialize() {
      try {
        // Check D2R availability
        const available = await window.electronAPI?.icon.isD2RAvailable();
        setD2rAvailable(available ?? false);

        // Preload popular icons if D2R is available
        if (available) {
          const result = await window.electronAPI?.icon.preloadPopular();
          setPreloaded(result?.success ?? false);
          console.log('Popular icons preloaded');
        }
      } catch (error) {
        console.error('Failed to initialize icon preloader:', error);
        setD2rAvailable(false);
      }
    }

    initialize();
  }, []);

  return { d2rAvailable, preloaded };
}
