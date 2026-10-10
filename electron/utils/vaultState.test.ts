import { describe, expect, it } from 'vitest';
import { assert } from './assert';
import {
  isCurrentlyVaulted,
  isGrailBookmark,
  isVaultLocationContext,
  VALID_SOURCE_FILE_TYPES,
} from './vaultState';

describe('When resolving whether a vault row is currently vaulted', () => {
  describe('If the row was never vaulted', () => {
    it('Then it is not vaulted', () => {
      // Arrange
      const row = { vaultedAt: undefined, unvaultedAt: undefined };

      // Act
      const result = isCurrentlyVaulted(row);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If the row has a vaulted timestamp and no unvaulted timestamp', () => {
    it('Then it is vaulted', () => {
      // Arrange
      const row = { vaultedAt: new Date('2024-01-01T00:00:00.000Z'), unvaultedAt: undefined };

      // Act
      const result = isCurrentlyVaulted(row);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If the unvaulted timestamp is older than the vaulted timestamp', () => {
    it('Then the item was re-vaulted and is vaulted', () => {
      // Arrange
      const row = {
        vaultedAt: new Date('2024-01-02T00:00:00.000Z'),
        unvaultedAt: new Date('2024-01-01T00:00:00.000Z'),
      };

      // Act
      const result = isCurrentlyVaulted(row);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If the unvaulted timestamp is equal to or newer than the vaulted timestamp', () => {
    it('Then it is not vaulted', () => {
      // Arrange
      const equal = {
        vaultedAt: new Date('2024-01-01T00:00:00.000Z'),
        unvaultedAt: new Date('2024-01-01T00:00:00.000Z'),
      };
      const newer = {
        vaultedAt: new Date('2024-01-01T00:00:00.000Z'),
        unvaultedAt: new Date('2024-01-02T00:00:00.000Z'),
      };

      // Act
      const results = [isCurrentlyVaulted(equal), isCurrentlyVaulted(newer)];

      // Assert
      expect(results).toEqual([false, false]);
    });
  });

  describe('If the timestamps arrive as ISO strings', () => {
    it('Then they are compared by time', () => {
      // Arrange
      const row = {
        vaultedAt: '2024-01-02T00:00:00.000Z',
        unvaultedAt: '2024-01-01T00:00:00.000Z',
      };

      // Act
      const result = isCurrentlyVaulted(row);

      // Assert
      expect(result).toBe(true);
    });
  });
});

describe('When using the shared vault validation helpers', () => {
  describe('If a source file type is checked', () => {
    it('Then only d2s, sss, d2x and d2i are valid', () => {
      // Arrange
      const supportedTypes = ['d2s', 'sss', 'd2x', 'd2i'];

      // Act
      const valid = supportedTypes.every((type) => VALID_SOURCE_FILE_TYPES.has(type));

      // Assert
      expect(valid).toBe(true);
      expect(VALID_SOURCE_FILE_TYPES.has('exe')).toBe(false);
    });
  });

  describe('If a location context is checked', () => {
    it('Then only the known vault location contexts are accepted', () => {
      // Arrange
      const knownContexts = ['equipped', 'inventory', 'stash', 'mercenary', 'corpse', 'unknown'];
      const invalidValues: unknown[] = ['belt', 'Stash', '', undefined, 3];

      // Act
      const knownResults = knownContexts.map(isVaultLocationContext);
      const invalidResults = invalidValues.map(isVaultLocationContext);

      // Assert
      expect(knownResults.every(Boolean)).toBe(true);
      expect(invalidResults.some(Boolean)).toBe(false);
    });
  });

  describe('If assert receives a false condition', () => {
    it('Then it throws an Error with the message', () => {
      // Arrange
      const call = () => assert(false, 'boom');

      // Act
      const failure = (() => {
        try {
          call();
          return undefined;
        } catch (error) {
          return error;
        }
      })();

      // Assert
      expect(failure).toEqual(new Error('boom'));
      expect(() => assert(true, 'never')).not.toThrow();
    });
  });
});

describe('When isGrailBookmark inspects a vault row fingerprint', () => {
  it.each([
    ['a bookmark fingerprint', 'grail:item-1', true],
    ['an item fingerprint', 'd2s|Sorc|stash|unique|Windforce|0,0', false],
    ['a fingerprint that only contains the prefix', 'x-grail:item-1', false],
  ])('Then %s is classified correctly', (_scenario, fingerprint, expected) => {
    // Arrange
    const row = { fingerprint };

    // Act
    const result = isGrailBookmark(row);

    // Assert
    expect(result).toBe(expected);
  });
});
