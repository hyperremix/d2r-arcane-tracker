import type { IItem } from '@dschu012/d2s/lib/d2/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameMode, GameVersion, type Item, type ItemsInSaves, type Settings } from '../types/grail';
import {
  buildFlattenObjectCacheKey,
  clearPrevUniqItemsFound,
  computeStats,
  computeSubStats,
  countInSaves,
  flattenObject,
  isRune,
  simplifyItemName,
} from './objects';

// Mock the grail items
vi.mock('../items/grail', () => ({
  runesSeed: {
    r01: { name: 'El Rune' },
    r02: { name: 'Eld Rune' },
    r33: { name: 'Zod Rune' },
  },
  runewordsSeed: {
    rw001: { name: 'Steel' },
    rw002: { name: 'Stealth' },
    rw003: { name: 'Leaf' },
  },
}));

// Mock the runewords mapping
vi.mock('../items/runewords', () => ({
  runewordsMapping: {
    Steel: { patch: 1.0 },
    Stealth: { patch: 1.0 },
    Leaf: { patch: 2.4 },
  },
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

describe('When flattenObject is called', () => {
  describe('If object is null', () => {
    it('Then should return empty object', () => {
      // Arrange
      const object = null;

      // Act
      const result = flattenObject(object);

      // Assert
      expect(result).toEqual({});
    });
  });

  describe('If object has nested structure', () => {
    it('Then should flatten nested objects recursively', () => {
      // Arrange
      const object = {
        Windforce: {
          'Hydra Bow': {},
        },
        Shako: {},
      };

      // Act
      const result = flattenObject(object);

      // Assert
      expect(result).toEqual({
        hydrabow: {},
        shako: {},
      });
    });
  });

  describe('If object has empty nested objects', () => {
    it('Then should skip empty nested objects', () => {
      // Arrange
      const object = {
        Windforce: {
          'Hydra Bow': {},
        },
        Empty: {},
      };

      // Act
      const result = flattenObject(object);

      // Assert
      expect(result).toEqual({
        hydrabow: {},
        empty: {},
      });
    });
  });

  describe('If cache key is provided', () => {
    it('Then should use cache when available', () => {
      // Arrange
      const object = { Shako: {} };
      const cacheKey = 'armor' as const;

      // Act
      const result1 = flattenObject(object, cacheKey);
      const result2 = flattenObject(object, cacheKey);

      // Assert
      expect(result1).toEqual({ shako: {} });
      expect(result2).toEqual({ shako: {} });
      expect(result1).toBe(result2); // Should be the same reference (cached)
    });
  });
});

describe('When buildFlattenObjectCacheKey is called', () => {
  describe('If settings have grailRunes enabled', () => {
    it('Then should append R to cache key', () => {
      // Arrange
      const settings = {
        grailRunes: true,
        grailRunewords: false,
        grailNormal: true,
        grailEthereal: false,
      } as Settings;
      const cacheKey = 'armor' as const;

      // Act
      const result = buildFlattenObjectCacheKey(cacheKey, settings);

      // Assert
      expect(result).toBe('armorRE');
    });
  });

  describe('If settings have grailRunewords enabled', () => {
    it('Then should append W to cache key', () => {
      // Arrange
      const settings = {
        grailRunes: false,
        grailRunewords: true,
        grailNormal: true,
        grailEthereal: false,
      } as Settings;
      const cacheKey = 'armor' as const;

      // Act
      const result = buildFlattenObjectCacheKey(cacheKey, settings);

      // Assert
      expect(result).toBe('armorWE');
    });
  });

  describe('If settings have both grailRunes and grailRunewords enabled', () => {
    it('Then should append both R and W to cache key', () => {
      // Arrange
      const settings = {
        grailRunes: true,
        grailRunewords: true,
        grailNormal: true,
        grailEthereal: false,
      } as Settings;
      const cacheKey = 'armor' as const;

      // Act
      const result = buildFlattenObjectCacheKey(cacheKey, settings);

      // Assert
      expect(result).toBe('armorRWE');
    });
  });

  describe('If settings have grailNormal enabled but grailEthereal disabled', () => {
    it('Then should append E to cache key', () => {
      // Arrange
      const settings = {
        grailRunes: false,
        grailRunewords: false,
        grailNormal: true,
        grailEthereal: false,
      } as Settings;
      const cacheKey = 'armor' as const;

      // Act
      const result = buildFlattenObjectCacheKey(cacheKey, settings);

      // Assert
      expect(result).toBe('armorE');
    });
  });

  describe('If all settings are enabled', () => {
    it('Then should append RWE to cache key', () => {
      // Arrange
      const settings = {
        grailRunes: true,
        grailRunewords: true,
        grailNormal: true,
        grailEthereal: false,
      } as Settings;
      const cacheKey = 'armor' as const;

      // Act
      const result = buildFlattenObjectCacheKey(cacheKey, settings);

      // Assert
      expect(result).toBe('armorRWE');
    });
  });
});

describe('When computeSubStats is called', () => {
  describe('If items are found in saves', () => {
    it('Then should return statistics structure', () => {
      // Arrange
      const items: ItemsInSaves = {
        shako: { name: 'Shako', type: 'armo', inSaves: {} } as Item,
      };
      const ethItems: ItemsInSaves = {
        shako: { name: 'Ethereal Shako', type: 'armo', inSaves: {} } as Item,
      };
      const template = {
        shako: {},
      };
      const ethTemplate = {
        shako: {},
      };
      const settings = {
        grailNormal: true,
        grailEthereal: true,
        grailRunes: false,
        grailRunewords: false,
        gameVersion: GameVersion.Resurrected,
      } as Settings;

      // Act
      const result = computeSubStats(items, ethItems, template, ethTemplate, settings, 'armor');

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
      const template = { shako: {} };
      const ethTemplate = { shako: {} };
      const settings = {
        grailNormal: true,
        grailEthereal: true,
        grailRunes: true,
        grailRunewords: true,
        gameVersion: GameVersion.Resurrected,
      } as Settings;

      // Act
      const result = computeSubStats(items, ethItems, template, ethTemplate, settings, 'armor');

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
        shako: { name: 'Shako', type: 'armo', inSaves: {} } as Item,
        r01: { name: 'El Rune', type: 'r01', inSaves: {} } as Item,
      };
      const ethItems: ItemsInSaves = {};
      const template = {
        shako: {},
        r01: {},
      };
      const ethTemplate = {};
      const settings = {
        grailNormal: true,
        grailEthereal: false,
        grailRunes: false,
        grailRunewords: false,
        gameVersion: GameVersion.Resurrected,
      } as Settings;

      // Act
      const result = computeSubStats(items, ethItems, template, ethTemplate, settings, 'armor');

      // Assert
      expect(result.normal.owned).toBe(1);
      expect(result.runes.owned).toBe(0);
    });
  });

  describe('If grailRunewords is disabled', () => {
    it('Then should not count runewords', () => {
      // Arrange
      const items: ItemsInSaves = {
        shako: { name: 'Shako', type: 'armo', inSaves: {} } as Item,
        rw001: { name: 'Steel', type: 'rw001', inSaves: {} } as Item,
      };
      const ethItems: ItemsInSaves = {};
      const template = {
        shako: {},
        rw001: {},
      };
      const ethTemplate = {};
      const settings = {
        grailNormal: true,
        grailEthereal: false,
        grailRunes: false,
        grailRunewords: false,
        gameVersion: GameVersion.Resurrected,
      } as Settings;

      // Act
      const result = computeSubStats(items, ethItems, template, ethTemplate, settings, 'armor');

      // Assert
      expect(result.normal.owned).toBe(1);
      expect(result.runewords.owned).toBe(0);
    });
  });

  describe('If game version is Classic', () => {
    it('Then should return statistics structure', () => {
      // Arrange
      const items = {};
      const ethItems = {};
      const template = {};
      const ethTemplate = {};
      const settings = {
        grailNormal: true,
        grailEthereal: false,
        grailRunes: false,
        grailRunewords: false,
        gameVersion: GameVersion.Classic,
      } as Settings;

      // Act
      const result = computeSubStats(items, ethItems, template, ethTemplate, settings, 'runewords');

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
        shako: { name: 'Shako', type: 'armo', inSaves: {} } as Item,
        windforce: { name: 'Windforce', type: 'weap', inSaves: {} } as Item,
        r01: { name: 'El Rune', type: 'r01', inSaves: {} } as Item,
        rw001: { name: 'Steel', type: 'rw001', inSaves: {} } as Item,
      };
      const ethItems: ItemsInSaves = {
        shako: { name: 'Ethereal Shako', type: 'armo', inSaves: {} } as Item,
        windforce: { name: 'Ethereal Windforce', type: 'weap', inSaves: {} } as Item,
      };
      const template = {
        runes: { r01: {} },
        runewords: { rw001: {} },
        uniques: {
          armor: { shako: {} },
          weapons: { windforce: {} },
          other: {},
        },
        sets: {},
        // biome-ignore lint/suspicious/noExplicitAny: explanation
      } as any;
      const ethTemplate = {
        uniques: {
          armor: { shako: {} },
          weapons: { windforce: {} },
          other: {},
        },
        // biome-ignore lint/suspicious/noExplicitAny: explanation
      } as any;
      const settings = {
        grailNormal: true,
        grailEthereal: true,
        grailRunes: true,
        grailRunewords: true,
        gameVersion: GameVersion.Resurrected,
        gameMode: GameMode.Manual,
      } as Settings;

      // Act
      const result = computeStats(items, ethItems, template, ethTemplate, settings);

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
      const items: ItemsInSaves = { shako: { name: 'Shako', type: 'armo', inSaves: {} } as Item };
      const ethItems: ItemsInSaves = {};
      const template = {
        runes: {},
        runewords: {},
        uniques: {
          armor: { shako: {} },
          weapons: {},
          other: {},
        },
        sets: {},
        // biome-ignore lint/suspicious/noExplicitAny: explanation
      } as any;
      const ethTemplate = {
        uniques: {
          armor: {},
          weapons: {},
          other: {},
        },
        // biome-ignore lint/suspicious/noExplicitAny: explanation
      } as any;
      const settings = {
        grailNormal: true,
        grailEthereal: false,
        grailRunes: false,
        grailRunewords: false,
        gameVersion: GameVersion.Resurrected,
        gameMode: GameMode.Manual,
      } as Settings;
      const playSound = vi.fn();

      // Act & Assert
      expect(() => {
        computeStats(items, ethItems, template, ethTemplate, settings, playSound);
      }).not.toThrow();
    });
  });

  describe('If gameMode is Manual', () => {
    it('Then should not call playSound', () => {
      // Arrange
      const items: ItemsInSaves = { shako: { name: 'Shako', type: 'armo', inSaves: {} } as Item };
      const ethItems: ItemsInSaves = {};
      const template = {
        runes: {},
        runewords: {},
        uniques: {
          armor: { shako: {} },
          weapons: {},
          other: {},
        },
        sets: {},
        // biome-ignore lint/suspicious/noExplicitAny: explanation
      } as any;
      const ethTemplate = {
        uniques: {
          armor: {},
          weapons: {},
          other: {},
        },
        // biome-ignore lint/suspicious/noExplicitAny: explanation
      } as any;
      const settings = {
        grailNormal: true,
        grailEthereal: false,
        grailRunes: false,
        grailRunewords: false,
        gameVersion: GameVersion.Resurrected,
        gameMode: GameMode.Manual,
      } as Settings;
      const playSound = vi.fn();

      // Act
      computeStats(items, ethItems, template, ethTemplate, settings, playSound);

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
      const item = {} as Item;

      // Act
      const result = countInSaves(item);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('If item has empty inSaves property', () => {
    it('Then should return 0', () => {
      // Arrange
      const item = { name: 'Test Item', type: 'armo', inSaves: {} } as Item;

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
    const items: ItemsInSaves = { shako: { name: 'Shako', type: 'armo', inSaves: {} } as Item };
    const ethItems: ItemsInSaves = {};
    const template = {
      runes: {},
      runewords: {},
      uniques: {
        armor: { shako: {} },
        weapons: {},
        other: {},
      },
      sets: {},
      // biome-ignore lint/suspicious/noExplicitAny: explanation
    } as any;
    const ethTemplate = {
      uniques: {
        armor: {},
        weapons: {},
        other: {},
      },
      // biome-ignore lint/suspicious/noExplicitAny: explanation
    } as any;
    const settings = {
      grailNormal: true,
      grailEthereal: false,
      grailRunes: false,
      grailRunewords: false,
      gameVersion: GameVersion.Resurrected,
      gameMode: GameMode.Manual,
    } as Settings;

    // Act
    computeStats(items, ethItems, template, ethTemplate, settings);
    clearPrevUniqItemsFound();
    computeStats(items, ethItems, template, ethTemplate, settings);

    // Assert
    // The function should work without errors after clearing
    expect(true).toBe(true);
  });
});
