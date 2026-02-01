import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron modules first
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  webContents: { getAllWebContents: vi.fn().mockReturnValue([]) },
}));

// Mock database
vi.mock('../database/database', () => ({
  grailDatabase: {
    getCharacterByName: vi.fn(),
    getProgressByItem: vi.fn(),
    getAllItems: vi.fn().mockReturnValue([]),
    getAllProgress: vi.fn().mockReturnValue([]),
  },
}));

// Mock DatabaseBatchWriter
vi.mock('../services/DatabaseBatchWriter', () => ({
  DatabaseBatchWriter: vi.fn().mockImplementation(() => ({
    queueCharacter: vi.fn(),
    queueProgress: vi.fn(),
    queueRunItem: vi.fn(),
    flush: vi.fn(),
  })),
}));

// Mock EventBus
vi.mock('../services/EventBus', () => ({
  EventBus: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    clear: vi.fn(),
    listenerCount: vi.fn().mockReturnValue(0),
  })),
}));

// Mock other services
vi.mock('../services/itemDetection', () => ({
  ItemDetectionService: vi.fn().mockImplementation(() => ({
    setGrailItems: vi.fn(),
    initializeFromDatabase: vi.fn(),
  })),
}));
vi.mock('../services/saveFileMonitor', () => ({
  SaveFileMonitor: vi.fn().mockImplementation(() => ({
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
  })),
}));
vi.mock('../services/runTracker', () => ({
  RunTrackerService: vi.fn().mockImplementation(() => ({
    getActiveRun: vi.fn(),
    setMemoryReader: vi.fn(),
  })),
}));
vi.mock('../services/processMonitor', () => ({
  ProcessMonitor: vi.fn(),
}));
vi.mock('../services/memoryReader', () => ({
  MemoryReader: vi.fn(),
}));

import type { GrailDatabase } from '../database/database';
import type { DatabaseBatchWriter } from '../services/DatabaseBatchWriter';
import type { EventBus } from '../services/EventBus';
import type { RunTrackerService } from '../services/runTracker';
import type { ItemDetectionEvent, Run } from '../types/grail';
import { handleAutomaticGrailProgress } from './saveFileHandlers';

type TestDependencies = {
  eventBus: EventBus;
  database: GrailDatabase;
  batchWriter: DatabaseBatchWriter;
  runTracker: RunTrackerService;
};

function createDependencies(options?: { trackCallOrder?: string[] }) {
  const callOrder = options?.trackCallOrder;

  const eventBus = {
    emit: vi.fn().mockImplementation((event: string) => {
      if (callOrder) callOrder.push(`emit:${event}`);
    }),
  } as unknown as EventBus;

  const database = {
    addRunItem: vi.fn(),
    getCharacterByName: vi.fn(),
    getProgressByItem: vi.fn(),
  } as unknown as GrailDatabase;

  const batchWriter = {
    queueCharacter: vi.fn(),
    queueProgress: vi.fn(),
    queueRunItem: vi.fn(),
    flush: vi.fn().mockImplementation(() => {
      if (callOrder) callOrder.push('flush');
    }),
  } as unknown as DatabaseBatchWriter;

  const runTracker = {
    getActiveRun: vi.fn(),
  } as unknown as RunTrackerService;

  return {
    dependencies: { eventBus, database, batchWriter, runTracker } satisfies TestDependencies,
    mocks: { eventBus, database, batchWriter, runTracker },
  };
}

describe('handleAutomaticGrailProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues run items when an active run is in progress', () => {
    // Arrange
    const { dependencies, mocks } = createDependencies();
    const activeRun: Run = {
      id: 'run-1',
      sessionId: 'session-1',
      runNumber: 1,
      startTime: new Date(),
      created: new Date(),
      lastUpdated: new Date(),
    };

    vi.mocked(mocks.runTracker.getActiveRun).mockReturnValue(activeRun);
    vi.mocked(mocks.database.getCharacterByName).mockReturnValue(undefined);
    vi.mocked(mocks.database.getProgressByItem).mockReturnValue([]);

    const event: ItemDetectionEvent = {
      type: 'item-found',
      item: {
        id: 'd2-item-1',
        name: 'Test Item',
        type: 'unique',
        quality: 'unique',
        level: 85,
        ethereal: false,
        sockets: 0,
        timestamp: new Date(),
        characterName: 'TestCharacter',
        location: 'inventory',
      },
      grailItem: {
        id: 'grail-item-1',
        name: 'Test Item',
        link: 'https://example.com',
        etherealType: 'optional',
        type: 'unique',
        category: 'weapons',
        subCategory: '1h_swords',
        treasureClass: 'elite',
      },
      silent: false,
      isInitialScan: false,
    };

    // Act
    handleAutomaticGrailProgress(event, dependencies);

    // Assert
    expect(mocks.batchWriter.queueProgress).toHaveBeenCalled();
    expect(mocks.batchWriter.queueRunItem).toHaveBeenCalledWith(
      expect.objectContaining({ runId: activeRun.id }),
    );
    expect(mocks.database.addRunItem).not.toHaveBeenCalled();
  });

  it('emits run-item-added AFTER flush to prevent race conditions', () => {
    // Arrange - track call order to verify flush happens before emit
    const callOrder: string[] = [];
    const { dependencies, mocks } = createDependencies({ trackCallOrder: callOrder });
    const activeRun: Run = {
      id: 'run-1',
      sessionId: 'session-1',
      runNumber: 1,
      startTime: new Date(),
      created: new Date(),
      lastUpdated: new Date(),
    };

    vi.mocked(mocks.runTracker.getActiveRun).mockReturnValue(activeRun);
    vi.mocked(mocks.database.getCharacterByName).mockReturnValue(undefined);
    vi.mocked(mocks.database.getProgressByItem).mockReturnValue([]);

    const event: ItemDetectionEvent = {
      type: 'item-found',
      item: {
        id: 'd2-item-1',
        name: 'Test Item',
        type: 'unique',
        quality: 'unique',
        level: 85,
        ethereal: false,
        sockets: 0,
        timestamp: new Date(),
        characterName: 'TestCharacter',
        location: 'inventory',
      },
      grailItem: {
        id: 'grail-item-1',
        name: 'Test Item',
        link: 'https://example.com',
        etherealType: 'optional',
        type: 'unique',
        category: 'weapons',
        subCategory: '1h_swords',
        treasureClass: 'elite',
      },
      silent: false,
      isInitialScan: false,
    };

    // Act
    handleAutomaticGrailProgress(event, dependencies);

    // Assert - verify flush is called before run-item-added emit
    const flushIndex = callOrder.indexOf('flush');
    const emitIndex = callOrder.indexOf('emit:run-item-added');

    expect(flushIndex).toBeGreaterThanOrEqual(0);
    expect(emitIndex).toBeGreaterThanOrEqual(0);
    expect(flushIndex).toBeLessThan(emitIndex);
  });
});
