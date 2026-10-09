import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import { describe, expect, it } from 'vitest';
import { D2I_SECTOR_HEADER_SIZE } from '../stashFormat';
import { detectSaveFormat, getClassicStashCodec } from './saveFormat';

const MODERN_FIXTURE_PATH = resolve(
  process.cwd(),
  'electron/services/fixtures/ModernSharedStashSoftCoreV2.d2i',
);

/** A single-sector .d2i buffer with the given header version and an empty JM item list. */
function createD2iBuffer(version: number): Buffer {
  const payload = Buffer.from([0x4a, 0x4d, 0x00, 0x00]);
  const header = Buffer.alloc(D2I_SECTOR_HEADER_SIZE);
  header.writeUInt32LE(0xaa55aa55, 0);
  header.writeUInt32LE(1, 4);
  header.writeUInt32LE(version, 8);
  header.writeUInt32LE(D2I_SECTOR_HEADER_SIZE + payload.length, 16);
  return Buffer.concat([header, payload]);
}

describe('When detectSaveFormat is called', () => {
  describe('If the file is a character save or a legacy shared stash', () => {
    it('Then the extension alone decides the kind, case-insensitively', () => {
      // Arrange
      const buffer = Buffer.alloc(0);

      // Act
      const formats = ['/saves/Hero.d2s', '/saves/Hero.D2S', '/saves/a.sss', '/saves/b.D2X'].map(
        (filePath) => detectSaveFormat(filePath, buffer),
      );

      // Assert
      expect(formats).toEqual([
        { kind: 'character', fileType: 'd2s' },
        { kind: 'character', fileType: 'd2s' },
        { kind: 'classicStash', fileType: 'sss' },
        { kind: 'classicStash', fileType: 'd2x' },
      ]);
    });
  });

  describe('If the file is a v105+ .d2i stash', () => {
    it('Then it is a modern stash with the header version', () => {
      // Arrange
      const buffer = readFileSync(MODERN_FIXTURE_PATH);

      // Act
      const format = detectSaveFormat('/saves/SharedStash.d2i', buffer);

      // Assert
      expect(format).toEqual({ kind: 'modernStash', fileType: 'd2i', d2iVersion: 105 });
    });
  });

  describe('If the file is a pre-105 .d2i stash', () => {
    it('Then it is a classic stash', () => {
      // Arrange
      const buffer = createD2iBuffer(99);

      // Act
      const format = detectSaveFormat('/saves/SharedStash.d2i', buffer);

      // Assert
      expect(format).toEqual({ kind: 'classicStash', fileType: 'd2i', d2iVersion: 99 });
    });
  });

  describe('If a v105+ .d2i stash is cut off inside a sector', () => {
    it('Then the header version still makes it a modern stash and the read error is kept', () => {
      // Arrange
      const buffer = readFileSync(MODERN_FIXTURE_PATH);
      const truncated = buffer.subarray(0, buffer.length - 10);

      // Act
      const format = detectSaveFormat('/saves/SharedStash.d2i', truncated);

      // Assert
      expect(format.kind).toBe('modernStash');
      expect(format.d2iVersion).toBe(105);
      expect(format.d2iReadError).toBeInstanceOf(Error);
    });
  });

  describe('If a .d2i file has no sector header', () => {
    it('Then it is a classic stash without a version and the read error is kept', () => {
      // Arrange
      const buffer = Buffer.alloc(D2I_SECTOR_HEADER_SIZE);

      // Act
      const format = detectSaveFormat('/saves/SharedStash.d2i', buffer);

      // Assert
      expect(format.kind).toBe('classicStash');
      expect(format.d2iVersion).toBeUndefined();
      expect(format.d2iReadError).toBeInstanceOf(Error);
    });
  });

  describe('If the extension is not a save file extension', () => {
    it('Then it throws', () => {
      // Arrange
      const buffer = Buffer.alloc(0);

      // Act
      const detect = () => detectSaveFormat('/saves/notes.txt', buffer);

      // Assert
      expect(detect).toThrow('Unsupported save file extension: .txt');
    });
  });
});

describe('When getClassicStashCodec is called', () => {
  it('Then pre-105 .d2i files use the v99 constants and legacy stashes the v96 ones', () => {
    // Arrange
    const fileTypes = ['d2i', 'sss', 'd2x'] as const;

    // Act
    const codecs = fileTypes.map((fileType) => getClassicStashCodec(fileType));

    // Assert
    expect(codecs).toEqual([
      { constants: constants99, version: 99 },
      { constants: constants96, version: 96 },
      { constants: constants96, version: 96 },
    ]);
  });
});
