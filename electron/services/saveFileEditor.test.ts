import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type SaveFileEditorModule = typeof import('./saveFileEditor');

let mockReadFile: ReturnType<typeof vi.fn>;
let mockWriteFile: ReturnType<typeof vi.fn>;
let mockD2sRead: ReturnType<typeof vi.fn>;
let mockD2sWrite: ReturnType<typeof vi.fn>;
let mockD2stashRead: ReturnType<typeof vi.fn>;
let mockD2stashWrite: ReturnType<typeof vi.fn>;
let removeItemFromSaveFile: SaveFileEditorModule['removeItemFromSaveFile'];
let addItemToSaveFile: SaveFileEditorModule['addItemToSaveFile'];

const constants96 = { version: 96 };
const constants99 = { version: 99 };

beforeAll(async () => {
  mockReadFile = vi.fn();
  mockWriteFile = vi.fn();
  mockD2sRead = vi.fn();
  mockD2sWrite = vi.fn();
  mockD2stashRead = vi.fn();
  mockD2stashWrite = vi.fn();

  vi.resetModules();

  vi.doMock('node:fs/promises', () => ({
    default: { readFile: mockReadFile, writeFile: mockWriteFile },
    readFile: mockReadFile,
    writeFile: mockWriteFile,
  }));

  vi.doMock('@dschu012/d2s', () => ({
    read: mockD2sRead,
    write: mockD2sWrite,
  }));

  vi.doMock('@dschu012/d2s/lib/d2/stash', () => ({
    read: mockD2stashRead,
    write: mockD2stashWrite,
  }));

  vi.doMock('@dschu012/d2s/lib/data/versions/96_constant_data', () => ({
    constants: constants96,
  }));

  vi.doMock('@dschu012/d2s/lib/data/versions/99_constant_data', () => ({
    constants: constants99,
  }));

  const module = await import('./saveFileEditor');
  removeItemFromSaveFile = module.removeItemFromSaveFile;
  addItemToSaveFile = module.addItemToSaveFile;
});

type D2sData = {
  items: { id: number }[];
  corpse_items: { id: number }[];
  merc_items: { id: number }[];
};

type StashData = {
  pages: { name: string; type: number; items: { id: number }[] }[];
  pageCount: number;
  hardcore: boolean;
  version: string;
  type: number;
  sharedGold: number;
};

function makeD2sData(
  items: { id: number }[] = [],
  corpseItems: { id: number }[] = [],
  mercItems: { id: number }[] = [],
): D2sData {
  return {
    items: [...items],
    corpse_items: [...corpseItems],
    merc_items: [...mercItems],
  };
}

function makeStashData(pages: { id: number }[][] = []): StashData {
  return {
    pages: pages.map((items) => ({ name: '', type: 0, items: [...items] })),
    pageCount: pages.length,
    hardcore: false,
    version: '99',
    type: 0,
    sharedGold: 0,
  };
}

const fakeBuffer = Buffer.from([0x01, 0x02]);
const fakeResultBuffer = new Uint8Array([0x03, 0x04]);

describe('When removeItemFromSaveFile is called', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue(fakeBuffer);
    mockWriteFile.mockResolvedValue(undefined);
    mockD2sWrite.mockResolvedValue(fakeResultBuffer);
    mockD2stashWrite.mockResolvedValue(fakeResultBuffer);
  });

  describe('If sourceFileType is d2s', () => {
    it('Then removes item with matching id from data.items and writes file', async () => {
      // Arrange
      const d2sData = makeD2sData([{ id: 42 }, { id: 99 }]);
      mockD2sRead.mockResolvedValue(d2sData);

      // Act
      await removeItemFromSaveFile('/path/to/char.d2s', 'd2s', 42);

      // Assert
      expect(mockD2sRead).toHaveBeenCalledWith(fakeBuffer);
      expect(d2sData.items).toHaveLength(1);
      expect(d2sData.items[0]?.id).toBe(99);
      expect(mockD2sWrite).toHaveBeenCalledWith(d2sData);
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/path/to/char.d2s',
        Buffer.from(fakeResultBuffer),
      );
    });
  });

  describe('If sourceFileType is d2s and item is in corpse_items', () => {
    it('Then removes item from corpse_items when found there', async () => {
      // Arrange
      const d2sData = makeD2sData([], [{ id: 7 }, { id: 8 }]);
      mockD2sRead.mockResolvedValue(d2sData);

      // Act
      await removeItemFromSaveFile('/path/to/char.d2s', 'd2s', 7);

      // Assert
      expect(d2sData.corpse_items).toHaveLength(1);
      expect(d2sData.corpse_items[0]?.id).toBe(8);
      expect(mockD2sWrite).toHaveBeenCalledWith(d2sData);
    });
  });

  describe('If sourceFileType is sss', () => {
    it('Then removes item from stash page items and writes file using constants96', async () => {
      // Arrange
      const stashData = makeStashData([[{ id: 55 }, { id: 66 }]]);
      mockD2stashRead.mockResolvedValue(stashData);

      // Act
      await removeItemFromSaveFile('/path/to/file.sss', 'sss', 55);

      // Assert
      expect(mockD2stashRead).toHaveBeenCalledWith(fakeBuffer, constants96);
      expect(stashData.pages[0]?.items).toHaveLength(1);
      expect(stashData.pages[0]?.items[0]?.id).toBe(66);
      expect(mockD2stashWrite).toHaveBeenCalledWith(stashData, constants96, 96);
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/path/to/file.sss',
        Buffer.from(fakeResultBuffer),
      );
    });
  });

  describe('If sourceFileType is d2i', () => {
    it('Then uses constants99 with version 99 when writing', async () => {
      // Arrange
      const stashData = makeStashData([[{ id: 11 }]]);
      mockD2stashRead.mockResolvedValue(stashData);

      // Act
      await removeItemFromSaveFile('/path/to/file.d2i', 'd2i', 11);

      // Assert
      expect(mockD2stashRead).toHaveBeenCalledWith(fakeBuffer, constants99);
      expect(mockD2stashWrite).toHaveBeenCalledWith(stashData, constants99, 99);
    });
  });

  describe('If item id is not found in any list', () => {
    it('Then writes file unchanged without throwing', async () => {
      // Arrange
      const d2sData = makeD2sData([{ id: 10 }]);
      mockD2sRead.mockResolvedValue(d2sData);

      // Act
      await removeItemFromSaveFile('/path/to/char.d2s', 'd2s', 999);

      // Assert
      expect(d2sData.items).toHaveLength(1);
      expect(mockD2sWrite).toHaveBeenCalledWith(d2sData);
    });
  });
});

describe('When addItemToSaveFile is called', () => {
  const testItem = { id: 123, type: 'uap' } as unknown as import('@dschu012/d2s').types.IItem;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue(fakeBuffer);
    mockWriteFile.mockResolvedValue(undefined);
    mockD2sWrite.mockResolvedValue(fakeResultBuffer);
    mockD2stashWrite.mockResolvedValue(fakeResultBuffer);
  });

  describe('If sourceFileType is d2s with inventory locationContext', () => {
    it('Then appends item to data.items and writes file', async () => {
      // Arrange
      const d2sData = makeD2sData([]);
      mockD2sRead.mockResolvedValue(d2sData);

      // Act
      await addItemToSaveFile('/path/to/char.d2s', 'd2s', testItem, 'inventory');

      // Assert
      expect(d2sData.items).toHaveLength(1);
      expect(d2sData.items[0]).toBe(testItem);
      expect(mockD2sWrite).toHaveBeenCalledWith(d2sData);
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/path/to/char.d2s',
        Buffer.from(fakeResultBuffer),
      );
    });
  });

  describe('If sourceFileType is d2s with mercenary locationContext', () => {
    it('Then appends item to merc_items and not to data.items', async () => {
      // Arrange
      const d2sData = makeD2sData([], [], []);
      mockD2sRead.mockResolvedValue(d2sData);

      // Act
      await addItemToSaveFile('/path/to/char.d2s', 'd2s', testItem, 'mercenary');

      // Assert
      expect(d2sData.merc_items).toHaveLength(1);
      expect(d2sData.merc_items[0]).toBe(testItem);
      expect(d2sData.items).toHaveLength(0);
    });
  });

  describe('If sourceFileType is sss', () => {
    it('Then appends item to the specified stash tab page', async () => {
      // Arrange
      const stashData = makeStashData([[], []]);
      mockD2stashRead.mockResolvedValue(stashData);

      // Act
      await addItemToSaveFile('/path/to/file.sss', 'sss', testItem, 'stash', 1);

      // Assert
      expect(stashData.pages[1]?.items).toHaveLength(1);
      expect(stashData.pages[1]?.items[0]).toBe(testItem);
      expect(stashData.pages[0]?.items).toHaveLength(0);
      expect(mockD2stashWrite).toHaveBeenCalledWith(stashData, constants96, 96);
    });
  });
});
