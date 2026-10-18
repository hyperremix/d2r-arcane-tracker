import type { FarmingOverview, Item } from 'electron/types/grail';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';

/**
 * Loads where the given items can drop. It loads again when the items or the character level
 * change, and drops answers to requests that were superseded in the meantime.
 * @param items - The items to look for
 * @param characterLevel - The character level for terror zones
 * @returns The overview once loaded, and an error message if loading failed
 */
export function useFarmingOverview(items: Item[], characterLevel: number) {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<FarmingOverview | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  // A stable key, so a new array with the same items doesn't load again
  const requestKey = itemIds.join('|');

  // biome-ignore lint/correctness/useExhaustiveDependencies: requestKey stands for itemIds
  useEffect(() => {
    let cancelled = false;
    window.electronAPI.farming
      .getOverview({ itemIds, characterLevel })
      .then((result) => {
        if (cancelled) return;
        setOverview(result);
        setError(undefined);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Failed to load the farming overview:', err);
        setError(t(translations.farming.loadFailed));
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, characterLevel, t]);

  return { overview, error, itemIds };
}
