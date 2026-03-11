import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type SaveFileEditorModule = typeof import('./saveFileEditor');

let mockReadFile: ReturnType<typeof vi.fn>;
let mockWriteFile: ReturnType<typeof vi.fn>;
let mockD2sRead: ReturnType<typeof vi.fn>;
let mockD2sWrite: ReturnType<typeof vi.fn>;
let mockD2stashRead: ReturnType<typeof vi.fn>;
let mockD2stashWrite: ReturnType<typeof vi.fn>;
let mockReadD2iMetadata: ReturnType<typeof vi.fn>;
let removeItemFromSaveFile: SaveFileEditorModule['removeItemFromSaveFile'];
let addItemToSaveFile: SaveFileEditorModule['addItemToSaveFile'];
let moveItemBetweenSaveFiles: SaveFileEditorModule['moveItemBetweenSaveFiles'];

const equipValidationConstantData = {
  other_items: {
    amu: { c: ['amulet'] },
    rin: { c: ['ring'] },
  },
  armor_items: {
    hlm: { c: ['helm'] },
    glv: { c: ['gloves'] },
    bts: { c: ['boots'] },
    blt: { c: ['belt'] },
    arm: { c: ['armor'] },
    buc: { c: ['shield'] },
    ama: { c: ['amazon item', 'helm'] },
  },
  weapon_items: {
    one: { c: ['weapon', 'sword'], mind: 3, maxd: 6 },
    two: { c: ['weapon', 'sword'], min2d: 8, max2d: 12 },
    clw: { c: ['weapon', 'hand to hand'], mind: 5, maxd: 11 },
  },
};

const constants96 = { version: 96, ...equipValidationConstantData };
const constants99 = { version: 99, ...equipValidationConstantData };

beforeAll(async () => {
  mockReadFile = vi.fn();
  mockWriteFile = vi.fn();
  mockD2sRead = vi.fn();
  mockD2sWrite = vi.fn();
  mockD2stashRead = vi.fn();
  mockD2stashWrite = vi.fn();
  mockReadD2iMetadata = vi.fn();

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

  vi.doMock('./stashFormat', () => ({
    readD2iMetadata: mockReadD2iMetadata,
  }));

  const module = await import('./saveFileEditor');
  removeItemFromSaveFile = module.removeItemFromSaveFile;
  addItemToSaveFile = module.addItemToSaveFile;
  moveItemBetweenSaveFiles = module.moveItemBetweenSaveFiles;
});

type D2sItem = {
  id?: unknown;
};

type D2sData = {
  header?: {
    class?: string;
  };
  items: D2sItem[];
  corpse_items: D2sItem[];
  merc_items: D2sItem[];
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
  items: D2sItem[] = [],
  corpseItems: D2sItem[] = [],
  mercItems: D2sItem[] = [],
  characterClass = 'sorceress',
): D2sData {
  return {
    header: {
      class: characterClass,
    },
    items: [...items],
    corpse_items: [...corpseItems],
    merc_items: [...mercItems],
  };
}

function makeD2sItem(
  id: number,
  code: string,
  overrides: Record<string, unknown> = {},
): import('@dschu012/d2s').types.IItem {
  return {
    id,
    code,
    type: code,
    ...overrides,
  } as unknown as import('@dschu012/d2s').types.IItem;
}

function addItemToEquippedSlot(params: {
  item: import('@dschu012/d2s').types.IItem;
  targetSlotId: number;
  characterClass?: string;
  existingItems?: D2sItem[];
}) {
  const d2sData = makeD2sData(
    params.existingItems ?? [],
    [],
    [],
    params.characterClass ?? 'sorceress',
  );
  mockD2sRead.mockResolvedValue(d2sData);
  const addPromise = addItemToSaveFile(
    '/path/to/char.d2s',
    'd2s',
    params.item,
    'equipped',
    undefined,
    undefined,
    undefined,
    params.targetSlotId,
  );

  return {
    d2sData,
    addPromise,
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
    mockReadD2iMetadata.mockReturnValue({
      version: 99,
      hardcore: false,
      sectors: [],
    });
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

    it('Then rejects modern v105 stash writes with MODERN_STASH_READ_ONLY', async () => {
      // Arrange
      mockReadD2iMetadata.mockReturnValue({
        version: 105,
        hardcore: false,
        sectors: [],
      });

      // Act & Assert
      await expect(removeItemFromSaveFile('/path/to/file.d2i', 'd2i', 11)).rejects.toThrow(
        'MODERN_STASH_READ_ONLY',
      );
      expect(mockD2stashRead).not.toHaveBeenCalled();
      expect(mockD2stashWrite).not.toHaveBeenCalled();
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
    mockReadD2iMetadata.mockReturnValue({
      version: 99,
      hardcore: false,
      sectors: [],
    });
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
      expect(d2sData.items[0]).toEqual(
        expect.objectContaining({
          id: 123,
          location_id: 0,
          alt_position_id: 1,
        }),
      );
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
      expect(d2sData.merc_items[0]).toEqual(
        expect.objectContaining({
          id: 123,
          location_id: 3,
          alt_position_id: 0,
        }),
      );
      expect(d2sData.items).toHaveLength(0);
    });
  });

  describe('If sourceFileType is d2s and target location is inventory with coordinates', () => {
    it('Then item location metadata and target coordinates are rewritten for inventory placement', async () => {
      // Arrange
      const d2sData = makeD2sData([]);
      mockD2sRead.mockResolvedValue(d2sData);
      const stashItem = {
        id: 987,
        location: 'stash',
        location_id: 0,
        alt_position_id: 5,
        position_x: 6,
        position_y: 5,
      } as unknown as import('@dschu012/d2s').types.IItem;

      // Act
      await addItemToSaveFile('/path/to/char.d2s', 'd2s', stashItem, 'inventory', undefined, 2, 1);

      // Assert
      expect(d2sData.items[0]).toEqual(
        expect.objectContaining({
          id: 987,
          location_id: 0,
          alt_position_id: 1,
          position_x: 2,
          position_y: 1,
        }),
      );
    });
  });

  describe('If sourceFileType is d2s and target location is equipped', () => {
    it('Then the equipped slot id is set for equipped placement', async () => {
      // Arrange
      const d2sData = makeD2sData([]);
      mockD2sRead.mockResolvedValue(d2sData);
      const equippedHelm = makeD2sItem(700, 'hlm');

      // Act
      await addItemToSaveFile(
        '/path/to/char.d2s',
        'd2s',
        equippedHelm,
        'equipped',
        undefined,
        5,
        2,
        1,
      );

      // Assert
      expect(d2sData.items[0]).toEqual(
        expect.objectContaining({
          id: 700,
          location_id: 1,
          equipped_id: 1,
          position_x: 0,
          position_y: 0,
        }),
      );
    });

    it('Then allows gloves in gloves slot', async () => {
      // Arrange
      const gloves = makeD2sItem(711, 'glv');
      const { d2sData, addPromise } = addItemToEquippedSlot({
        item: gloves,
        targetSlotId: 10,
      });

      // Act
      await addPromise;

      // Assert
      expect(d2sData.items[0]).toEqual(
        expect.objectContaining({
          id: 711,
          equipped_id: 10,
        }),
      );
    });

    it('Then rejects gloves outside the gloves slot', async () => {
      // Arrange
      const gloves = makeD2sItem(712, 'glv');
      const { addPromise } = addItemToEquippedSlot({
        item: gloves,
        targetSlotId: 1,
      });

      // Act & Assert
      await expect(addPromise).rejects.toThrow('EQUIP_VALIDATION:INVALID_SLOT');
      expect(mockD2sWrite).not.toHaveBeenCalled();
    });

    it('Then allows helms in helm slot', async () => {
      // Arrange
      const helm = makeD2sItem(713, 'hlm');
      const { d2sData, addPromise } = addItemToEquippedSlot({
        item: helm,
        targetSlotId: 1,
      });

      // Act
      await addPromise;

      // Assert
      expect(d2sData.items[0]).toEqual(
        expect.objectContaining({
          id: 713,
          equipped_id: 1,
        }),
      );
    });

    it('Then rejects helms outside the helm slot', async () => {
      // Arrange
      const helm = makeD2sItem(714, 'hlm');
      const { addPromise } = addItemToEquippedSlot({
        item: helm,
        targetSlotId: 3,
      });

      // Act & Assert
      await expect(addPromise).rejects.toThrow('EQUIP_VALIDATION:INVALID_SLOT');
      expect(mockD2sWrite).not.toHaveBeenCalled();
    });

    it('Then allows rings in both ring slots', async () => {
      // Arrange
      const leftRing = makeD2sItem(715, 'rin');
      const rightRing = makeD2sItem(716, 'rin');
      const leftRingAdd = addItemToEquippedSlot({
        item: leftRing,
        targetSlotId: 6,
      });

      // Act
      await leftRingAdd.addPromise;
      const rightRingAdd = addItemToEquippedSlot({
        item: rightRing,
        targetSlotId: 7,
      });
      await rightRingAdd.addPromise;

      // Assert
      expect(leftRingAdd.d2sData.items[0]).toEqual(
        expect.objectContaining({
          id: 715,
          equipped_id: 6,
        }),
      );
      expect(rightRingAdd.d2sData.items[0]).toEqual(
        expect.objectContaining({
          id: 716,
          equipped_id: 7,
        }),
      );
    });

    it('Then rejects rings outside ring slots', async () => {
      // Arrange
      const ring = makeD2sItem(717, 'rin');
      const { addPromise } = addItemToEquippedSlot({
        item: ring,
        targetSlotId: 2,
      });

      // Act & Assert
      await expect(addPromise).rejects.toThrow('EQUIP_VALIDATION:INVALID_SLOT');
      expect(mockD2sWrite).not.toHaveBeenCalled();
    });

    it('Then allows amulets in amulet slot', async () => {
      // Arrange
      const amulet = makeD2sItem(718, 'amu');
      const { d2sData, addPromise } = addItemToEquippedSlot({
        item: amulet,
        targetSlotId: 2,
      });

      // Act
      await addPromise;

      // Assert
      expect(d2sData.items[0]).toEqual(
        expect.objectContaining({
          id: 718,
          equipped_id: 2,
        }),
      );
    });

    it('Then rejects amulets outside amulet slot', async () => {
      // Arrange
      const amulet = makeD2sItem(719, 'amu');
      const { addPromise } = addItemToEquippedSlot({
        item: amulet,
        targetSlotId: 6,
      });

      // Act & Assert
      await expect(addPromise).rejects.toThrow('EQUIP_VALIDATION:INVALID_SLOT');
      expect(mockD2sWrite).not.toHaveBeenCalled();
    });

    it('Then allows boots in boots slot', async () => {
      // Arrange
      const boots = makeD2sItem(720, 'bts');
      const { d2sData, addPromise } = addItemToEquippedSlot({
        item: boots,
        targetSlotId: 9,
      });

      // Act
      await addPromise;

      // Assert
      expect(d2sData.items[0]).toEqual(
        expect.objectContaining({
          id: 720,
          equipped_id: 9,
        }),
      );
    });

    it('Then rejects boots outside boots slot', async () => {
      // Arrange
      const boots = makeD2sItem(721, 'bts');
      const { addPromise } = addItemToEquippedSlot({
        item: boots,
        targetSlotId: 8,
      });

      // Act & Assert
      await expect(addPromise).rejects.toThrow('EQUIP_VALIDATION:INVALID_SLOT');
      expect(mockD2sWrite).not.toHaveBeenCalled();
    });

    it('Then allows belts in belt slot', async () => {
      // Arrange
      const belt = makeD2sItem(722, 'blt');
      const { d2sData, addPromise } = addItemToEquippedSlot({
        item: belt,
        targetSlotId: 8,
      });

      // Act
      await addPromise;

      // Assert
      expect(d2sData.items[0]).toEqual(
        expect.objectContaining({
          id: 722,
          equipped_id: 8,
        }),
      );
    });

    it('Then rejects belts outside belt slot', async () => {
      // Arrange
      const belt = makeD2sItem(723, 'blt');
      const { addPromise } = addItemToEquippedSlot({
        item: belt,
        targetSlotId: 9,
      });

      // Act & Assert
      await expect(addPromise).rejects.toThrow('EQUIP_VALIDATION:INVALID_SLOT');
      expect(mockD2sWrite).not.toHaveBeenCalled();
    });

    it('Then allows body armor in armor slot', async () => {
      // Arrange
      const armor = makeD2sItem(724, 'arm');
      const { d2sData, addPromise } = addItemToEquippedSlot({
        item: armor,
        targetSlotId: 3,
      });

      // Act
      await addPromise;

      // Assert
      expect(d2sData.items[0]).toEqual(
        expect.objectContaining({
          id: 724,
          equipped_id: 3,
        }),
      );
    });

    it('Then rejects body armor outside armor slot', async () => {
      // Arrange
      const armor = makeD2sItem(725, 'arm');
      const { addPromise } = addItemToEquippedSlot({
        item: armor,
        targetSlotId: 1,
      });

      // Act & Assert
      await expect(addPromise).rejects.toThrow('EQUIP_VALIDATION:INVALID_SLOT');
      expect(mockD2sWrite).not.toHaveBeenCalled();
    });

    it('Then rejects unknown and unclassified items from equipped slots', async () => {
      // Arrange
      const unknownItem = makeD2sItem(726, 'zzz');
      const { addPromise } = addItemToEquippedSlot({
        item: unknownItem,
        targetSlotId: 1,
      });

      // Act & Assert
      await expect(addPromise).rejects.toThrow('EQUIP_VALIDATION:INVALID_SLOT');
      expect(mockD2sWrite).not.toHaveBeenCalled();
    });

    it('Then rejects class-specific items when class does not match', async () => {
      // Arrange
      const d2sData = makeD2sData([], [], [], 'sorceress');
      mockD2sRead.mockResolvedValue(d2sData);
      const amazonOnlyHelm = makeD2sItem(701, 'ama');

      // Act
      const addPromise = addItemToSaveFile(
        '/path/to/char.d2s',
        'd2s',
        amazonOnlyHelm,
        'equipped',
        undefined,
        undefined,
        undefined,
        1,
      );

      // Assert
      await expect(addPromise).rejects.toThrow('EQUIP_VALIDATION:CLASS_RESTRICTED');
      expect(mockD2sWrite).not.toHaveBeenCalled();
    });

    it('Then allows class-specific items when class matches', async () => {
      // Arrange
      const d2sData = makeD2sData([], [], [], 'amazon');
      mockD2sRead.mockResolvedValue(d2sData);
      const amazonOnlyHelm = makeD2sItem(702, 'ama');

      // Act
      await addItemToSaveFile(
        '/path/to/char.d2s',
        'd2s',
        amazonOnlyHelm,
        'equipped',
        undefined,
        undefined,
        undefined,
        1,
      );

      // Assert
      expect(d2sData.items[0]).toEqual(
        expect.objectContaining({
          id: 702,
          location_id: 1,
          equipped_id: 1,
        }),
      );
    });

    it('Then rejects two-handed-required weapon when offhand is occupied', async () => {
      // Arrange
      const occupiedOffhand = makeD2sItem(703, 'buc', { equipped_id: 5 });
      const d2sData = makeD2sData([occupiedOffhand], [], [], 'paladin');
      mockD2sRead.mockResolvedValue(d2sData);
      const twoHandedSword = makeD2sItem(704, 'two');

      // Act
      const addPromise = addItemToSaveFile(
        '/path/to/char.d2s',
        'd2s',
        twoHandedSword,
        'equipped',
        undefined,
        undefined,
        undefined,
        4,
      );

      // Assert
      await expect(addPromise).rejects.toThrow('EQUIP_VALIDATION:TWO_HANDED_OFFHAND_OCCUPIED');
      expect(mockD2sWrite).not.toHaveBeenCalled();
    });

    it('Then rejects two-handed-required weapon when dropping to left hand', async () => {
      // Arrange
      const d2sData = makeD2sData([], [], [], 'paladin');
      mockD2sRead.mockResolvedValue(d2sData);
      const twoHandedSword = makeD2sItem(705, 'two');

      // Act
      const addPromise = addItemToSaveFile(
        '/path/to/char.d2s',
        'd2s',
        twoHandedSword,
        'equipped',
        undefined,
        undefined,
        undefined,
        5,
      );

      // Assert
      await expect(addPromise).rejects.toThrow('EQUIP_VALIDATION:TWO_HANDED_REQUIRES_RIGHT_HAND');
      expect(mockD2sWrite).not.toHaveBeenCalled();
    });

    it('Then allows barbarian to equip two-handed swords in offhand', async () => {
      // Arrange
      const d2sData = makeD2sData([], [], [], 'barbarian');
      mockD2sRead.mockResolvedValue(d2sData);
      const twoHandedSword = makeD2sItem(706, 'two');

      // Act
      await addItemToSaveFile(
        '/path/to/char.d2s',
        'd2s',
        twoHandedSword,
        'equipped',
        undefined,
        undefined,
        undefined,
        5,
      );

      // Assert
      expect(d2sData.items[0]).toEqual(
        expect.objectContaining({
          id: 706,
          equipped_id: 5,
        }),
      );
    });

    it('Then allows assassin claws in offhand', async () => {
      // Arrange
      const d2sData = makeD2sData([], [], [], 'assassin');
      mockD2sRead.mockResolvedValue(d2sData);
      const claw = makeD2sItem(707, 'clw');

      // Act
      await addItemToSaveFile(
        '/path/to/char.d2s',
        'd2s',
        claw,
        'equipped',
        undefined,
        undefined,
        undefined,
        5,
      );

      // Assert
      expect(d2sData.items[0]).toEqual(
        expect.objectContaining({
          id: 707,
          equipped_id: 5,
        }),
      );
    });

    it('Then rejects non-barbarian and non-assassin offhand weapon drops', async () => {
      // Arrange
      const d2sData = makeD2sData([], [], [], 'sorceress');
      mockD2sRead.mockResolvedValue(d2sData);
      const oneHandSword = makeD2sItem(708, 'one');

      // Act
      const addPromise = addItemToSaveFile(
        '/path/to/char.d2s',
        'd2s',
        oneHandSword,
        'equipped',
        undefined,
        undefined,
        undefined,
        5,
      );

      // Assert
      await expect(addPromise).rejects.toThrow('EQUIP_VALIDATION:OFFHAND_WEAPON_RESTRICTED');
      expect(mockD2sWrite).not.toHaveBeenCalled();
    });

    it('Then rejects equip moves when target slot is already occupied', async () => {
      // Arrange
      const occupiedAmulet = makeD2sItem(709, 'amu', { equipped_id: 2 });
      const d2sData = makeD2sData([occupiedAmulet], [], [], 'sorceress');
      mockD2sRead.mockResolvedValue(d2sData);
      const targetAmulet = makeD2sItem(710, 'amu');

      // Act
      const addPromise = addItemToSaveFile(
        '/path/to/char.d2s',
        'd2s',
        targetAmulet,
        'equipped',
        undefined,
        undefined,
        undefined,
        2,
      );

      // Assert
      await expect(addPromise).rejects.toThrow('EQUIP_VALIDATION:TARGET_SLOT_OCCUPIED');
      expect(mockD2sWrite).not.toHaveBeenCalled();
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

  describe('If sourceFileType is d2i and format is modern v105', () => {
    it('Then it throws MODERN_STASH_READ_ONLY before mutating', async () => {
      // Arrange
      mockReadD2iMetadata.mockReturnValue({
        version: 105,
        hardcore: false,
        sectors: [],
      });

      // Act & Assert
      await expect(
        addItemToSaveFile('/path/to/file.d2i', 'd2i', testItem, 'stash', 0),
      ).rejects.toThrow('MODERN_STASH_READ_ONLY');
      expect(mockD2stashRead).not.toHaveBeenCalled();
      expect(mockD2stashWrite).not.toHaveBeenCalled();
    });
  });
});

describe('When moveItemBetweenSaveFiles is called', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadD2iMetadata.mockReturnValue({
      version: 99,
      hardcore: false,
      sectors: [],
    });
    mockReadFile.mockResolvedValue(fakeBuffer);
    mockWriteFile.mockResolvedValue(undefined);
    mockD2sWrite.mockResolvedValue(fakeResultBuffer);
    mockD2stashWrite.mockResolvedValue(fakeResultBuffer);
  });

  describe('If source and target are the same d2s file', () => {
    it('Then it rewrites the item position in a single save-file write', async () => {
      // Arrange
      const sourceItem = {
        id: 77,
        location_id: 0,
        alt_position_id: 1,
        position_x: 0,
        position_y: 0,
      } as unknown as import('@dschu012/d2s').types.IItem;
      const d2sData = makeD2sData([sourceItem], [], []);
      mockD2sRead.mockResolvedValue(d2sData);

      // Act
      await moveItemBetweenSaveFiles({
        sourceFilePath: '/path/to/char.d2s',
        sourceFileType: 'd2s',
        sourceItemId: 77,
        targetFilePath: '/path/to/char.d2s',
        targetFileType: 'd2s',
        targetLocationContext: 'inventory',
        targetGridX: 3,
        targetGridY: 2,
      });

      // Assert
      expect(mockD2sWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              id: 77,
              location_id: 0,
              alt_position_id: 1,
              position_x: 3,
              position_y: 2,
            }),
          ],
        }),
      );
    });
  });

  describe('If source and target are different files', () => {
    it('Then it writes to target before removing from source', async () => {
      // Arrange
      const sourceItem = {
        id: 88,
        location_id: 0,
        alt_position_id: 1,
        position_x: 1,
        position_y: 1,
      } as unknown as import('@dschu012/d2s').types.IItem;
      const sourceData = makeD2sData([sourceItem], [], []);
      const targetData = makeD2sData([], [], []);
      mockD2sRead.mockResolvedValueOnce(sourceData).mockResolvedValueOnce(targetData);

      // Act
      await moveItemBetweenSaveFiles({
        sourceFilePath: '/path/to/source.d2s',
        sourceFileType: 'd2s',
        sourceItemId: 88,
        targetFilePath: '/path/to/target.d2s',
        targetFileType: 'd2s',
        targetLocationContext: 'stash',
        targetGridX: 7,
        targetGridY: 4,
      });

      // Assert
      expect(mockWriteFile).toHaveBeenNthCalledWith(
        1,
        '/path/to/target.d2s',
        Buffer.from(fakeResultBuffer),
      );
      expect(mockWriteFile).toHaveBeenNthCalledWith(
        2,
        '/path/to/source.d2s',
        Buffer.from(fakeResultBuffer),
      );
    });

    it('Then it rejects modern shared stash moves before writing either file', async () => {
      // Arrange
      mockReadD2iMetadata.mockReturnValue({
        version: 105,
        hardcore: false,
        sectors: [],
      });

      // Act & Assert
      await expect(
        moveItemBetweenSaveFiles({
          sourceFilePath: '/path/to/source.d2i',
          sourceFileType: 'd2i',
          sourceItemId: 88,
          targetFilePath: '/path/to/target.d2s',
          targetFileType: 'd2s',
          targetLocationContext: 'inventory',
          targetGridX: 0,
          targetGridY: 0,
        }),
      ).rejects.toThrow('MODERN_STASH_READ_ONLY');
      expect(mockD2sWrite).not.toHaveBeenCalled();
      expect(mockD2stashWrite).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });
});
