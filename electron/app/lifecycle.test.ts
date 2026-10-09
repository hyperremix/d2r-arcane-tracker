import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppLifecycle,
  closeWindowAndWait,
  deferQuitUntilShutdown,
  shutdownWhenStarted,
} from './lifecycle';

describe('When the app lifecycle shuts down', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
    vi.useRealTimers();
  });

  it('Then the steps run in reverse registration order and asynchronous steps are awaited', async () => {
    // Arrange
    const calls: string[] = [];
    const lifecycle = new AppLifecycle();
    lifecycle.onShutdown('database', () => {
      calls.push('database');
    });
    lifecycle.onShutdown('monitor', async () => {
      await Promise.resolve();
      calls.push('monitor');
    });
    lifecycle.onShutdown('hotkeys', () => {
      calls.push('hotkeys');
    });

    // Act
    await lifecycle.shutdown();

    // Assert
    expect(calls).toEqual(['hotkeys', 'monitor', 'database']);
  });

  it('If a step fails, Then the error is logged and the remaining steps still run', async () => {
    // Arrange
    const closeDatabase = vi.fn();
    const lifecycle = new AppLifecycle();
    lifecycle.onShutdown('database', closeDatabase);
    lifecycle.onShutdown('run tracker', () => {
      throw new Error('session write failed');
    });
    lifecycle.onShutdown('monitor', () => Promise.reject(new Error('watcher close failed')));

    // Act
    await lifecycle.shutdown();

    // Assert
    expect(closeDatabase).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith('[shutdown] run tracker failed:', expect.any(Error));
    expect(consoleError).toHaveBeenCalledWith('[shutdown] monitor failed:', expect.any(Error));
  });

  it('If a step hangs, Then the next steps run after the step timeout', async () => {
    // Arrange
    vi.useFakeTimers();
    const closeDatabase = vi.fn();
    const lifecycle = new AppLifecycle(100);
    lifecycle.onShutdown('database', closeDatabase);
    lifecycle.onShutdown('memory reader', () => new Promise<void>(() => undefined));

    // Act
    const shutdown = lifecycle.shutdown();
    await vi.advanceTimersByTimeAsync(100);
    await shutdown;

    // Assert
    expect(closeDatabase).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      '[shutdown] memory reader failed:',
      expect.objectContaining({ message: 'Timed out after 100ms' }),
    );
  });

  it('If steps finish or fail in time, Then no step timeout timer is left pending', async () => {
    // Arrange
    vi.useFakeTimers();
    const lifecycle = new AppLifecycle(100);
    lifecycle.onShutdown('database', () => undefined);
    lifecycle.onShutdown('monitor', async () => {
      await Promise.resolve();
    });
    lifecycle.onShutdown('run tracker', () => {
      throw new Error('session write failed');
    });

    // Act
    await lifecycle.shutdown();

    // Assert
    expect(vi.getTimerCount()).toBe(0);
  });

  it('If shutdown is requested twice, Then every step runs only once', async () => {
    // Arrange
    const closeDatabase = vi.fn();
    const lifecycle = new AppLifecycle();
    lifecycle.onShutdown('database', closeDatabase);

    // Act
    await Promise.all([lifecycle.shutdown(), lifecycle.shutdown()]);
    await lifecycle.shutdown();

    // Assert
    expect(closeDatabase).toHaveBeenCalledTimes(1);
  });
});

describe('When the app is asked to quit', () => {
  function createApp() {
    const emitter = new EventEmitter();
    const app = {
      on: (event: 'before-quit', listener: (event: { preventDefault(): void }) => void) =>
        emitter.on(event, listener),
      quit: vi.fn(() => {
        requestQuit();
      }),
    };
    const requestQuit = () => {
      const event = { preventDefault: vi.fn() };
      emitter.emit('before-quit', event);
      return event;
    };
    return { app, requestQuit };
  }

  it('Then quitting is deferred until the shutdown has finished', async () => {
    // Arrange
    const { app, requestQuit } = createApp();
    let finishShutdown: () => void = () => undefined;
    const shutdown = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishShutdown = resolve;
        }),
    );
    deferQuitUntilShutdown(app, shutdown);

    // Act
    const firstRequest = requestQuit();
    const secondRequest = requestQuit();
    const quitBeforeShutdownFinished = app.quit.mock.calls.length;
    finishShutdown();
    await vi.waitFor(() => expect(app.quit).toHaveBeenCalledTimes(1));

    // Assert
    expect(firstRequest.preventDefault).toHaveBeenCalled();
    expect(secondRequest.preventDefault).toHaveBeenCalled();
    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(quitBeforeShutdownFinished).toBe(0);
  });

  it('If the shutdown has finished, Then the final quit is not prevented', async () => {
    // Arrange
    const { app, requestQuit } = createApp();
    deferQuitUntilShutdown(app, () => Promise.resolve());
    requestQuit();
    await vi.waitFor(() => expect(app.quit).toHaveBeenCalledTimes(1));

    // Act
    const finalRequest = requestQuit();

    // Assert
    expect(finalRequest.preventDefault).not.toHaveBeenCalled();
  });
});

describe('When the app is asked to stop while it is still starting', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('If the startup is still pending, Then the shutdown waits for it and then stops the started app', async () => {
    // Arrange
    const calls: string[] = [];
    const startedApp = {
      shutdown: vi.fn(async () => {
        calls.push('app.shutdown');
      }),
    };
    let finishStartup!: (app: typeof startedApp) => void;
    const startup = new Promise<typeof startedApp>((resolve) => {
      finishStartup = resolve;
    });

    // Act
    const stopped = shutdownWhenStarted(startup).then(() => calls.push('stopped'));
    await Promise.resolve();
    const shutdownBeforeStartupFinished = startedApp.shutdown.mock.calls.length;
    calls.push('startup.finished');
    finishStartup(startedApp);
    await stopped;

    // Assert
    expect(shutdownBeforeStartupFinished).toBe(0);
    expect(calls).toEqual(['startup.finished', 'app.shutdown', 'stopped']);
  });

  it('If the startup already finished, Then the started app is stopped once', async () => {
    // Arrange
    const startedApp = { shutdown: vi.fn(() => Promise.resolve()) };

    // Act
    await shutdownWhenStarted(Promise.resolve(startedApp));

    // Assert
    expect(startedApp.shutdown).toHaveBeenCalledTimes(1);
  });

  it('If the startup failed or never began, Then there is nothing to stop and it resolves', async () => {
    // Arrange / Act / Assert
    await expect(shutdownWhenStarted(Promise.resolve(undefined))).resolves.toBeUndefined();
    await expect(shutdownWhenStarted(undefined)).resolves.toBeUndefined();
  });

  it('If waiting for the startup rejects, Then the error is logged and the shutdown still resolves', async () => {
    // Arrange
    const failure = new Error('startup rejected');

    // Act
    await expect(shutdownWhenStarted(Promise.reject(failure))).resolves.toBeUndefined();

    // Assert
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[shutdown]'), failure);
  });

  it('If a quit is requested while the startup is pending, Then the app quits only after the started app stopped', async () => {
    // Arrange
    const calls: string[] = [];
    const startedApp = {
      shutdown: vi.fn(async () => {
        calls.push('app.shutdown');
      }),
    };
    let finishStartup!: (app: typeof startedApp) => void;
    const startup = new Promise<typeof startedApp>((resolve) => {
      finishStartup = resolve;
    });
    const emitter = new EventEmitter();
    const app = {
      on: (event: 'before-quit', listener: (event: { preventDefault(): void }) => void) =>
        emitter.on(event, listener),
      quit: vi.fn(() => {
        calls.push('app.quit');
      }),
    };
    deferQuitUntilShutdown(app, () => shutdownWhenStarted(startup));

    // Act
    emitter.emit('before-quit', { preventDefault: vi.fn() });
    await Promise.resolve();
    const quitBeforeStartupFinished = app.quit.mock.calls.length;
    finishStartup(startedApp);
    await vi.waitFor(() => expect(app.quit).toHaveBeenCalledTimes(1));

    // Assert
    expect(quitBeforeStartupFinished).toBe(0);
    expect(calls).toEqual(['app.shutdown', 'app.quit']);
  });
});

describe('When a window is closed and awaited', () => {
  function createWindow() {
    const emitter = new EventEmitter();
    let destroyed = false;
    return {
      isDestroyed: () => destroyed,
      close: vi.fn(),
      destroy: vi.fn(() => {
        destroyed = true;
      }),
      once: (event: 'closed', listener: () => void) => emitter.once(event, listener),
      emitClosed: () => {
        destroyed = true;
        emitter.emit('closed');
      },
    };
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Then it resolves once the window has closed', async () => {
    // Arrange
    const window = createWindow();
    window.close.mockImplementation(() => window.emitClosed());

    // Act
    await closeWindowAndWait(window);

    // Assert
    expect(window.close).toHaveBeenCalledTimes(1);
    expect(window.destroy).not.toHaveBeenCalled();
  });

  it('If the window does not close in time, Then it is destroyed', async () => {
    // Arrange
    vi.useFakeTimers();
    const window = createWindow();

    // Act
    const closing = closeWindowAndWait(window, 100);
    await vi.advanceTimersByTimeAsync(100);
    await closing;

    // Assert
    expect(window.destroy).toHaveBeenCalledTimes(1);
  });

  it('If the window is already destroyed, Then it resolves without closing it', async () => {
    // Arrange
    const window = createWindow();
    window.emitClosed();

    // Act
    await closeWindowAndWait(window);

    // Assert
    expect(window.close).not.toHaveBeenCalled();
  });
});
