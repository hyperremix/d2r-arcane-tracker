import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readWarlockSave } from '../../test/helpers/rotwCharacterSave';
import {
  buildSaveFileHeader,
  getCharacterClass,
  getSaveNameFromPath,
  isHardcoreStashFileName,
  isRotwExpansionSave,
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
    const classIds = [0, 1, 2, 3, 4, 5, 6, 7];

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
      'warlock',
    ]);
  });

  it('Then should return unknown for invalid character class ID', () => {
    // Arrange
    const invalidIds = [8, 99, -1];

    // Act
    const classes = invalidIds.map((id) => getCharacterClass(id));

    // Assert
    expect(classes).toEqual(['unknown', 'unknown', 'unknown']);
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

describe('When the game mode of a stash is read from its file name', () => {
  describe('If the path uses Windows separators', () => {
    it('Then only the file name decides, not a folder name', () => {
      // Arrange
      const softcoreInHardcoreFolder =
        'C:\\Users\\hardcore\\Saved Games\\SharedStashSoftCoreV2.d2i';
      const hardcoreStash = 'C:\\Users\\x\\Saved Games\\SharedStashHardCoreV2.d2i';

      // Act
      const softcoreResult = isHardcoreStashFileName(softcoreInHardcoreFolder);
      const hardcoreResult = isHardcoreStashFileName(hardcoreStash);

      // Assert
      expect(softcoreResult).toBe(false);
      expect(hardcoreResult).toBe(true);
    });
  });

  describe('If the path uses POSIX separators', () => {
    it('Then only the file name decides, not a folder name', () => {
      // Arrange
      const softcoreInHardcoreFolder = '/saves/hardcore/SharedStashSoftCoreV2.d2i';

      // Act
      const result = isHardcoreStashFileName(softcoreInHardcoreFolder);

      // Assert
      expect(result).toBe(false);
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

  describe('If a real Reign of the Warlock (v105) Warlock save is described', () => {
    it('Then it is a level 1 softcore expansion Warlock', () => {
      // Arrange
      const save = readWarlockSave();

      // Act
      const saveFile = buildSaveFileHeader('/saves/Warlock.d2s', save, LAST_MODIFIED);

      // Assert
      expect(saveFile).toEqual({
        name: 'Warlock',
        path: '/saves/Warlock.d2s',
        lastModified: LAST_MODIFIED,
        characterClass: 'warlock',
        level: 1,
        hardcore: false,
        expansion: true,
      });
    });
  });

  describe('If a v105 character save has its fields at the moved offsets', () => {
    it('Then class, level and hardcore come from the new offsets and expansion from the game mode byte', () => {
      // Arrange
      const header = Buffer.alloc(800);
      header.writeUInt32LE(105, 4);
      header.writeUInt8(0x04, 20); // hardcore
      header.writeUInt8(7, 24); // warlock
      header.writeUInt8(85, 27);
      header.writeUInt8(1, 248); // classic game mode
      header.writeUInt8(0xff, 36); // the pre-v105 offsets must not be read
      header.writeUInt8(4, 40);
      header.writeUInt8(92, 43);

      // Act
      const saveFile = buildSaveFileHeader('/saves/Hero.d2s', header, LAST_MODIFIED);

      // Assert
      expect(saveFile).toEqual(
        expect.objectContaining({
          characterClass: 'warlock',
          level: 85,
          hardcore: true,
          expansion: false,
        }),
      );
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
    it('Then its version comes from the stash header and its hardcore flag from the file name', () => {
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

  describe('If .d2i stashes are described whose header field after the signature differs', () => {
    // D2R writes 1 into both SharedStashSoftCoreV2.d2i and SharedStashHardCoreV2.d2i, 0 into
    // older v97 files and 2 into modern ones: the field is not a game mode flag.
    function createStashHeader(headerField: number, version: number): Buffer {
      const header = Buffer.alloc(68);
      header.writeUInt32LE(0xaa55aa55, 0);
      header.writeUInt32LE(headerField, 4);
      header.writeUInt32LE(version, 8);
      header.writeUInt32LE(68, 16);
      return header;
    }

    it.each([
      ['/saves/SharedStashHardCoreV2.d2i', 1, 99, 'Shared Stash Hardcore', true],
      ['/saves/SharedStashSoftCoreV2.d2i', 1, 98, 'Shared Stash Softcore', false],
      ['/saves/SharedStashSoftCoreV2.d2i', 0, 97, 'Shared Stash Softcore', false],
      ['/saves/ModernSharedStashSoftCoreV2.d2i', 2, 105, 'Modern Shared Stash Softcore', false],
      ['/saves/ModernSharedStashHardCoreV2.d2i', 2, 105, 'Modern Shared Stash Hardcore', true],
    ])('Then %s (field %i, version %i) is named %s', (filePath, headerField, version, name, hardcore) => {
      // Arrange
      const content = createStashHeader(headerField, version);

      // Act
      const saveFile = buildSaveFileHeader(filePath, content, LAST_MODIFIED);

      // Assert
      expect(saveFile).toEqual(
        expect.objectContaining({ name, hardcore, sourceFileVersion: version }),
      );
    });
  });

  describe('If the header of a .d2i file cannot be read', () => {
    it('Then the hardcore flag comes from the file name and no version is known', () => {
      // Arrange
      const content = Buffer.from('not a stash');

      // Act
      const headerInfo = readD2iHeaderInfo('/saves/SharedStashHardCoreV2.d2i', content);

      // Assert
      expect(headerInfo).toEqual({ hardcore: true });
    });
  });
});

describe('When it is checked whether a character save was made for an expansion game mode', () => {
  function makeSave(version: number, gameMode: number, length = 800): Buffer {
    const save = Buffer.alloc(length);
    save.writeUInt32LE(version, 4);
    if (length > 248) {
      save.writeUInt8(gameMode, 248);
    }
    return save;
  }

  describe('If a v105 save has the Lord of Destruction or Reign of the Warlock game mode', () => {
    it('Then it is an expansion save', () => {
      // Arrange
      const saves = [makeSave(105, 2), makeSave(105, 3)];

      // Act
      const results = saves.map((save) => isRotwExpansionSave(save));

      // Assert
      expect(results).toEqual([true, true]);
    });
  });

  describe('If a v105 save has the classic game mode', () => {
    it('Then it is not an expansion save', () => {
      // Arrange
      const save = makeSave(105, 1);

      // Act
      const result = isRotwExpansionSave(save);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If the save is older than v105 or too short to hold a game mode byte', () => {
    it('Then it is not judged by a game mode byte', () => {
      // Arrange
      const saves = [makeSave(99, 3), makeSave(105, 3, 100), Buffer.alloc(4)];

      // Act
      const results = saves.map((save) => isRotwExpansionSave(save));

      // Assert
      expect(results).toEqual([false, false, false]);
    });
  });
});
