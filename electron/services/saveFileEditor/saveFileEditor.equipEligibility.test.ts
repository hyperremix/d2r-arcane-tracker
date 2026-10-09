import type { Mock } from 'vitest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveEligibleEquipmentSlots } from '@/components/inventory/equipValidation';
import { EQUIPPED_SLOT_IDS, type PaperDollSlotKey } from '@/components/inventory/spatialLayout';
import { REPRESENTATIVE_ITEM_CODES } from '@/test/equipRepresentativeItems';
import { normalizeWeaponSetSlotId } from '../../utils/equipSlots';

// These tests run the real save file editor equip validation against the real d2s v99/v96 item
// tables (only file access and the d2s character read/write are mocked) and compare the slots it
// accepts with the slots the inventory browser highlights. A rule change that makes the two
// diverge, or that breaks the editor's own enforcement, fails here.

type SaveFileEditorModule = typeof import('./index');
type D2sItem = import('@dschu012/d2s').types.IItem;

let mockReadFile: ReturnType<typeof vi.fn>;
let mockWriteFile: Mock<(filePath: string, data: Buffer) => unknown>;
let mockD2sRead: ReturnType<typeof vi.fn>;
let mockD2sWrite: ReturnType<typeof vi.fn>;
let addItemToSaveFile: SaveFileEditorModule['addItemToSaveFile'];

const EQUIPPED_SLOT_ID_RANGE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

beforeAll(async () => {
  mockReadFile = vi.fn().mockResolvedValue(Buffer.from([0x01, 0x02]));
  mockWriteFile = vi.fn();
  mockD2sRead = vi.fn();
  mockD2sWrite = vi.fn().mockResolvedValue(new Uint8Array([0x03, 0x04]));

  vi.resetModules();

  vi.doMock('node:fs/promises', () => ({
    default: { readFile: mockReadFile, writeFile: mockWriteFile },
    readFile: mockReadFile,
    writeFile: mockWriteFile,
  }));
  vi.doMock('../saveFileBackup', () => ({
    backupSaveFile: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock('../../utils/atomicWrite', () => ({
    writeFileAtomic: (filePath: string, data: Buffer) => mockWriteFile(filePath, data),
  }));
  vi.doMock('@dschu012/d2s', () => ({
    read: mockD2sRead,
    write: mockD2sWrite,
    // ensureD2sConstants() only registers versions that getConstantData cannot find.
    getConstantData: vi.fn(() => ({})),
    setConstantData: vi.fn(),
  }));

  const module = await import('./index');
  addItemToSaveFile = module.addItemToSaveFile;
});

// With isolate:false, doMock registrations and the module cache are shared across test files.
afterAll(() => {
  for (const modulePath of [
    'node:fs/promises',
    '../saveFileBackup',
    '../../utils/atomicWrite',
    '@dschu012/d2s',
  ]) {
    vi.doUnmock(modulePath);
  }
  vi.resetModules();
});

beforeEach(() => {
  mockWriteFile.mockClear();
  mockD2sWrite.mockClear();
});

/** Equips the item on an empty character and returns the `EQUIP_VALIDATION` code, if rejected. */
async function tryEquip(
  code: string,
  targetSlotId: number,
  characterClass = 'sorceress',
): Promise<string | undefined> {
  // Arrange: d2s `read` returns the same character for the save and the re-parse check.
  mockD2sRead.mockResolvedValue({
    header: { class: characterClass },
    items: [],
    corpse_items: [],
    merc_items: [],
  });
  const item = { id: 1, code, type: code } as unknown as D2sItem;

  try {
    await addItemToSaveFile({
      filePath: '/path/to/char.d2s',
      fileType: 'd2s',
      item,
      locationContext: 'equipped',
      targetEquippedSlotId: targetSlotId,
    });
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const match = /^EQUIP_VALIDATION:([A-Z_]+)$/.exec(message);
    if (!match) {
      throw error;
    }
    return match[1];
  }
}

function rendererSlotIds(rawItemJson: string): number[] {
  const slots: Set<PaperDollSlotKey> = resolveEligibleEquipmentSlots({ rawItemJson });
  return [...slots].map((slot) => EQUIPPED_SLOT_IDS[slot]).sort((left, right) => left - right);
}

describe('When the save file editor validates the slot of an equipped item', () => {
  it.each(
    REPRESENTATIVE_ITEM_CODES,
  )('Then it accepts exactly the slots the browser highlights for item %s', async (code) => {
    // Arrange: the browser reads the categories d2s stores on the parsed item, which are the
    // categories of its table entry; the editor looks them up by item code on its own.
    const { constants } = await import('@dschu012/d2s/lib/data/versions/99_constant_data');
    const table = constants as unknown as Record<string, Record<string, { c?: unknown }>>;
    const categories = (
      table.armor_items[code] ??
      table.weapon_items[code] ??
      table.other_items[code]
    )?.c;
    const expectedSlotIds = rendererSlotIds(JSON.stringify({ type: code, categories }));

    // Act: slot eligibility is checked before class and handedness rules, so any other
    // validation code than INVALID_SLOT still means the slot itself is allowed.
    const acceptedSlotIds = new Set<number>();
    for (const slotId of EQUIPPED_SLOT_ID_RANGE) {
      const rejection = await tryEquip(code, slotId);
      if (rejection !== 'INVALID_SLOT') {
        acceptedSlotIds.add(normalizeWeaponSetSlotId(slotId));
      }
    }

    // Assert
    expect([...acceptedSlotIds].sort((left, right) => left - right)).toEqual(expectedSlotIds);
  });

  it.each([
    ['uap', 1],
    ['uui', 3],
    ['lgl', 10],
    ['lbt', 9],
    ['vbl', 8],
    ['rin', 7],
    ['amu', 2],
    ['ssd', 4],
  ])('If item %s is equipped to its slot %i, Then the editor writes the save', async (code, slotId) => {
    // Arrange / Act
    const rejection = await tryEquip(code, slotId);

    // Assert
    expect(rejection).toBeUndefined();
    expect(mockD2sWrite).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['uap', 3],
    ['uui', 1],
    ['lgl', 9],
    ['lbt', 10],
    ['vbl', 1],
    ['rin', 2],
    ['amu', 6],
    ['ssd', 1],
    ['r01', 4],
  ])('If item %s is equipped to the wrong slot %i, Then the editor rejects it as INVALID_SLOT', async (code, slotId) => {
    // Arrange / Act
    const rejection = await tryEquip(code, slotId);

    // Assert
    expect(rejection).toBe('INVALID_SLOT');
    expect(mockD2sWrite).not.toHaveBeenCalled();
  });
});
