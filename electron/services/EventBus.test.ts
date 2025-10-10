import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEvent } from '../types/events';
import { EventBus } from './EventBus';

describe('When EventBus is instantiated', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('If on method is called with an event handler', () => {
    it('Then should register the handler', () => {
      // Arrange
      const handler = vi.fn();

      // Act
      eventBus.on('monitoring-stopped', handler);

      // Assert
      expect(eventBus.listenerCount('monitoring-stopped')).toBe(1);
    });

    it('Then should return an unsubscribe function', () => {
      // Arrange
      const handler = vi.fn();

      // Act
      const unsubscribe = eventBus.on('monitoring-stopped', handler);

      // Assert
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('If multiple handlers are registered for same event', () => {
    it('Then should register all handlers', () => {
      // Arrange
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      // Act
      eventBus.on('monitoring-stopped', handler1);
      eventBus.on('monitoring-stopped', handler2);
      eventBus.on('monitoring-stopped', handler3);

      // Assert
      expect(eventBus.listenerCount('monitoring-stopped')).toBe(3);
    });

    it('Then should invoke all handlers when event is emitted', () => {
      // Arrange
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();
      eventBus.on('monitoring-stopped', handler1);
      eventBus.on('monitoring-stopped', handler2);
      eventBus.on('monitoring-stopped', handler3);

      // Act
      eventBus.emit('monitoring-stopped', {});

      // Assert
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });
  });

  describe('If emit is called with an event payload', () => {
    it('Then should invoke handler with correct payload', () => {
      // Arrange
      const handler = vi.fn();
      const payload = {
        directory: '/test/path',
        saveFileCount: 5,
      };
      eventBus.on('monitoring-started', handler);

      // Act
      eventBus.emit('monitoring-started', payload);

      // Assert
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('Then should not invoke handlers for different events', () => {
      // Arrange
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on('monitoring-started', handler1);
      eventBus.on('monitoring-stopped', handler2);

      // Act
      eventBus.emit('monitoring-started', {
        directory: '/test/path',
        saveFileCount: 5,
      });

      // Assert
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('If emit is called with no registered handlers', () => {
    it('Then should not throw an error', () => {
      // Arrange
      const payload = {
        directory: '/test/path',
        saveFileCount: 5,
      };

      // Act & Assert
      expect(() => eventBus.emit('monitoring-started', payload)).not.toThrow();
    });
  });

  describe('If handler throws an error', () => {
    it('Then should catch error and continue with other handlers', () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty - suppressing console errors in test
      });
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = vi.fn();
      eventBus.on('monitoring-stopped', errorHandler);
      eventBus.on('monitoring-stopped', successHandler);

      // Act
      eventBus.emit('monitoring-stopped', {});

      // Assert
      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('If handler returns a rejected Promise', () => {
    it('Then should catch async error and log it', async () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty - suppressing console errors in test
      });
      const asyncHandler = vi.fn(async () => {
        throw new Error('Async handler error');
      });
      eventBus.on('monitoring-stopped', asyncHandler);

      // Act
      eventBus.emit('monitoring-stopped', {});

      // Wait for async errors to be caught
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(asyncHandler).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('If unsubscribe function is called', () => {
    it('Then should remove the specific handler', () => {
      // Arrange
      const handler = vi.fn();
      const unsubscribe = eventBus.on('monitoring-stopped', handler);

      // Act
      unsubscribe();

      // Assert
      expect(eventBus.listenerCount('monitoring-stopped')).toBe(0);
    });

    it('Then should not invoke handler after unsubscribe', () => {
      // Arrange
      const handler = vi.fn();
      const unsubscribe = eventBus.on('monitoring-stopped', handler);
      unsubscribe();

      // Act
      eventBus.emit('monitoring-stopped', {});

      // Assert
      expect(handler).not.toHaveBeenCalled();
    });

    it('Then should not affect other handlers for same event', () => {
      // Arrange
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const unsubscribe1 = eventBus.on('monitoring-stopped', handler1);
      eventBus.on('monitoring-stopped', handler2);

      // Act
      unsubscribe1();
      eventBus.emit('monitoring-stopped', {});

      // Assert
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('If off method is called', () => {
    it('Then should remove the specific handler', () => {
      // Arrange
      const handler = vi.fn();
      eventBus.on('monitoring-stopped', handler);

      // Act
      eventBus.off('monitoring-stopped', handler);

      // Assert
      expect(eventBus.listenerCount('monitoring-stopped')).toBe(0);
    });

    it('Then should not affect other handlers', () => {
      // Arrange
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on('monitoring-stopped', handler1);
      eventBus.on('monitoring-stopped', handler2);

      // Act
      eventBus.off('monitoring-stopped', handler1);

      // Assert
      expect(eventBus.listenerCount('monitoring-stopped')).toBe(1);
    });
  });

  describe('If off is called with non-existent handler', () => {
    it('Then should not throw an error', () => {
      // Arrange
      const handler = vi.fn();

      // Act & Assert
      expect(() => eventBus.off('monitoring-stopped', handler)).not.toThrow();
    });
  });

  describe('If clear method is called', () => {
    it('Then should remove all event listeners', () => {
      // Arrange
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();
      eventBus.on('monitoring-started', handler1);
      eventBus.on('monitoring-stopped', handler2);
      eventBus.on('monitoring-error', handler3);

      // Act
      eventBus.clear();

      // Assert
      expect(eventBus.listenerCount('monitoring-started')).toBe(0);
      expect(eventBus.listenerCount('monitoring-stopped')).toBe(0);
      expect(eventBus.listenerCount('monitoring-error')).toBe(0);
    });

    it('Then should not invoke any handlers after clear', () => {
      // Arrange
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on('monitoring-started', handler1);
      eventBus.on('monitoring-stopped', handler2);
      eventBus.clear();

      // Act
      eventBus.emit('monitoring-started', {
        directory: '/test/path',
        saveFileCount: 5,
      });
      eventBus.emit('monitoring-stopped', {});

      // Assert
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('If listenerCount is called', () => {
    it('Then should return correct count for event with handlers', () => {
      // Arrange
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on('monitoring-stopped', handler1);
      eventBus.on('monitoring-stopped', handler2);

      // Act
      const count = eventBus.listenerCount('monitoring-stopped');

      // Assert
      expect(count).toBe(2);
    });

    it('Then should return zero for event with no handlers', () => {
      // Arrange & Act
      const count = eventBus.listenerCount('monitoring-stopped');

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('If async handler is registered', () => {
    it('Then should invoke async handler successfully', async () => {
      // Arrange
      let asyncValue = 0;
      const asyncHandler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        asyncValue = 42;
      });
      eventBus.on('monitoring-stopped', asyncHandler);

      // Act
      eventBus.emit('monitoring-stopped', {});
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Assert
      expect(asyncHandler).toHaveBeenCalled();
      expect(asyncValue).toBe(42);
    });
  });

  describe('If type safety is validated', () => {
    it('Then should accept correctly typed payloads', () => {
      // Arrange
      const handler = vi.fn();
      eventBus.on('save-file-event', handler);

      const validPayload: AppEvent = {
        type: 'save-file-event',
        payload: {
          type: 'modified',
          file: {
            name: 'test',
            path: '/test/path',
            lastModified: new Date(),
            characterClass: 'barbarian',
            level: 1,
            difficulty: 'normal',
            hardcore: false,
            expansion: true,
          },
          extractedItems: [],
          silent: false,
        },
      };

      // Act
      eventBus.emit('save-file-event', validPayload.payload);

      // Assert
      expect(handler).toHaveBeenCalledWith(validPayload.payload);
    });
  });
});
