import { beforeEach, describe, expect, it, vi } from 'vitest';
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

function createDependencies() {
  const eventBus = {
    emit: vi.fn(),
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
});
