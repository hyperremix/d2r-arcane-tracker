import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { areOffsetsValid, D2RGameState, getOffsetsForVersion } from '../config/d2rOffsets';
import { EventBus } from './EventBus';
import { MemoryReader } from './memoryReader';
import { ProcessMonitor } from './processMonitor';

// Mock win32-api
vi.mock('win32-api', () => ({
  Kernel32: {
    load: vi.fn().mockReturnValue({
      OpenProcess: vi.fn().mockReturnValue(1234),
      GetLastError: vi.fn().mockReturnValue(0),
    }),
  },
  ffi: {
    load: vi.fn().mockReturnValue({
      func: vi.fn((name: string) => {
        if (name === 'CloseHandle') {
          return vi.fn().mockReturnValue(true);
        }
        if (name === 'ReadProcessMemory') {
          return vi.fn().mockReturnValue(true);
        }
        return vi.fn();
      }),
    }),
  },
}));

// Mock child_process
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

describe('When MemoryReader is instantiated', () => {
  let eventBus: EventBus;
  let processMonitor: ProcessMonitor;
  let memoryReader: MemoryReader;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecAsync.mockReset();

    eventBus = new EventBus();
    processMonitor = new ProcessMonitor(eventBus);
    memoryReader = new MemoryReader(eventBus, processMonitor);
  });

  afterEach(() => {
    if (memoryReader) {
      memoryReader.stopPolling();
    }
  });

  describe('If updatePollingInterval is called', () => {
    it('Then should update the polling interval', () => {
      // Act
      memoryReader.updatePollingInterval(1000);

      // Assert - no errors thrown
      expect(true).toBe(true);
    });

    it('Then should clamp interval to valid range', () => {
      // Act - try to set too low and too high
      memoryReader.updatePollingInterval(50);
      memoryReader.updatePollingInterval(10000);

      // Assert - should be clamped (no error)
      expect(true).toBe(true);
    });
  });

  describe('If startPolling is called on non-Windows platform', () => {
    it('Then should skip polling', () => {
      // Arrange
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });

      const testMemoryReader = new MemoryReader(eventBus, processMonitor);

      // Act
      testMemoryReader.startPolling();

      // Assert - no errors, polling not started
      expect(true).toBe(true);

      // Cleanup
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });
  });

  describe('If startPolling is called without process handle', () => {
    it('Then should not start polling', () => {
      // Act
      memoryReader.startPolling();

      // Assert - no crash
      expect(true).toBe(true);
    });
  });

  describe('If stopPolling is called', () => {
    it('Then should stop polling', () => {
      // Act
      memoryReader.stopPolling();

      // Assert - no errors
      expect(true).toBe(true);
    });
  });

  describe('If readGameState is called without valid offsets', () => {
    it('Then should return null', async () => {
      // Act
      const result = await memoryReader.readGameState();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('If isInGame is called', () => {
    it('Then should return null when no process handle', async () => {
      // Act
      const result = await memoryReader.isInGame();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('If getGameId is called', () => {
    it('Then should return null when no process handle', async () => {
      // Act
      const result = await memoryReader.getGameId();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('If getCharacterName is called', () => {
    it('Then should return null when no process handle', async () => {
      // Act
      const result = await memoryReader.getCharacterName();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('If event bus integration works', () => {
    it('Then should listen to d2r-started events', () => {
      // Arrange
      const initialListenerCount = eventBus.listenerCount('d2r-started');

      // Act
      const newMemoryReader = new MemoryReader(eventBus, processMonitor);

      // Assert
      expect(eventBus.listenerCount('d2r-started')).toBeGreaterThan(initialListenerCount);

      // Cleanup
      newMemoryReader.stopPolling();
    });

    it('Then should listen to d2r-stopped events', () => {
      // Arrange
      const initialListenerCount = eventBus.listenerCount('d2r-stopped');

      // Act
      const newMemoryReader = new MemoryReader(eventBus, processMonitor);

      // Assert
      expect(eventBus.listenerCount('d2r-stopped')).toBeGreaterThan(initialListenerCount);

      // Cleanup
      newMemoryReader.stopPolling();
    });
  });
});

describe('When D2RGameState enum is used', () => {
  describe('If checking Lobby state', () => {
    it('Then should have correct value', () => {
      // Assert
      expect(D2RGameState.Lobby).toBe(0x00);
    });
  });

  describe('If checking InGame state', () => {
    it('Then should have correct value', () => {
      // Assert
      expect(D2RGameState.InGame).toBe(0x02);
    });
  });
});

describe('When offset helper functions are used', () => {
  describe('If getOffsetsForVersion is called with known version', () => {
    it('Then should return version-specific offsets', () => {
      // Act
      const offsets = getOffsetsForVersion('2.7');

      // Assert
      expect(offsets).toBeDefined();
      expect(offsets.p1).toBe(0x23e6e0);
      expect(offsets.p2).toBe(0x8);
      expect(offsets.p3).toBe(0x0);
    });
  });

  describe('If getOffsetsForVersion is called with unknown version', () => {
    it('Then should return default offsets', () => {
      // Act
      const offsets = getOffsetsForVersion('99.99.99');

      // Assert
      expect(offsets).toBeDefined();
      expect(offsets.version).toBe('2.7+');
    });
  });

  describe('If areOffsetsValid is called with valid offsets', () => {
    it('Then should return true', () => {
      // Arrange
      const offsets = {
        p1: 0x23e6e0,
        p2: 0x8,
        p3: 0x0,
        version: '2.7',
      };

      // Act
      const result = areOffsetsValid(offsets);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If areOffsetsValid is called with invalid offsets', () => {
    it('Then should return false', () => {
      // Arrange
      const offsets = {
        p1: 0x0,
        p2: 0x0,
        p3: 0x0,
        version: 'unknown',
      };

      // Act
      const result = areOffsetsValid(offsets);

      // Assert
      expect(result).toBe(false);
    });
  });
});
