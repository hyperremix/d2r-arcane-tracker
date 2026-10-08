import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServiceLogger, setErrorForwarder } from './serviceLogger';

describe('When createServiceLogger is called', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* intentionally empty for mocking */
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {
      /* intentionally empty for mocking */
    });
    vi.spyOn(console, 'log').mockImplementation(() => {
      /* intentionally empty for mocking */
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Reset the error forwarder between tests
    setErrorForwarder(() => {
      /* intentionally empty */
    });
  });

  describe('If error is called', () => {
    it('Then should format message with [Service.operation] prefix', () => {
      // Arrange
      const log = createServiceLogger('TestService');
      const error = new Error('something broke');

      // Act
      log.error('doStuff', error);

      // Assert
      expect(console.error).toHaveBeenCalledWith('[TestService.doStuff]', error);
    });
  });

  describe('If error is called with context', () => {
    it('Then should include context in log output', () => {
      // Arrange
      const log = createServiceLogger('SaveFileMonitor');
      const error = new Error('parse failed');
      const context = { filePath: '/path/to/file.d2s' };

      // Act
      log.error('parseSaveFile', error, context);

      // Assert
      expect(console.error).toHaveBeenCalledWith('[SaveFileMonitor.parseSaveFile]', error, context);
    });
  });

  describe('If error is called with surfaceToUI option', () => {
    it('Then should forward the error code and the error message as detail', () => {
      // Arrange
      const mockForwarder = vi.fn();
      setErrorForwarder(mockForwarder);
      const log = createServiceLogger('DatabaseBatchWriter');
      const error = new Error('flush failed');

      // Act
      log.error('flush', error, { attempt: 3 }, { surfaceToUI: true, code: 'databaseWriteFailed' });

      // Assert
      expect(mockForwarder).toHaveBeenCalledWith({
        service: 'DatabaseBatchWriter',
        operation: 'flush',
        severity: 'error',
        code: 'databaseWriteFailed',
        detail: 'flush failed',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('If error is called with surfaceToUI and params', () => {
    it('Then should forward the params for translated copy', () => {
      // Arrange
      const mockForwarder = vi.fn();
      setErrorForwarder(mockForwarder);
      const log = createServiceLogger('ItemDetection');

      // Act
      log.error(
        'extractItemsFromSaveFile',
        new Error('Unexpected end of buffer'),
        {},
        { surfaceToUI: true, code: 'saveFileParseFailed', params: { fileName: 'Sorc.d2s' } },
      );

      // Assert
      expect(mockForwarder).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'saveFileParseFailed',
          params: { fileName: 'Sorc.d2s' },
          detail: 'Unexpected end of buffer',
        }),
      );
    });
  });

  describe('If error is called with surfaceToUI and a detail override', () => {
    it('Then should forward the override instead of the error message', () => {
      // Arrange
      const mockForwarder = vi.fn();
      setErrorForwarder(mockForwarder);
      const log = createServiceLogger('DatabaseBatchWriter');

      // Act
      log.error(
        'flush',
        'Max retries exceeded',
        {},
        { surfaceToUI: true, code: 'databaseWriteFailed', detail: 'SQLITE_BUSY' },
      );

      // Assert
      expect(mockForwarder).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'databaseWriteFailed', detail: 'SQLITE_BUSY' }),
      );
    });
  });

  describe('If error is called with surfaceToUI', () => {
    it('Then should not forward any user-facing message', () => {
      // Arrange
      const mockForwarder = vi.fn();
      setErrorForwarder(mockForwarder);
      const log = createServiceLogger('IconService');

      // Act
      log.error(
        'convertAllSprites',
        new Error('Sprite directory not found'),
        {},
        { surfaceToUI: true, code: 'spriteConversionFailed' },
      );

      // Assert
      expect(mockForwarder.mock.calls[0][0]).not.toHaveProperty('message');
      expect(mockForwarder.mock.calls[0][0]).not.toHaveProperty('params');
    });
  });

  describe('If error is called without surfaceToUI', () => {
    it('Then should not call error forwarder', () => {
      // Arrange
      const mockForwarder = vi.fn();
      setErrorForwarder(mockForwarder);
      const log = createServiceLogger('MemoryReader');

      // Act
      log.error('readMemory', new Error('transient'));

      // Assert
      expect(mockForwarder).not.toHaveBeenCalled();
    });
  });

  describe('If warn is called', () => {
    it('Then should call console.warn with formatted prefix', () => {
      // Arrange
      const log = createServiceLogger('SaveFileMonitor');

      // Act
      log.warn('validate', 'Invalid interval');

      // Assert
      expect(console.warn).toHaveBeenCalledWith('[SaveFileMonitor.validate]', 'Invalid interval');
    });
  });

  describe('If info is called', () => {
    it('Then should call console.log with formatted prefix', () => {
      // Arrange
      const log = createServiceLogger('ProcessMonitor');

      // Act
      log.info('startMonitoring', 'Started');

      // Assert
      expect(console.log).toHaveBeenCalledWith('[ProcessMonitor.startMonitoring]', 'Started');
    });
  });

  describe('If info is called with context', () => {
    it('Then should include context in log output', () => {
      // Arrange
      const log = createServiceLogger('SaveFileMonitor');

      // Act
      log.info('startMonitoring', 'Started', { directory: '/saves' });

      // Assert
      expect(console.log).toHaveBeenCalledWith('[SaveFileMonitor.startMonitoring]', 'Started', {
        directory: '/saves',
      });
    });
  });

  describe('If non-Error value is passed as error', () => {
    it('Then should stringify the value as detail', () => {
      // Arrange
      const mockForwarder = vi.fn();
      setErrorForwarder(mockForwarder);
      const log = createServiceLogger('TestService');

      // Act
      log.error('op', 'string error', {}, { surfaceToUI: true, code: 'terrorZoneWriteFailed' });

      // Assert
      expect(mockForwarder).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'string error',
        }),
      );
    });
  });
});
