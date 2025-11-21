import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterBuilder, GrailProgressBuilder } from '@/fixtures';
import type { Character, GrailProgress, RunItem } from '../types/grail';
import { DatabaseBatchWriter } from './DatabaseBatchWriter';

// Mock database interface
interface MockGrailDatabase {
  upsertCharactersBatch: ReturnType<typeof vi.fn>;
  upsertProgressBatch: ReturnType<typeof vi.fn>;
  addRunItemsBatch: ReturnType<typeof vi.fn>;
}

const createMockDatabase = (): MockGrailDatabase => ({
  upsertCharactersBatch: vi.fn(),
  upsertProgressBatch: vi.fn(),
  addRunItemsBatch: vi.fn(),
});

describe('When DatabaseBatchWriter is used', () => {
  let batchWriter: DatabaseBatchWriter;
  let mockDatabase: MockGrailDatabase;

  beforeEach(() => {
    vi.useFakeTimers();
    mockDatabase = createMockDatabase();
    // biome-ignore lint/suspicious/noExplicitAny: Mock database for testing
    batchWriter = new DatabaseBatchWriter(mockDatabase as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('If queueCharacter is called', () => {
    it('Then should add character to queue', () => {
      // Arrange
      const character = CharacterBuilder.new().withId('char-1').withName('TestChar').build();

      // Act
      batchWriter.queueCharacter(character);

      // Assert
      expect(batchWriter.getCharacterQueueSize()).toBe(1);
    });

    it('Then should deduplicate characters by ID', () => {
      // Arrange
      const character1 = CharacterBuilder.new().withId('char-1').withName('TestChar').build();
      const character2 = CharacterBuilder.new()
        .withId('char-1')
        .withName('TestChar Updated')
        .build();

      // Act
      batchWriter.queueCharacter(character1);
      batchWriter.queueCharacter(character2);

      // Assert
      expect(batchWriter.getCharacterQueueSize()).toBe(1);
    });

    it('Then should schedule flush after delay', () => {
      // Arrange
      const character = CharacterBuilder.new().withId('char-1').build();

      // Act
      batchWriter.queueCharacter(character);

      // Assert - flush not called yet
      expect(mockDatabase.upsertCharactersBatch).not.toHaveBeenCalled();

      // Fast-forward time
      vi.advanceTimersByTime(100);

      // Assert - flush should be called
      expect(mockDatabase.upsertCharactersBatch).toHaveBeenCalledWith([character]);
    });
  });

  describe('If queueProgress is called', () => {
    it('Then should add progress to queue', () => {
      // Arrange
      const progress = GrailProgressBuilder.new().withId('prog-1').build();

      // Act
      batchWriter.queueProgress(progress);

      // Assert
      expect(batchWriter.getProgressQueueSize()).toBe(1);
    });

    it('Then should deduplicate progress by ID', () => {
      // Arrange
      const progress1 = GrailProgressBuilder.new().withId('prog-1').withItemId('item-1').build();
      const progress2 = GrailProgressBuilder.new().withId('prog-1').withItemId('item-2').build();

      // Act
      batchWriter.queueProgress(progress1);
      batchWriter.queueProgress(progress2);

      // Assert
      expect(batchWriter.getProgressQueueSize()).toBe(1);
    });

    it('Then should schedule flush after delay', () => {
      // Arrange
      const progress = GrailProgressBuilder.new().withId('prog-1').build();

      // Act
      batchWriter.queueProgress(progress);

      // Assert - flush not called yet
      expect(mockDatabase.upsertProgressBatch).not.toHaveBeenCalled();

      // Fast-forward time
      vi.advanceTimersByTime(100);

      // Assert - flush should be called
      expect(mockDatabase.upsertProgressBatch).toHaveBeenCalledWith([progress]);
    });
  });

  describe('If queueRunItem is called', () => {
    it('Then should add run item to queue', () => {
      // Arrange
      const runItem: RunItem = {
        id: 'run-item-1',
        runId: 'run-1',
        grailProgressId: 'prog-1',
        foundTime: new Date(),
        created: new Date(),
      };

      // Act
      batchWriter.queueRunItem(runItem);

      // Assert
      expect(batchWriter.getRunItemQueueSize()).toBe(1);
    });

    it('Then should deduplicate run items by ID', () => {
      // Arrange
      const runItem1: RunItem = {
        id: 'run-item-1',
        runId: 'run-1',
        grailProgressId: 'prog-1',
        foundTime: new Date(),
        created: new Date(),
      };
      const runItem2: RunItem = {
        id: 'run-item-1',
        runId: 'run-1',
        grailProgressId: 'prog-1',
        foundTime: new Date(),
        created: new Date(),
      };

      // Act
      batchWriter.queueRunItem(runItem1);
      batchWriter.queueRunItem(runItem2);

      // Assert
      expect(batchWriter.getRunItemQueueSize()).toBe(1);
    });

    it('Then should schedule flush after delay', () => {
      // Arrange
      const runItem: RunItem = {
        id: 'run-item-1',
        runId: 'run-1',
        grailProgressId: 'prog-1',
        foundTime: new Date(),
        created: new Date(),
      };

      // Act
      batchWriter.queueRunItem(runItem);

      // Assert - flush not called yet
      expect(mockDatabase.addRunItemsBatch).not.toHaveBeenCalled();

      // Fast-forward time
      vi.advanceTimersByTime(100);

      // Assert - flush should be called
      expect(mockDatabase.addRunItemsBatch).toHaveBeenCalledWith([runItem]);
    });
  });

  describe('If queue size exceeds threshold', () => {
    it('Then should flush immediately', () => {
      // Arrange
      const characters: Character[] = [];
      for (let i = 0; i < 51; i++) {
        characters.push(CharacterBuilder.new().withId(`char-${i}`).build());
      }

      // Act
      for (const char of characters) {
        batchWriter.queueCharacter(char);
      }

      // Assert - should flush at threshold (50), leaving 1 item in queue
      expect(mockDatabase.upsertCharactersBatch).toHaveBeenCalled();
      expect(batchWriter.getCharacterQueueSize()).toBe(1); // 51st item still queued
    });

    it('Then should flush when combined queue exceeds threshold', () => {
      // Arrange
      const characters: Character[] = [];
      const progressList: GrailProgress[] = [];
      for (let i = 0; i < 30; i++) {
        characters.push(CharacterBuilder.new().withId(`char-${i}`).build());
      }
      for (let i = 0; i < 21; i++) {
        progressList.push(GrailProgressBuilder.new().withId(`prog-${i}`).build());
      }

      // Act
      for (const char of characters) {
        batchWriter.queueCharacter(char);
      }
      for (const prog of progressList) {
        batchWriter.queueProgress(prog);
      }

      // Assert - should flush when total reaches 51
      expect(mockDatabase.upsertCharactersBatch).toHaveBeenCalled();
      expect(mockDatabase.upsertProgressBatch).toHaveBeenCalled();
    });

    it('Then should flush when run items exceed threshold', () => {
      // Arrange
      const runItems: RunItem[] = [];
      for (let i = 0; i < 51; i++) {
        runItems.push({
          id: `run-item-${i}`,
          runId: 'run-1',
          grailProgressId: 'prog-1',
          foundTime: new Date(),
          created: new Date(),
        });
      }

      // Act
      for (const item of runItems) {
        batchWriter.queueRunItem(item);
      }

      // Assert
      expect(mockDatabase.addRunItemsBatch).toHaveBeenCalled();
      expect(batchWriter.getRunItemQueueSize()).toBe(1);
    });
  });

  describe('If flush is called manually', () => {
    it('Then should flush all queued items immediately', () => {
      // Arrange
      const character = CharacterBuilder.new().withId('char-1').build();
      const progress = GrailProgressBuilder.new().withId('prog-1').build();
      batchWriter.queueCharacter(character);
      batchWriter.queueProgress(progress);

      // Act
      batchWriter.flush();

      // Assert
      expect(mockDatabase.upsertCharactersBatch).toHaveBeenCalledWith([character]);
      expect(mockDatabase.upsertProgressBatch).toHaveBeenCalledWith([progress]);
      expect(batchWriter.getCharacterQueueSize()).toBe(0);
      expect(batchWriter.getProgressQueueSize()).toBe(0);
      expect(batchWriter.getRunItemQueueSize()).toBe(0);
    });

    it('Then should cancel pending flush timer', () => {
      // Arrange
      const character = CharacterBuilder.new().withId('char-1').build();
      batchWriter.queueCharacter(character);

      // Act
      batchWriter.flush();

      // Fast-forward past the delay
      vi.advanceTimersByTime(200);

      // Assert - should only be called once (manual flush, not timer)
      expect(mockDatabase.upsertCharactersBatch).toHaveBeenCalledTimes(1);
    });

    it('Then should not throw error if queues are empty', () => {
      // Act & Assert
      expect(() => batchWriter.flush()).not.toThrow();
      expect(mockDatabase.upsertCharactersBatch).not.toHaveBeenCalled();
      expect(mockDatabase.upsertProgressBatch).not.toHaveBeenCalled();
    });
  });

  describe('If flush encounters database error', () => {
    it('Then should throw error and keep items in queue', () => {
      // Arrange
      const character = CharacterBuilder.new().withId('char-1').build();
      batchWriter.queueCharacter(character);
      mockDatabase.upsertCharactersBatch.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Act & Assert
      expect(() => batchWriter.flush()).toThrow('Database error');
      expect(batchWriter.getCharacterQueueSize()).toBe(1); // Item still in queue for retry
    });
  });

  describe('If timer-based flush is debounced', () => {
    it('Then should reset timer on new queue operations', () => {
      // Arrange
      const character1 = CharacterBuilder.new().withId('char-1').build();
      const character2 = CharacterBuilder.new().withId('char-2').build();

      // Act
      batchWriter.queueCharacter(character1);
      vi.advanceTimersByTime(50); // Halfway through delay
      batchWriter.queueCharacter(character2);
      vi.advanceTimersByTime(50); // Would have been 100ms for first item

      // Assert - should not have flushed yet (timer was reset)
      expect(mockDatabase.upsertCharactersBatch).not.toHaveBeenCalled();

      // Fast-forward remaining time
      vi.advanceTimersByTime(50);

      // Assert - should flush now
      expect(mockDatabase.upsertCharactersBatch).toHaveBeenCalledWith([character1, character2]);
    });
  });

  describe('If clear is called', () => {
    it('Then should clear all queues and cancel timer', () => {
      // Arrange
      const character = CharacterBuilder.new().withId('char-1').build();
      const progress = GrailProgressBuilder.new().withId('prog-1').build();
      batchWriter.queueCharacter(character);
      batchWriter.queueProgress(progress);

      // Act
      batchWriter.clear();

      // Assert
      expect(batchWriter.getCharacterQueueSize()).toBe(0);
      expect(batchWriter.getProgressQueueSize()).toBe(0);
      expect(batchWriter.getRunItemQueueSize()).toBe(0);

      // Fast-forward time - no flush should occur
      vi.advanceTimersByTime(200);
      expect(mockDatabase.upsertCharactersBatch).not.toHaveBeenCalled();
      expect(mockDatabase.upsertProgressBatch).not.toHaveBeenCalled();
    });
  });

  describe('If multiple items are queued and flushed', () => {
    it('Then should batch all items in single transaction', () => {
      // Arrange
      const characters = [
        CharacterBuilder.new().withId('char-1').withName('Char1').build(),
        CharacterBuilder.new().withId('char-2').withName('Char2').build(),
        CharacterBuilder.new().withId('char-3').withName('Char3').build(),
      ];

      const progressList = [
        GrailProgressBuilder.new().withId('prog-1').withItemId('item-1').build(),
        GrailProgressBuilder.new().withId('prog-2').withItemId('item-2').build(),
      ];

      // Act
      for (const char of characters) {
        batchWriter.queueCharacter(char);
      }
      for (const prog of progressList) {
        batchWriter.queueProgress(prog);
      }
      batchWriter.flush();

      // Assert
      expect(mockDatabase.upsertCharactersBatch).toHaveBeenCalledTimes(1);
      expect(mockDatabase.upsertCharactersBatch).toHaveBeenCalledWith(characters);
      expect(mockDatabase.upsertProgressBatch).toHaveBeenCalledTimes(1);
      expect(mockDatabase.upsertProgressBatch).toHaveBeenCalledWith(progressList);
    });

    it('Then should flush run items after progress', () => {
      // Arrange
      const progress = GrailProgressBuilder.new().withId('prog-1').build();
      const runItem: RunItem = {
        id: 'run-item-1',
        runId: 'run-1',
        grailProgressId: 'prog-1',
        foundTime: new Date(),
        created: new Date(),
      };

      // Act
      batchWriter.queueProgress(progress);
      batchWriter.queueRunItem(runItem);
      batchWriter.flush();

      // Assert
      expect(mockDatabase.upsertProgressBatch).toHaveBeenCalledWith([progress]);
      expect(mockDatabase.addRunItemsBatch).toHaveBeenCalledWith([runItem]);

      // Verify order: progress must be called before run items
      const progressCallOrder = mockDatabase.upsertProgressBatch.mock.invocationCallOrder[0];
      const runItemsCallOrder = mockDatabase.addRunItemsBatch.mock.invocationCallOrder[0];
      expect(progressCallOrder).toBeLessThan(runItemsCallOrder);
    });
  });

  describe('If flush is called with only characters queued', () => {
    it('Then should flush only characters', () => {
      // Arrange
      const character = CharacterBuilder.new().withId('char-1').build();
      batchWriter.queueCharacter(character);

      // Act
      batchWriter.flush();

      // Assert
      expect(mockDatabase.upsertCharactersBatch).toHaveBeenCalledWith([character]);
      expect(mockDatabase.upsertProgressBatch).not.toHaveBeenCalled();
    });
  });

  describe('If flush is called with only progress queued', () => {
    it('Then should flush only progress', () => {
      // Arrange
      const progress = GrailProgressBuilder.new().withId('prog-1').build();
      batchWriter.queueProgress(progress);

      // Act
      batchWriter.flush();

      // Assert
      expect(mockDatabase.upsertProgressBatch).toHaveBeenCalledWith([progress]);
      expect(mockDatabase.upsertCharactersBatch).not.toHaveBeenCalled();
      expect(mockDatabase.addRunItemsBatch).not.toHaveBeenCalled();
    });
  });

  describe('If flush is called with only run items queued', () => {
    it('Then should flush only run items', () => {
      // Arrange
      const runItem: RunItem = {
        id: 'run-item-1',
        runId: 'run-1',
        grailProgressId: 'prog-1',
        foundTime: new Date(),
        created: new Date(),
      };
      batchWriter.queueRunItem(runItem);

      // Act
      batchWriter.flush();

      // Assert
      expect(mockDatabase.addRunItemsBatch).toHaveBeenCalledWith([runItem]);
      expect(mockDatabase.upsertCharactersBatch).not.toHaveBeenCalled();
      expect(mockDatabase.upsertProgressBatch).not.toHaveBeenCalled();
    });
  });

  describe('If getCharacterQueueSize is called', () => {
    it('Then should return correct queue size', () => {
      // Arrange
      const char1 = CharacterBuilder.new().withId('char-1').build();
      const char2 = CharacterBuilder.new().withId('char-2').build();

      // Act
      batchWriter.queueCharacter(char1);
      batchWriter.queueCharacter(char2);

      // Assert
      expect(batchWriter.getCharacterQueueSize()).toBe(2);
    });
  });

  describe('If getProgressQueueSize is called', () => {
    it('Then should return correct queue size', () => {
      // Arrange
      const prog1 = GrailProgressBuilder.new().withId('prog-1').build();
      const prog2 = GrailProgressBuilder.new().withId('prog-2').build();

      // Act
      batchWriter.queueProgress(prog1);
      batchWriter.queueProgress(prog2);

      // Assert
      expect(batchWriter.getProgressQueueSize()).toBe(2);
    });
  });

  describe('If getRunItemQueueSize is called', () => {
    it('Then should return correct queue size', () => {
      // Arrange
      const runItem1: RunItem = {
        id: 'run-item-1',
        runId: 'run-1',
        grailProgressId: 'prog-1',
        foundTime: new Date(),
        created: new Date(),
      };
      const runItem2: RunItem = {
        id: 'run-item-2',
        runId: 'run-1',
        grailProgressId: 'prog-1',
        foundTime: new Date(),
        created: new Date(),
      };

      // Act
      batchWriter.queueRunItem(runItem1);
      batchWriter.queueRunItem(runItem2);

      // Assert
      expect(batchWriter.getRunItemQueueSize()).toBe(2);
    });
  });
});
