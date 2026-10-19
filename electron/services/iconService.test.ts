import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceErrorPayload } from '../types/serviceError';
import { setErrorForwarder } from '../utils/serviceLogger';
import { IconService } from './iconService';

// Hoisted because the IconService constructor calls app.getPath.
const paths = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => paths.userData),
  },
}));

// The platform and home folder the install path detection sees; unset means the real ones
const osOverrides = vi.hoisted(() => ({
  platform: undefined as NodeJS.Platform | undefined,
  home: undefined as string | undefined,
}));
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  const platform = () => osOverrides.platform ?? actual.platform();
  const homedir = () => osOverrides.home ?? actual.homedir();
  return { ...actual, default: { ...actual, platform, homedir }, platform, homedir };
});

// The files the install path detection sees; unset means the real file system
const fsOverrides = vi.hoisted(() => ({
  statSync: undefined as ((file: string) => { isFile: () => boolean }) | undefined,
}));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const statSync = ((file: string, ...rest: unknown[]) =>
    fsOverrides.statSync
      ? fsOverrides.statSync(file)
      : (actual.statSync as (...args: unknown[]) => unknown)(
          file,
          ...rest,
        )) as typeof actual.statSync;
  return { ...actual, default: { ...actual, statSync }, statSync };
});

/**
 * Fakes a Windows file system holding the given files. Paths are compared with backslashes, as
 * `path.join` on the machine running the tests may join a Windows folder with a slash.
 * @param files - Windows paths of the files that exist
 * @param unreadable - Windows paths whose lookup fails with a permission error
 */
function fakeWindowsFiles(files: string[], unreadable: string[] = []) {
  fsOverrides.statSync = (file) => {
    const windowsPath = file.replace(/\//g, '\\');
    if (unreadable.includes(windowsPath)) {
      throw Object.assign(new Error(`EACCES: permission denied, stat '${windowsPath}'`), {
        code: 'EACCES',
      });
    }
    if (!files.includes(windowsPath)) {
      throw Object.assign(new Error(`ENOENT: no such file or directory, stat '${windowsPath}'`), {
        code: 'ENOENT',
      });
    }
    return { isFile: () => true };
  };
}

describe('IconService', () => {
  let tempDir: string;
  let forwarder: ReturnType<typeof vi.fn<(payload: ServiceErrorPayload) => void>>;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'icon-service-'));
    paths.userData = path.join(tempDir, 'user-data');
    mkdirSync(paths.userData, { recursive: true });
    forwarder = vi.fn();
    setErrorForwarder(forwarder);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    osOverrides.platform = undefined;
    osOverrides.home = undefined;
    fsOverrides.statSync = undefined;
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('When the D2R installation is looked up on Linux', () => {
    beforeEach(() => {
      osOverrides.platform = 'linux';
      osOverrides.home = realpathSync(tempDir);
      // A WINEPREFIX of the machine running the tests must not add a prefix
      vi.stubEnv('WINEPREFIX', '');
    });

    it('If the game is installed in a Proton prefix, Then it is suggested and detected', () => {
      // Arrange
      const install = path.join(
        realpathSync(tempDir),
        '.local/share/Steam/steamapps/compatdata/2426010261/pfx/drive_c',
        'Program Files (x86)',
        'Diablo II Resurrected',
      );
      mkdirSync(install, { recursive: true });
      writeFileSync(path.join(install, 'D2R.exe'), '');
      const service = new IconService();

      // Act
      const suggested = service.getSuggestedD2RPath();
      const detected = service.findD2RInstallation();

      // Assert
      expect(suggested).toBe(install);
      expect(detected).toBe(install);
    });

    it('If the folder in the Proton prefix has no D2R.exe, Then nothing is suggested or detected', () => {
      // Arrange
      mkdirSync(
        path.join(
          realpathSync(tempDir),
          '.local/share/Steam/steamapps/compatdata/2426010261/pfx/drive_c',
          'Program Files (x86)',
          'Diablo II Resurrected',
        ),
        { recursive: true },
      );
      const service = new IconService();

      // Act
      const suggested = service.getSuggestedD2RPath();
      const detected = service.findD2RInstallation();

      // Assert
      expect(suggested).toBeUndefined();
      expect(detected).toBeNull();
    });

    it('If no installation is found, Then nothing is suggested or detected', () => {
      // Arrange
      const service = new IconService();

      // Act
      const suggested = service.getSuggestedD2RPath();
      const detected = service.findD2RInstallation();

      // Assert
      expect(suggested).toBeUndefined();
      expect(detected).toBeNull();
    });
  });

  describe('When the D2R installation is looked up on Windows', () => {
    const battleNetDefault = 'C:\\Program Files (x86)\\Diablo II Resurrected';
    const programFiles = 'C:\\Program Files\\Diablo II Resurrected';
    const cGames = 'C:\\Games\\Diablo II Resurrected';

    beforeEach(() => {
      osOverrides.platform = 'win32';
      osOverrides.home = 'C:\\Users\\player';
    });

    it('If D2R.exe is in the Battle.net default folder, Then that folder is suggested', () => {
      // Arrange
      fakeWindowsFiles([`${battleNetDefault}\\D2R.exe`, `${programFiles}\\D2R.exe`]);
      const service = new IconService();

      // Act
      const suggested = service.getSuggestedD2RPath();

      // Assert
      expect(suggested).toBe(battleNetDefault);
    });

    it('If D2R.exe is only in Program Files, Then that folder is suggested', () => {
      // Arrange
      fakeWindowsFiles([`${programFiles}\\D2R.exe`]);
      const service = new IconService();

      // Act
      const suggested = service.getSuggestedD2RPath();

      // Assert
      expect(suggested).toBe(programFiles);
    });

    it('If D2R.exe is in the Battle.net default folder, Then it is detected and becomes the configured path', () => {
      // Arrange
      fakeWindowsFiles([`${battleNetDefault}\\D2R.exe`]);
      const service = new IconService();

      // Act
      const detected = service.findD2RInstallation();

      // Assert
      expect(detected).toBe(battleNetDefault);
      expect(service.getD2RPath()).toBe(battleNetDefault);
    });

    it('If the Battle.net default folder and C:\\Games both have D2R.exe, Then the Battle.net default is detected', () => {
      // Arrange
      fakeWindowsFiles([`${battleNetDefault}\\D2R.exe`, `${cGames}\\D2R.exe`]);
      const service = new IconService();

      // Act
      const detected = service.findD2RInstallation();

      // Assert
      expect(detected).toBe(battleNetDefault);
    });

    it('If C:\\Games has no D2R.exe, Then it is skipped and nothing is detected', () => {
      // Arrange
      fakeWindowsFiles([`${cGames}\\Data\\data.000`]);
      const service = new IconService();

      // Act
      const detected = service.findD2RInstallation();

      // Assert
      expect(detected).toBeNull();
    });

    it('If no well-known folder has D2R.exe, Then nothing is suggested or detected', () => {
      // Arrange
      fakeWindowsFiles([`${battleNetDefault}\\Data\\data.000`]);
      const service = new IconService();

      // Act
      const suggested = service.getSuggestedD2RPath();
      const detected = service.findD2RInstallation();

      // Assert
      expect(suggested).toBeUndefined();
      expect(detected).toBeNull();
    });

    it('If D2R.exe is a folder, Then that folder is not suggested', () => {
      // Arrange
      fsOverrides.statSync = (file) => {
        if (file.replace(/\//g, '\\') === `${battleNetDefault}\\D2R.exe`) {
          return { isFile: () => false };
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      };
      const service = new IconService();

      // Act
      const suggested = service.getSuggestedD2RPath();

      // Assert
      expect(suggested).toBeUndefined();
    });

    it('If a folder cannot be read, Then it is skipped and the next one is suggested', () => {
      // Arrange
      fakeWindowsFiles([`${programFiles}\\D2R.exe`], [`${battleNetDefault}\\D2R.exe`]);
      const service = new IconService();

      // Act
      const suggested = service.getSuggestedD2RPath();

      // Assert
      expect(suggested).toBe(programFiles);
    });

    it('If a folder is suggested, Then the configured path is not changed', () => {
      // Arrange
      fakeWindowsFiles([`${battleNetDefault}\\D2R.exe`]);
      const service = new IconService();

      // Act
      service.getSuggestedD2RPath();

      // Assert
      expect(service.getD2RPath()).toBeNull();
    });
  });

  describe('When convertAllSprites is called', () => {
    it('If the sprite directory does not exist, Then surfaces a spriteConversionFailed error to the UI', async () => {
      // Arrange
      const service = new IconService();
      const missingD2rPath = path.join(tempDir, 'missing-d2r');

      // Act
      const result = await service.convertAllSprites(missingD2rPath);

      // Assert
      expect(result.success).toBe(false);
      expect(forwarder).toHaveBeenCalledTimes(1);
      expect(forwarder).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'IconService',
          operation: 'convertAllSprites',
          severity: 'error',
          code: 'spriteConversionFailed',
          detail: expect.stringContaining('Sprite directory not found'),
        }),
      );
    });
  });
});
