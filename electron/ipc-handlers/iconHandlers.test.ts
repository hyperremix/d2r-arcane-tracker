/** biome-ignore-all lint/suspicious/noExplicitAny: handlers are retrieved from mocked ipcMain.handle calls */
import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IconService } from '../services/iconService';
import type { SettingsService } from '../services/settingsService';
import { initializeIconHandlers } from './iconHandlers';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));

const iconService = {
  getD2RPath: vi.fn(),
  setD2RPath: vi.fn(),
  findD2RInstallation: vi.fn(),
  getSuggestedD2RPath: vi.fn(),
  convertAllSprites: vi.fn(),
};
const settings = {
  get: vi.fn(),
  update: vi.fn(),
};

function getHandler(channel: string) {
  return vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === channel)?.[1] as any;
}

describe('When the icon:convertSprites handler is invoked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    iconService.convertAllSprites.mockResolvedValue({ success: true, totalFiles: 3 });
    initializeIconHandlers({
      iconService: iconService as unknown as IconService,
      settings: settings as unknown as SettingsService,
    });
  });

  it('If the icon service has no path yet but one is saved, Then it converts from the saved path', async () => {
    // Arrange
    iconService.getD2RPath.mockReturnValue(null);
    settings.get.mockImplementation((key: string) =>
      key === 'd2rInstallPath' ? '/games/d2r' : undefined,
    );
    const handler = getHandler('icon:convertSprites');

    // Act
    await handler({});

    // Assert
    expect(iconService.convertAllSprites).toHaveBeenCalledWith('/games/d2r', expect.any(Function));
    expect(iconService.setD2RPath).toHaveBeenCalledWith('/games/d2r');
  });

  it('If the icon service already has a path, Then it converts from that path', async () => {
    // Arrange
    iconService.getD2RPath.mockReturnValue('/games/service');
    settings.get.mockReturnValue('/games/saved');
    const handler = getHandler('icon:convertSprites');

    // Act
    await handler({});

    // Assert
    expect(iconService.convertAllSprites).toHaveBeenCalledWith(
      '/games/service',
      expect.any(Function),
    );
  });

  it('If no path is known anywhere, Then it fails and records the failed status', async () => {
    // Arrange
    iconService.getD2RPath.mockReturnValue(null);
    settings.get.mockReturnValue(undefined);
    const handler = getHandler('icon:convertSprites');

    // Act
    const result = handler({});

    // Assert
    await expect(result).rejects.toThrow('D2R installation path not set');
    expect(iconService.convertAllSprites).not.toHaveBeenCalled();
    expect(settings.update).toHaveBeenCalledWith({ iconConversionStatus: 'failed' });
  });
});

describe('When the icon:getD2RPath handler is invoked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    initializeIconHandlers({
      iconService: iconService as unknown as IconService,
      settings: settings as unknown as SettingsService,
    });
  });

  it('If the icon service has no path but one is saved, Then it loads the saved path into the service', async () => {
    // Arrange
    iconService.getD2RPath.mockReturnValue(null);
    settings.get.mockReturnValue('/games/d2r');
    const handler = getHandler('icon:getD2RPath');

    // Act
    const result = await handler({});

    // Assert
    expect(result).toBe('/games/d2r');
    expect(iconService.setD2RPath).toHaveBeenCalledWith('/games/d2r');
    expect(iconService.findD2RInstallation).not.toHaveBeenCalled();
  });
});

describe('When the icon:getSuggestedD2RPath handler is invoked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    initializeIconHandlers({
      iconService: iconService as unknown as IconService,
      settings: settings as unknown as SettingsService,
    });
  });

  it('If an installation is found, Then it is returned without being saved', async () => {
    // Arrange
    iconService.getSuggestedD2RPath.mockReturnValue('C:\\Program Files\\Diablo II Resurrected');
    const handler = getHandler('icon:getSuggestedD2RPath');

    // Act
    const result = await handler({});

    // Assert
    expect(result).toBe('C:\\Program Files\\Diablo II Resurrected');
    expect(settings.update).not.toHaveBeenCalled();
    expect(iconService.setD2RPath).not.toHaveBeenCalled();
  });

  it('If detection throws, Then nothing is suggested', async () => {
    // Arrange
    iconService.getSuggestedD2RPath.mockImplementation(() => {
      throw new Error('EPERM');
    });
    const handler = getHandler('icon:getSuggestedD2RPath');

    // Act
    const result = await handler({});

    // Assert
    expect(result).toBeUndefined();
  });
});
