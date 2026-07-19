import type { ParsedInventoryItem } from 'electron/types/grail';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getGridHeight, getGridWidth } from '@/components/inventory/spatialLayout';

export interface StackPickupState {
  itemCode: string;
  sourceItem: ParsedInventoryItem;
  count: number;
  maxCount: number;
  iconFileName: string;
  itemName: string;
  gridWidth: number;
  gridHeight: number;
}

export interface UseStackPickupResult {
  pickupState: StackPickupState | undefined;
  isPickupActive: boolean;
  startPickup: (item: ParsedInventoryItem) => void;
  incrementPickup: () => void;
  decrementPickup: () => void;
  consumePickup: (placed: number) => void;
  cancelPickup: () => void;
}

export function useStackPickup(): UseStackPickupResult {
  const [pickupState, setPickupState] = useState<StackPickupState | undefined>(undefined);

  // Stable ref so escape/click handlers can read the latest state without stale closures.
  const stateRef = useRef<StackPickupState | undefined>(undefined);
  stateRef.current = pickupState;

  const cancelPickup = useCallback(() => {
    setPickupState(undefined);
  }, []);

  const startPickup = useCallback((item: ParsedInventoryItem) => {
    const maxCount = item.stackCount ?? 1;
    if (maxCount <= 0) {
      return;
    }

    setPickupState((prev) => {
      // Same item type — increment count.
      if (prev && prev.itemCode === (item.itemCode ?? '').toLowerCase()) {
        const next = Math.min(prev.count + 1, prev.maxCount);
        return { ...prev, count: next };
      }

      // Different item — start fresh.
      return {
        itemCode: (item.itemCode ?? '').toLowerCase(),
        sourceItem: item,
        count: 1,
        maxCount,
        iconFileName: item.iconFileName ?? '',
        itemName: item.itemName,
        gridWidth: getGridWidth(item),
        gridHeight: getGridHeight(item),
      };
    });
  }, []);

  const incrementPickup = useCallback(() => {
    setPickupState((prev) => {
      if (!prev) return prev;
      return { ...prev, count: Math.min(prev.count + 1, prev.maxCount) };
    });
  }, []);

  const decrementPickup = useCallback(() => {
    setPickupState((prev) => {
      if (!prev) return prev;
      const next = prev.count - 1;
      if (next <= 0) {
        return undefined;
      }
      return { ...prev, count: next };
    });
  }, []);

  const consumePickup = useCallback((placed: number) => {
    if (placed <= 0) return;
    setPickupState((prev) => {
      if (!prev) return prev;
      const remaining = prev.count - placed;
      if (remaining <= 0) {
        return undefined;
      }
      return { ...prev, count: remaining };
    });
  }, []);

  // Escape key cancels pickup.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stateRef.current) {
        setPickupState(undefined);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Cancel on unmount.
  useEffect(() => {
    return () => {
      setPickupState(undefined);
    };
  }, []);

  return {
    pickupState,
    isPickupActive: pickupState !== undefined,
    startPickup,
    incrementPickup,
    decrementPickup,
    consumePickup,
    cancelPickup,
  };
}
