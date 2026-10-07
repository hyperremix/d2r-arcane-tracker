import { describe, expect, it } from 'vitest';
import { HolyGrailItemBuilder } from '@/fixtures/HolyGrailItemBuilder';
import { itemMatchesSearch, normalizeSearchText, tokenizeSearchQuery } from './itemSearch';

const shako = HolyGrailItemBuilder.new()
  .withId('harlequincrest')
  .withName('Harlequin Crest')
  .withCategory('armor')
  .withArmorSubCategory('helms')
  .withItemBase('Shako')
  .build();

const talArmor = HolyGrailItemBuilder.new()
  .withId('talrashasguardianship')
  .withName("Tal Rasha's Guardianship")
  .withType('set')
  .withCategory('armor')
  .withArmorSubCategory('body_armor')
  .withItemBase('Lacquered Plate')
  .withSetName("Tal Rasha's Wrappings")
  .build();

const griffon = HolyGrailItemBuilder.new()
  .withId('griffonseye')
  .withName("Griffon's Eye")
  .withCategory('armor')
  .withArmorSubCategory('helms')
  .withItemBase('Diadem')
  .build();

const enigma = HolyGrailItemBuilder.new()
  .withId('enigma')
  .withName('Enigma')
  .withType('runeword')
  .withCategory('runewords')
  .withRunewordSubCategory('runewords')
  .withRunes(['jah', 'ith', 'ber'])
  .build();

const windforce = HolyGrailItemBuilder.new()
  .withId('windforce')
  .withName('Windforce')
  .withItemBase('Hydra Bow')
  .build();

const shaftstop = HolyGrailItemBuilder.new()
  .withId('shaftstop')
  .withName('Shaftstop')
  .withItemBase('Mesh Armor')
  .build();

const shadowDancer = HolyGrailItemBuilder.new()
  .withId('shadowdancer')
  .withName('Shadow Dancer')
  .withItemBase('Myrmidon Greaves')
  .build();

const allItems = [shako, talArmor, griffon, enigma, windforce, shaftstop, shadowDancer];

function search(query: string, fuzzy = false) {
  const tokens = tokenizeSearchQuery(query);
  return allItems.filter((item) => itemMatchesSearch(item, tokens, fuzzy)).map((item) => item.id);
}

describe('When normalizeSearchText is called', () => {
  describe('If the text contains capitals, apostrophes, punctuation and diacritics', () => {
    it('Then returns lowercase words separated by single spaces', () => {
      // Arrange
      const text = "  Tal Rasha's  Guardianship: Éthereal-Edition ";

      // Act
      const normalized = normalizeSearchText(text);

      // Assert
      expect(normalized).toBe('tal rashas guardianship ethereal edition');
    });
  });
});

describe('When tokenizeSearchQuery is called', () => {
  describe('If the query has no searchable characters', () => {
    it('Then returns no tokens', () => {
      // Arrange & Act
      const tokens = tokenizeSearchQuery("  ' - ");

      // Assert
      expect(tokens).toEqual([]);
    });
  });
});

describe('When itemMatchesSearch is used in exact mode', () => {
  describe('If the query is empty', () => {
    it('Then every item matches', () => {
      // Arrange & Act
      const result = search('');

      // Assert
      expect(result).toHaveLength(allItems.length);
    });
  });

  describe('If the query matches part of an item name', () => {
    it('Then matches case-insensitively', () => {
      // Arrange & Act
      const result = search('harlequin');

      // Assert
      expect(result).toEqual(['harlequincrest']);
    });
  });

  describe('If the query is a base item name', () => {
    it('Then matches items with that base', () => {
      // Arrange & Act
      const shakoResult = search('Shako');
      const diademResult = search('diadem');

      // Assert
      expect(shakoResult).toEqual(['harlequincrest']);
      expect(diademResult).toEqual(['griffonseye']);
    });
  });

  describe('If the query is a set name without the apostrophe', () => {
    it('Then matches the set items', () => {
      // Arrange & Act
      const result = search('tal rashas wrappings');

      // Assert
      expect(result).toEqual(['talrashasguardianship']);
    });
  });

  describe('If the query is a rune name', () => {
    it('Then matches runewords made with that rune', () => {
      // Arrange & Act
      const result = search('Ber');

      // Assert
      expect(result).toEqual(['enigma']);
    });
  });

  describe('If the query has several words from different fields', () => {
    it('Then only items matching every word are returned', () => {
      // Arrange & Act
      const matching = search('harlequin shako');
      const notMatching = search('harlequin diadem');

      // Assert
      expect(matching).toEqual(['harlequincrest']);
      expect(notMatching).toEqual([]);
    });
  });

  describe('If the query contains a typo', () => {
    it('Then nothing matches', () => {
      // Arrange & Act
      const result = search('windfroce');

      // Assert
      expect(result).toEqual([]);
    });
  });
});

describe('When itemMatchesSearch is used in fuzzy mode', () => {
  describe('If the query contains a small typo', () => {
    it('Then still matches the intended item', () => {
      // Arrange & Act
      const transposed = search('windfroce', true);
      const missingLetter = search('harlequin crst', true);

      // Assert
      expect(transposed).toEqual(['windforce']);
      expect(missingLetter).toEqual(['harlequincrest']);
    });
  });

  describe('If the query abbreviates words', () => {
    it('Then matches by word prefix and by in-order letters', () => {
      // Arrange & Act
      const prefixResult = search('lacq pl', true);
      const abbreviationResult = search('hrlqn', true);

      // Assert
      expect(prefixResult).toEqual(['talrashasguardianship']);
      expect(abbreviationResult).toEqual(['harlequincrest']);
    });
  });

  describe('If the query shares only its first letters with other names', () => {
    it('Then does not match unrelated items', () => {
      // Arrange & Act
      const result = search('shako', true);

      // Assert
      expect(result).toEqual(['harlequincrest']);
      expect(result).not.toContain('shaftstop');
      expect(result).not.toContain('shadowdancer');
    });
  });

  describe('If the query is short', () => {
    it('Then does not tolerate typos', () => {
      // Arrange & Act
      const result = search('bek', true);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
