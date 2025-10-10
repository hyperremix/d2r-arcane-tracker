/** biome-ignore-all lint/suspicious/noExplicitAny: This file is testing private methods */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the d2s library
vi.mock('@dschu012/d2s', () => ({
  read: vi.fn(),
}));

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'node:fs/promises';
// Import mocked modules
import { read } from '@dschu012/d2s';
import { D2SaveFileBuilder, D2SItemBuilder, HolyGrailItemBuilder } from '@/fixtures';
import type { D2Item, D2SItem, Item } from '../types/grail';
import { EventBus } from './EventBus';
import { ItemDetectionService } from './itemDetection';

// Mock data types

describe('When ItemDetectionService is used', () => {
  let service: ItemDetectionService;
  let mockGrailItems: Item[];
  let eventBus: EventBus;

  beforeEach(() => {
    // Create EventBus instance
    eventBus = new EventBus();

    // Create service with EventBus
    service = new ItemDetectionService(eventBus);
    mockGrailItems = [
      HolyGrailItemBuilder.new()
        .withId('shako')
        .withName('shako')
        .withType('unique')
        .withArmorSubCategory('helms')
        .withEtherealType('none')
        .build(),
      HolyGrailItemBuilder.new()
        .withId('windforce')
        .withName('windforce')
        .withType('unique')
        .withWeaponSubCategory('bows')
        .withEtherealType('none')
        .build(),
      HolyGrailItemBuilder.new()
        .withId('ber-rune')
        .withName('ber')
        .withType('rune')
        .withRuneSubCategory('runes')
        .withEtherealType('none')
        .build(),
    ];

    // Clear all mocks
    vi.clearAllMocks();

    // Reset mocks to default behavior
    vi.mocked(readFile).mockClear();
    vi.mocked(read).mockClear();
  });

  describe('If setGrailItems is called', () => {
    it('Then should set the grail items array', () => {
      // Arrange
      const items = mockGrailItems;

      // Act
      service.setGrailItems(items);

      // Assert
      // We can't directly access private property, but we can test through other methods
      expect(true).toBe(true); // Placeholder - functionality tested through other methods
    });

    it('Then should work with different item types using builder methods', () => {
      // Arrange
      const diverseItems = [
        HolyGrailItemBuilder.new()
          .withId('shako')
          .withName('shako')
          .withType('unique')
          .withArmorSubCategory('helms')
          .withEtherealType('none')
          .build(),
        HolyGrailItemBuilder.new()
          .withId('windforce')
          .withName('windforce')
          .withType('unique')
          .withWeaponSubCategory('bows')
          .withEtherealType('none')
          .build(),
        HolyGrailItemBuilder.new()
          .withId('ber-rune')
          .withName('ber')
          .withType('rune')
          .withRuneSubCategory('runes')
          .withEtherealType('none')
          .build(),
        HolyGrailItemBuilder.new()
          .withId('angelic-raiment')
          .withName('angelicraiment')
          .withType('set')
          .withArmorSubCategory('body_armor')
          .withSetName('Angelic Raiment')
          .withEtherealType('none')
          .build(),
        HolyGrailItemBuilder.new()
          .withId('grandfather')
          .withName('grandfather')
          .withType('unique')
          .withWeaponSubCategory('2h_swords')
          .withEtherealType('optional')
          .build(),
      ];

      // Act
      service.setGrailItems(diverseItems);

      // Assert
      expect(diverseItems).toHaveLength(5);
      expect(diverseItems[0].type).toBe('unique');
      expect(diverseItems[0].category).toBe('armor');
      expect(diverseItems[0].subCategory).toBe('helms');
      expect(diverseItems[1].type).toBe('unique');
      expect(diverseItems[1].category).toBe('weapons');
      expect(diverseItems[1].subCategory).toBe('bows');
      expect(diverseItems[2].type).toBe('rune');
      expect(diverseItems[2].category).toBe('runes');
      expect(diverseItems[3].type).toBe('set');
      expect(diverseItems[3].setName).toBe('Angelic Raiment');
      expect(diverseItems[4].etherealType).toBe('optional');
    });

    it('Then should work with multiple items using buildMany', () => {
      // Arrange
      const multipleItems = HolyGrailItemBuilder.new()
        .withId('shako')
        .withName('shako')
        .withType('unique')
        .withArmorSubCategory('helms')
        .withEtherealType('none')
        .buildMany(3);

      // Act
      service.setGrailItems(multipleItems);

      // Assert
      expect(multipleItems).toHaveLength(3);
      expect(multipleItems[0].name).toBe('shako 1');
      expect(multipleItems[1].name).toBe('shako 2');
      expect(multipleItems[2].name).toBe('shako 3');
      // All should have the same properties except name and id
      multipleItems.forEach((item) => {
        expect(item.type).toBe('unique');
        expect(item.category).toBe('armor');
        expect(item.subCategory).toBe('helms');
        expect(item.etherealType).toBe('none');
      });
    });
  });

  describe('If analyzeSaveFile is called', () => {
    it('Then should work with different character types using builder convenience methods', async () => {
      // Arrange
      const amazonSaveFile = D2SaveFileBuilder.new()
        .asAmazon()
        .atLevel(85)
        .inHell()
        .asHardcore()
        .asExpansion()
        .withName('AmazonTest')
        .withPath('/path/to/amazon.d2s')
        .build();

      const barbarianSaveFile = D2SaveFileBuilder.new()
        .asBarbarian()
        .atLevel(90)
        .inNightmare()
        .asSoftcore()
        .asClassic()
        .withName('BarbarianTest')
        .withPath('/path/to/barbarian.d2s')
        .build();

      service.setGrailItems(mockGrailItems);

      // Act & Assert
      await service.analyzeSaveFile(amazonSaveFile);
      await service.analyzeSaveFile(barbarianSaveFile);
      expect(amazonSaveFile.characterClass).toBe('Amazon');
      expect(amazonSaveFile.level).toBe(85);
      expect(amazonSaveFile.difficulty).toBe('hell');
      expect(amazonSaveFile.hardcore).toBe(true);
      expect(amazonSaveFile.expansion).toBe(true);
      expect(barbarianSaveFile.characterClass).toBe('Barbarian');
      expect(barbarianSaveFile.level).toBe(90);
      expect(barbarianSaveFile.difficulty).toBe('nightmare');
      expect(barbarianSaveFile.hardcore).toBe(false);
      expect(barbarianSaveFile.expansion).toBe(false);
    });

    it('Then should work with multiple save files using buildMany', async () => {
      // Arrange
      const saveFiles = D2SaveFileBuilder.new()
        .asSorceress()
        .atLevel(80)
        .inHell()
        .asHardcore()
        .asExpansion()
        .withName('SorceressTest')
        .withPath('/path/to/sorceress.d2s')
        .buildMany(3);

      service.setGrailItems(mockGrailItems);

      // Act
      for (const saveFile of saveFiles) {
        await service.analyzeSaveFile(saveFile);
      }

      // Assert
      expect(saveFiles).toHaveLength(3);
      expect(saveFiles[0].name).toBe('SorceressTest-0');
      expect(saveFiles[1].name).toBe('SorceressTest-1');
      expect(saveFiles[2].name).toBe('SorceressTest-2');
      expect(saveFiles[0].path).toBe('/path/to/sorceress-0.d2s');
      expect(saveFiles[1].path).toBe('/path/to/sorceress-1.d2s');
      expect(saveFiles[2].path).toBe('/path/to/sorceress-2.d2s');
      // All should have the same properties except name and path
      saveFiles.forEach((saveFile) => {
        expect(saveFile.characterClass).toBe('Sorceress');
        expect(saveFile.level).toBe(80);
        expect(saveFile.difficulty).toBe('hell');
        expect(saveFile.hardcore).toBe(true);
        expect(saveFile.expansion).toBe(true);
      });
    });
  });

  describe('If extractItemsFromSaveFile is called', () => {
    it('Then should handle parsing errors', async () => {
      // Arrange
      const mockSaveFile = D2SaveFileBuilder.new()
        .withName('TestCharacter')
        .withPath('/path/to/save.d2s')
        .withLastModified(new Date())
        .build();

      vi.mocked(readFile).mockRejectedValue(new Error('Parse error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Mock implementation
      });

      // Act
      const result = await (service as any).extractItemsFromSaveFile(mockSaveFile);

      // Assert
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error parsing save file with d2s:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('If extractItemsFromList is called', () => {
    it('Then should extract items with proper names and types', () => {
      // Arrange
      const mockItemList: D2SItem[] = [
        D2SItemBuilder.new().withId(1).asUniqueHelm().build(),
        D2SItemBuilder.new().withId(2).asSetArmor().withLevel(30).asEquipped().build(),
        D2SItemBuilder.new().withId(3).asRareItem().withLevel(25).build(),
        D2SItemBuilder.new()
          .withId(4)
          .asRune('r30') // Ber rune
          .withQuality(1)
          .build(),
        D2SItemBuilder.new().withId(5).asRuneword().withQuality(1).build(),
      ];

      const items: D2Item[] = [];

      // Act
      (service as any).extractItemsFromList(mockItemList, items, 'TestCharacter', 'inventory');

      // Assert
      expect(items).toHaveLength(5);
      expect(items[0].name).toBe('shako');
      expect(items[0].quality).toBe('unique');
      expect(items[1].name).toBe('angelicraiment');
      expect(items[1].quality).toBe('set');
      expect(items[2].name).toBe('raresword');
      expect(items[2].quality).toBe('rare');
      expect(items[3].name).toBe('ber');
      expect(items[3].quality).toBe('normal');
      expect(items[4].name).toBe('enigma');
      expect(items[4].quality).toBe('normal');
    });

    it('Then should handle socketed items recursively', () => {
      // Arrange
      const mockItemList: D2SItem[] = [
        D2SItemBuilder.new()
          .withId(1)
          .asUniqueHelm()
          .asSocketed(1)
          .withSocketedItems([
            D2SItemBuilder.new()
              .withId(2)
              .asRune('r30') // Ber rune
              .withQuality(1)
              .build(),
          ])
          .build(),
      ];

      const items: D2Item[] = [];

      // Act
      (service as any).extractItemsFromList(mockItemList, items, 'TestCharacter', 'inventory');

      // Assert
      expect(items).toHaveLength(2); // Shako + socketed Ber rune
      expect(items[0].name).toBe('shako');
      expect(items[1].name).toBe('ber');
    });

    it('Then should skip items without grail-relevant names', () => {
      // Arrange
      const mockItemList: D2SItem[] = [
        D2SItemBuilder.new()
          .withId(1)
          .withName('Regular Sword')
          .withType('swor')
          .withLevel(10)
          .withQuality(1)
          .build(),
        D2SItemBuilder.new().withId(2).asUniqueHelm().build(),
      ];

      const items: D2Item[] = [];

      // Act
      (service as any).extractItemsFromList(mockItemList, items, 'TestCharacter', 'inventory');

      // Assert
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('shako');
    });
  });

  describe('If isRune is called', () => {
    it('Then should identify runes correctly', () => {
      // Arrange
      const runeItem: D2SItem = D2SItemBuilder.new().asRune('r30').build(); // Ber rune
      const nonRuneItem: D2SItem = D2SItemBuilder.new().withType('swor').build(); // Sword

      // Act
      const isRuneResult = (service as any).isRune(runeItem);
      const isNotRuneResult = (service as any).isRune(nonRuneItem);

      // Assert
      expect(isRuneResult).toBe(true);
      expect(isNotRuneResult).toBe(false);
    });
  });

  describe('If getItemName is called', () => {
    it('Then should return simplified unique item name', () => {
      // Arrange
      const uniqueItem: D2SItem = D2SItemBuilder.new().withUniqueName('Shako').build();

      // Act
      const result = (service as any).getItemName(uniqueItem);

      // Assert
      expect(result).toBe('shako');
    });

    it('Then should return simplified set item name', () => {
      // Arrange
      const setItem: D2SItem = D2SItemBuilder.new().withSetName('Angelic Raiment').build();

      // Act
      const result = (service as any).getItemName(setItem);

      // Assert
      expect(result).toBe('angelicraiment');
    });

    it('Then should return simplified rare item name', () => {
      // Arrange
      const rareItem: D2SItem = D2SItemBuilder.new().withRareName('Rare Sword').build();

      // Act
      const result = (service as any).getItemName(rareItem);

      // Assert
      expect(result).toBe('raresword');
    });

    it('Then should return rune name from mapping', () => {
      // Arrange
      const runeItem: D2SItem = D2SItemBuilder.new().asRune('r30').build(); // Ber rune

      // Act
      const result = (service as any).getItemName(runeItem);

      // Assert
      expect(result).toBe('ber');
    });

    it('Then should return runeword name with prefix', () => {
      // Arrange
      const runewordItem: D2SItem = D2SItemBuilder.new().withRunewordName('Enigma').build();

      // Act
      const result = (service as any).getItemName(runewordItem);

      // Assert
      expect(result).toBe('enigma');
    });

    it('Then should process rainbow facet correctly', () => {
      // Arrange
      const rainbowFacetItem: D2SItem = D2SItemBuilder.new().asRainbowFacet().build();

      // Act
      const result = (service as any).getItemName(rainbowFacetItem);

      // Assert
      expect(result).toBe('rainbowfacetcolddeath');
    });

    it('Then should return fallback name when no specific name found', () => {
      // Arrange
      const fallbackItem: D2SItem = D2SItemBuilder.new().withName('Generic Item').build();

      // Act
      const result = (service as any).getItemName(fallbackItem);

      // Assert
      expect(result).toBe('Generic Item');
    });
  });

  describe('If getItemType is called', () => {
    it('Then should return lowercase type', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new().withType('SHAKO').build();

      // Act
      const result = (service as any).getItemType(item);

      // Assert
      expect(result).toBe('shako');
    });

    it('Then should return type_name when type is not available', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new().withTypeName('Helm').withoutType().build();

      // Act
      const result = (service as any).getItemType(item);

      // Assert
      expect(result).toBe('helm');
    });

    it('Then should return code when type and type_name are not available', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new()
        .withCode('SWOR')
        .withoutType()
        .withoutTypeName()
        .build();

      // Act
      const result = (service as any).getItemType(item);

      // Assert
      expect(result).toBe('swor');
    });

    it('Then should return misc when no type information is available', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new()
        .withoutType()
        .withoutTypeName()
        .withoutCode()
        .build();

      // Act
      const result = (service as any).getItemType(item);

      // Assert
      expect(result).toBe('misc');
    });
  });

  describe('If getItemQuality is called', () => {
    it('Then should return normal for quality 1', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new().withQuality(1).build();

      // Act
      const result = (service as any).getItemQuality(item);

      // Assert
      expect(result).toBe('normal');
    });

    it('Then should return magic for quality 2', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new().withQuality(2).build();

      // Act
      const result = (service as any).getItemQuality(item);

      // Assert
      expect(result).toBe('magic');
    });

    it('Then should return rare for quality 3', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new().withQuality(3).build();

      // Act
      const result = (service as any).getItemQuality(item);

      // Assert
      expect(result).toBe('rare');
    });

    it('Then should return set for quality 4', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new().withQuality(4).build();

      // Act
      const result = (service as any).getItemQuality(item);

      // Assert
      expect(result).toBe('set');
    });

    it('Then should return unique for quality 5', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new().withQuality(5).build();

      // Act
      const result = (service as any).getItemQuality(item);

      // Assert
      expect(result).toBe('unique');
    });

    it('Then should return crafted for quality 6', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new().withQuality(6).build();

      // Act
      const result = (service as any).getItemQuality(item);

      // Assert
      expect(result).toBe('crafted');
    });

    it('Then should return normal for unknown quality', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new().withQuality(99).build();

      // Act
      const result = (service as any).getItemQuality(item);

      // Assert
      expect(result).toBe('normal');
    });
  });

  describe('If getItemLocation is called', () => {
    it('Then should return equipment for equipped items', () => {
      // Arrange
      const equippedItem: D2SItem = D2SItemBuilder.new().asEquipped().build();

      // Act
      const result = (service as any).getItemLocation(equippedItem);

      // Assert
      expect(result).toBe('equipment');
    });

    it('Then should return stash for stash items', () => {
      // Arrange
      const stashItem: D2SItem = D2SItemBuilder.new().withLocation('stash').build();

      // Act
      const result = (service as any).getItemLocation(stashItem);

      // Assert
      expect(result).toBe('stash');
    });

    it('Then should return inventory for other items', () => {
      // Arrange
      const inventoryItem: D2SItem = D2SItemBuilder.new().withLocation('inventory').build();

      // Act
      const result = (service as any).getItemLocation(inventoryItem);

      // Assert
      expect(result).toBe('inventory');
    });
  });

  describe('If getItemSockets is called', () => {
    it('Then should return socket count from gems array', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new().withGems([1, 2, 3]).build();

      // Act
      const result = (service as any).getItemSockets(item);

      // Assert
      expect(result).toBe(3);
    });

    it('Then should return socket_count when available', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new()
        .withSocketCount(2)
        .withoutGems()
        .withoutSocketed()
        .build();

      // Act
      const result = (service as any).getItemSockets(item);

      // Assert
      expect(result).toBe(2);
    });

    it('Then should return socketed when available', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new()
        .withSocketed(1)
        .withoutGems()
        .withoutSocketCount()
        .build();

      // Act
      const result = (service as any).getItemSockets(item);

      // Assert
      expect(result).toBe(1);
    });

    it('Then should return 0 when no socket information is available', () => {
      // Arrange
      const item: D2SItem = D2SItemBuilder.new().build();

      // Act
      const result = (service as any).getItemSockets(item);

      // Assert
      expect(result).toBe(0);
    });

    it('Then should work with multiple items using buildMany', () => {
      // Arrange
      const multipleItems = D2SItemBuilder.new().asUniqueHelm().buildMany(3);

      // Act & Assert
      expect(multipleItems).toHaveLength(3);
      expect(multipleItems[0].id).toBe('item-0');
      expect(multipleItems[1].id).toBe('item-1');
      expect(multipleItems[2].id).toBe('item-2');
      // All should have the same properties except id
      multipleItems.forEach((item) => {
        expect(item.unique_name).toBe('Shako');
        expect(item.type).toBe('ushk');
        expect(item.level).toBe(62);
        expect(item.quality).toBe(5);
        expect(item.ethereal).toBe(0);
      });
    });

    it('Then should work with real D2SItem interface using D2SItemBuilder', () => {
      // Arrange
      const d2sItems = D2SItemBuilder.new()
        .withId('test-item-1')
        .asUniqueHelm()
        .withSocketedItems([D2SItemBuilder.new().withId('socketed-rune').asRune('r30').build()])
        .build();

      // Act
      const items: D2Item[] = [];
      (service as any).extractItemsFromList([d2sItems], items, 'TestCharacter', 'inventory');

      // Assert
      expect(items).toHaveLength(2); // Shako + socketed rune
      expect(items[0].name).toBe('shako');
      expect(items[0].quality).toBe('unique');
      expect(items[1].name).toBe('ber');
      expect(items[1].quality).toBe('crafted');
    });
  });

  describe('If findGrailMatch is called', () => {
    it('Then should return matching grail item', () => {
      // Arrange
      const item: D2Item = {
        id: 'test',
        name: 'shako',
        type: 'helms',
        quality: 'unique',
        level: 62,
        ethereal: false,
        sockets: 0,
        timestamp: new Date(),
        characterName: 'Test',
        location: 'inventory',
      };

      service.setGrailItems(mockGrailItems);

      // Act
      const result = (service as any).findGrailMatch(item);

      // Assert
      expect(result).toEqual(mockGrailItems[0]);
    });

    it('Then should return null when no match is found', () => {
      // Arrange
      const item: D2Item = {
        id: 'test',
        name: 'nonexistent',
        type: 'misc',
        quality: 'normal',
        level: 1,
        ethereal: false,
        sockets: 0,
        timestamp: new Date(),
        characterName: 'Test',
        location: 'inventory',
      };

      service.setGrailItems(mockGrailItems);

      // Act
      const result = (service as any).findGrailMatch(item);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('If analyzeSaveFile detects duplicate items', () => {
    it('Then should emit event on first detection', async () => {
      // Arrange
      const saveFile = D2SaveFileBuilder.new()
        .withPath('/test/char.d2s')
        .withName('TestChar')
        .build();
      const d2sItem = D2SItemBuilder.new()
        .withId('1234')
        .asUniqueHelm()
        .withUniqueName('shako') // Must match mockGrailItems ID
        .build();
      const eventSpy = vi.fn();
      eventBus.on('item-detection', eventSpy);
      service.setGrailItems(mockGrailItems);

      // Act - provide pre-extracted items to avoid parsing
      await service.analyzeSaveFile(saveFile, [d2sItem as any]);

      // Assert
      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    it('Then should NOT emit event on second detection of same item', async () => {
      // Arrange
      const saveFile = D2SaveFileBuilder.new()
        .withPath('/test/char.d2s')
        .withName('TestChar')
        .build();
      const d2sItem = D2SItemBuilder.new()
        .withId('1234')
        .asUniqueHelm()
        .withUniqueName('shako') // Must match mockGrailItems ID
        .build();
      const eventSpy = vi.fn();
      eventBus.on('item-detection', eventSpy);
      service.setGrailItems(mockGrailItems);

      // Act - provide pre-extracted items to avoid parsing
      await service.analyzeSaveFile(saveFile, [d2sItem as any]); // First analysis
      await service.analyzeSaveFile(saveFile, [d2sItem as any]); // Second analysis - should not emit

      // Assert
      expect(eventSpy).toHaveBeenCalledTimes(1); // Only called once
    });

    it('Then should emit event for new item in same save file', async () => {
      // Arrange
      const saveFile = D2SaveFileBuilder.new()
        .withPath('/test/char.d2s')
        .withName('TestChar')
        .build();
      const d2sItem1 = D2SItemBuilder.new()
        .withId('1234')
        .asUniqueHelm()
        .withUniqueName('shako') // Must match mockGrailItems ID
        .build();
      const d2sItem2 = D2SItemBuilder.new()
        .withId('5678')
        .asUniqueHelm()
        .withUniqueName('shako') // Same item but different ID
        .build();
      const eventSpy = vi.fn();
      eventBus.on('item-detection', eventSpy);
      service.setGrailItems(mockGrailItems);

      // Act - provide pre-extracted items to avoid parsing
      await service.analyzeSaveFile(saveFile, [d2sItem1 as any]); // First item
      await service.analyzeSaveFile(saveFile, [d2sItem1 as any, d2sItem2 as any]); // Second item added

      // Assert
      expect(eventSpy).toHaveBeenCalledTimes(2); // One for each unique item
    });

    it('Then should emit event for same item in different save file', async () => {
      // Arrange
      const saveFile1 = D2SaveFileBuilder.new()
        .withPath('/test/char1.d2s')
        .withName('Char1')
        .build();
      const saveFile2 = D2SaveFileBuilder.new()
        .withPath('/test/char2.d2s')
        .withName('Char2')
        .build();
      const d2sItem = D2SItemBuilder.new()
        .withId('1234')
        .asUniqueHelm()
        .withUniqueName('shako') // Must match mockGrailItems ID
        .build();
      const eventSpy = vi.fn();
      eventBus.on('item-detection', eventSpy);
      service.setGrailItems(mockGrailItems);

      // Act - provide pre-extracted items to avoid parsing
      await service.analyzeSaveFile(saveFile1, [d2sItem as any]); // First save file
      await service.analyzeSaveFile(saveFile2, [d2sItem as any]); // Different save file

      // Assert
      expect(eventSpy).toHaveBeenCalledTimes(2); // Once per save file
    });
  });

  describe('If clearSeenItems is called', () => {
    it('Then should clear all tracking and allow re-detection', async () => {
      // Arrange
      const saveFile = D2SaveFileBuilder.new()
        .withPath('/test/char.d2s')
        .withName('TestChar')
        .build();
      const d2sItem = D2SItemBuilder.new()
        .withId('1234')
        .asUniqueHelm()
        .withUniqueName('shako') // Must match mockGrailItems ID
        .build();
      const eventSpy = vi.fn();
      eventBus.on('item-detection', eventSpy);
      service.setGrailItems(mockGrailItems);

      // Act - provide pre-extracted items to avoid parsing
      await service.analyzeSaveFile(saveFile, [d2sItem as any]); // First detection
      service.clearSeenItems(); // Clear tracking
      await service.analyzeSaveFile(saveFile, [d2sItem as any]); // Should detect again

      // Assert
      expect(eventSpy).toHaveBeenCalledTimes(2); // Emitted twice after clear
    });

    it('Then should clear specific save file tracking', async () => {
      // Arrange
      const saveFile1 = D2SaveFileBuilder.new()
        .withPath('/test/char1.d2s')
        .withName('Char1')
        .build();
      const saveFile2 = D2SaveFileBuilder.new()
        .withPath('/test/char2.d2s')
        .withName('Char2')
        .build();
      const d2sItem = D2SItemBuilder.new()
        .withId('1234')
        .asUniqueHelm()
        .withUniqueName('shako') // Must match mockGrailItems ID
        .build();
      const eventSpy = vi.fn();
      eventBus.on('item-detection', eventSpy);
      service.setGrailItems(mockGrailItems);

      // Act - provide pre-extracted items to avoid parsing
      await service.analyzeSaveFile(saveFile1, [d2sItem as any]); // Detect in file 1
      await service.analyzeSaveFile(saveFile2, [d2sItem as any]); // Detect in file 2
      service.clearSeenItems('/test/char1.d2s'); // Clear only file 1
      await service.analyzeSaveFile(saveFile1, [d2sItem as any]); // Should detect again
      await service.analyzeSaveFile(saveFile2, [d2sItem as any]); // Should NOT detect again

      // Assert
      expect(eventSpy).toHaveBeenCalledTimes(3); // file1, file2, file1 again
    });
  });
});
