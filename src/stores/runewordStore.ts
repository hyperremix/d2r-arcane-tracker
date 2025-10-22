import { create } from 'zustand';
import {
  addRuneToInventory,
  clearInventory,
  type CraftableRuneword,
  filterCraftableRunewords,
  getCraftableRunewords,
  removeRuneFromInventory,
  type RuneInventory,
  searchRunewords,
  sortRunewords,
} from '@/lib/runeword-calculator';

/**
 * Interface defining the state and actions for the Runeword Calculator store.
 */
interface RunewordState {
  // Rune inventory
  inventory: RuneInventory;

  // UI state
  searchTerm: string;
  showOnlyCraftable: boolean;
  sortBy: 'name' | 'runes' | 'craftable';
  selectedRunewordId: string | null;

  // Computed state (memoized)
  craftableRunewords: CraftableRuneword[];

  // Actions
  addRune: (runeId: string, quantity?: number) => void;
  removeRune: (runeId: string, quantity?: number) => void;
  setRuneQuantity: (runeId: string, quantity: number) => void;
  clearInventory: () => void;
  loadInventory: () => Promise<void>;
  saveInventory: () => Promise<void>;

  // UI actions
  setSearchTerm: (term: string) => void;
  setShowOnlyCraftable: (show: boolean) => void;
  setSortBy: (sortBy: 'name' | 'runes' | 'craftable') => void;
  setSelectedRunewordId: (id: string | null) => void;

  // Utility
  refreshCraftableRunewords: () => void;
}

/**
 * Zustand store for managing runeword calculator state.
 * Handles rune inventory, filtering, sorting, and persistence.
 */
export const useRunewordStore = create<RunewordState>((set, get) => ({
  // Initial state
  inventory: {},
  searchTerm: '',
  showOnlyCraftable: false,
  sortBy: 'name',
  selectedRunewordId: null,
  craftableRunewords: [],

  // Actions
  addRune: (runeId: string, quantity = 1) => {
    const { inventory } = get();
    const newInventory = addRuneToInventory(inventory, runeId, quantity);
    set({ inventory: newInventory });
    get().refreshCraftableRunewords();
    get().saveInventory();
  },

  removeRune: (runeId: string, quantity = 1) => {
    const { inventory } = get();
    const newInventory = removeRuneFromInventory(inventory, runeId, quantity);
    set({ inventory: newInventory });
    get().refreshCraftableRunewords();
    get().saveInventory();
  },

  setRuneQuantity: (runeId: string, quantity: number) => {
    const { inventory } = get();
    if (quantity <= 0) {
      const newInventory = { ...inventory };
      delete newInventory[runeId];
      set({ inventory: newInventory });
    } else {
      set({ inventory: { ...inventory, [runeId]: quantity } });
    }
    get().refreshCraftableRunewords();
    get().saveInventory();
  },

  clearInventory: () => {
    set({ inventory: clearInventory() });
    get().refreshCraftableRunewords();
    get().saveInventory();
  },

  loadInventory: async () => {
    try {
      const stored = await window.electronAPI?.runeword.getInventory();
      if (stored) {
        set({ inventory: stored });
        get().refreshCraftableRunewords();
      }
    } catch (error) {
      console.error('Failed to load rune inventory:', error);
    }
  },

  saveInventory: async () => {
    const { inventory } = get();
    try {
      await window.electronAPI?.runeword.saveInventory(inventory);
    } catch (error) {
      console.error('Failed to save rune inventory:', error);
    }
  },

  setSearchTerm: (term: string) => {
    set({ searchTerm: term });
    get().refreshCraftableRunewords();
  },

  setShowOnlyCraftable: (show: boolean) => {
    set({ showOnlyCraftable: show });
    get().refreshCraftableRunewords();
  },

  setSortBy: (sortBy: 'name' | 'runes' | 'craftable') => {
    set({ sortBy });
    get().refreshCraftableRunewords();
  },

  setSelectedRunewordId: (id: string | null) => {
    set({ selectedRunewordId: id });
  },

  refreshCraftableRunewords: () => {
    const { inventory, searchTerm, showOnlyCraftable, sortBy } = get();

    let craftable = getCraftableRunewords(inventory);
    craftable = filterCraftableRunewords(craftable, showOnlyCraftable);
    craftable = searchRunewords(craftable, searchTerm);
    craftable = sortRunewords(craftable, sortBy);

    set({ craftableRunewords: craftable });
  },
}));

// Initialize craftable runewords on store creation
useRunewordStore.getState().refreshCraftableRunewords();
