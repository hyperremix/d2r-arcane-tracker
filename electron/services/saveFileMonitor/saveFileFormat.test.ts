import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildSaveFileHeader,
  getCharacterClass,
  getSaveNameFromPath,
  readD2iHeaderInfo,
  shouldIncludeSaveFile,
} from './saveFileFormat';

const MODERN_STASH_FIXTURE_PATH = resolve(
  process.cwd(),
  'electron/services/fixtures/ModernSharedStashSoftCoreV2.d2i',
);
const LAST_MODIFIED = new Date('2024-05-01T10:00:00.000Z');

describe('When a character class id is mapped', () => {
  it('Then should return correct character class for valid ID', () => {
    // Arrange
    const classIds = [0, 1, 2, 3, 4, 5, 6];

    // Act
    const classes = classIds.map((id) => getCharacterClass(id));

    // Assert
    expect(classes).toEqual([
      'amazon',
      'sorceress',
      'necromancer',
      'paladin',
      'barbarian',
      'druid',
      'assassin',
    ]);
  });

  it('Then should return unknown for invalid character class ID', () => {
    // Arrange
    const invalidIds = [99, -1];

    // Act
    const classes = invalidIds.map((id) => getCharacterClass(id));

    // Assert
    expect(classes).toEqual(['unknown', 'unknown']);
  });
});

describe('When a save name is derived from a file path', () => {
  describe('If getSaveNameFromPath is called with hardcore=true parameter', () => {
    it('Then should return legacy Shared Stash Hardcore for legacy file versions', () => {
      // Arrange
      const filePath = '/test/SharedStashSoftcoreV2.d2i';

      // Act
      const result = getSaveNameFromPath(filePath, true, 99);

      // Assert
      expect(result).toBe('Shared Stash Hardcore');
    });
  });

  describe('If getSaveNameFromPath is called with hardcore=false parameter', () => {
    it('Then should return modern Shared Stash Softcore for modern file versions', () => {
      // Arrange
      const filePath = '/test/SharedStashHardcoreV2.d2i';

      // Act
      const result = getSaveNameFromPath(filePath, false, 105);

      // Assert
      expect(result).toBe('Modern Shared Stash Softcore');
    });
  });

  describe('If getSaveNameFromPath is called with hardcore=true and modern version', () => {
    it('Then should return modern Shared Stash Hardcore', () => {
      // Arrange
      const filePath = '/test/SharedStashSoftcoreV2.d2i';

      // Act
      const result = getSaveNameFromPath(filePath, true, 105);

      // Assert
      expect(result).toBe('Modern Shared Stash Hardcore');
    });
  });

  describe('If getSaveNameFromPath is called without hardcore parameter for hardcore stash', () => {
    it('Then should fallback to filename detection', () => {
      // Arrange
      const filePath = '/test/SharedStashHardcoreV2.d2i';

      // Act
      const result = getSaveNameFromPath(filePath);

      // Assert
      expect(result).toBe('Shared Stash Hardcore'); // Falls back to filename
    });
  });

  describe('If getSaveNameFromPath is called without hardcore parameter for softcore stash', () => {
    it('Then should fallback to filename detection', () => {
      // Arrange
      const filePath = '/test/SharedStashSoftcoreV2.d2i';

      // Act
      const result = getSaveNameFromPath(filePath);

      // Assert
      expect(result).toBe('Shared Stash Softcore'); // Falls back to filename
    });
  });

  describe('If getSaveNameFromPath is called with non-.d2i file', () => {
    it('Then should return filename without extension', () => {
      // Arrange
      const filePath = '/test/MyCharacter.d2s';

      // Act
      const result = getSaveNameFromPath(filePath);

      // Assert
      expect(result).toBe('MyCharacter');
    });
  });

  describe('If getSaveNameFromPath is called with an uppercase extension', () => {
    it('Then should strip the extension case-insensitively', () => {
      // Arrange
      const filePath = '/test/Hero.D2S';

      // Act
      const result = getSaveNameFromPath(filePath);

      // Assert
      expect(result).toBe('Hero');
    });
  });

  describe('If getSaveNameFromPath is called with hardcore parameter on non-.d2i file', () => {
    it('Then should ignore hardcore parameter', () => {
      // Arrange
      const filePath = '/test/MyCharacter.d2s';

      // Act
      const result = getSaveNameFromPath(filePath, true);

      // Assert
      expect(result).toBe('MyCharacter'); // Hardcore parameter only applies to .d2i files
    });
  });
});

describe('When save file names are filtered', () => {
  describe('If backup-like stash filenames are evaluated', () => {
    it('Then backup-like .d2i files should be excluded from parsing', () => {
      // Arrange
      const fileNames = [
        'Barb.d2s',
        'SharedStashSoftCoreV2.d2i',
        'SharedStashSoftCoreV2_Backup.d2i',
        'SharedStashSoftCoreV2.bak.d2i',
        'notes.txt',
      ];

      // Act
      const included = fileNames.map((name) => shouldIncludeSaveFile(name));

      // Assert
      expect(included).toEqual([true, true, false, false, false]);
    });
  });

  describe('If save file extensions use a different case or a legacy stash format', () => {
    it('Then they are included', () => {
      // Arrange
      const fileNames = ['Hero.D2S', 'Shared.sss', 'Shared.D2X', 'Stash_bak.d2s'];

      // Act
      const included = fileNames.map((name) => shouldIncludeSaveFile(name));

      // Assert
      expect(included).toEqual([true, true, true, true]);
    });
  });
});

describe('When the header of a save file is built from its content', () => {
  describe('If a character save has a full header', () => {
    it('Then class, level and status flags are read from their fixed offsets', () => {
      // Arrange
      const header = Buffer.alloc(800);
      header.writeUInt8(0x24, 36); // hardcore + expansion
      header.writeUInt8(4, 40); // barbarian
      header.writeUInt8(92, 43);

      // Act
      const saveFile = buildSaveFileHeader('/saves/Hero.D2S', header, LAST_MODIFIED);

      // Assert
      expect(saveFile).toEqual({
        name: 'Hero',
        path: '/saves/Hero.D2S',
        lastModified: LAST_MODIFIED,
        characterClass: 'barbarian',
        level: 92,
        hardcore: true,
        expansion: true,
      });
    });
  });

  describe('If a character save is too short for a header', () => {
    it('Then the defaults of an unknown softcore expansion character are used', () => {
      // Arrange
      const content = Buffer.from('mock');

      // Act
      const saveFile = buildSaveFileHeader('/saves/Hero.d2s', content, LAST_MODIFIED);

      // Assert
      expect(saveFile).toEqual(
        expect.objectContaining({
          name: 'Hero',
          characterClass: 'unknown',
          level: 1,
          hardcore: false,
          expansion: true,
        }),
      );
    });
  });

  describe('If a legacy shared stash is described', () => {
    it('Then the parsed hardcore flag wins over the file name', () => {
      // Arrange
      const content = Buffer.alloc(16);

      // Act
      const fromHint = buildSaveFileHeader('/saves/SharedSoftcore.sss', content, LAST_MODIFIED, {
        stashHardcore: true,
      });
      const fromName = buildSaveFileHeader('/saves/SharedHardcore.d2x', content, LAST_MODIFIED);

      // Assert
      expect(fromHint).toEqual(
        expect.objectContaining({
          name: 'SharedSoftcore',
          characterClass: 'shared_stash',
          level: 1,
          hardcore: true,
        }),
      );
      expect(fromName.hardcore).toBe(true);
    });
  });

  describe('If a modern shared stash is described', () => {
    it('Then its hardcore flag and version come from the stash header', () => {
      // Arrange
      const content = readFileSync(MODERN_STASH_FIXTURE_PATH);

      // Act
      const saveFile = buildSaveFileHeader(MODERN_STASH_FIXTURE_PATH, content, LAST_MODIFIED);

      // Assert
      expect(saveFile).toEqual(
        expect.objectContaining({
          name: 'Modern Shared Stash Softcore',
          characterClass: 'shared_stash',
          hardcore: false,
          sourceFileVersion: 105,
        }),
      );
    });
  });

  describe('If the header of a .d2i file cannot be read', () => {
    it('Then the hardcore flag falls back to the file name and no version is known', () => {
      // Arrange
      const content = Buffer.from('not a stash');

      // Act
      const headerInfo = readD2iHeaderInfo('/saves/SharedStashHardCoreV2.d2i', content);

      // Assert
      expect(headerInfo).toEqual({ hardcore: true });
    });
  });
});
