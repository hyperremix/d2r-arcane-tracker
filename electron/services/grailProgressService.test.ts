// @vitest-environment node
import type { Database as DatabaseType } from 'better-sqlite3';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CharacterBuilder,
  D2ItemBuilder,
  D2SaveFileBuilder,
  GrailProgressBuilder,
  HolyGrailItemBuilder,
} from '@/fixtures';
import * as characters from '../database/characters';
import { createDrizzleDb } from '../database/drizzle';
import * as progress from '../database/progress';
import * as runItems from '../database/run-items';
import type { DatabaseContext } from '../database/types';
import type { BroadcastToRenderers } from '../ipc/broadcast';
import { createInMemoryDatabase, initializeDatabaseSchema } from '../test/helpers/databaseHelpers';
import type { ItemDetectionEvent, Run } from '../types/grail';
import { setErrorForwarder } from '../utils/serviceLogger';
import { EventBus } from './EventBus';
import {
  type GrailProgressDatabase,
  GrailProgressService,
  loadGrailItemsIntoDetection,
} from './grailProgressService';

const activeRun: Run = {
  id: 'run-1',
  sessionId: 'session-1',
  characterId: 'char-runner',
  runNumber: 1,
  startTime: new Date('2024-01-01T10:00:00.000Z'),
  created: new Date('2024-01-01T10:00:00.000Z'),
  lastUpdated: new Date('2024-01-01T10:00:00.000Z'),
};

/** Builds the save file of a sorceress; the characters table only accepts the stored class names. */
function sorceressSaveFile(name: string) {
  return D2SaveFileBuilder.new().withCharacterClass('sorceress').withName(name);
}

function createFoundItem(
  overrides: { characterName?: string; grailItemId?: string; silent?: boolean } = {},
): ItemDetectionEvent {
  const grailItemId = overrides.grailItemId ?? 'shako';
  return {
    type: 'item-found',
    item: D2ItemBuilder.new()
      .withId(`${grailItemId}-item`)
      .withName(grailItemId)
      .withCharacterName(overrides.characterName ?? 'Sorc')
      .withLocation('inventory')
      .build(),
    grailItem: HolyGrailItemBuilder.new().withId(grailItemId).withName(grailItemId).build(),
    d2sItemId: 42,
    silent: overrides.silent ?? false,
  } as ItemDetectionEvent;
}

describe('When a parsed save file is recorded in the database', () => {
  let rawDb: DatabaseType;
  let ctx: DatabaseContext;
  let database: GrailProgressDatabase;
  let eventBus: EventBus;
  let broadcastToRenderers: ReturnType<typeof vi.fn>;
  let runTracker: { getActiveRun: Mock<() => Run | null> };
  let service: GrailProgressService;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rawDb = createInMemoryDatabase();
    initializeDatabaseSchema(rawDb);
    ctx = { rawDb, db: createDrizzleDb(rawDb), dbPath: ':memory:' };
    rawDb
      .prepare(
        `INSERT INTO items (id, name, type, category, sub_category, treasure_class, ethereal_type)
         VALUES ('shako', 'Shako', 'unique', 'armor', 'helms', 'elite', 'optional')`,
      )
      .run();
    database = {
      addRunItem: (runItem) => runItems.addRunItem(ctx, runItem),
      getCharacterByName: (name) => characters.getCharacterByName(ctx, name),
      getCharacterBySaveFilePath: (path) => characters.getCharacterBySaveFilePath(ctx, path),
      getProgressByItem: (itemId) => progress.getProgressByItem(ctx, itemId),
      transaction: (fn) => rawDb.transaction(fn)(),
      upsertCharacter: (character) => characters.upsertCharacter(ctx, character),
      upsertProgress: (grailProgress) => progress.upsertProgress(ctx, grailProgress),
    };
    eventBus = new EventBus();
    broadcastToRenderers = vi.fn();
    runTracker = { getActiveRun: vi.fn<() => Run | null>(() => null) };
    service = new GrailProgressService({
      database,
      eventBus,
      runTracker,
      broadcastToRenderers: broadcastToRenderers as unknown as BroadcastToRenderers,
    });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
    rawDb.close();
  });

  describe('If the save file of a new character contains a new grail item', () => {
    it('Then one character is created and the progress belongs to it', () => {
      // Arrange
      const saveFile = sorceressSaveFile('Sorc').withPath('/saves/Sorc.d2s').build();

      // Act
      service.recordSaveFile(saveFile, [createFoundItem({ characterName: 'Sorc' })]);

      // Assert
      const storedCharacters = characters.getAllCharacters(ctx);
      expect(storedCharacters).toHaveLength(1);
      expect(storedCharacters[0]).toMatchObject({ name: 'Sorc', saveFilePath: '/saves/Sorc.d2s' });
      expect(progress.getAllProgress(ctx)).toEqual([
        expect.objectContaining({ characterId: storedCharacters[0].id, itemId: 'shako' }),
      ]);
    });
  });

  describe('If the save file contains no new grail items', () => {
    it('Then only the character is stored', () => {
      // Arrange
      const saveFile = sorceressSaveFile('Sorc').build();

      // Act
      service.recordSaveFile(saveFile, []);

      // Assert
      expect(characters.getAllCharacters(ctx)).toHaveLength(1);
      expect(progress.getAllProgress(ctx)).toEqual([]);
    });

    it('If the character is new, Then the progress update is broadcast once after the commit', () => {
      // Arrange
      const saveFile = sorceressSaveFile('Sorc').build();
      const stateWhenBroadcast: Array<{ inTransaction: boolean; characterCount: number }> = [];
      broadcastToRenderers.mockImplementation(() => {
        stateWhenBroadcast.push({
          inTransaction: rawDb.inTransaction,
          characterCount: characters.getAllCharacters(ctx).length,
        });
      });

      // Act
      service.recordSaveFile(saveFile, []);

      // Assert
      expect(broadcastToRenderers).toHaveBeenCalledTimes(1);
      expect(broadcastToRenderers).toHaveBeenCalledWith('grail-progress-updated');
      expect(stateWhenBroadcast).toEqual([{ inTransaction: false, characterCount: 1 }]);
    });

    it('If only the level of the character changed, Then the progress update is broadcast once after the commit', () => {
      // Arrange
      const saveFile = sorceressSaveFile('Sorc').withLevel(10).build();
      service.recordSaveFile(saveFile, []);
      broadcastToRenderers.mockClear();
      const stateWhenBroadcast: Array<{ inTransaction: boolean; level: number | undefined }> = [];
      broadcastToRenderers.mockImplementation(() => {
        stateWhenBroadcast.push({
          inTransaction: rawDb.inTransaction,
          level: characters.getCharacterByName(ctx, 'Sorc')?.level,
        });
      });

      // Act
      service.recordSaveFile(sorceressSaveFile('Sorc').withLevel(11).build(), []);

      // Assert
      expect(broadcastToRenderers).toHaveBeenCalledTimes(1);
      expect(broadcastToRenderers).toHaveBeenCalledWith('grail-progress-updated');
      expect(stateWhenBroadcast).toEqual([{ inTransaction: false, level: 11 }]);
    });

    it.each([
      ['class', D2SaveFileBuilder.new().withName('Sorc').withCharacterClass('necromancer')],
      ['hardcore flag', sorceressSaveFile('Sorc').withHardcore(true)],
      ['expansion flag', sorceressSaveFile('Sorc').withExpansion(false)],
    ])('If only the %s of the character changed, Then the progress update is broadcast', (_field, builder) => {
      // Arrange
      service.recordSaveFile(sorceressSaveFile('Sorc').build(), []);
      broadcastToRenderers.mockClear();

      // Act
      service.recordSaveFile(builder.build(), []);

      // Assert
      expect(broadcastToRenderers).toHaveBeenCalledTimes(1);
      expect(broadcastToRenderers).toHaveBeenCalledWith('grail-progress-updated');
    });

    it('If the character is unchanged, Then nothing is broadcast', () => {
      // Arrange
      const saveFile = sorceressSaveFile('Sorc').build();
      service.recordSaveFile(saveFile, []);
      broadcastToRenderers.mockClear();

      // Act
      service.recordSaveFile(saveFile, []);

      // Assert
      expect(broadcastToRenderers).not.toHaveBeenCalled();
    });

    it('If the transaction is rolled back, Then nothing is broadcast', () => {
      // Arrange
      const saveFile = sorceressSaveFile('Sorc').build();
      database.transaction = (fn) =>
        rawDb.transaction(() => {
          fn();
          throw new Error('commit failed');
        })();

      // Act
      service.recordSaveFile(saveFile, []);

      // Assert
      expect(characters.getAllCharacters(ctx)).toEqual([]);
      expect(broadcastToRenderers).not.toHaveBeenCalled();
    });
  });

  describe('If a new character is recorded together with a new grail item', () => {
    it('Then the progress update is broadcast once, with the discovery', () => {
      // Arrange
      const saveFile = sorceressSaveFile('Sorc').build();

      // Act
      service.recordSaveFile(saveFile, [createFoundItem({ characterName: 'Sorc' })]);

      // Assert
      expect(broadcastToRenderers).toHaveBeenCalledTimes(1);
      expect(broadcastToRenderers).toHaveBeenCalledWith(
        'grail-progress-updated',
        expect.objectContaining({ firstTimeDiscovery: true }),
      );
    });

    it('If the item was already found by another character, Then one generic progress update is broadcast', () => {
      // Arrange
      service.recordSaveFile(sorceressSaveFile('Other').build(), [
        createFoundItem({ characterName: 'Other' }),
      ]);
      broadcastToRenderers.mockClear();
      const saveFile = sorceressSaveFile('Sorc').build();

      // Act
      service.recordSaveFile(saveFile, [createFoundItem({ characterName: 'Sorc' })]);

      // Assert
      expect(broadcastToRenderers).toHaveBeenCalledTimes(1);
      expect(broadcastToRenderers).toHaveBeenCalledWith('grail-progress-updated');
    });
  });

  describe('If one found item cannot be written', () => {
    it('Then the other items and the character are still recorded', () => {
      // Arrange
      const saveFile = sorceressSaveFile('Sorc').build();
      const unknownItem = createFoundItem({ grailItemId: 'not-in-items-table' });

      // Act
      service.recordSaveFile(saveFile, [unknownItem, createFoundItem()]);

      // Assert
      expect(characters.getAllCharacters(ctx)).toHaveLength(1);
      expect(progress.getAllProgress(ctx)).toEqual([expect.objectContaining({ itemId: 'shako' })]);
      expect(consoleError).toHaveBeenCalledWith(
        '[GrailProgressService.recordFoundItem]',
        expect.any(Error),
        { item: 'not-in-items-table', grailItemId: 'not-in-items-table' },
      );
    });
  });

  describe('If a grail item is found during an active run', () => {
    beforeEach(() => {
      rawDb.exec(`
        INSERT INTO characters (id, name, character_class) VALUES ('char-runner', 'Runner', 'sorceress');
        INSERT INTO sessions (id, start_time) VALUES ('session-1', '2024-01-01T10:00:00.000Z');
        INSERT INTO runs (id, session_id, character_id, run_number, start_time)
          VALUES ('run-1', 'session-1', 'char-runner', 1, '2024-01-01T10:00:00.000Z');
      `);
      runTracker.getActiveRun.mockReturnValue(activeRun);
    });

    it('Then run-item-added is emitted after the progress and run item are committed', () => {
      // Arrange
      const saveFile = sorceressSaveFile('Sorc').build();
      const runItemsWhenAnnounced: unknown[] = [];
      eventBus.on('run-item-added', () => {
        runItemsWhenAnnounced.push(...runItems.getRunItems(ctx, 'run-1'));
      });

      // Act
      service.recordSaveFile(saveFile, [createFoundItem()]);

      // Assert
      const [storedProgress] = progress.getAllProgress(ctx);
      expect(runItemsWhenAnnounced).toEqual([
        expect.objectContaining({ runId: 'run-1', grailProgressId: storedProgress.id }),
      ]);
    });

    it('If the run item of one find cannot be written, Then that find is rolled back and not announced', () => {
      // Arrange
      rawDb
        .prepare(
          `INSERT INTO items (id, name, type, category, sub_category, treasure_class, ethereal_type)
           VALUES ('andariels', 'Andariel''s Visage', 'unique', 'armor', 'helms', 'elite', 'optional')`,
        )
        .run();
      const saveFile = sorceressSaveFile('Sorc').build();
      const addRunItem = database.addRunItem;
      database.addRunItem = (runItem) => {
        if (runItem.grailProgressId?.includes('shako')) {
          throw new Error('run item write failed');
        }
        addRunItem(runItem);
      };
      const announcedRunItems: unknown[] = [];
      eventBus.on('run-item-added', (event) => {
        announcedRunItems.push(event);
      });

      // Act
      service.recordSaveFile(saveFile, [
        createFoundItem({ grailItemId: 'shako' }),
        createFoundItem({ grailItemId: 'andariels' }),
      ]);

      // Assert
      expect(progress.getAllProgress(ctx)).toEqual([
        expect.objectContaining({ itemId: 'andariels' }),
      ]);
      expect(runItems.getRunItems(ctx, 'run-1')).toEqual([
        expect.objectContaining({ grailProgressId: progress.getAllProgress(ctx)[0].id }),
      ]);
      expect(characters.getAllCharacters(ctx).map(({ name }) => name)).toContain('Sorc');
      expect(announcedRunItems).toHaveLength(1);
      expect(broadcastToRenderers).toHaveBeenCalledTimes(1);
      expect(broadcastToRenderers).toHaveBeenCalledWith(
        'grail-progress-updated',
        expect.objectContaining({ progress: expect.objectContaining({ itemId: 'andariels' }) }),
      );
    });

    it('If the find is silent, Then no run item is added', () => {
      // Arrange
      const saveFile = sorceressSaveFile('Sorc').build();

      // Act
      service.recordSaveFile(saveFile, [createFoundItem({ silent: true })]);

      // Assert
      expect(runItems.getRunItems(ctx, 'run-1')).toEqual([]);
    });
  });
});

describe('When the progress of found items is announced', () => {
  function createDependencies() {
    const database = {
      addRunItem: vi.fn(),
      getCharacterByName: vi.fn(),
      getCharacterBySaveFilePath: vi.fn(),
      getProgressByItem: vi.fn(() => []),
      transaction: vi.fn((fn: () => unknown) => fn()),
      upsertCharacter: vi.fn(),
      upsertProgress: vi.fn(),
    };
    const eventBus = { emit: vi.fn() };
    const runTracker = { getActiveRun: vi.fn<() => Run | null>(() => null) };
    const broadcastToRenderers = vi.fn();
    const service = new GrailProgressService({
      database: database as unknown as GrailProgressDatabase,
      eventBus: eventBus as unknown as EventBus,
      runTracker,
      broadcastToRenderers: broadcastToRenderers as unknown as BroadcastToRenderers,
    });
    return { service, database, eventBus, runTracker, broadcastToRenderers };
  }

  const saveFile = D2SaveFileBuilder.new().withName('Sorc').build();
  const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();

  describe('If no character has found the item before', () => {
    it('Then a first-time discovery is broadcast with the new progress', () => {
      // Arrange
      const { service, database, broadcastToRenderers } = createDependencies();
      database.getCharacterByName.mockReturnValue(character);

      // Act
      service.recordSaveFile(saveFile, [createFoundItem()]);

      // Assert
      expect(broadcastToRenderers).toHaveBeenCalledTimes(1);
      expect(broadcastToRenderers).toHaveBeenCalledWith(
        'grail-progress-updated',
        expect.objectContaining({
          character: expect.objectContaining({ id: 'char-1' }),
          progress: expect.objectContaining({ characterId: 'char-1', itemId: 'shako' }),
          autoDetected: true,
          firstTimeDiscovery: true,
        }),
      );
    });
  });

  describe('If another character has already found the item', () => {
    it('Then the progress update is broadcast without discovery details', () => {
      // Arrange
      const { service, database, broadcastToRenderers } = createDependencies();
      database.getCharacterByName.mockReturnValue(character);
      database.getProgressByItem.mockReturnValue([
        GrailProgressBuilder.new().withCharacterId('char-2').withItemId('shako').build(),
      ] as never);

      // Act
      service.recordSaveFile(saveFile, [createFoundItem()]);

      // Assert
      expect(broadcastToRenderers).toHaveBeenCalledTimes(1);
      expect(broadcastToRenderers).toHaveBeenCalledWith('grail-progress-updated');
    });
  });

  describe('If the item is found for the first time during a silent scan', () => {
    it('Then the progress update is broadcast without discovery details', () => {
      // Arrange
      const { service, database, broadcastToRenderers } = createDependencies();
      database.getCharacterByName.mockReturnValue(character);

      // Act
      service.recordSaveFile(saveFile, [createFoundItem({ silent: true })]);

      // Assert
      expect(broadcastToRenderers).toHaveBeenCalledTimes(1);
      expect(broadcastToRenderers).toHaveBeenCalledWith('grail-progress-updated');
    });
  });

  describe('If the transaction fails', () => {
    it('Then nothing is announced', () => {
      // Arrange
      const { service, database, eventBus, runTracker, broadcastToRenderers } =
        createDependencies();
      runTracker.getActiveRun.mockReturnValue(activeRun as never);
      database.transaction.mockImplementation(() => {
        throw new Error('database is locked');
      });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      // Act
      service.recordSaveFile(saveFile, [createFoundItem()]);

      // Assert
      expect(eventBus.emit).not.toHaveBeenCalled();
      expect(broadcastToRenderers).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('Then the lost write is surfaced to the user', () => {
      // Arrange
      const { service, database } = createDependencies();
      database.transaction.mockImplementation(() => {
        throw new Error('database is locked');
      });
      const forwardError = vi.fn();
      setErrorForwarder(forwardError);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      try {
        // Act
        service.recordSaveFile(saveFile, [createFoundItem()]);

        // Assert
        expect(forwardError).toHaveBeenCalledWith(
          expect.objectContaining({
            service: 'GrailProgressService',
            code: 'databaseWriteFailed',
          }),
        );
      } finally {
        consoleError.mockRestore();
        setErrorForwarder(() => {
          /* intentionally empty */
        });
      }
    });
  });

  describe('If a duplicate find is added to the active run', () => {
    it('Then the run item reuses the persisted auto-detected progress', () => {
      // Arrange
      const { service, database, runTracker } = createDependencies();
      const persistedProgress = GrailProgressBuilder.new()
        .withId('existing-progress')
        .withCharacterId('char-1')
        .withItemId('shako')
        .asNormal()
        .withManuallyAdded(false)
        .build();
      database.getCharacterByName.mockReturnValue(character);
      database.getProgressByItem.mockReturnValue([persistedProgress] as never);
      runTracker.getActiveRun.mockReturnValue(activeRun as never);

      // Act
      service.recordSaveFile(saveFile, [createFoundItem()]);

      // Assert
      expect(database.addRunItem).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run-1', grailProgressId: 'existing-progress' }),
      );
    });

    it('If the persisted progress was added manually, Then the run item uses the new progress', () => {
      // Arrange
      const { service, database, runTracker } = createDependencies();
      const manualProgress = GrailProgressBuilder.new()
        .withId('manual-progress')
        .withCharacterId('char-1')
        .withItemId('shako')
        .asNormal()
        .withManuallyAdded(true)
        .build();
      database.getCharacterByName.mockReturnValue(character);
      database.getProgressByItem.mockReturnValue([manualProgress] as never);
      runTracker.getActiveRun.mockReturnValue(activeRun as never);

      // Act
      service.recordSaveFile(saveFile, [createFoundItem()]);

      // Assert
      const [newProgress] = database.upsertProgress.mock.calls[0] as unknown as [{ id: string }];
      expect(newProgress.id).not.toBe('manual-progress');
      expect(database.addRunItem).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run-1', grailProgressId: newProgress.id }),
      );
    });
  });

  describe('If an item is found in a modern shared stash without a character row', () => {
    it.each([
      ['Modern Shared Stash Softcore', false],
      ['Modern Shared Stash Hardcore', true],
    ])('Then %s is stored as a shared_stash character (hardcore: %s)', (stashName, hardcore) => {
      // Arrange
      const { service, database } = createDependencies();
      const stashFile = D2SaveFileBuilder.new().withName('Other').build();
      database.getCharacterBySaveFilePath.mockReturnValue(
        CharacterBuilder.new().withName('Other').build(),
      );

      // Act
      service.recordSaveFile(stashFile, [createFoundItem({ characterName: stashName })]);

      // Assert
      expect(database.upsertCharacter).toHaveBeenCalledWith(
        expect.objectContaining({ name: stashName, characterClass: 'shared_stash', hardcore }),
      );
    });
  });
});

describe('When the grail items are loaded into item detection', () => {
  function createItemDetection() {
    return { setGrailItems: vi.fn(), initializeFromDatabase: vi.fn() };
  }

  it('Then the detection service receives the grail items and the existing progress', () => {
    // Arrange
    const itemDetection = createItemDetection();
    const items = HolyGrailItemBuilder.new().withId('shako').buildMany(1);
    const existingProgress = GrailProgressBuilder.new().withItemId('shako').buildMany(1);
    const database = {
      getAllItems: vi.fn(() => items),
      getAllProgress: vi.fn(() => existingProgress),
    };

    // Act
    loadGrailItemsIntoDetection(itemDetection, database);

    // Assert
    expect(itemDetection.setGrailItems).toHaveBeenCalledWith(items);
    expect(itemDetection.initializeFromDatabase).toHaveBeenCalledWith(existingProgress);
  });

  it('If the database cannot be read, Then the error is logged instead of thrown', () => {
    // Arrange
    const itemDetection = createItemDetection();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const database = {
      getAllItems: vi.fn(() => {
        throw new Error('Database error');
      }),
      getAllProgress: vi.fn(() => []),
    };

    // Act
    const load = () => loadGrailItemsIntoDetection(itemDetection, database);

    // Assert
    expect(load).not.toThrow();
    expect(consoleError).toHaveBeenCalled();
    expect(itemDetection.initializeFromDatabase).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
