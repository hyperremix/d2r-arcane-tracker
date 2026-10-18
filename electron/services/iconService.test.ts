import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
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
      const service = new IconService();

      // Act
      const suggested = service.getSuggestedD2RPath();
      const detected = service.findD2RInstallation();

      // Assert
      expect(suggested).toBe(install);
      expect(detected).toBe(install);
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
