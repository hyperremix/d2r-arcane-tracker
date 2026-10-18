/** biome-ignore-all lint/suspicious/noExplicitAny: handlers are retrieved from mocked ipcMain.handle calls */
import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrailDatabase } from '../database/database';
import { EventBus } from '../services/EventBus';
import type { FarmingService } from '../services/farming/farmingService';
import { SettingsService } from '../services/settingsService';
import { initializeFarmingHandlers } from './farmingHandlers';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
}));

const getOverview = vi.fn();
const getItemSources = vi.fn();
const grailDatabase = {
  getAllSettings: vi.fn(),
  setSetting: vi.fn(),
};

function getHandler(channel: string) {
  return vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === channel)?.[1] as any;
}

const overviewRequest = { itemIds: ['ber', 'harlequincrest'], characterLevel: 85 };
const itemSourcesRequest = { itemId: 'ber', players: 3, magicFind: 200, characterLevel: 85 };

describe('When the farming handlers are initialized', () => {
  let dispose: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    dispose = initializeFarmingHandlers({
      farmingService: { getOverview, getItemSources } as unknown as FarmingService,
      settings: new SettingsService(grailDatabase as unknown as GrailDatabase, new EventBus()),
    });
  });

  it('Then both farming channels are handled and disposing removes them', () => {
    // Arrange
    const channels = vi.mocked(ipcMain.handle).mock.calls.map((call) => call[0]);

    // Act
    dispose();

    // Assert
    expect(channels.sort()).toEqual(['farming:getItemSources', 'farming:getOverview']);
    expect(
      vi
        .mocked(ipcMain.removeHandler)
        .mock.calls.map((call) => call[0])
        .sort(),
    ).toEqual(['farming:getItemSources', 'farming:getOverview']);
  });

  it('If the overview is requested, Then the service answers for the configured D2R install path', async () => {
    // Arrange
    vi.mocked(grailDatabase.getAllSettings).mockReturnValue({ d2rInstallPath: '/d2r' } as any);
    const overview = { status: 'ready', locations: [], terrorZones: [], unknownItemIndexes: [] };
    getOverview.mockReturnValue(overview);

    // Act
    const result = await getHandler('farming:getOverview')({}, overviewRequest);

    // Assert
    expect(getOverview).toHaveBeenCalledWith('/d2r', overviewRequest);
    expect(result).toBe(overview);
  });

  it('If the install path setting changes between requests, Then each request uses the current path', async () => {
    // Arrange
    const handler = getHandler('farming:getOverview');
    vi.mocked(grailDatabase.getAllSettings).mockReturnValueOnce({
      d2rInstallPath: '/first',
    } as any);
    vi.mocked(grailDatabase.getAllSettings).mockReturnValueOnce({} as any);

    // Act
    await handler({}, overviewRequest);
    await handler({}, overviewRequest);

    // Assert
    expect(getOverview).toHaveBeenNthCalledWith(1, '/first', overviewRequest);
    expect(getOverview).toHaveBeenNthCalledWith(2, undefined, overviewRequest);
  });

  it('If the item sources are requested, Then the service answers for the configured D2R install path', async () => {
    // Arrange
    vi.mocked(grailDatabase.getAllSettings).mockReturnValue({ d2rInstallPath: '/d2r' } as any);
    const sources = { status: 'ready', known: true, sources: [] };
    getItemSources.mockReturnValue(sources);

    // Act
    const result = await getHandler('farming:getItemSources')({}, itemSourcesRequest);

    // Assert
    expect(getItemSources).toHaveBeenCalledWith('/d2r', itemSourcesRequest);
    expect(result).toBe(sources);
  });

  it.each([
    ['a character level above the maximum', { itemIds: ['ber'], characterLevel: 100 }],
    ['a non-integer character level', { itemIds: ['ber'], characterLevel: 85.5 }],
    ['an empty item ID', { itemIds: [''], characterLevel: 85 }],
    ['item IDs that are not a list', { itemIds: 'ber', characterLevel: 85 }],
    ['no request', undefined],
  ])('If the overview request has %s, Then it is rejected before the service runs', async (_, request) => {
    // Arrange
    vi.mocked(grailDatabase.getAllSettings).mockReturnValue({ d2rInstallPath: '/d2r' } as any);

    // Act
    const result = getHandler('farming:getOverview')({}, request);

    // Assert
    await expect(result).rejects.toThrow();
    expect(getOverview).not.toHaveBeenCalled();
  });

  it.each([
    ['players above the maximum', { ...itemSourcesRequest, players: 9 }],
    ['negative magic find', { ...itemSourcesRequest, magicFind: -1 }],
    ['an empty item ID', { ...itemSourcesRequest, itemId: '' }],
    ['a character level of 0', { ...itemSourcesRequest, characterLevel: 0 }],
  ])('If the item sources request has %s, Then it is rejected before the service runs', async (_, request) => {
    // Arrange
    vi.mocked(grailDatabase.getAllSettings).mockReturnValue({ d2rInstallPath: '/d2r' } as any);

    // Act
    const result = getHandler('farming:getItemSources')({}, request);

    // Assert
    await expect(result).rejects.toThrow();
    expect(getItemSources).not.toHaveBeenCalled();
  });
});
