import type { RunTrackerShortcutAction } from '../types/grail';

/**
 * Run tracker shortcut actions in registration order.
 */
export const RUN_TRACKER_SHORTCUT_ACTIONS: readonly RunTrackerShortcutAction[] = [
  'startRun',
  'pauseRun',
  'endRun',
  'endSession',
];

/**
 * Default run tracker shortcuts, used when a stored shortcut is missing or malformed.
 * The renderer keeps its own copies for its settings defaults.
 */
export const DEFAULT_RUN_TRACKER_SHORTCUTS: Readonly<Record<RunTrackerShortcutAction, string>> = {
  startRun: 'Ctrl+R',
  pauseRun: 'Ctrl+Space',
  endRun: 'Ctrl+E',
  endSession: 'Ctrl+Shift+E',
};
