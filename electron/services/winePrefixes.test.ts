import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findWineD2RInstallations, findWineSaveDirectories } from './winePrefixes';

const SAVE_FOLDER = path.join('Saved Games', 'Diablo II Resurrected');

describe('When D2R folders are looked up in Wine and Proton prefixes', () => {
  let home: string;

  /** Creates a folder (and its parents) under the fake home folder and returns its path. */
  const createFolder = (...segments: string[]) => {
    const folder = path.join(home, ...segments);
    mkdirSync(folder, { recursive: true });
    return folder;
  };

  /** Creates the save folder of a prefix user, optionally with a character file. */
  const createSaveFolder = (prefix: string, user: string, withCharacter = false) => {
    const folder = createFolder(prefix, 'drive_c', 'users', user, SAVE_FOLDER);
    if (withCharacter) {
      writeFileSync(path.join(folder, 'Sorc.d2s'), '');
    }
    return folder;
  };

  beforeEach(() => {
    // Resolved, because the lookup returns resolved paths (macOS links /var to /private/var)
    home = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'wine-prefixes-')));
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  describe('If no prefix exists', () => {
    it('Then nothing is found', () => {
      // Arrange
      createFolder('Documents');

      // Act
      const saves = findWineSaveDirectories(home, {});
      const installs = findWineD2RInstallations(home, {});

      // Assert
      expect(saves).toEqual([]);
      expect(installs).toEqual([]);
    });
  });

  describe('If the game runs in Steam Proton prefixes', () => {
    it('Then the Steam release and a non-Steam Battle.net prefix are both found, the Steam release first', () => {
      // Arrange
      const compatdata = path.join('.local', 'share', 'Steam', 'steamapps', 'compatdata');
      const battleNet = createSaveFolder(path.join(compatdata, '2426010261', 'pfx'), 'steamuser');
      const steamRelease = createSaveFolder(path.join(compatdata, '2536520', 'pfx'), 'steamuser');

      // Act
      const saves = findWineSaveDirectories(home, {});

      // Assert
      expect(saves).toEqual([steamRelease, battleNet]);
    });

    it('Then a library on an SD card listed in libraryfolders.vdf is searched too', () => {
      // Arrange
      const steamApps = createFolder('.local', 'share', 'Steam', 'steamapps');
      const sdCard = createFolder('run', 'media', 'deck', 'SD');
      writeFileSync(
        path.join(steamApps, 'libraryfolders.vdf'),
        `"libraryfolders"\n{\n\t"1"\n\t{\n\t\t"path"\t\t"${sdCard}"\n\t}\n}\n`,
      );
      const sdSaves = createSaveFolder(
        path.join('run', 'media', 'deck', 'SD', 'steamapps', 'compatdata', '2536520', 'pfx'),
        'steamuser',
      );
      const sdInstall = createFolder(
        'run',
        'media',
        'deck',
        'SD',
        'steamapps',
        'common',
        'Diablo II Resurrected',
      );

      // Act
      const saves = findWineSaveDirectories(home, {});
      const installs = findWineD2RInstallations(home, {});

      // Assert
      expect(saves).toEqual([sdSaves]);
      expect(installs).toEqual([sdInstall]);
    });

    it('Then a Steam folder reached through the ~/.steam/steam link is found once', () => {
      // Arrange
      const steamRoot = createFolder('.local', 'share', 'Steam');
      createFolder('.steam');
      // A junction on Windows, which needs no extra rights; the type is ignored elsewhere
      symlinkSync(steamRoot, path.join(home, '.steam', 'steam'), 'junction');
      const saves = createSaveFolder(
        path.join('.local', 'share', 'Steam', 'steamapps', 'compatdata', '2536520', 'pfx'),
        'steamuser',
      );

      // Act
      const result = findWineSaveDirectories(home, {});

      // Assert
      expect(result).toEqual([saves]);
    });
  });

  describe('If the game runs in Lutris, Heroic, Bottles or plain Wine prefixes', () => {
    it('Then each save folder is found, and folders with character files come first', () => {
      // Arrange
      const lutris = createSaveFolder(path.join('Games', 'battlenet'), 'deck');
      const heroic = createSaveFolder(
        path.join('Games', 'Heroic', 'Prefixes', 'default'),
        'steamuser',
      );
      const bottles = createSaveFolder(
        path.join('.local', 'share', 'bottles', 'bottles', 'Battle.net'),
        'deck',
      );
      const wine = createSaveFolder('.wine', 'deck', true);

      // Act
      const saves = findWineSaveDirectories(home, {});

      // Assert
      expect(saves).toEqual([wine, lutris, heroic, bottles]);
    });

    it('Then the prefix in WINEPREFIX is searched first and the Public profile is skipped', () => {
      // Arrange
      const custom = createSaveFolder('custom-prefix', 'deck');
      createSaveFolder('.wine', 'Public');
      const wine = createSaveFolder('.wine', 'deck');

      // Act
      const saves = findWineSaveDirectories(home, { WINEPREFIX: path.join(home, 'custom-prefix') });

      // Assert
      expect(saves).toEqual([custom, wine]);
    });

    it('Then the Battle.net install folder inside the prefix is found', () => {
      // Arrange
      const install = createFolder(
        'Games',
        'battlenet',
        'drive_c',
        'Program Files (x86)',
        'Diablo II Resurrected',
      );

      // Act
      const installs = findWineD2RInstallations(home, {});

      // Assert
      expect(installs).toEqual([install]);
    });
  });

  describe('If a folder that holds prefixes is not a readable folder', () => {
    it('Then it is skipped and the other prefixes are still found', () => {
      // Arrange
      writeFileSync(path.join(home, 'Games'), 'not a folder');
      const wine = createSaveFolder('.wine', 'deck');

      // Act
      const saves = findWineSaveDirectories(home, {});

      // Assert
      expect(saves).toEqual([wine]);
    });
  });
});
