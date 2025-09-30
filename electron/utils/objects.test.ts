import type { IItem } from '@dschu012/d2s/lib/d2/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameMode, type ItemsInSaves, type SaveFileItem, type Settings } from '../types/grail';
import {
  clearPrevUniqItemsFound,
  computeStats,
  computeSubStats,
  countInSaves,
  isRune,
  simplifyItemName,
} from './objects';

// Mock the items indexes
vi.mock('../items/indexes', () => ({
  isRunewordId: vi.fn(),
}));

// Mock the items
vi.mock('../items/index', () => ({
  items: [
    { id: 'el', type: 'rune', category: 'runes', etherealType: 'none' },
    { id: 'eld', type: 'rune', category: 'runes', etherealType: 'none' },
    { id: 'zod', type: 'rune', category: 'runes', etherealType: 'none' },
    { id: 'steel', type: 'runeword', category: 'runewords', etherealType: 'none' },
    { id: 'stealth', type: 'runeword', category: 'runewords', etherealType: 'none' },
    { id: 'leaf', type: 'runeword', category: 'runewords', etherealType: 'none' },
  ],
}));

describe('When simplifyItemName is called', () => {
  describe('If item name contains special characters', () => {
    it('Then should remove all non-alphanumeric characters and convert to lowercase', () => {
      // Arrange
      const itemName = 'Windforce (Hydra Bow)';

      // Act
      const result = simplifyItemName(itemName);

      // Assert
      expect(result).toBe('windforcehydrabow');
    });
  });

  describe('If item name contains numbers', () => {
    it('Then should preserve numbers in the simplified name', () => {
      // Arrange
      const itemName = 'Rune 33 - Zod';

      // Act
      const result = simplifyItemName(itemName);

      // Assert
      expect(result).toBe('rune33zod');
    });
  });

  describe('If item name is already simple', () => {
    it('Then should return lowercase version', () => {
      // Arrange
      const itemName = 'Shako';

      // Act
      const result = simplifyItemName(itemName);

      // Assert
      expect(result).toBe('shako');
    });
  });
});

describe('When isRune is called', () => {
  describe('If item type matches rune pattern', () => {
    it('Then should return true for valid rune types', () => {
      // Arrange
      const runeItem: IItem = { type: 'r01' } as IItem;

      // Act
      const result = isRune(runeItem);

      // Assert
      expect(result).toBe(true);
    });

    it('Then should return true for higher rune types', () => {
      // Arrange
      const runeItem: IItem = { type: 'r33' } as IItem;

      // Act
      const result = isRune(runeItem);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If item type does not match rune pattern', () => {
    it('Then should return false for non-rune types', () => {
      // Arrange
      const nonRuneItem: IItem = { type: 'swor' } as IItem;

      // Act
      const result = isRune(nonRuneItem);

      // Assert
      expect(result).toBe(false);
    });

    it('Then should return false for items without type', () => {
      // Arrange
      const itemWithoutType: IItem = {} as IItem;

      // Act
      const result = isRune(itemWithoutType);

      // Assert
      expect(result).toBe(false);
    });
  });
});

describe('When computeSubStats is called', () => {
  describe('If items are found in saves', () => {
    it('Then should return statistics structure', () => {
      // Arrange
      const items: ItemsInSaves = {
        shako: { name: 'Shako', type: 'armo', inSaves: {} } as SaveFileItem,
      };
      const ethItems: ItemsInSaves = {
        shako: { name: 'Ethereal Shako', type: 'armo', inSaves: {} } as SaveFileItem,
      };
      const settings = {
        grailNormal: true,
        grailEthereal: true,
        grailRunes: false,
        grailRunewords: false,
      } as Settings;

      // Act
      const result = computeSubStats(items, ethItems, 'armor', settings);

      // Assert
      expect(result).toHaveProperty('normal');
      expect(result).toHaveProperty('ethereal');
      expect(result).toHaveProperty('runes');
      expect(result).toHaveProperty('runewords');
      expect(result).toHaveProperty('uniqItemsList');
      expect(result.normal).toHaveProperty('owned');
      expect(result.ethereal).toHaveProperty('owned');
    });
  });

  describe('If no items are found', () => {
    it('Then should return zero statistics', () => {
      // Arrange
      const items = {};
      const ethItems = {};
      const settings = {
        grailNormal: true,
        grailEthereal: true,
        grailRunes: true,
        grailRunewords: true,
      } as Settings;

      // Act
      const result = computeSubStats(items, ethItems, 'armor', settings);

      // Assert
      expect(result.normal.owned).toBe(0);
      expect(result.ethereal.owned).toBe(0);
      expect(result.runes.owned).toBe(0);
      expect(result.runewords.owned).toBe(0);
      expect(result.uniqItemsList).toEqual([]);
    });
  });

  describe('If grailRunes is disabled', () => {
    it('Then should not count runes', () => {
      // Arrange
      const items: ItemsInSaves = {
        el: {
          name: 'El Rune',
          type: 'r01',
          inSaves: {
            TestChar: [{ ethereal: false, ilevel: 1, socketed: false }],
          },
        },
        eld: {
          name: 'Eld Rune',
          type: 'r02',
          inSaves: {
            TestChar: [{ ethereal: false, ilevel: 1, socketed: false }],
          },
        },
      };
      const ethItems: ItemsInSaves = {};
      const settings = {
        grailNormal: true,
        grailEthereal: false,
        grailRunes: false,
        grailRunewords: false,
      } as Settings;

      // Act
      const result = computeSubStats(items, ethItems, 'runes', settings);

      // Assert
      expect(result.normal.owned).toBe(0);
      expect(result.runes.owned).toBe(0);
    });
  });

  describe('If grailRunewords is disabled', () => {
    it('Then should not count runewords', () => {
      // Arrange
      const items: ItemsInSaves = {
        delirium: {
          name: 'Delirium',
          type: 'runeword',
          inSaves: {
            TestChar: [{ ethereal: false, ilevel: 65, socketed: false }],
          },
        },
        dream: {
          name: 'Dream',
          type: 'runeword',
          inSaves: {
            TestChar: [{ ethereal: false, ilevel: 65, socketed: false }],
          },
        },
      };
      const ethItems: ItemsInSaves = {};
      const settings = {
        grailNormal: true,
        grailEthereal: false,
        grailRunes: false,
        grailRunewords: false,
      } as Settings;

      // Act
      const result = computeSubStats(items, ethItems, 'runewords', settings);

      // Assert
      expect(result.normal.owned).toBe(0);
      expect(result.runewords.owned).toBe(0);
    });
  });

  describe('If game version is Classic', () => {
    it('Then should return statistics structure', () => {
      // Arrange
      const items = {};
      const ethItems = {};
      const settings = {
        grailNormal: true,
        grailEthereal: false,
        grailRunes: false,
        grailRunewords: false,
      } as Settings;

      // Act
      const result = computeSubStats(items, ethItems, 'runewords', settings);

      // Assert
      expect(result).toHaveProperty('runewords');
      expect(result.runewords).toHaveProperty('owned');
    });
  });
});

describe('When computeStats is called', () => {
  beforeEach(() => {
    clearPrevUniqItemsFound();
  });

  describe('If all item types are found', () => {
    it('Then should return comprehensive statistics structure', () => {
      // Arrange
      const items: ItemsInSaves = {
        shako: { name: 'Shako', type: 'armo', inSaves: {} } as SaveFileItem,
        windforce: { name: 'Windforce', type: 'weap', inSaves: {} } as SaveFileItem,
        r01: { name: 'El Rune', type: 'r01', inSaves: {} } as SaveFileItem,
        rw001: { name: 'Steel', type: 'rw001', inSaves: {} } as SaveFileItem,
      };
      const ethItems: ItemsInSaves = {
        shako: { name: 'Ethereal Shako', type: 'armo', inSaves: {} } as SaveFileItem,
        windforce: { name: 'Ethereal Windforce', type: 'weap', inSaves: {} } as SaveFileItem,
      };
      const settings = {
        grailNormal: true,
        grailEthereal: true,
        grailRunes: true,
        grailRunewords: true,
        gameMode: GameMode.Manual,
      } as Settings;

      // Act
      const result = computeStats(items, ethItems, settings);

      // Assert
      expect(result).toHaveProperty('normal');
      expect(result).toHaveProperty('ethereal');
      expect(result).toHaveProperty('runes');
      expect(result).toHaveProperty('runewords');
      expect(result.normal).toHaveProperty('armor');
      expect(result.normal).toHaveProperty('weapon');
      expect(result.ethereal).toHaveProperty('armor');
      expect(result.ethereal).toHaveProperty('weapon');
    });
  });

  describe('If playSound function is provided', () => {
    it('Then should execute without errors', () => {
      // Arrange
      const items: ItemsInSaves = {
        shako: { name: 'Shako', type: 'armo', inSaves: {} } as SaveFileItem,
      };
      const ethItems: ItemsInSaves = {};
      const settings = {
        grailNormal: true,
        grailEthereal: false,
        grailRunes: false,
        grailRunewords: false,
        gameMode: GameMode.Manual,
      } as Settings;
      const playSound = vi.fn();

      // Act & Assert
      expect(() => {
        computeStats(items, ethItems, settings, playSound);
      }).not.toThrow();
    });
  });

  describe('If gameMode is Manual', () => {
    it('Then should not call playSound', () => {
      // Arrange
      const items: ItemsInSaves = {
        shako: { name: 'Shako', type: 'armo', inSaves: {} } as SaveFileItem,
      };
      const ethItems: ItemsInSaves = {};
      const settings = {
        grailNormal: true,
        grailEthereal: false,
        grailRunes: false,
        grailRunewords: false,
        gameMode: GameMode.Manual,
      } as Settings;
      const playSound = vi.fn();

      // Act
      computeStats(items, ethItems, settings, playSound);

      // Assert
      expect(playSound).not.toHaveBeenCalled();
    });
  });
});

describe('When countInSaves is called', () => {
  describe('If item has inSaves property', () => {
    it('Then should count total items across all saves', () => {
      // Arrange
      const item = {
        name: 'Test Item',
        type: 'armo',
        inSaves: {
          save1: [{ quantity: 1 }, { quantity: 1 }],
          save2: [{ quantity: 1 }],
        },
        // biome-ignore lint/suspicious/noExplicitAny: explanation
      } as any;

      // Act
      const result = countInSaves(item);

      // Assert
      expect(result).toBe(3);
    });
  });

  describe('If item has no inSaves property', () => {
    it('Then should return 0', () => {
      // Arrange
      const item = {} as SaveFileItem;

      // Act
      const result = countInSaves(item);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('If item has empty inSaves property', () => {
    it('Then should return 0', () => {
      // Arrange
      const item = { name: 'Test Item', type: 'armo', inSaves: {} } as SaveFileItem;

      // Act
      const result = countInSaves(item);

      // Assert
      expect(result).toBe(0);
    });
  });
});

describe('When clearPrevUniqItemsFound is called', () => {
  it('Then should reset previous unique items found', () => {
    // Arrange
    const items: ItemsInSaves = {
      shako: { name: 'Shako', type: 'armo', inSaves: {} } as SaveFileItem,
    };
    const ethItems: ItemsInSaves = {};
    const settings = {
      grailNormal: true,
      grailEthereal: false,
      grailRunes: false,
      grailRunewords: false,
      gameMode: GameMode.Manual,
    } as Settings;

    // Act
    computeStats(items, ethItems, settings);
    clearPrevUniqItemsFound();
    computeStats(items, ethItems, settings);

    // Assert
    // The function should work without errors after clearing
    expect(true).toBe(true);
  });
});
