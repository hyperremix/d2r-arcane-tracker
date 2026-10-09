import type { types as d2sTypes } from '@dschu012/d2s';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import { describe, expect, it } from 'vitest';
import { D2S_CONSTANT_VERSIONS, type D2sConstantRegistry, registerD2sConstants } from './constants';

/** An in-memory registry that behaves like the d2s one: unknown versions throw. */
function createRegistry(initial: Record<number, d2sTypes.IConstantData> = {}) {
  const stored = new Map<number, d2sTypes.IConstantData>(
    Object.entries(initial).map(([version, data]) => [Number(version), data]),
  );
  const setCalls: number[] = [];
  const registry: D2sConstantRegistry = {
    getConstantData(version) {
      const data = stored.get(version);
      if (!data) {
        throw new Error(`No constant data found for this version ${version}`);
      }
      return data;
    },
    setConstantData(version, data) {
      setCalls.push(version);
      stored.set(version, data);
    },
  };
  return { registry, stored, setCalls };
}

describe('When the d2s constants are registered', () => {
  describe('If no version has constants yet', () => {
    it('Then every supported version gets constants, with the 99 data only for version 99', () => {
      // Arrange
      const { registry, stored } = createRegistry();

      // Act
      registerD2sConstants(registry);

      // Assert
      expect([...stored.keys()]).toEqual([96, 97, 98, 99, 0, 1, 2]);
      for (const version of D2S_CONSTANT_VERSIONS) {
        expect(stored.get(version)).toBe(version === 99 ? constants99 : constants96);
      }
    });
  });

  describe('If some versions already have constants', () => {
    it('Then only the missing versions are registered', () => {
      // Arrange
      const custom = { custom: true } as unknown as d2sTypes.IConstantData;
      const { registry, stored, setCalls } = createRegistry({ 96: custom, 99: custom });

      // Act
      registerD2sConstants(registry);

      // Assert
      expect(setCalls).toEqual([97, 98, 0, 1, 2]);
      expect(stored.get(96)).toBe(custom);
      expect(stored.get(99)).toBe(custom);
    });
  });

  describe('If the constants are registered twice', () => {
    it('Then the second call changes nothing', () => {
      // Arrange
      const { registry, setCalls } = createRegistry();
      registerD2sConstants(registry);
      setCalls.length = 0;

      // Act
      registerD2sConstants(registry);

      // Assert
      expect(setCalls).toEqual([]);
    });
  });
});
