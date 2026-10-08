import type { Item } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import {
  filterRunewordsByRunes,
  getRunewordCompletionStatus,
  sortRunewordsByCraftability,
} from './runeword-utils';

function createRuneword(id: string, name: string, runes: string[]): Item {
  return {
    id,
    name,
    link: '',
    etherealType: 'none',
    type: 'runeword',
    category: 'weapons',
    subCategory: 'runewords',
    treasureClass: 'normal',
    runes,
  } as Item;
}

const steel = createRuneword('steel', 'Steel', ['tir', 'el']);
const enigma = createRuneword('enigma', 'Enigma', ['jah', 'ith', 'ber']);
const infinity = createRuneword('infinity', 'Infinity', ['ber', 'mal', 'ber', 'ist']);
const callToArms = createRuneword('call_to_arms', 'Call to Arms', [
  'amn',
  'ral',
  'mal',
  'ist',
  'ohm',
]);
const runewords = [steel, enigma, infinity, callToArms];

describe('runeword-utils', () => {
  describe('filterRunewordsByRunes', () => {
    it('When several runes are selected, then only runewords containing all of them match', () => {
      // Arrange
      const selectedRunes = ['ber', 'jah'];

      // Act
      const result = filterRunewordsByRunes(runewords, selectedRunes, 'all', {});

      // Assert
      expect(result.map((r) => r.id)).toEqual(['enigma']);
    });

    it('If no runes are selected, then the rune selection does not restrict results', () => {
      // Arrange / Act
      const result = filterRunewordsByRunes(runewords, [], 'all', {});

      // Assert
      expect(result).toHaveLength(runewords.length);
    });

    it('When availability is craftable, then only runewords with every required rune match', () => {
      // Arrange
      const availableRunes = { tir: 1, el: 1, jah: 1, ith: 1 };

      // Act
      const result = filterRunewordsByRunes(runewords, [], 'craftable', availableRunes);

      // Assert
      expect(result.map((r) => r.id)).toEqual(['steel']);
    });

    it('When availability is missingOne, then craftable runewords and those missing one rune match', () => {
      // Arrange
      const availableRunes = { tir: 1, el: 1, jah: 1, ith: 1, ber: 1, mal: 1, ist: 1 };

      // Act
      const result = filterRunewordsByRunes(runewords, [], 'missingOne', availableRunes);

      // Assert
      // Steel and Enigma are craftable; Infinity needs a second Ber; Call to Arms misses Amn, Ral, Ohm
      expect(result.map((r) => r.id)).toEqual(['steel', 'enigma', 'infinity']);
    });

    it('If a runeword needs the same rune twice, then each missing copy counts towards the limit', () => {
      // Arrange
      const availableRunes = { mal: 1, ist: 1 };

      // Act
      const result = filterRunewordsByRunes([infinity], [], 'missingOne', availableRunes);

      // Assert
      expect(result).toEqual([]);
    });

    it('If a runeword has no runes, then it is excluded', () => {
      // Arrange
      const empty = createRuneword('empty', 'Empty', []);

      // Act
      const result = filterRunewordsByRunes([empty], [], 'all', {});

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('sortRunewordsByCraftability', () => {
    it('When sorting, then craftable runewords come first, then fewest missing runes, then name', () => {
      // Arrange
      const lore = createRuneword('lore', 'Lore', ['ort', 'sol']);
      const ancientsPledge = createRuneword('ancients_pledge', "Ancient's Pledge", [
        'ral',
        'ort',
        'tal',
      ]);
      const availableRunes = { tir: 1, el: 1, ort: 1, sol: 1, ral: 1, tal: 1, jah: 1, ith: 1 };
      const input = [callToArms, infinity, enigma, lore, steel, ancientsPledge];

      // Act
      const result = sortRunewordsByCraftability(input, availableRunes);

      // Assert
      expect(result.map((r) => r.id)).toEqual([
        'ancients_pledge', // craftable
        'lore', // craftable
        'steel', // craftable
        'enigma', // missing 1 (Ber)
        'call_to_arms', // missing 4 (Amn, Mal, Ist, Ohm)
        'infinity', // missing 4 (Ber x2, Mal, Ist)
      ]);
    });

    it('When sorting, then the input array is not mutated', () => {
      // Arrange
      const input = [enigma, steel];

      // Act
      sortRunewordsByCraftability(input, { tir: 1, el: 1 });

      // Assert
      expect(input).toEqual([enigma, steel]);
    });
  });

  describe('getRunewordCompletionStatus', () => {
    it('When some runes are owned, then available and total counts reflect each required copy', () => {
      // Arrange
      const availableRunes = { ber: 1, mal: 3 };

      // Act
      const status = getRunewordCompletionStatus(infinity, availableRunes);

      // Assert
      expect(status).toEqual({
        complete: false,
        missingRunes: ['ber', 'ist'],
        availableCount: 2,
        totalCount: 4,
      });
    });
  });
});
