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
