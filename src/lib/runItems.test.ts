import type { GrailProgress, Item, RunItem } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import { createRunItemLookup, resolveRunItem, resolveRunItemName } from './runItems';

const shako = { id: 'shako', name: 'Harlequin Crest' } as Item;
const shakoProgress = { id: 'progress-1', itemId: 'shako' } as GrailProgress;
const orphanProgress = { id: 'progress-2', itemId: 'deleted-item' } as GrailProgress;

const makeRunItem = (overrides: Partial<RunItem>): RunItem =>
  ({ id: 'run-item', runId: 'run', foundTime: new Date(0), ...overrides }) as RunItem;

describe('When run items are resolved', () => {
  const lookup = createRunItemLookup([shako], [shakoProgress, orphanProgress]);

  describe('If the run item is a manual entry with a name', () => {
    it('Then its own name is used', () => {
      // Arrange
      const runItem = makeRunItem({ name: 'Perfect Skull' });

      // Act
      const name = resolveRunItemName(runItem, lookup);

      // Assert
      expect(name).toBe('Perfect Skull');
    });
  });

  describe('If the run item links to grail progress', () => {
    it('Then the progress record, the grail item and its name are returned', () => {
      // Arrange
      const runItem = makeRunItem({ grailProgressId: 'progress-1' });

      // Act
      const resolved = resolveRunItem(runItem, lookup);

      // Assert
      expect(resolved).toEqual({ name: 'Harlequin Crest', progress: shakoProgress, item: shako });
    });
  });

  describe('If the linked progress record points to an unknown item', () => {
    it('Then the progress record is returned without an item or name', () => {
      // Arrange
      const runItem = makeRunItem({ grailProgressId: 'progress-2' });

      // Act
      const resolved = resolveRunItem(runItem, lookup);

      // Assert
      expect(resolved).toEqual({ name: undefined, progress: orphanProgress, item: undefined });
    });
  });

  describe('If the run item has neither a name nor a known progress record', () => {
    it('Then no name is resolved', () => {
      // Arrange
      const unlinked = makeRunItem({});
      const unknownProgress = makeRunItem({ grailProgressId: 'missing' });

      // Act
      const names = [unlinked, unknownProgress].map((runItem) =>
        resolveRunItemName(runItem, lookup),
      );

      // Assert
      expect(names).toEqual([undefined, undefined]);
    });
  });
});

describe('When several records share an id', () => {
  describe('If the run item links to a duplicated progress or item id', () => {
    it('Then the first record wins, like the Array.find lookups it replaced', () => {
      // Arrange
      const firstItem = { id: 'dup-item', name: 'First' } as Item;
      const secondItem = { id: 'dup-item', name: 'Second' } as Item;
      const firstProgress = { id: 'dup-progress', itemId: 'dup-item' } as GrailProgress;
      const secondProgress = { id: 'dup-progress', itemId: 'other' } as GrailProgress;
      const lookup = createRunItemLookup([firstItem, secondItem], [firstProgress, secondProgress]);

      // Act
      const resolved = resolveRunItem(makeRunItem({ grailProgressId: 'dup-progress' }), lookup);

      // Assert
      expect(resolved.progress).toBe(firstProgress);
      expect(resolved.item).toBe(firstItem);
    });
  });
});
