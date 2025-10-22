import { describe, expect, it } from 'vitest';
import type { Item } from 'electron/types/grail';
import {
  addRuneToInventory,
  calculateRuneRequirements,
  canCraftRuneword,
  clearInventory,
  filterCraftableRunewords,
  getAllRunes,
  getAllRunewords,
  getCraftableRunewords,
  getMissingRunes,
  getRuneName,
  getTotalRuneCount,
  removeRuneFromInventory,
  type RuneInventory,
  searchRunewords,
  sortRunewords,
} from './runeword-calculator';

describe('runeword-calculator', () => {
  describe('getAllRunes', () => {
    it('should return all runes', () => {
      const runes = getAllRunes();
      expect(runes).toBeDefined();
      expect(runes.length).toBeGreaterThan(0);
      expect(runes[0]).toHaveProperty('id');
      expect(runes[0]).toHaveProperty('name');
    });
  });

  describe('getAllRunewords', () => {
    it('should return all runewords', () => {
      const runewords = getAllRunewords();
      expect(runewords).toBeDefined();
      expect(runewords.length).toBeGreaterThan(0);
      expect(runewords[0]).toHaveProperty('id');
      expect(runewords[0]).toHaveProperty('name');
      expect(runewords[0]).toHaveProperty('runes');
    });
  });

  describe('getRuneName', () => {
    it('should return the name of a rune by ID', () => {
      expect(getRuneName('el')).toBe('El');
      expect(getRuneName('eld')).toBe('Eld');
      expect(getRuneName('tir')).toBe('Tir');
    });

    it('should return the ID if rune is not found', () => {
      expect(getRuneName('unknown')).toBe('unknown');
    });
  });

  describe('calculateRuneRequirements', () => {
    it('should calculate rune requirements for a simple runeword', () => {
      const runeword: Item = {
        id: 'test',
        name: 'Test',
        link: '',
        etherealType: 'none',
        type: 'runeword',
        category: 'runewords',
        subCategory: 'runewords',
        treasureClass: 'normal',
        runes: ['el', 'eld', 'tir'],
      };

      const requirements = calculateRuneRequirements(runeword);
      expect(requirements.get('el')).toBe(1);
      expect(requirements.get('eld')).toBe(1);
      expect(requirements.get('tir')).toBe(1);
    });

    it('should handle duplicate runes', () => {
      const runeword: Item = {
        id: 'bone',
        name: 'Bone',
        link: '',
        etherealType: 'none',
        type: 'runeword',
        category: 'runewords',
        subCategory: 'runewords',
        treasureClass: 'normal',
        runes: ['sol', 'um', 'um'],
      };

      const requirements = calculateRuneRequirements(runeword);
      expect(requirements.get('sol')).toBe(1);
      expect(requirements.get('um')).toBe(2);
    });

    it('should return empty map for runeword without runes', () => {
      const runeword: Item = {
        id: 'test',
        name: 'Test',
        link: '',
        etherealType: 'none',
        type: 'runeword',
        category: 'runewords',
        subCategory: 'runewords',
        treasureClass: 'normal',
      };

      const requirements = calculateRuneRequirements(runeword);
      expect(requirements.size).toBe(0);
    });
  });

  describe('canCraftRuneword', () => {
    const runeword: Item = {
      id: 'lore',
      name: 'Lore',
      link: '',
      etherealType: 'none',
      type: 'runeword',
      category: 'runewords',
      subCategory: 'runewords',
      treasureClass: 'normal',
      runes: ['ort', 'sol'],
    };

    it('should return true when all runes are available', () => {
      const inventory: RuneInventory = { ort: 1, sol: 1 };
      expect(canCraftRuneword(runeword, inventory)).toBe(true);
    });

    it('should return true when excess runes are available', () => {
      const inventory: RuneInventory = { ort: 5, sol: 3 };
      expect(canCraftRuneword(runeword, inventory)).toBe(true);
    });

    it('should return false when some runes are missing', () => {
      const inventory: RuneInventory = { ort: 1 };
      expect(canCraftRuneword(runeword, inventory)).toBe(false);
    });

    it('should return false when no runes are available', () => {
      const inventory: RuneInventory = {};
      expect(canCraftRuneword(runeword, inventory)).toBe(false);
    });

    it('should handle duplicate runes correctly', () => {
      const boneRuneword: Item = {
        id: 'bone',
        name: 'Bone',
        link: '',
        etherealType: 'none',
        type: 'runeword',
        category: 'runewords',
        subCategory: 'runewords',
        treasureClass: 'normal',
        runes: ['sol', 'um', 'um'],
      };

      const inventoryWithOne: RuneInventory = { sol: 1, um: 1 };
      expect(canCraftRuneword(boneRuneword, inventoryWithOne)).toBe(false);

      const inventoryWithTwo: RuneInventory = { sol: 1, um: 2 };
      expect(canCraftRuneword(boneRuneword, inventoryWithTwo)).toBe(true);
    });
  });

  describe('getMissingRunes', () => {
    const runeword: Item = {
      id: 'lore',
      name: 'Lore',
      link: '',
      etherealType: 'none',
      type: 'runeword',
      category: 'runewords',
      subCategory: 'runewords',
      treasureClass: 'normal',
      runes: ['ort', 'sol'],
    };

    it('should return empty array when all runes are available', () => {
      const inventory: RuneInventory = { ort: 1, sol: 1 };
      const missing = getMissingRunes(runeword, inventory);
      expect(missing).toEqual([]);
    });

    it('should return missing runes', () => {
      const inventory: RuneInventory = { ort: 1 };
      const missing = getMissingRunes(runeword, inventory);
      expect(missing).toHaveLength(1);
      expect(missing[0].runeId).toBe('sol');
      expect(missing[0].runeName).toBe('Sol');
      expect(missing[0].needed).toBe(1);
    });

    it('should calculate correct quantities for duplicate runes', () => {
      const boneRuneword: Item = {
        id: 'bone',
        name: 'Bone',
        link: '',
        etherealType: 'none',
        type: 'runeword',
        category: 'runewords',
        subCategory: 'runewords',
        treasureClass: 'normal',
        runes: ['sol', 'um', 'um'],
      };

      const inventory: RuneInventory = { sol: 1, um: 1 };
      const missing = getMissingRunes(boneRuneword, inventory);
      expect(missing).toHaveLength(1);
      expect(missing[0].runeId).toBe('um');
      expect(missing[0].needed).toBe(1);
    });
  });

  describe('getCraftableRunewords', () => {
    it('should return all runewords with craftability info', () => {
      const inventory: RuneInventory = { ort: 1, sol: 1 };
      const craftable = getCraftableRunewords(inventory);
      expect(craftable.length).toBeGreaterThan(0);
      expect(craftable[0]).toHaveProperty('runeword');
      expect(craftable[0]).toHaveProperty('canCraft');
      expect(craftable[0]).toHaveProperty('missingRunes');
      expect(craftable[0]).toHaveProperty('hasAllRunes');
    });

    it('should mark runewords as craftable when all runes available', () => {
      const inventory: RuneInventory = { ort: 1, sol: 1 };
      const craftable = getCraftableRunewords(inventory);
      const lore = craftable.find((cr) => cr.runeword.id === 'lore');
      expect(lore?.canCraft).toBe(true);
      expect(lore?.hasAllRunes).toBe(true);
      expect(lore?.missingRunes).toEqual([]);
    });
  });

  describe('filterCraftableRunewords', () => {
    it('should return all runewords when showOnlyCraftable is false', () => {
      const inventory: RuneInventory = { ort: 1, sol: 1 };
      const craftable = getCraftableRunewords(inventory);
      const filtered = filterCraftableRunewords(craftable, false);
      expect(filtered.length).toBe(craftable.length);
    });

    it('should filter to only craftable runewords', () => {
      const inventory: RuneInventory = { ort: 1, sol: 1 };
      const craftable = getCraftableRunewords(inventory);
      const filtered = filterCraftableRunewords(craftable, true);
      expect(filtered.every((cr) => cr.canCraft)).toBe(true);
    });
  });

  describe('searchRunewords', () => {
    it('should return all runewords for empty search', () => {
      const inventory: RuneInventory = {};
      const craftable = getCraftableRunewords(inventory);
      const searched = searchRunewords(craftable, '');
      expect(searched.length).toBe(craftable.length);
    });

    it('should filter by runeword name', () => {
      const inventory: RuneInventory = {};
      const craftable = getCraftableRunewords(inventory);
      const searched = searchRunewords(craftable, 'lore');
      expect(searched.length).toBeGreaterThan(0);
      expect(searched.every((cr) => cr.runeword.name.toLowerCase().includes('lore'))).toBe(
        true
      );
    });

    it('should be case insensitive', () => {
      const inventory: RuneInventory = {};
      const craftable = getCraftableRunewords(inventory);
      const searchedLower = searchRunewords(craftable, 'lore');
      const searchedUpper = searchRunewords(craftable, 'LORE');
      expect(searchedLower.length).toBe(searchedUpper.length);
    });
  });

  describe('sortRunewords', () => {
    const inventory: RuneInventory = { ort: 1, sol: 1 };
    const craftable = getCraftableRunewords(inventory);

    it('should sort by name alphabetically', () => {
      const sorted = sortRunewords(craftable, 'name');
      for (let i = 1; i < sorted.length; i++) {
        expect(
          sorted[i - 1].runeword.name.localeCompare(sorted[i].runeword.name)
        ).toBeLessThanOrEqual(0);
      }
    });

    it('should sort by number of runes', () => {
      const sorted = sortRunewords(craftable, 'runes');
      for (let i = 1; i < sorted.length; i++) {
        const prevRuneCount = sorted[i - 1].runeword.runes?.length || 0;
        const currRuneCount = sorted[i].runeword.runes?.length || 0;
        expect(prevRuneCount).toBeLessThanOrEqual(currRuneCount);
      }
    });

    it('should sort by craftability', () => {
      const sorted = sortRunewords(craftable, 'craftable');
      let foundUncraftable = false;
      for (const cr of sorted) {
        if (!cr.canCraft) {
          foundUncraftable = true;
        }
        if (foundUncraftable) {
          expect(cr.canCraft).toBe(false);
        }
      }
    });
  });

  describe('inventory management', () => {
    it('should add rune to inventory', () => {
      const inventory: RuneInventory = {};
      const updated = addRuneToInventory(inventory, 'el', 1);
      expect(updated.el).toBe(1);
    });

    it('should add multiple runes to inventory', () => {
      const inventory: RuneInventory = { el: 2 };
      const updated = addRuneToInventory(inventory, 'el', 3);
      expect(updated.el).toBe(5);
    });

    it('should remove rune from inventory', () => {
      const inventory: RuneInventory = { el: 5 };
      const updated = removeRuneFromInventory(inventory, 'el', 2);
      expect(updated.el).toBe(3);
    });

    it('should delete rune when quantity reaches zero', () => {
      const inventory: RuneInventory = { el: 2 };
      const updated = removeRuneFromInventory(inventory, 'el', 2);
      expect(updated.el).toBeUndefined();
    });

    it('should not go below zero when removing', () => {
      const inventory: RuneInventory = { el: 1 };
      const updated = removeRuneFromInventory(inventory, 'el', 5);
      expect(updated.el).toBeUndefined();
    });

    it('should clear inventory', () => {
      const inventory = clearInventory();
      expect(Object.keys(inventory).length).toBe(0);
    });

    it('should calculate total rune count', () => {
      const inventory: RuneInventory = { el: 5, eld: 3, tir: 2 };
      expect(getTotalRuneCount(inventory)).toBe(10);
    });

    it('should return 0 for empty inventory', () => {
      const inventory: RuneInventory = {};
      expect(getTotalRuneCount(inventory)).toBe(0);
    });
  });
});
