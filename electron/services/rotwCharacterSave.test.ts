import type { Database as DatabaseType } from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as characters from '../database/characters';
import { createDrizzleDb } from '../database/drizzle';
import { insertItems } from '../database/items';
import * as progress from '../database/progress';
import * as runItems from '../database/run-items';
import type { DatabaseContext } from '../database/types';
import type { BroadcastToRenderers } from '../ipc/broadcast';
import { items as catalogItems } from '../items';
import { createInMemoryDatabase, initializeDatabaseSchema } from '../test/helpers/databaseHelpers';
import {
  addItemToRotwCharacterSave,
  readModernStashItem,
  readWarlockSave,
} from '../test/helpers/rotwCharacterSave';
import { GameMode, type Item, type Run } from '../types/grail';
import { ensureD2sConstants } from './d2s/constants';
import { EventBus } from './EventBus';
import { GrailProgressService } from './grailProgressService';
import { ItemDetectionService } from './itemDetection';
import { buildSaveFileHeader } from './saveFileMonitor/saveFileFormat';
import { parseSaveContent } from './saveFileMonitor/saveFileParser';

const WARLOCK_SAVE_PATH = '/saves/Warlock.d2s';
const LAST_MODIFIED = new Date('2026-10-15T10:00:00.000Z');

function findCatalogItem(id: string): Item {
  const item = catalogItems.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`No catalog item ${id}`);
  }
  return item;
}

function parseWarlockSave(content: Buffer) {
  return parseSaveContent(
    { saveName: 'Warlock', filePath: WARLOCK_SAVE_PATH, content, extension: '.d2s' },
    () => GameMode.Both,
  );
}

describe('When a Reign of the Warlock (v105) character save is scanned', () => {
  beforeEach(() => {
    ensureD2sConstants();
  });

  describe('If the real Warlock save with its starting items is parsed', () => {
    it('Then the whole file is read and every starting item is found', async () => {
      // Arrange
      const save = readWarlockSave();

      // Act
      const result = await parseWarlockSave(save);

      // Assert
      expect(result.status).toBe('parsed');
      expect(result.items.map((item) => item.rawParsedItem.type).sort()).toEqual([
        'dgr',
        'hp1',
        'hp1',
        'hp1',
        'hp1',
        'isc',
        'tsc',
      ]);
    });
  });

  describe('If the Warlock carries a grail item', () => {
    let rawDb: DatabaseType;
    let ctx: DatabaseContext;
    let eventBus: EventBus;
    let consoleLog: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      rawDb = createInMemoryDatabase();
      initializeDatabaseSchema(rawDb);
      ctx = { rawDb, db: createDrizzleDb(rawDb), dbPath: ':memory:' };
      insertItems(ctx, [findCatalogItem('wartraveler')]);
      eventBus = new EventBus();
    });

    afterEach(() => {
      rawDb.close();
      consoleLog.mockRestore();
    });

    it('Then the item is detected and recorded as found by a stored Warlock character', async () => {
      // Arrange
      const warTraveler = await readModernStashItem('War Traveler');
      const save = await addItemToRotwCharacterSave(readWarlockSave(), warTraveler, 0, 0);
      const itemDetection = new ItemDetectionService(eventBus);
      itemDetection.setGrailItems([findCatalogItem('wartraveler')]);
      const grailProgress = new GrailProgressService({
        database: {
          addRunItem: (runItem) => runItems.addRunItem(ctx, runItem),
          getCharacterByName: (name) => characters.getCharacterByName(ctx, name),
          getCharacterBySaveFilePath: (path) => characters.getCharacterBySaveFilePath(ctx, path),
          getProgressByItem: (itemId) => progress.getProgressByItem(ctx, itemId),
          transaction: (fn) => rawDb.transaction(fn)(),
          upsertCharacter: (character) => characters.upsertCharacter(ctx, character),
          upsertProgress: (grailProgress) => progress.upsertProgress(ctx, grailProgress),
        },
        eventBus,
        runTracker: { getActiveRun: (): Run | null => null },
        broadcastToRenderers: vi.fn() as unknown as BroadcastToRenderers,
      });

      // Act
      const { items: parsedItems, status } = await parseWarlockSave(save);
      const saveFile = buildSaveFileHeader(WARLOCK_SAVE_PATH, save, LAST_MODIFIED);
      const foundItems = await itemDetection.analyzeSaveFile(saveFile, parsedItems);
      const recorded = grailProgress.recordSaveFile(saveFile, foundItems);

      // Assert
      expect(status).toBe('parsed');
      expect(foundItems.map((event) => event.grailItem.id)).toEqual(['wartraveler']);
      expect(recorded).toBe(true);
      const storedCharacters = characters.getAllCharacters(ctx);
      expect(storedCharacters).toEqual([
        expect.objectContaining({
          name: 'Warlock',
          characterClass: 'warlock',
          level: 1,
          hardcore: false,
          expansion: true,
          saveFilePath: WARLOCK_SAVE_PATH,
        }),
      ]);
      expect(progress.getAllProgress(ctx)).toEqual([
        expect.objectContaining({ characterId: storedCharacters[0].id, itemId: 'wartraveler' }),
      ]);
    });
  });
});
