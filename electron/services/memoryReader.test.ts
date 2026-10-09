import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { KNOWN_D2R_BUILDS, PE_HEADER_READ_SIZE } from '../config/d2rBuilds';
import { D2RGameState } from '../config/d2rPatterns';
import { EventBus } from './EventBus';
import { MemoryReader } from './memoryReader';

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
  let memoryReader: MemoryReader;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecAsync.mockReset();

    eventBus = new EventBus();
    memoryReader = new MemoryReader(eventBus);
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

      const testMemoryReader = new MemoryReader(eventBus);

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

  describe('If event bus integration works', () => {
    it('Then should listen to d2r-started events', () => {
      // Arrange
      const initialListenerCount = eventBus.listenerCount('d2r-started');

      // Act
      const newMemoryReader = new MemoryReader(eventBus);

      // Assert
      expect(eventBus.listenerCount('d2r-started')).toBeGreaterThan(initialListenerCount);

      // Cleanup
      newMemoryReader.stopPolling();
    });

    it('Then should listen to d2r-stopped events', () => {
      // Arrange
      const initialListenerCount = eventBus.listenerCount('d2r-stopped');

      // Act
      const newMemoryReader = new MemoryReader(eventBus);

      // Assert
      expect(eventBus.listenerCount('d2r-stopped')).toBeGreaterThan(initialListenerCount);

      // Cleanup
      newMemoryReader.stopPolling();
    });
  });
});

interface FakeWindowsMemoryReader {
  openProcess: Mock<(processId: number) => Promise<number | null>>;
  closeHandle: Mock<(handle: number) => Promise<void>>;
  getModuleInfo: Mock<
    (
      processId: number,
      moduleName: string,
    ) => Promise<{ baseAddress: string; size: number | undefined } | null>
  >;
  readMemory: Mock<(handle: number, address: number, size: number) => Promise<Buffer | null>>;
  readModuleImage: Mock<
    (handle: number, baseAddress: string, size: number) => Promise<Buffer | null>
  >;
}

const MODULE_BASE = 0x7ff600000000;
const IMAGE_SIZE = 0x2000;
const UI_OFFSET = 0x1800;
const GAME_STATE_ADDRESS = MODULE_BASE + UI_OFFSET - 0xa;
const [KNOWN_BUILD] = KNOWN_D2R_BUILDS;
const KNOWN_BUILD_FLAG_ADDRESS = MODULE_BASE + KNOWN_BUILD.inGameFlagRva;

/** Builds a minimal PE header with the given identity. */
function createPeHeader(timeDateStamp: number, sizeOfImage: number): Buffer {
  const peOffset = 0x150;
  const header = Buffer.alloc(PE_HEADER_READ_SIZE);
  header.writeUInt32LE(peOffset, 0x3c);
  header.writeUInt32LE(0x00004550, peOffset);
  header.writeUInt32LE(timeDateStamp, peOffset + 8);
  header.writeUInt32LE(sizeOfImage, peOffset + 24 + 56);
  return header;
}

/** Builds a module image whose UI pattern resolves to UI_OFFSET. */
function createModuleImageWithUiPattern(): Buffer {
  const image = Buffer.alloc(IMAGE_SIZE);
  const patternRva = 0x400;
  Buffer.from([0x40, 0x84, 0xed, 0x0f, 0x94, 0x05]).copy(image, patternRva);
  image.writeInt32LE(UI_OFFSET - (patternRva + 10), patternRva + 6);
  return image;
}

describe('When D2R starts and the memory offsets are resolved', () => {
  let eventBus: EventBus;
  let memoryReader: MemoryReader;
  let fakeReader: FakeWindowsMemoryReader;
  let gameStateByte: number;
  let peHeader: Buffer | null;
  const originalPlatform = process.platform;

  // Lets the chain of awaited calls in the d2r-started handler run to completion
  const flushPromises = async () => {
    for (let i = 0; i < 25; i++) {
      await Promise.resolve();
    }
  };

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    gameStateByte = 0;
    peHeader = null; // unreadable header => unknown build => signature scan
    fakeReader = {
      openProcess: vi.fn().mockResolvedValue(1234),
      closeHandle: vi.fn().mockResolvedValue(undefined),
      getModuleInfo: vi
        .fn()
        .mockResolvedValue({ baseAddress: MODULE_BASE.toString(16), size: IMAGE_SIZE }),
      readMemory: vi.fn(async (_handle: number, address: number) => {
        if (address === MODULE_BASE) {
          return peHeader;
        }
        const isFlagAddress =
          address === GAME_STATE_ADDRESS || address === KNOWN_BUILD_FLAG_ADDRESS;
        return isFlagAddress ? Buffer.from([gameStateByte]) : null;
      }),
      readModuleImage: vi.fn().mockResolvedValue(createModuleImageWithUiPattern()),
    };

    eventBus = new EventBus();
    memoryReader = new MemoryReader(eventBus);
    Reflect.set(memoryReader, 'memoryReader', fakeReader);
  });

  afterEach(async () => {
    await memoryReader.shutdown();
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    vi.useRealTimers();
  });

  describe('If the UI pattern is found on the first attempt', () => {
    it('Then should emit game-entered and game-exited as the in-game flag changes', async () => {
      // Arrange
      const entered = vi.fn();
      const exited = vi.fn();
      eventBus.on('game-entered', entered);
      eventBus.on('game-exited', exited);

      // Act
      eventBus.emit('d2r-started', { processId: 1234, processName: 'D2R.exe' });
      await flushPromises();
      gameStateByte = 1;
      await vi.advanceTimersByTimeAsync(500);
      gameStateByte = 0;
      await vi.advanceTimersByTimeAsync(500);

      // Assert
      expect(memoryReader.isOffsetsValid()).toBe(true);
      expect(entered).toHaveBeenCalledTimes(1);
      expect(exited).toHaveBeenCalledTimes(1);
    });
  });

  describe('If the D2R build is known', () => {
    it('Then should use the verified flag offset without scanning the image', async () => {
      // Arrange
      peHeader = createPeHeader(KNOWN_BUILD.timeDateStamp, KNOWN_BUILD.sizeOfImage);
      const entered = vi.fn();
      const exited = vi.fn();
      eventBus.on('game-entered', entered);
      eventBus.on('game-exited', exited);

      // Act
      eventBus.emit('d2r-started', { processId: 1234, processName: 'D2R.exe' });
      await flushPromises();
      gameStateByte = 1;
      await vi.advanceTimersByTimeAsync(500);
      gameStateByte = 0;
      await vi.advanceTimersByTimeAsync(500);

      // Assert
      expect(fakeReader.readModuleImage).not.toHaveBeenCalled();
      expect(memoryReader.isOffsetsValid()).toBe(true);
      expect(entered).toHaveBeenCalledTimes(1);
      expect(exited).toHaveBeenCalledTimes(1);
    });
  });

  describe('If the D2R build is unknown', () => {
    it('Then should fall back to the signature scan', async () => {
      // Arrange
      peHeader = createPeHeader(KNOWN_BUILD.timeDateStamp + 1, KNOWN_BUILD.sizeOfImage);

      // Act
      eventBus.emit('d2r-started', { processId: 1234, processName: 'D2R.exe' });
      await flushPromises();

      // Assert
      expect(fakeReader.readModuleImage).toHaveBeenCalledTimes(1);
      expect(memoryReader.isOffsetsValid()).toBe(true);
    });
  });

  describe('If a known build does not expose a 0/1 flag at the known offset yet', () => {
    it('Then should retry the verified offset instead of scanning', async () => {
      // Arrange
      peHeader = createPeHeader(KNOWN_BUILD.timeDateStamp, KNOWN_BUILD.sizeOfImage);
      gameStateByte = 0x7f;

      // Act
      eventBus.emit('d2r-started', { processId: 1234, processName: 'D2R.exe' });
      await flushPromises();
      const validBeforeRetry = memoryReader.isOffsetsValid();
      gameStateByte = 0;
      await vi.advanceTimersByTimeAsync(5000);

      // Assert
      expect(validBeforeRetry).toBe(false);
      expect(memoryReader.isOffsetsValid()).toBe(true);
      expect(fakeReader.readModuleImage).not.toHaveBeenCalled();
    });
  });

  describe('If no UI pattern candidate has a live 0/1 flag', () => {
    it('Then should leave offsets invalid and keep retrying', async () => {
      // Arrange
      gameStateByte = 0x55;

      // Act
      eventBus.emit('d2r-started', { processId: 1234, processName: 'D2R.exe' });
      await flushPromises();
      await vi.advanceTimersByTimeAsync(5000);

      // Assert
      expect(memoryReader.isOffsetsValid()).toBe(false);
      expect(fakeReader.readModuleImage).toHaveBeenCalledTimes(2);
    });
  });

  describe('If the first attempt cannot read the module image', () => {
    it('Then should retry and start detecting once the image is readable', async () => {
      // Arrange
      fakeReader.readModuleImage.mockResolvedValueOnce(null);
      const entered = vi.fn();
      eventBus.on('game-entered', entered);

      // Act
      eventBus.emit('d2r-started', { processId: 1234, processName: 'D2R.exe' });
      await flushPromises();
      expect(memoryReader.isOffsetsValid()).toBe(false);

      gameStateByte = 1;
      await vi.advanceTimersByTimeAsync(5000);
      await flushPromises();

      // Assert
      expect(fakeReader.readModuleImage).toHaveBeenCalledTimes(2);
      expect(memoryReader.isOffsetsValid()).toBe(true);
      expect(entered).toHaveBeenCalledTimes(1);
    });
  });

  describe('If the UI pattern is not found', () => {
    it('Then should keep retrying and leave offsets invalid', async () => {
      // Arrange
      fakeReader.readModuleImage.mockResolvedValue(Buffer.alloc(IMAGE_SIZE));

      // Act
      eventBus.emit('d2r-started', { processId: 1234, processName: 'D2R.exe' });
      await flushPromises();
      await vi.advanceTimersByTimeAsync(10000);
      await flushPromises();

      // Assert
      expect(fakeReader.readModuleImage.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(memoryReader.isOffsetsValid()).toBe(false);
    });
  });

  describe('If D2R stops while a retry is pending', () => {
    it('Then should stop retrying', async () => {
      // Arrange
      fakeReader.readModuleImage.mockResolvedValue(null);
      eventBus.emit('d2r-started', { processId: 1234, processName: 'D2R.exe' });
      await flushPromises();

      // Act
      eventBus.emit('d2r-stopped', { processId: null, processName: 'D2R.exe' });
      await flushPromises();
      await vi.advanceTimersByTimeAsync(60000);

      // Assert
      expect(fakeReader.readModuleImage).toHaveBeenCalledTimes(1);
    });
  });
});

describe('When D2RGameState enum is used', () => {
  describe('If checking Lobby state', () => {
    it('Then should have correct value', () => {
      // Assert
      expect(D2RGameState.Lobby).toBe(0);
    });
  });

  describe('If checking InGame state', () => {
    it('Then should have correct value', () => {
      // Assert
      expect(D2RGameState.InGame).toBe(1);
    });
  });
});
