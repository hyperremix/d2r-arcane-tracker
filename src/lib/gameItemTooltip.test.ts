import i18n from 'i18next';
import { describe, expect, it } from 'vitest';
import { buildGameItemTooltipModel } from './gameItemTooltip';

const t = (key: string, options?: Record<string, unknown>): string => i18n.t(key, options);

describe('When buildGameItemTooltipModel is called', () => {
  describe('If raw item data contains base stats and affixes', () => {
    it('Then it returns a structured tooltip model with ordered lines', () => {
      // Arrange
      const rawItemJson = JSON.stringify({
        unique_name: 'Bonesnap',
        type_name: 'Maul',
        base_damage: {
          mindam: 120,
          maxdam: 172,
          twohandmindam: 120,
          twohandmaxdam: 172,
        },
        current_durability: 53,
        max_durability: 60,
        reqstr: 69,
        required_level: 24,
        displayed_combined_magic_attributes: [
          { description: '+300% Enhanced Damage', visible: true },
          { description: '40% Chance of Crushing Blow', visible: true },
        ],
      });

      // Act
      const result = buildGameItemTooltipModel({
        rawItemJson,
        fallbackName: 'fallback-name',
        quality: 'unique',
        type: 'unique',
        t,
      });

      // Assert
      expect(result).toEqual({
        name: 'Bonesnap',
        quality: 'unique',
        isRuneword: false,
        baseTypeLine: 'Maul',
        coreLines: [
          'One Hand Damage: 120 to 172',
          'Two Hand Damage: 120 to 172',
          'Durability: 53 of 60',
          'Required Strength: 69',
          'Required Level: 24',
        ],
        affixLines: ['+300% Enhanced Damage', '40% Chance of Crushing Blow'],
        socketEntries: [],
      });
    });
  });

  describe('If runeword and unique names both exist', () => {
    it('Then runeword_name is prioritized as the header', () => {
      // Arrange
      const rawItemJson = JSON.stringify({
        runeword_name: 'Enigma',
        unique_name: 'Shako',
        displayed_combined_magic_attributes: [{ description: '+2 To All Skills', visible: true }],
      });

      // Act
      const result = buildGameItemTooltipModel({
        rawItemJson,
        fallbackName: 'fallback-name',
        quality: 'crafted',
        type: 'runeword',
        t,
      });

      // Assert
      expect(result?.name).toBe('Enigma');
    });
  });

  describe('If raw magic item fields include prefix and suffix names', () => {
    it('Then the generated magic display name is used instead of raw base name', () => {
      // Arrange
      const rawItemJson = JSON.stringify({
        name: 'Ring',
        type_name: 'Ring',
        magic_prefix_name: 'Viper',
        magic_suffix_name: 'of the Fox',
        displayed_combined_magic_attributes: [
          { description: '+80 to Attack Rating', visible: true },
        ],
      });

      // Act
      const result = buildGameItemTooltipModel({
        rawItemJson,
        fallbackName: 'Ring',
        quality: 'magic',
        type: 'magic',
        t,
      });

      // Assert
      expect(result?.name).toBe('Viper Ring of the Fox');
      expect(result?.baseTypeLine).toBe('Ring');
    });
  });

  describe('If raw rare item fields include rare name parts', () => {
    it('Then the generated rare display name is used instead of raw base name', () => {
      // Arrange
      const rawItemJson = JSON.stringify({
        name: 'Ring',
        type_name: 'Ring',
        rare_name: 'Stone',
        rare_name2: 'Master',
        displayed_combined_magic_attributes: [
          { description: '+24% Better Chance of Magic Items', visible: true },
        ],
      });

      // Act
      const result = buildGameItemTooltipModel({
        rawItemJson,
        fallbackName: 'Ring',
        quality: 'rare',
        type: 'rare',
        t,
      });

      // Assert
      expect(result?.name).toBe('Stone Master');
      expect(result?.baseTypeLine).toBe('Ring');
    });
  });

  describe('If a combined attribute has visible=false', () => {
    it('Then that hidden attribute line is not included', () => {
      // Arrange
      const rawItemJson = JSON.stringify({
        type_name: 'Mace',
        displayed_combined_magic_attributes: [
          { description: '+30% Fire Resist', visible: true },
          { description: '+100 To Attack Rating', visible: false },
        ],
      });

      // Act
      const result = buildGameItemTooltipModel({
        rawItemJson,
        fallbackName: 'fallback-name',
        quality: 'magic',
        type: 'magic',
        t,
      });

      // Assert
      expect(result?.affixLines).toEqual(['+30% Fire Resist']);
    });
  });

  describe('If raw item JSON is invalid', () => {
    it('Then it returns null', () => {
      // Arrange
      const rawItemJson = '{invalid json}';

      // Act
      const result = buildGameItemTooltipModel({
        rawItemJson,
        fallbackName: 'fallback-name',
        quality: 'unique',
        type: 'unique',
        t,
      });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('If raw item JSON is sparse and has no game-tooltip fields', () => {
    it('Then it returns null so metadata fallback can be used', () => {
      // Arrange
      const rawItemJson = '{}';

      // Act
      const result = buildGameItemTooltipModel({
        rawItemJson,
        fallbackName: 'fallback-name',
        quality: 'unique',
        type: 'unique',
        t,
      });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('If raw item JSON contains filled and open sockets', () => {
    it('Then it returns socket entries for both socketed items and empty sockets', () => {
      // Arrange
      const rawItemJson = JSON.stringify({
        type_name: 'Helm',
        total_nr_of_sockets: 3,
        nr_of_items_in_sockets: 2,
        socketed_items: [
          {
            name: 'r31',
            type: 'r31',
            inv_file: 'invjah',
          },
          {
            type_name: 'Ruby Jewel',
            code: 'jew',
          },
        ],
      });

      // Act
      const result = buildGameItemTooltipModel({
        rawItemJson,
        fallbackName: 'fallback-name',
        quality: 'magic',
        type: 'magic',
        t,
      });

      // Assert
      expect(
        result?.socketEntries.map((entry) => ({
          name: entry.name,
          isOpenSocket: entry.isOpenSocket,
        })),
      ).toEqual([
        { name: 'Jah Rune', isOpenSocket: false },
        { name: 'Ruby Jewel', isOpenSocket: false },
        { name: 'Open Socket', isOpenSocket: true },
      ]);
    });
  });

  describe('If raw item JSON has only open sockets', () => {
    it('Then it returns a non-null model with one entry per open socket', () => {
      // Arrange
      const rawItemJson = JSON.stringify({
        total_nr_of_sockets: 2,
        nr_of_items_in_sockets: 0,
      });

      // Act
      const result = buildGameItemTooltipModel({
        rawItemJson,
        fallbackName: 'fallback-name',
        quality: 'normal',
        type: 'normal',
        t,
      });

      // Assert
      expect(result?.socketEntries).toHaveLength(2);
      expect(result?.socketEntries.every((entry) => entry.isOpenSocket)).toBe(true);
    });
  });

  describe('If raw item is a gem with a concatenated internal name and a spaced type_name', () => {
    it('Then the spaced type_name is promoted as the display name with no redundant base type line', () => {
      // Arrange — d2s stores "flaweddiamond" in raw.name and "Flawed Diamond" in type_name
      const rawItemJson = JSON.stringify({
        name: 'flaweddiamond',
        type_name: 'Flawed Diamond',
      });

      // Act
      const result = buildGameItemTooltipModel({
        rawItemJson,
        fallbackName: 'flaweddiamond',
        quality: 'normal',
        type: 'normal',
        t,
      });

      // Assert
      expect(result?.name).toBe('Flawed Diamond');
      expect(result?.baseTypeLine).toBeUndefined();
    });
  });

  describe('If raw item JSON has socketed_items but no socket totals', () => {
    it('Then it still renders the socketed item entries', () => {
      // Arrange
      const rawItemJson = JSON.stringify({
        socketed_items: [
          {
            type_name: 'Ber Rune',
            code: 'r30',
          },
        ],
      });

      // Act
      const result = buildGameItemTooltipModel({
        rawItemJson,
        fallbackName: 'fallback-name',
        quality: 'normal',
        type: 'normal',
        t,
      });

      // Assert
      expect(
        result?.socketEntries.map((entry) => ({
          name: entry.name,
          isOpenSocket: entry.isOpenSocket,
        })),
      ).toEqual([{ name: 'Ber Rune', isOpenSocket: false }]);
    });
  });

  describe('If socketed rune item has name equal to its item code (real d2s output)', () => {
    it('Then the human-readable rune name is resolved via type code lookup', () => {
      // Arrange — d2s gives socketed runes type="r18" and name="r18" (code), not "Ko Rune"
      // (d2s IItem has no `code` field; the item code lives in `type`)
      const rawItemJson = JSON.stringify({
        type_name: 'Flail',
        total_nr_of_sockets: 4,
        nr_of_items_in_sockets: 4,
        socketed_items: [
          { name: 'r18', type: 'r18', type_name: 'Ko Rune', inv_file: 'invko' },
          { name: 'r26', type: 'r26', type_name: 'Vex Rune', inv_file: 'invvex' },
          { name: 'r21', type: 'r21', type_name: 'Pul Rune', inv_file: 'invpul' },
          { name: 'r10', type: 'r10', type_name: 'Thul Rune', inv_file: 'invthul' },
        ],
      });

      // Act
      const result = buildGameItemTooltipModel({
        rawItemJson,
        fallbackName: 'fallback-name',
        quality: 'runeword',
        type: 'runeword',
        t,
      });

      // Assert
      expect(
        result?.socketEntries.map((entry) => ({
          name: entry.name,
          isOpenSocket: entry.isOpenSocket,
        })),
      ).toEqual([
        { name: 'Ko Rune', isOpenSocket: false },
        { name: 'Vex Rune', isOpenSocket: false },
        { name: 'Pul Rune', isOpenSocket: false },
        { name: 'Thul Rune', isOpenSocket: false },
      ]);
    });
  });
});
