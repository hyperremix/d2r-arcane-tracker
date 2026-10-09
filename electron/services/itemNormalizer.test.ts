import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { D2SaveFileBuilder, D2SItemBuilder } from '@/fixtures';
import { items as catalogItems } from '../items/index';
import type { D2SItem, ItemDetectionEvent, ParsedInventoryItem } from '../types/grail';
import { EventBus } from './EventBus';
import { ItemDetectionService } from './itemDetection';
import {
  mapItemQuality,
  normalizeItemsWithSocketedItems,
  resolveDetectionName,
  resolveGrailLookupName,
  resolveSocketCount,
  selectDetectionCandidates,
  toDetectedItem,
} from './itemNormalizer';
import { parseModernStash } from './modernStashParser';

const MODERN_STASH_FIXTURE_PATH = resolve(
  process.cwd(),
  'electron/services/fixtures/ModernSharedStashSoftCoreV2.d2i',
);

const saveFile = D2SaveFileBuilder.new()
  .withName('TestChar')
  .withPath('/test/TestChar.d2s')
  .build();

const toParsedItems = (d2sItems: D2SItem[]): ParsedInventoryItem[] =>
  normalizeItemsWithSocketedItems(d2sItems, {
    filePath: saveFile.path,
    saveName: saveFile.name,
    sourceFileType: 'd2s',
    fallbackLocation: 'inventory',
  });

const resolveDetectedType = (item: D2SItem): string =>
  toDetectedItem(toParsedItems([item])[0], saveFile).type;

const detectionKeys = (items: ParsedInventoryItem[]) =>
  selectDetectionCandidates(items).map(
    (item) => `${resolveDetectionName(item.rawParsedItem)}${item.ethereal ? '+eth' : ''}`,
  );

describe('When resolveDetectionName is called', () => {
  it('Then should return simplified unique item name', () => {
    // Arrange
    const uniqueItem: D2SItem = D2SItemBuilder.new().withUniqueName('Shako').build();

    // Act
    const result = resolveDetectionName(uniqueItem);

    // Assert
    expect(result).toBe('shako');
  });

  it('Then should return simplified set item name', () => {
    // Arrange
    const setItem: D2SItem = D2SItemBuilder.new().withSetName('Angelic Raiment').build();

    // Act
    const result = resolveDetectionName(setItem);

    // Assert
    expect(result).toBe('angelicraiment');
  });

  it('Then should NOT return rare item name (rare items excluded from grail)', () => {
    // Arrange - rare items are intentionally excluded because their names
    // can match real grail items (e.g., "Doom Collar" with rare_name "Doom")
    const rareItem: D2SItem = D2SItemBuilder.new().withRareName('Rare Sword').build();

    // Act
    const result = resolveDetectionName(rareItem);

    // Assert - rare_name is ignored, falls through to item.name fallback
    expect(result).toBe('Default Item');
  });

  it('Then should return rune name from mapping', () => {
    // Arrange
    const runeItem: D2SItem = D2SItemBuilder.new().asRune('r30').build(); // Ber rune

    // Act
    const result = resolveDetectionName(runeItem);

    // Assert
    expect(result).toBe('ber');
  });

  it('Then should return runeword name with prefix', () => {
    // Arrange
    const runewordItem: D2SItem = D2SItemBuilder.new().withRunewordName('Enigma').build();

    // Act
    const result = resolveDetectionName(runewordItem);

    // Assert
    expect(result).toBe('enigma');
  });

  it('Then should process rainbow facet correctly', () => {
    // Arrange
    const rainbowFacetItem: D2SItem = D2SItemBuilder.new().asRainbowFacet().build();

    // Act
    const result = resolveDetectionName(rainbowFacetItem);

    // Assert
    expect(result).toBe('rainbowfacetcolddeath');
  });

  it('Then should return fallback name when no specific name found', () => {
    // Arrange
    const fallbackItem: D2SItem = D2SItemBuilder.new().withName('Generic Item').build();

    // Act
    const result = resolveDetectionName(fallbackItem);

    // Assert
    expect(result).toBe('Generic Item');
  });
});

describe('When the detected item type is resolved', () => {
  it('Then should return lowercase type', () => {
    // Arrange
    const item: D2SItem = D2SItemBuilder.new().withType('SHAKO').build();

    // Act
    const result = resolveDetectedType(item);

    // Assert
    expect(result).toBe('shako');
  });

  it('Then should return type_name when type is not available', () => {
    // Arrange
    const item: D2SItem = D2SItemBuilder.new().withTypeName('Helm').withoutType().build();

    // Act
    const result = resolveDetectedType(item);

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
    const result = resolveDetectedType(item);

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
    const result = resolveDetectedType(item);

    // Assert
    expect(result).toBe('misc');
  });
});

describe('When mapItemQuality is called', () => {
  it('Then should return normal for quality 1', () => {
    // Arrange
    const item: D2SItem = D2SItemBuilder.new().withQuality(1).build();

    // Act
    const result = mapItemQuality(item.quality);

    // Assert
    expect(result).toBe('normal');
  });

  it('Then should return magic for quality 2', () => {
    // Arrange
    const item: D2SItem = D2SItemBuilder.new().withQuality(2).build();

    // Act
    const result = mapItemQuality(item.quality);

    // Assert
    expect(result).toBe('magic');
  });

  it('Then should return rare for quality 3', () => {
    // Arrange
    const item: D2SItem = D2SItemBuilder.new().withQuality(3).build();

    // Act
    const result = mapItemQuality(item.quality);

    // Assert
    expect(result).toBe('rare');
  });

  it('Then should return set for quality 4', () => {
    // Arrange
    const item: D2SItem = D2SItemBuilder.new().withQuality(4).build();

    // Act
    const result = mapItemQuality(item.quality);

    // Assert
    expect(result).toBe('set');
  });

  it('Then should return unique for quality 5', () => {
    // Arrange
    const item: D2SItem = D2SItemBuilder.new().withQuality(5).build();

    // Act
    const result = mapItemQuality(item.quality);

    // Assert
    expect(result).toBe('unique');
  });

  it('Then should return crafted for quality 6', () => {
    // Arrange
    const item: D2SItem = D2SItemBuilder.new().withQuality(6).build();

    // Act
    const result = mapItemQuality(item.quality);

    // Assert
    expect(result).toBe('crafted');
  });

  it('Then should return normal for unknown quality', () => {
    // Arrange
    const item: D2SItem = D2SItemBuilder.new().withQuality(99).build();

    // Act
    const result = mapItemQuality(item.quality);

    // Assert
    expect(result).toBe('normal');
  });
});

describe('When resolveSocketCount is called', () => {
  it('Then should return socket count from gems array', () => {
    // Arrange
    const item: D2SItem = D2SItemBuilder.new().withGems([1, 2, 3]).build();

    // Act
    const result = resolveSocketCount(item);

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
    const result = resolveSocketCount(item);

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
    const result = resolveSocketCount(item);

    // Assert
    expect(result).toBe(1);
  });

  it('Then should return 0 when no socket information is available', () => {
    // Arrange
    const item: D2SItem = D2SItemBuilder.new().build();

    // Act
    const result = resolveSocketCount(item);

    // Assert
    expect(result).toBe(0);
  });
});

describe('When resolveGrailLookupName is called', () => {
  it('Then grail items resolve to their grail id and other unique or set items to their simple name', () => {
    // Arrange
    const shako = D2SItemBuilder.new().asUniqueHelm().build();
    const ber = D2SItemBuilder.new().asRune('r30').build();
    const unknownUnique = D2SItemBuilder.new().withUniqueName('Not A Real Unique').build();
    const plainItem = D2SItemBuilder.new().withName('Regular Sword').build();

    // Act
    const names = [shako, ber, unknownUnique, plainItem].map(resolveGrailLookupName);

    // Assert
    expect(names).toEqual(['shako', 'ber', 'notarealunique', '']);
  });
});

describe('When normalizeItemsWithSocketedItems is called', () => {
  it('Then socketed items follow their parent and carry no stack count of their own', () => {
    // Arrange
    const socketedRune = D2SItemBuilder.new().withId('socketed').asRune('r30').build();
    const parent = D2SItemBuilder.new()
      .withId('parent')
      .asUniqueHelm()
      .asSocketed(1)
      .withSocketedItems([socketedRune])
      .build();

    // Act
    const parsed = normalizeItemsWithSocketedItems([parent], {
      filePath: saveFile.path,
      saveName: saveFile.name,
      sourceFileType: 'd2s',
      fallbackLocation: 'inventory',
      stackCount: 4,
    });

    // Assert
    expect(parsed.map((item) => item.rawParsedItem.id)).toEqual(['parent', 'socketed']);
    expect(parsed.map((item) => item.isSocketedItem)).toEqual([false, true]);
    expect(parsed.map((item) => item.stackCount)).toEqual([4, undefined]);
  });
});

describe('When selectDetectionCandidates is called', () => {
  it('Then only items with a grail lookup name are picked, non-ethereal ones first and grouped by name', () => {
    // Arrange
    const items = toParsedItems([
      D2SItemBuilder.new().withId(1).asUniqueHelm().asEthereal().build(),
      D2SItemBuilder.new().withId(2).asRune('r01').build(),
      D2SItemBuilder.new().withId(3).asRareItem().build(),
      D2SItemBuilder.new().withId(4).asUniqueHelm().build(),
      D2SItemBuilder.new().withId(5).asRune('r01').build(),
    ]);

    // Act
    const keys = detectionKeys(items);

    // Assert
    expect(keys).toEqual(['el', 'el', 'shako', 'shako+eth']);
  });

  it('Then items socketed into a picked item follow it, even without a grail lookup name', () => {
    // Arrange
    const jewel = D2SItemBuilder.new().withId('jewel').withName('el').withType('jew').build();
    const items = toParsedItems([
      D2SItemBuilder.new().withId('loose').asRune('r02').build(),
      D2SItemBuilder.new()
        .withId('helm')
        .asUniqueHelm()
        .asSocketed(2)
        .withSocketedItems([D2SItemBuilder.new().withId('rune').asRune('r02').build(), jewel])
        .build(),
    ]);

    // Act
    const ids = selectDetectionCandidates(items).map((item) => item.rawParsedItem.id);

    // Assert
    expect(ids).toEqual(['loose', 'rune', 'helm', 'rune', 'jewel']);
  });
});

describe('When toDetectedItem is called', () => {
  it('Then the detection view reuses the normalized item and reports the save file character', () => {
    // Arrange
    const [parsed] = toParsedItems([
      D2SItemBuilder.new()
        .withId(42)
        .asUniqueHelm()
        .asEthereal()
        .withLevel(77)
        .withSocketCount(2)
        .build(),
    ]);

    // Act
    const detected = toDetectedItem(parsed, saveFile);

    // Assert
    expect(detected).toEqual({
      id: '42',
      name: 'shako',
      type: 'ushk',
      quality: 'unique',
      location: 'inventory',
      locationContext: 'inventory',
      characterName: 'TestChar',
      characterClass: saveFile.characterClass,
      level: 77,
      ethereal: true,
      sockets: parsed.socketCount,
      timestamp: expect.any(Date),
    });
  });
});

describe('When the modern shared stash fixture is analyzed', () => {
  it('Then every grail item in it, including runes socketed into runewords, is detected once', async () => {
    // Arrange
    const modern = await parseModernStash(readFileSync(MODERN_STASH_FIXTURE_PATH));
    const stashFile = {
      ...saveFile,
      name: 'Modern Shared Stash Softcore',
      characterClass: 'shared_stash',
    };
    const parsedItems = modern.items.flatMap((entry) =>
      normalizeItemsWithSocketedItems([entry.item], {
        filePath: '/test/ModernSharedStashSoftCoreV2.d2i',
        saveName: stashFile.name,
        sourceFileType: 'd2i',
        fallbackLocation: 'stash',
        stashTab: entry.stashTab,
        stashTabKind: entry.stashTabKind,
        stackCount: entry.stackCount,
      }),
    );
    const eventBus = new EventBus();
    const detected: string[] = [];
    eventBus.on('item-detection', (event: ItemDetectionEvent) => {
      detected.push(`${event.grailItem.id}_${event.item.ethereal}`);
    });
    const service = new ItemDetectionService(eventBus);
    service.setGrailItems(catalogItems);

    // Act
    await service.analyzeSaveFile(stashFile, parsedItems);

    // Assert
    expect(detected).toEqual([
      'layingofhands_false',
      'wartraveler_false',
      'snowclash_false',
      'hellrack_false',
      'skinofthevipermagi_false',
      'hwaninsjustice_false',
      'honesundan_false',
      'shael_false',
      'amn_false',
      'talrashashoradriccrest_false',
      'homunculus_false',
      'gheedsfortune_false',
      'talrashasfinespuncloth_false',
      'walloftheeyeless_false',
      'talrashasguardianship_false',
      'grief_false',
      'eth_false',
      'tir_false',
      'lo_false',
      'mal_false',
      'ral_false',
      'thefaceofhorror_false',
      'enigma_false',
      'jah_false',
      'ith_false',
      'ber_false',
      'theeyeofetlich_false',
      'thestoneofjordan_false',
      'spirit_false',
      'tal_false',
      'thul_false',
      'ort_false',
      'therisingsun_false',
      'maraskaleidoscope_false',
      'heartoftheoak_false',
      'ko_false',
      'vex_false',
      'pul_false',
      'lem_false',
      'gul_false',
      'io_false',
      'dol_false',
      'hel_false',
      'lum_false',
      'fal_false',
      'el_false',
      'eld_false',
      'sol_false',
      'um_false',
      'nef_false',
    ]);
  });
});
