import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceErrorPayload } from '../types/serviceError';
import { setErrorForwarder } from '../utils/serviceLogger';
import { IconService } from './iconService';

// Hoisted because iconService.ts instantiates its singleton (calling app.getPath) on import.
const paths = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => paths.userData),
  },
}));

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
    rmSync(tempDir, { recursive: true, force: true });
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
