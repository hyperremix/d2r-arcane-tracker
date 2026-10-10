import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  autoUpdater: {
    on: vi.fn(),
    removeListener: vi.fn(),
    checkForUpdates: vi.fn(),
  } as Record<string, unknown> & {
    on: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    checkForUpdates: ReturnType<typeof vi.fn>;
  },
}));

vi.mock('electron', () => ({ app: { getVersion: () => '1.0.0' } }));
vi.mock('electron-updater', () => ({ autoUpdater: mocks.autoUpdater }));

import { UpdateService } from './updateService';

describe('When the update service is disposed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.autoUpdater.on.mockClear();
    mocks.autoUpdater.removeListener.mockClear();
    mocks.autoUpdater.checkForUpdates.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Then every auto-updater listener it registered is removed', () => {
    // Arrange
    const service = new UpdateService();
    service.initialize(false);
    const registered = mocks.autoUpdater.on.mock.calls.map(([event, listener]) => [
      event,
      listener,
    ]);

    // Act
    service.dispose();

    // Assert
    expect(registered.length).toBeGreaterThan(0);
    expect(mocks.autoUpdater.removeListener.mock.calls).toEqual(registered);
  });

  it('If the startup check is still pending, Then it never runs', async () => {
    // Arrange
    const service = new UpdateService();
    service.initialize(true);

    // Act
    service.dispose();
    await vi.advanceTimersByTimeAsync(5000);

    // Assert
    expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('If it is not disposed, Then the startup check runs after the delay', async () => {
    // Arrange
    const service = new UpdateService();

    // Act
    service.initialize(true);
    await vi.advanceTimersByTimeAsync(5000);

    // Assert
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    service.dispose();
  });

  it('Then status changes are no longer reported', () => {
    // Arrange
    const service = new UpdateService();
    const statusCallback = vi.fn();
    service.setStatusCallback(statusCallback);
    service.initialize(false);
    const errorListener = mocks.autoUpdater.on.mock.calls.find(([event]) => event === 'error')?.[1];

    // Act
    service.dispose();
    errorListener?.(new Error('offline'));

    // Assert
    expect(statusCallback).not.toHaveBeenCalled();
  });
});
