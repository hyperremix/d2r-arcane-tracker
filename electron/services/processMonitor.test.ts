import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from './EventBus';
import { ProcessMonitor } from './processMonitor';

// Fake D2R process lookup
const mockFindProcess = vi.fn<() => Promise<number | null>>();

describe('When ProcessMonitor is instantiated', () => {
  let eventBus: EventBus;
  let processMonitor: ProcessMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindProcess.mockReset();

    eventBus = new EventBus();
    processMonitor = new ProcessMonitor(eventBus, mockFindProcess);
  });

  afterEach(() => {
    // Clean up any running monitors
    if (processMonitor) {
      processMonitor.shutdown();
    }
  });

  describe('If getProcessId is called', () => {
    it('Then should return null when no process is tracked', () => {
      // Act
      const result = processMonitor.getProcessId();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('If isRunning is called', () => {
    it('Then should return false when no process is tracked', () => {
      // Act
      const result = processMonitor.isRunning();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If startMonitoring is called on non-Windows platform', () => {
    it('Then should skip monitoring', () => {
      // Arrange
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });

      // Act
      processMonitor.startMonitoring();

      // Assert
      expect(processMonitor.isRunning()).toBe(false);
      expect(mockFindProcess).not.toHaveBeenCalled();
      expect(processMonitor.isMonitoring()).toBe(false);

      // Cleanup
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });
  });

  describe('If stopMonitoring is called', () => {
    it('Then should clear process state', () => {
      // Act
      processMonitor.stopMonitoring();

      // Assert
      expect(processMonitor.isRunning()).toBe(false);
      expect(processMonitor.getProcessId()).toBeNull();
    });
  });

  describe('If shutdown is called', () => {
    it('Then should stop monitoring', () => {
      // Act
      processMonitor.shutdown();

      // Assert
      expect(processMonitor.isRunning()).toBe(false);
    });
  });

  describe('If event bus integration works', () => {
    it('Then should be able to register event listeners', () => {
      // Arrange
      const handler = vi.fn();

      // Act
      eventBus.on('d2r-started', handler);

      // Assert
      expect(eventBus.listenerCount('d2r-started')).toBe(1);
    });
  });

  describe('If monitoring runs on Windows and D2R starts', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    it('Then d2r-started is emitted and the monitor reports the game as running', async () => {
      // Arrange
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockFindProcess.mockResolvedValue(4321);
      const started = vi.fn();
      eventBus.on('d2r-started', started);

      // Act
      processMonitor.startMonitoring();
      await vi.waitFor(() => expect(started).toHaveBeenCalled());

      // Assert
      expect(started).toHaveBeenCalledWith({ processId: 4321, processName: 'D2R.exe' });
      expect(processMonitor.isMonitoring()).toBe(true);
      expect(processMonitor.isRunning()).toBe(true);
    });
  });
});
