import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  type MockInstance,
  vi,
} from 'vitest';
import { D2ItemBuilder, D2SaveFileBuilder, HolyGrailItemBuilder } from '@/fixtures';
import {
  GameMode,
  type ItemDetectionEvent,
  type ParsedInventoryItemWithRaw,
  type SaveFileEvent,
  type Settings,
} from '../types/grail';
import { EventBus } from './EventBus';
import {
  GrailDetectionPipeline,
  type GrailDetectionPipelineDependencies,
  MONITORING_AUTO_START_DELAY_MS,
} from './grailDetectionPipeline';

type SettingsListener = (changes: Partial<Settings>) => void | Promise<void>;

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function createDeferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('When the grail detection pipeline runs', () => {
  let eventBus: EventBus;
  let settingsListeners: SettingsListener[];
  let gameMode: GameMode | (() => GameMode);
  let settings: {
    get: ReturnType<typeof vi.fn>;
    onUpdated: ReturnType<typeof vi.fn>;
  };
  let saveFileMonitor: {
    startMonitoring: Mock<() => Promise<void>>;
    stopMonitoringIfActive: Mock<() => Promise<void>>;
  };
  let itemDetection: { analyzeSaveFile: ReturnType<typeof vi.fn> };
  let grailProgress: { recordSaveFile: ReturnType<typeof vi.fn> };
  const pipelines: GrailDetectionPipeline[] = [];

  function startPipeline(): GrailDetectionPipeline {
    const pipeline = new GrailDetectionPipeline({
      eventBus,
      settings,
      saveFileMonitor,
      itemDetection,
      grailProgress,
    } as unknown as GrailDetectionPipelineDependencies);
    pipelines.push(pipeline);
    pipeline.start();
    return pipeline;
  }

  // Settles once every listener has finished processing the update
  const emitSettingsUpdated = (changes: Partial<Settings>): Promise<unknown> =>
    Promise.all(settingsListeners.map((listener) => listener(changes)));

  beforeEach(() => {
    eventBus = new EventBus();
    settingsListeners = [];
    gameMode = GameMode.Both;
    settings = {
      get: vi.fn((key: keyof Settings) => {
        if (key !== 'gameMode') {
          return undefined;
        }
        return typeof gameMode === 'function' ? gameMode() : gameMode;
      }),
      onUpdated: vi.fn((listener: SettingsListener) => {
        settingsListeners.push(listener);
        return () => {
          settingsListeners = settingsListeners.filter((entry) => entry !== listener);
        };
      }),
    };
    saveFileMonitor = {
      startMonitoring: vi.fn().mockResolvedValue(undefined),
      stopMonitoringIfActive: vi.fn().mockResolvedValue(undefined),
    };
    itemDetection = { analyzeSaveFile: vi.fn().mockResolvedValue([]) };
    grailProgress = { recordSaveFile: vi.fn() };
  });

  afterEach(() => {
    for (const pipeline of pipelines.splice(0)) {
      pipeline.dispose();
    }
  });

  describe('If a modified save file is reported', () => {
    it('Then its parsed items are analyzed and the character is recorded with the items found', async () => {
      // Arrange
      const file = D2SaveFileBuilder.new().withName('TestCharacter').build();
      const parsedItems = [{ fingerprint: 'fp-1' }] as unknown as ParsedInventoryItemWithRaw[];
      const foundItem = {
        type: 'item-found',
        item: D2ItemBuilder.new().withCharacterName('TestCharacter').build(),
        grailItem: HolyGrailItemBuilder.new().withId('shako').build(),
      } as ItemDetectionEvent;
      itemDetection.analyzeSaveFile.mockResolvedValue([foundItem]);
      const event: SaveFileEvent = {
        type: 'modified',
        file,
        parsedItems,
        silent: true,
        isInitialScan: true,
      };
      startPipeline();

      // Act
      await eventBus.emitAsync('save-file-event', event);

      // Assert
      expect(itemDetection.analyzeSaveFile).toHaveBeenCalledWith(file, parsedItems, true, true);
      expect(grailProgress.recordSaveFile).toHaveBeenCalledWith(file, [foundItem]);
    });

    it('Then a save file without parsed items is analyzed with an empty item list', async () => {
      // Arrange
      const file = D2SaveFileBuilder.new().withName('TestCharacter').build();
      startPipeline();

      // Act
      await eventBus.emitAsync('save-file-event', { type: 'modified', file });

      // Assert
      expect(itemDetection.analyzeSaveFile).toHaveBeenCalledWith(file, [], undefined, undefined);
    });
  });

  describe('If a created save file is reported', () => {
    it('Then the character is recorded without analyzing items', async () => {
      // Arrange
      const file = D2SaveFileBuilder.new().withName('TestCharacter').build();
      startPipeline();

      // Act
      await eventBus.emitAsync('save-file-event', { type: 'created', file });

      // Assert
      expect(itemDetection.analyzeSaveFile).not.toHaveBeenCalled();
      expect(grailProgress.recordSaveFile).toHaveBeenCalledWith(file, []);
    });
  });

  describe('If the pipeline is disposed', () => {
    it('Then save file events and settings changes are no longer handled', async () => {
      // Arrange
      const pipeline = startPipeline();
      const file = D2SaveFileBuilder.new().withName('TestCharacter').build();

      // Act
      pipeline.dispose();
      await eventBus.emitAsync('save-file-event', { type: 'modified', file });

      // Assert
      expect(eventBus.listenerCount('save-file-event')).toBe(0);
      expect(settingsListeners).toHaveLength(0);
      expect(grailProgress.recordSaveFile).not.toHaveBeenCalled();
    });

    it('When start is called twice, Then the save file event is handled once', async () => {
      // Arrange
      const pipeline = startPipeline();
      const file = D2SaveFileBuilder.new().withName('TestCharacter').build();

      // Act
      pipeline.start();
      await eventBus.emitAsync('save-file-event', { type: 'created', file });

      // Assert
      expect(grailProgress.recordSaveFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('If save file monitoring is auto-started', () => {
    let warnSpy: MockInstance | undefined;
    let logSpy: MockInstance | undefined;

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      warnSpy?.mockRestore();
      warnSpy = undefined;
      logSpy?.mockRestore();
      logSpy = undefined;
      vi.useRealTimers();
    });

    it.each([
      GameMode.Both,
      GameMode.Softcore,
      GameMode.Hardcore,
    ])('When the game mode is %s, Then monitoring starts after the startup delay', async (mode) => {
      // Arrange
      gameMode = mode;
      startPipeline();

      // Act
      await vi.advanceTimersByTimeAsync(MONITORING_AUTO_START_DELAY_MS);

      // Assert
      expect(saveFileMonitor.startMonitoring).toHaveBeenCalledTimes(1);
    });

    it('When the persisted game mode is Manual, Then monitoring does not start', async () => {
      // Arrange
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      gameMode = GameMode.Manual;
      startPipeline();

      // Act
      await vi.advanceTimersByTimeAsync(MONITORING_AUTO_START_DELAY_MS);

      // Assert
      expect(saveFileMonitor.startMonitoring).not.toHaveBeenCalled();
    });

    it('If the settings cannot be read, Then monitoring still starts', async () => {
      // Arrange
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      gameMode = () => {
        throw new Error('database unavailable');
      };
      startPipeline();

      // Act
      await vi.advanceTimersByTimeAsync(MONITORING_AUTO_START_DELAY_MS);

      // Assert
      expect(saveFileMonitor.startMonitoring).toHaveBeenCalledTimes(1);
    });

    it('If the pipeline is disposed before the delay, Then monitoring does not start', async () => {
      // Arrange
      const pipeline = startPipeline();

      // Act
      pipeline.dispose();
      await vi.advanceTimersByTimeAsync(MONITORING_AUTO_START_DELAY_MS);

      // Assert
      expect(saveFileMonitor.startMonitoring).not.toHaveBeenCalled();
    });
  });

  describe('If the game mode is changed while the app is running', () => {
    it('When switching to Manual, Then monitoring is stopped if active', async () => {
      // Arrange
      startPipeline();

      // Act
      await emitSettingsUpdated({ gameMode: GameMode.Manual });

      // Assert
      expect(saveFileMonitor.stopMonitoringIfActive).toHaveBeenCalledTimes(1);
    });

    it('When switching from Manual to an automatic mode, Then monitoring resumes once', async () => {
      // Arrange
      gameMode = GameMode.Manual;
      startPipeline();

      // Act
      await Promise.all([
        emitSettingsUpdated({ gameMode: GameMode.Softcore }),
        emitSettingsUpdated({ gameMode: GameMode.Softcore }),
      ]);

      // Assert
      expect(saveFileMonitor.startMonitoring).toHaveBeenCalledTimes(1);
    });

    it('When the mode flips auto -> Manual -> auto during an in-flight start, Then the resume start is still requested', async () => {
      // Arrange
      startPipeline();
      const inFlightStart = createDeferred();
      saveFileMonitor.startMonitoring.mockReturnValueOnce(inFlightStart.promise);
      // A start requested elsewhere (e.g. over IPC) that has not finished yet
      const startRequest = saveFileMonitor.startMonitoring();

      // Act
      await emitSettingsUpdated({ gameMode: GameMode.Manual });
      const resume = emitSettingsUpdated({ gameMode: GameMode.Softcore });
      inFlightStart.resolve();
      await Promise.all([startRequest, resume]);

      // Assert
      expect(saveFileMonitor.startMonitoring).toHaveBeenCalledTimes(2);
      expect(saveFileMonitor.stopMonitoringIfActive).toHaveBeenCalledTimes(1);
    });

    it('When switching between automatic modes, Then monitoring is left untouched', async () => {
      // Arrange
      startPipeline();

      // Act
      await emitSettingsUpdated({ gameMode: GameMode.Hardcore });

      // Assert
      expect(saveFileMonitor.startMonitoring).not.toHaveBeenCalled();
      expect(saveFileMonitor.stopMonitoringIfActive).not.toHaveBeenCalled();
    });

    it('When unrelated settings change, Then monitoring is left untouched', async () => {
      // Arrange
      gameMode = GameMode.Manual;
      startPipeline();

      // Act
      await emitSettingsUpdated({ theme: 'dark' });

      // Assert
      expect(saveFileMonitor.startMonitoring).not.toHaveBeenCalled();
      expect(saveFileMonitor.stopMonitoringIfActive).not.toHaveBeenCalled();
    });

    it('If stopping the monitor fails, Then the error is logged and not thrown', async () => {
      // Arrange
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      saveFileMonitor.stopMonitoringIfActive.mockRejectedValue(new Error('watcher close failed'));
      startPipeline();

      // Act
      await emitSettingsUpdated({ gameMode: GameMode.Manual });

      // Assert
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to update save file monitoring for the game mode:',
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });
  });
});
