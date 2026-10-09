/** Longest time a single shutdown step may take before the next one runs. */
const DEFAULT_STEP_TIMEOUT_MS = 5000;

/** One teardown step of the running app. */
interface ShutdownStep {
  name: string;
  run: () => void | Promise<void>;
}

/**
 * Collects teardown steps while the app starts and runs them in reverse start order on shutdown,
 * so everything is stopped before the things it depends on (the database closes last).
 */
export class AppLifecycle {
  private readonly steps: ShutdownStep[] = [];
  private shutdownPromise: Promise<void> | undefined;

  /**
   * @param stepTimeoutMs - Longest time a step may take; a step that hangs must not keep the app
   *   from quitting
   */
  constructor(private readonly stepTimeoutMs = DEFAULT_STEP_TIMEOUT_MS) {}

  /**
   * Registers the teardown of something that was just started.
   * @param name - Name used in error logs
   * @param run - The teardown; may be asynchronous
   */
  onShutdown(name: string, run: () => void | Promise<void>): void {
    this.steps.push({ name, run });
  }

  /**
   * Runs every registered step once, newest first. A failing or hanging step is logged and does not
   * stop the remaining steps. Calling it again returns the same shutdown.
   * @returns Promise that resolves when all steps have finished; it never rejects
   */
  shutdown(): Promise<void> {
    this.shutdownPromise ??= this.runSteps();
    return this.shutdownPromise;
  }

  private async runSteps(): Promise<void> {
    for (const step of [...this.steps].reverse()) {
      try {
        await this.runWithTimeout(step);
      } catch (error) {
        console.error(`[shutdown] ${step.name} failed:`, error);
      }
    }
  }

  private async runWithTimeout(step: ShutdownStep): Promise<void> {
    let timeout: NodeJS.Timeout | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error(`Timed out after ${this.stepTimeoutMs}ms`)),
        this.stepTimeoutMs,
      );
    });
    try {
      await Promise.race([Promise.resolve().then(step.run), timedOut]);
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** The parts of Electron's `app` the quit handling relies on. */
export interface QuittableApp {
  on(event: 'before-quit', listener: (event: { preventDefault(): void }) => void): unknown;
  quit(): void;
}

/**
 * Makes quitting wait for the asynchronous shutdown: the first quit request is deferred until the
 * shutdown has finished, then the app quits for real. Quit requests during the shutdown are ignored.
 * @param app - Electron's `app`
 * @param shutdown - Stops the running app; must not reject
 */
export function deferQuitUntilShutdown(app: QuittableApp, shutdown: () => Promise<void>): void {
  let state: 'running' | 'stopping' | 'stopped' = 'running';

  app.on('before-quit', (event) => {
    if (state === 'stopped') {
      return;
    }

    event.preventDefault();
    if (state === 'stopping') {
      return;
    }

    state = 'stopping';
    void shutdown().finally(() => {
      state = 'stopped';
      app.quit();
    });
  });
}

/** The parts of a `BrowserWindow` needed to close it. */
export interface ClosableWindow {
  isDestroyed(): boolean;
  close(): void;
  destroy(): void;
  once(event: 'closed', listener: () => void): unknown;
}

/**
 * Closes a window and waits until it is closed, so its close handlers (which save the window
 * bounds) have run. A window that does not close in time (e.g. a renderer cancels the unload) is
 * destroyed.
 * @param window - The window to close
 * @param timeoutMs - Longest time to wait for the window to close
 */
export function closeWindowAndWait(window: ClosableWindow, timeoutMs = 2000): Promise<void> {
  if (window.isDestroyed()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (!window.isDestroyed()) {
        window.destroy();
      }
      resolve();
    }, timeoutMs);

    window.once('closed', () => {
      clearTimeout(timeout);
      resolve();
    });
    window.close();
  });
}
