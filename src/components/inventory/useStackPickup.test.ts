import { act, renderHook } from '@testing-library/react';
import type { ParsedInventoryItem } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStackPickup } from './useStackPickup';

function makeItem(overrides: Partial<ParsedInventoryItem> = {}): ParsedInventoryItem {
  return {
    fingerprint: 'fp-default',
    itemCode: 'r01',
    itemName: 'El Rune',
    quality: 'other',
    type: 'rune',
    stackCount: 5,
    iconFileName: 'runes/el.png',
    sourceFilePath: '/path/to/stash.d2i',
    sourceFileType: 'd2i',
    locationContext: 'stash',
    stashTab: 5,
    isSocketedItem: false,
    ...overrides,
  } as ParsedInventoryItem;
}

describe('When useStackPickup is used', () => {
  describe('If startPickup is called with a stackable item', () => {
    it('Then pickup state is initialized with count=1', () => {
      // Arrange
      const { result } = renderHook(() => useStackPickup());
      const item = makeItem({ stackCount: 3 });

      // Act
      act(() => {
        result.current.startPickup(item);
      });

      // Assert
      expect(result.current.isPickupActive).toBe(true);
      expect(result.current.pickupState?.count).toBe(1);
      expect(result.current.pickupState?.maxCount).toBe(3);
      expect(result.current.pickupState?.itemCode).toBe('r01');
    });
  });

  describe('If startPickup is called twice with the same item code', () => {
    it('Then count increments rather than restarting', () => {
      // Arrange
      const { result } = renderHook(() => useStackPickup());
      const item = makeItem({ stackCount: 5 });

      // Act
      act(() => {
        result.current.startPickup(item);
      });
      act(() => {
        result.current.startPickup(item);
      });

      // Assert
      expect(result.current.pickupState?.count).toBe(2);
    });
  });

  describe('If startPickup count would exceed maxCount', () => {
    it('Then count is capped at maxCount', () => {
      // Arrange
      const { result } = renderHook(() => useStackPickup());
      const item = makeItem({ stackCount: 2 });

      // Act
      act(() => {
        result.current.startPickup(item);
        result.current.startPickup(item);
        result.current.startPickup(item); // would be 3, but max is 2
      });

      // Assert
      expect(result.current.pickupState?.count).toBe(2);
    });
  });

  describe('If startPickup is called with a different item while pickup is active', () => {
    it('Then pickup resets to the new item with count=1', () => {
      // Arrange
      const { result } = renderHook(() => useStackPickup());
      const itemA = makeItem({ itemCode: 'r01', stackCount: 3 });
      const itemB = makeItem({ itemCode: 'r02', itemName: 'Eld Rune', stackCount: 4 });

      // Act
      act(() => {
        result.current.startPickup(itemA);
        result.current.startPickup(itemA);
        result.current.startPickup(itemB); // switches item
      });

      // Assert
      expect(result.current.pickupState?.itemCode).toBe('r02');
      expect(result.current.pickupState?.count).toBe(1);
    });
  });

  describe('If incrementPickup is called', () => {
    it('Then count increases by one', () => {
      // Arrange
      const { result } = renderHook(() => useStackPickup());
      act(() => result.current.startPickup(makeItem({ stackCount: 5 })));

      // Act
      act(() => result.current.incrementPickup());

      // Assert
      expect(result.current.pickupState?.count).toBe(2);
    });
  });

  describe('If decrementPickup reduces count to zero', () => {
    it('Then pickup is cancelled', () => {
      // Arrange
      const { result } = renderHook(() => useStackPickup());
      act(() => result.current.startPickup(makeItem({ stackCount: 1 })));

      // Act
      act(() => result.current.decrementPickup());

      // Assert
      expect(result.current.isPickupActive).toBe(false);
      expect(result.current.pickupState).toBeUndefined();
    });
  });

  describe('If cancelPickup is called', () => {
    it('Then pickup state is cleared', () => {
      // Arrange
      const { result } = renderHook(() => useStackPickup());
      act(() => result.current.startPickup(makeItem()));

      // Act
      act(() => result.current.cancelPickup());

      // Assert
      expect(result.current.isPickupActive).toBe(false);
    });
  });

  describe('If consumePickup is called with the full count', () => {
    it('Then pickup state is cleared', () => {
      // Arrange
      const { result } = renderHook(() => useStackPickup());
      const item = makeItem({ stackCount: 3 });
      act(() => {
        result.current.startPickup(item);
        result.current.startPickup(item);
        result.current.startPickup(item);
      });
      expect(result.current.pickupState?.count).toBe(3);

      // Act
      act(() => result.current.consumePickup(3));

      // Assert
      expect(result.current.isPickupActive).toBe(false);
    });
  });

  describe('If consumePickup is called with a partial count', () => {
    it('Then remaining count reflects how many items are still held', () => {
      // Arrange
      const { result } = renderHook(() => useStackPickup());
      const item = makeItem({ stackCount: 5 });
      act(() => {
        result.current.startPickup(item);
        result.current.startPickup(item);
        result.current.startPickup(item);
      });
      expect(result.current.pickupState?.count).toBe(3);

      // Act
      act(() => result.current.consumePickup(2));

      // Assert
      expect(result.current.pickupState?.count).toBe(1);
      expect(result.current.isPickupActive).toBe(true);
    });
  });

  describe('If the Escape key is pressed while pickup is active', () => {
    beforeEach(() => {
      vi.spyOn(window, 'addEventListener');
      vi.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('Then pickup is cancelled', () => {
      // Arrange
      const { result } = renderHook(() => useStackPickup());
      act(() => result.current.startPickup(makeItem()));
      expect(result.current.isPickupActive).toBe(true);

      // Act
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      // Assert
      expect(result.current.isPickupActive).toBe(false);
    });

    it('Then pressing a different key does not cancel pickup', () => {
      // Arrange
      const { result } = renderHook(() => useStackPickup());
      act(() => result.current.startPickup(makeItem()));

      // Act
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      });

      // Assert
      expect(result.current.isPickupActive).toBe(true);
    });
  });

  describe('If startPickup is called with an item that has no stack count', () => {
    it('Then maxCount defaults to 1', () => {
      // Arrange
      const { result } = renderHook(() => useStackPickup());
      const item = makeItem({ stackCount: undefined });

      // Act
      act(() => result.current.startPickup(item));

      // Assert
      expect(result.current.pickupState?.maxCount).toBe(1);
    });
  });

  describe('If gridWidth and gridHeight are read from the pickup state', () => {
    it('Then they reflect the item dimensions', () => {
      // Arrange
      const { result } = renderHook(() => useStackPickup());
      const item = makeItem({ gridWidth: 1, gridHeight: 2 });

      // Act
      act(() => result.current.startPickup(item));

      // Assert
      expect(result.current.pickupState?.gridWidth).toBe(1);
      expect(result.current.pickupState?.gridHeight).toBe(2);
    });
  });
});
