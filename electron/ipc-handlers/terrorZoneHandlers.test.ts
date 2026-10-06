/** biome-ignore-all lint/suspicious/noExplicitAny: handlers are retrieved from mocked ipcMain.handle calls */
import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { grailDatabase } from '../database/database';
import { initializeTerrorZoneHandlers } from './terrorZoneHandlers';

const { validateGameFile } = vi.hoisted(() => ({ validateGameFile: vi.fn() }));

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('../database/database', () => ({
  grailDatabase: {
    getAllSettings: vi.fn(),
    setSetting: vi.fn(),
  },
}));

vi.mock('../services/terrorZoneService', () => ({
  TerrorZoneService: class {
    validateGameFile = validateGameFile;
  },
}));

function getHandler(channel: string) {
  return vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === channel)?.[1] as any;
}

describe('When the terrorZone:validatePath handler is invoked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    initializeTerrorZoneHandlers();
  });

  it('If no D2R install path is configured, Then it returns the pathNotConfigured error code', async () => {
    // Arrange
    vi.mocked(grailDatabase.getAllSettings).mockReturnValue({} as any);
    const handler = getHandler('terrorZone:validatePath');

    // Act
    const result = await handler();

    // Assert
    expect(result).toMatchObject({ valid: false, errorCode: 'pathNotConfigured' });
    expect(validateGameFile).not.toHaveBeenCalled();
  });

  it('If an unexpected error is thrown, Then it returns the unknown error code with the error message', async () => {
    // Arrange
    vi.mocked(grailDatabase.getAllSettings).mockImplementation(() => {
      throw new Error('database unavailable');
    });
    const handler = getHandler('terrorZone:validatePath');

    // Act
    const result = await handler();

    // Assert
    expect(result).toEqual({
      valid: false,
      error: 'database unavailable',
      errorCode: 'unknown',
    });
  });

  it('If the validation service reports a result, Then the handler returns it unchanged', async () => {
    // Arrange
    vi.mocked(grailDatabase.getAllSettings).mockReturnValue({ d2rInstallPath: '/d2r' } as any);
    validateGameFile.mockResolvedValue({ valid: false, errorCode: 'gameFileNotFound' });
    const handler = getHandler('terrorZone:validatePath');

    // Act
    const result = await handler();

    // Assert
    expect(validateGameFile).toHaveBeenCalledWith('/d2r');
    expect(result).toEqual({ valid: false, errorCode: 'gameFileNotFound' });
  });
});
