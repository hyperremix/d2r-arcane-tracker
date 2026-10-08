import { globalShortcut } from 'electron';
import type {
  GlobalHotkeyRegistration,
  GlobalHotkeyStatus,
  RunTrackerShortcutAction,
  Settings,
} from '../types/grail';
import { RUN_TRACKER_SHORTCUT_ACTIONS } from '../utils/runTrackerShortcuts';
import { createServiceLogger } from '../utils/serviceLogger';
import type { RunTrackerService } from './runTracker';

const log = createServiceLogger('GlobalHotkeyService');

/**
 * Default run tracker shortcuts (kept in sync with the renderer defaults).
 */
export const DEFAULT_RUN_TRACKER_SHORTCUTS: Readonly<Record<RunTrackerShortcutAction, string>> = {
  startRun: 'Ctrl+R',
  pauseRun: 'Ctrl+Space',
  endRun: 'Ctrl+E',
  endSession: 'Ctrl+Shift+E',
};

type AcceleratorModifier = 'CommandOrControl' | 'Alt' | 'Shift';

/**
 * Stored shortcuts use "Ctrl" for the platform's primary modifier (Cmd on macOS),
 * which maps to Electron's "CommandOrControl".
 */
const MODIFIER_TOKENS: Record<string, AcceleratorModifier> = {
  ctrl: 'CommandOrControl',
  control: 'CommandOrControl',
  cmd: 'CommandOrControl',
  command: 'CommandOrControl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
};

const NAMED_KEYS: Record<string, string> = {
  space: 'Space',
  spacebar: 'Space',
  esc: 'Escape',
  escape: 'Escape',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  insert: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
};

const FUNCTION_KEY_PATTERN = /^f([1-9]|1\d|2[0-4])$/;
const SINGLE_CHARACTER_KEY_PATTERN = /^[a-z0-9`\-=[\]\\;',./]$/;

/**
 * Converts a key token from a stored shortcut into an Electron accelerator key code.
 * @param token - Lower-cased key token (e.g. "r", "space", "f5", "arrowup")
 * @returns The accelerator key code, or undefined if the key is not supported
 */
function toAcceleratorKey(token: string): string | undefined {
  if (NAMED_KEYS[token]) {
    return NAMED_KEYS[token];
  }
  if (FUNCTION_KEY_PATTERN.test(token)) {
    return token.toUpperCase();
  }
  if (SINGLE_CHARACTER_KEY_PATTERN.test(token)) {
    return token.toUpperCase();
  }
  return undefined;
}

/**
 * Converts a stored run tracker shortcut (e.g. "Ctrl+Shift+E") into an Electron accelerator
 * (e.g. "CommandOrControl+Shift+E") suitable for `globalShortcut.register`.
 *
 * Global hotkeys swallow the key combination in every application, so a shortcut must use
 * Ctrl or Alt, unless its key is a function key (F1-F24). Plain or Shift-only letters would
 * break typing system-wide and are rejected.
 * @param shortcut - The stored shortcut string
 * @returns The Electron accelerator, or undefined if the shortcut cannot be used globally
 */
export function shortcutToAccelerator(shortcut: unknown): string | undefined {
  if (typeof shortcut !== 'string') {
    return undefined;
  }

  const tokens = shortcut
    .split('+')
    .map((token) => token.replace(/\s+/g, '').toLowerCase())
    .filter(Boolean);

  const modifiers = new Set<AcceleratorModifier>();
  let key: string | undefined;

  for (const token of tokens) {
    const modifier = MODIFIER_TOKENS[token];
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }
    if (key !== undefined) {
      // More than one non-modifier key is not a valid accelerator
      return undefined;
    }
    key = toAcceleratorKey(token);
    if (key === undefined) {
      return undefined;
    }
  }

  if (!key) {
    return undefined;
  }

  const isFunctionKey = /^F\d+$/.test(key);
  if (!isFunctionKey && !modifiers.has('CommandOrControl') && !modifiers.has('Alt')) {
    return undefined;
  }

  const orderedModifiers = (['CommandOrControl', 'Alt', 'Shift'] as const).filter((modifier) =>
    modifiers.has(modifier),
  );
  return [...orderedModifiers, key].join('+');
}

/**
 * Resolves the configured shortcuts, falling back to defaults for missing or malformed values.
 * @param shortcuts - The stored shortcuts setting (untrusted shape)
 * @returns A shortcut string for every action
 */
export function resolveRunTrackerShortcuts(
  shortcuts: unknown,
): Record<RunTrackerShortcutAction, string> {
  const source =
    typeof shortcuts === 'object' && shortcuts !== null
      ? (shortcuts as Partial<Record<RunTrackerShortcutAction, unknown>>)
      : {};
  const resolved = { ...DEFAULT_RUN_TRACKER_SHORTCUTS };
  for (const action of RUN_TRACKER_SHORTCUT_ACTIONS) {
    const value = source[action];
    if (typeof value === 'string' && value.trim()) {
      resolved[action] = value;
    }
  }
  return resolved;
}

/**
 * Returns whether auto mode (memory reading) controls runs, which disables manual run actions.
 * @param settings - Current settings
 * @param platform - The current platform (auto mode is Windows only)
 */
export function isRunTrackerAutoModeEnabled(
  settings: Pick<Settings, 'runTrackerMemoryReading'>,
  platform: NodeJS.Platform,
): boolean {
  return settings.runTrackerMemoryReading === true && platform === 'win32';
}

/**
 * Subset of the run tracker service used by global hotkeys.
 */
export type GlobalHotkeyRunTracker = Pick<
  RunTrackerService,
  | 'getActiveSession'
  | 'getActiveRun'
  | 'getState'
  | 'startRun'
  | 'endRun'
  | 'pauseRun'
  | 'resumeRun'
  | 'endSession'
>;

/**
 * Dependencies of the global hotkey service.
 */
export interface GlobalHotkeyServiceOptions {
  /** Reads the current settings from the database. */
  getSettings: () => Settings;
  /** Returns the run tracker service, if it was initialized. */
  getRunTracker: () => GlobalHotkeyRunTracker | null;
  /** Whether the main app window is focused (its own keyboard listener handles shortcuts then). */
  isAppFocused: () => boolean;
  /** Called whenever the registration status changes. */
  onStatusChange: (status: GlobalHotkeyStatus) => void;
  /** Platform override for tests. Defaults to `process.platform`. */
  platform?: NodeJS.Platform;
}

interface HotkeyBinding {
  action: RunTrackerShortcutAction;
  shortcut: string;
  accelerator: string | undefined;
}

/**
 * Registers the run tracker shortcuts as OS-wide hotkeys so they work while D2R is focused.
 *
 * Hotkeys are only registered while the main app window is not focused. While it is focused,
 * the renderer's own keyboard listener handles the shortcuts (including its confirmation
 * dialogs), so a key press never triggers an action twice.
 */
export class GlobalHotkeyService {
  private status: GlobalHotkeyStatus = { enabled: false, registrations: [] };
  private bindings: HotkeyBinding[] = [];
  private readonly registeredAccelerators = new Set<string>();
  private readonly platform: NodeJS.Platform;

  constructor(private readonly options: GlobalHotkeyServiceOptions) {
    this.platform = options.platform ?? process.platform;
  }

  /**
   * Returns the current registration status.
   */
  getStatus(): GlobalHotkeyStatus {
    return this.status;
  }

  /**
   * Re-reads the settings and (re-)registers or unregisters the hotkeys accordingly.
   * Registration is always attempted once so conflicts are reported immediately, even while the
   * app window is focused; the hotkeys are then released again until the window loses focus.
   */
  sync(): void {
    this.unregisterAll();

    const settings = this.readSettings();
    if (settings?.runTrackerGlobalHotkeys !== true) {
      this.bindings = [];
      this.setStatus({ enabled: false, registrations: [] });
      return;
    }

    const shortcuts = resolveRunTrackerShortcuts(settings.runTrackerShortcuts);
    this.bindings = RUN_TRACKER_SHORTCUT_ACTIONS.map((action) => ({
      action,
      shortcut: shortcuts[action],
      accelerator: shortcutToAccelerator(shortcuts[action]),
    }));

    this.registerBindings();

    if (this.options.isAppFocused()) {
      this.unregisterAll();
    }
  }

  /**
   * Registers the hotkeys when the app window loses focus and releases them when it gains focus.
   */
  handleFocusChange(): void {
    if (!this.status.enabled) {
      return;
    }

    if (this.options.isAppFocused()) {
      this.unregisterAll();
      return;
    }

    if (this.registeredAccelerators.size === 0) {
      this.registerBindings();
    }
  }

  /**
   * Runs a run tracker action triggered by a global hotkey.
   * Applies the same rules as the run tracker buttons: manual run actions are ignored while auto
   * mode is enabled, but ending the session stays available.
   * @param action - The triggered action
   */
  handleAction(action: RunTrackerShortcutAction): void {
    if (this.options.isAppFocused()) {
      // The renderer's keyboard listener handles shortcuts while the app is focused
      return;
    }

    const runTracker = this.options.getRunTracker();
    if (!runTracker) {
      return;
    }

    const settings = this.readSettings();
    const autoModeEnabled = settings ? isRunTrackerAutoModeEnabled(settings, this.platform) : false;

    try {
      if (action === 'endSession') {
        // Ending the session stays available in auto mode, matching the End Session button
        if (runTracker.getActiveSession()) {
          runTracker.endSession();
        }
        return;
      }
      if (!autoModeEnabled) {
        this.runManualAction(runTracker, action);
      }
    } catch (error) {
      log.error('handleAction', error, { action });
    }
  }

  private runManualAction(
    runTracker: GlobalHotkeyRunTracker,
    action: Exclude<RunTrackerShortcutAction, 'endSession'>,
  ): void {
    if (action === 'startRun') {
      if (runTracker.getActiveSession() && !runTracker.getActiveRun()) {
        runTracker.startRun(undefined, true);
      }
      return;
    }

    if (!runTracker.getActiveRun()) {
      return;
    }

    if (action === 'endRun') {
      runTracker.endRun(true);
    } else if (runTracker.getState().isPaused) {
      runTracker.resumeRun();
    } else {
      runTracker.pauseRun();
    }
  }

  /**
   * Unregisters all hotkeys owned by this service and stops reacting to presses.
   */
  dispose(): void {
    this.unregisterAll();
    this.bindings = [];
    this.status = { enabled: false, registrations: [] };
  }

  private readSettings(): Settings | undefined {
    try {
      return this.options.getSettings();
    } catch (error) {
      log.error('readSettings', error);
      return undefined;
    }
  }

  private registerBindings(): void {
    const claimed = new Set<string>();
    const registrations: GlobalHotkeyRegistration[] = this.bindings.map(
      ({ action, shortcut, accelerator }) => {
        if (!accelerator) {
          return { action, shortcut, state: 'unsupported' };
        }
        if (claimed.has(accelerator)) {
          // Another action already uses the same combination
          return { action, shortcut, state: 'conflict' };
        }
        claimed.add(accelerator);

        try {
          const registered = globalShortcut.register(accelerator, () => this.handleAction(action));
          if (!registered) {
            log.warn('register', `Global hotkey ${accelerator} is already in use`, { action });
            return { action, shortcut, state: 'conflict' };
          }
          this.registeredAccelerators.add(accelerator);
          return { action, shortcut, state: 'registered' };
        } catch (error) {
          log.error('register', error, { action, accelerator });
          return { action, shortcut, state: 'unsupported' };
        }
      },
    );

    this.setStatus({ enabled: true, registrations });
  }

  private unregisterAll(): void {
    for (const accelerator of this.registeredAccelerators) {
      try {
        globalShortcut.unregister(accelerator);
      } catch (error) {
        log.error('unregister', error, { accelerator });
      }
    }
    this.registeredAccelerators.clear();
  }

  private setStatus(next: GlobalHotkeyStatus): void {
    if (JSON.stringify(next) === JSON.stringify(this.status)) {
      return;
    }
    this.status = next;
    this.options.onStatusChange(next);
  }
}
