import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from './EventBus';
import { ProcessMonitor } from './processMonitor';

// Mock node:child_process
const mockExecAsync = vi.fn();

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    exec: vi.fn(),
  };
});

vi.mock('node:util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:util')>();
  return {
    ...actual,
    promisify: () => mockExecAsync,
  };
});

describe('When ProcessMonitor is instantiated', () => {
  let eventBus: EventBus;
  let processMonitor: ProcessMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecAsync.mockReset();

    eventBus = new EventBus();
    processMonitor = new ProcessMonitor(eventBus);
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
      expect(mockExecAsync).not.toHaveBeenCalled();

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
});
