import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerD2sConstants } from '../d2s/constants';
import { getClassicStashCodec } from '../saveFormat/saveFormat';
import {
  assertWritableSaveFile,
  CharacterSaveFile,
  ClassicStashFile,
  decodeSaveFile,
  describeDecodedSaveFile,
  openSaveFile,
} from './saveFileAdapters';

const MODERN_FIXTURE_PATH = resolve(
  process.cwd(),
  'electron/services/fixtures/ModernSharedStashSoftCoreV2.d2i',
);

const CHARACTER_FIXTURE_PATH = resolve(
  process.cwd(),
  'electron/services/fixtures/ClassicCharacterV99.d2s',
);

function makeItem(id: number, overrides: Record<string, unknown> = {}): d2sTypes.IItem {
  return { id, type: 'amu', ...overrides } as unknown as d2sTypes.IItem;
}

function makeStash(pages: d2sTypes.IItem[][]): d2sTypes.IStash {
  return {
    pages: pages.map((items) => ({ name: '', type: 0, items })),
    pageCount: pages.length,
  } as unknown as d2sTypes.IStash;
}

function makeCharacter(items: d2sTypes.IItem[] = []): d2sTypes.ID2S {
  return {
    header: { class: 'sorceress' },
    items,
    corpse_items: [],
    merc_items: [],
  } as unknown as d2sTypes.ID2S;
}

describe('When a save file is opened for editing', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'arcane-save-adapters-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  describe('If the given file type matches the extension', () => {
    it('Then the detected format and the file content are returned', async () => {
      // Arrange
      const filePath = join(directory, 'SharedStash.d2i');
      writeFileSync(filePath, readFileSync(MODERN_FIXTURE_PATH));

      // Act
      const file = await openSaveFile(filePath, 'd2i');

      // Assert
      expect(file.format).toMatchObject({ kind: 'modernStash', fileType: 'd2i', d2iVersion: 105 });
      expect(file.buffer.equals(readFileSync(MODERN_FIXTURE_PATH))).toBe(true);
    });
  });

  describe('If the given file type does not match the extension', () => {
    it('Then it is refused', async () => {
      // Arrange
      const filePath = join(directory, 'Hero.d2s');
      writeFileSync(filePath, Buffer.alloc(16));

      // Act
      const open = openSaveFile(filePath, 'sss');

      // Assert
      await expect(open).rejects.toThrow("Save file type 'sss' does not match");
    });
  });

  describe('If the .d2i sectors cannot be read', () => {
    it('Then the read error is thrown before anything is edited', async () => {
      // Arrange
      const filePath = join(directory, 'SharedStash.d2i');
      const fixture = readFileSync(MODERN_FIXTURE_PATH);
      writeFileSync(filePath, fixture.subarray(0, fixture.length - 10));

      // Act
      const open = openSaveFile(filePath, 'd2i');

      // Assert
      await expect(open).rejects.toThrow('exceeds file length');
    });
  });

  describe('If the file is a modern stash', () => {
    it('Then whole-file edits are refused as read-only', async () => {
      // Arrange
      const filePath = join(directory, 'SharedStash.d2i');
      writeFileSync(filePath, readFileSync(MODERN_FIXTURE_PATH));
      const file = await openSaveFile(filePath, 'd2i');

      // Act
      const decode = decodeSaveFile(file);
      const assertWritable = assertWritableSaveFile(filePath, 'd2i');

      // Assert
      await expect(decode).rejects.toThrow('MODERN_STASH_READ_ONLY');
      await expect(assertWritable).rejects.toThrow('MODERN_STASH_READ_ONLY');
    });
  });
});

describe('When a classic stash is edited in memory', () => {
  const codec = getClassicStashCodec('sss');

  describe('If an item is placed on a tab the stash does not have yet', () => {
    it('Then the missing pages are added and the item gets the target cell', () => {
      // Arrange
      const data = makeStash([[]]);
      const stash = new ClassicStashFile('/saves/stash.sss', data, codec);

      // Act
      stash.placeItem(makeItem(1), { locationContext: 'stash', stashTab: 2, gridX: 3, gridY: 4 });

      // Assert
      expect(data.pages).toHaveLength(3);
      expect(data.pageCount).toBe(3);
      expect(data.pages[2]?.items[0]).toMatchObject({ id: 1, position_x: 3, position_y: 4 });
    });
  });

  describe('If the target cell is occupied', () => {
    it('Then the placement is refused', () => {
      // Arrange
      const data = makeStash([[makeItem(1, { position_x: 0, position_y: 0 })]]);
      const stash = new ClassicStashFile('/saves/stash.sss', data, codec);

      // Act
      const place = () =>
        stash.placeItem(makeItem(2), { locationContext: 'stash', stashTab: 0, gridX: 0, gridY: 0 });

      // Assert
      expect(place).toThrow('TARGET_CELL_OCCUPIED');
      expect(data.pages[0]?.items).toHaveLength(1);
    });
  });

  describe('If several pages hold an item with the same id', () => {
    it('Then only the first one is extracted', () => {
      // Arrange
      const data = makeStash([[makeItem(7)], [makeItem(7)]]);
      const stash = new ClassicStashFile('/saves/stash.sss', data, codec);

      // Act
      const extracted = stash.extractItem(7);

      // Assert
      expect(extracted).toMatchObject({ id: 7 });
      expect(data.pages[0]?.items).toHaveLength(0);
      expect(data.pages[1]?.items).toHaveLength(1);
      expect(stash.findItem(7)).toBe(data.pages[1]?.items[0]);
    });
  });
});

describe('When a character save is edited in memory', () => {
  describe('If an item is placed for the mercenary', () => {
    it('Then it goes to the mercenary items with the mercenary location', () => {
      // Arrange
      const data = makeCharacter();
      const character = new CharacterSaveFile('/saves/Hero.d2s', data);

      // Act
      character.placeItem(makeItem(3), { locationContext: 'mercenary' });

      // Assert
      expect(data.merc_items).toHaveLength(1);
      expect(data.merc_items[0]).toMatchObject({ id: 3, location_id: 3 });
      expect(data.items).toHaveLength(0);
    });
  });

  describe('If an item is placed onto an occupied inventory cell', () => {
    it('Then the placement is refused', () => {
      // Arrange
      const occupant = makeItem(1, {
        location_id: 0,
        alt_position_id: 1,
        position_x: 2,
        position_y: 1,
      });
      const data = makeCharacter([occupant]);
      const character = new CharacterSaveFile('/saves/Hero.d2s', data);

      // Act
      const place = () =>
        character.placeItem(makeItem(2), { locationContext: 'inventory', gridX: 2, gridY: 1 });

      // Assert
      expect(place).toThrow('TARGET_CELL_OCCUPIED');
      expect(data.items).toEqual([occupant]);
    });
  });
});

describe('When a save file is decoded for in-memory editing', () => {
  let directory: string;

  beforeEach(() => {
    // Registered on the d2s instance imported here, which is the one the adapters decode with.
    registerD2sConstants(d2s);
    directory = mkdtempSync(join(tmpdir(), 'arcane-save-adapters-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  describe('If the file is a character save', () => {
    it('Then a CharacterSaveFile with the parsed items is returned', async () => {
      // Arrange
      const filePath = join(directory, 'Hero.d2s');
      writeFileSync(filePath, readFileSync(CHARACTER_FIXTURE_PATH));
      const expected = await d2s.read(readFileSync(CHARACTER_FIXTURE_PATH));

      // Act
      const decoded = await decodeSaveFile(await openSaveFile(filePath, 'd2s'));

      // Assert
      expect(decoded).toBeInstanceOf(CharacterSaveFile);
      expect(decoded.kind).toBe('character');
      expect((decoded as CharacterSaveFile).data.items).toHaveLength(expected.items.length);
      expect(describeDecodedSaveFile(decoded)).toBe('save file');
    });

    it('Then write() replaces the file with the edited character', async () => {
      // Arrange
      const filePath = join(directory, 'Hero.d2s');
      writeFileSync(filePath, readFileSync(CHARACTER_FIXTURE_PATH));
      const decoded = await decodeSaveFile(await openSaveFile(filePath, 'd2s'));
      const itemCount = (decoded as CharacterSaveFile).data.items.length;
      const removedId = (decoded as CharacterSaveFile).data.items.find(
        (item: d2sTypes.IItem) => typeof item.id === 'number',
      )?.id as number;

      // Act
      const removed = decoded.extractItem(removedId);
      await decoded.write();

      // Assert
      expect(removed).toMatchObject({ id: removedId });
      const written = await d2s.read(readFileSync(filePath));
      expect(written.items).toHaveLength(itemCount - 1);
    });
  });

  describe('If the file is a classic stash', () => {
    const codec = getClassicStashCodec('sss');

    function writeEmptyStash(filePath: string): Promise<Uint8Array> {
      const empty = {
        pages: [{ name: '', type: 0, items: [] }],
        pageCount: 1,
        hardcore: false,
        version: '02',
        type: 0,
        sharedGold: 0,
      } as unknown as d2sTypes.IStash;
      return d2stash.write(empty, codec.constants, codec.version).then((bytes) => {
        writeFileSync(filePath, bytes);
        return bytes;
      });
    }

    it('Then a ClassicStashFile with the parsed pages is returned', async () => {
      // Arrange
      const filePath = join(directory, 'Stash.sss');
      await writeEmptyStash(filePath);

      // Act
      const decoded = await decodeSaveFile(await openSaveFile(filePath, 'sss'));

      // Assert
      expect(decoded).toBeInstanceOf(ClassicStashFile);
      expect(decoded.kind).toBe('classicStash');
      expect((decoded as ClassicStashFile).data.pages).toHaveLength(1);
      expect(describeDecodedSaveFile(decoded)).toBe('stash file');
    });

    it('Then write() replaces the file with the edited stash', async () => {
      // Arrange
      const filePath = join(directory, 'Stash.sss');
      await writeEmptyStash(filePath);
      const decoded = await decodeSaveFile(await openSaveFile(filePath, 'sss'));
      const stash = decoded as ClassicStashFile;

      // Act
      stash.data.pages.push({ name: 'Second', type: 0, items: [] });
      await stash.write();

      // Assert
      const written = await d2stash.read(readFileSync(filePath), codec.constants);
      expect(written.pages).toHaveLength(2);
      expect(written.pages[1]?.name).toBe('Second');
    });
  });
});
