/**
 * Application settings.
 *
 * Shared by the main process and the renderer; re-exported from `./grail`.
 */
import type { WidgetSize } from '../utils/widgetDisplay';

/**
 * Enum representing the different game modes for Holy Grail tracking.
 */
export enum GameMode {
  Both = 'both',
  Softcore = 'softcore',
  Hardcore = 'hardcore',
  Manual = 'manual',
}

/**
 * Enum representing the different versions of Diablo 2.
 */
export enum GameVersion {
  Resurrected = 'Resurrected',
  Classic = 'Classic',
}

/**
 * Type representing all application settings.
 */
export type Settings = {
  saveDir: string;
  lang: string;
  gameMode: GameMode;
  grailNormal: boolean;
  grailEthereal: boolean;
  grailRunes: boolean;
  grailRunewords: boolean;
  gameVersion: GameVersion;
  enableSounds: boolean;
  notificationVolume: number;
  inAppNotifications: boolean;
  nativeNotifications: boolean;
  needsSeeding: boolean;
  theme: 'light' | 'dark' | 'system';
  showItemIcons: boolean;
  d2rInstallPath?: string; // Path to D2R installation
  iconConversionStatus?: 'not_started' | 'in_progress' | 'completed' | 'failed';
  iconConversionProgress?: { current: number; total: number };
  // Advanced monitoring settings (optional, with defaults)
  tickReaderIntervalMs?: number; // Default: 500
  chokidarPollingIntervalMs?: number; // Default: 1000
  fileStabilityThresholdMs?: number; // Default: 300
  fileChangeDebounceMs?: number; // Default: 2000
  // Widget settings
  widgetEnabled?: boolean; // Whether the widget is enabled
  widgetDisplay?: 'overall' | 'split' | 'all' | 'run-only'; // Widget display mode (overall only, normal+ethereal, all three, or run counter only)
  widgetPosition?: { x: number; y: number }; // Widget position on screen
  widgetOpacity?: number; // Widget opacity (0.0 to 1.0)
  widgetSizeOverall?: WidgetSize; // Custom size for overall mode
  widgetSizeSplit?: WidgetSize; // Custom size for split mode
  widgetSizeAll?: WidgetSize; // Custom size for all mode
  widgetSizeRunOnly?: WidgetSize; // Custom size for run-only mode
  /**
   * When true, the widget is locked in place: clicks pass through it to the game, it cannot be
   * focused, dragged or resized. Unlock it again from the widget settings. Defaults to false.
   */
  widgetLocked?: boolean;
  /**
   * When true (default), the run-only widget variant shows a compact text list
   * of grail-relevant items found in recent runs for the active session.
   * When false, only the run/session statistics are shown.
   */
  widgetRunOnlyShowItems?: boolean;
  // Main window settings
  mainWindowBounds?: { x: number; y: number; width: number; height: number }; // Main window position and size
  // Wizard settings
  wizardCompleted?: boolean; // Whether the setup wizard has been completed
  wizardSkipped?: boolean; // Whether the user skipped the setup wizard
  // Terror zone configuration
  terrorZoneConfig?: Record<string, boolean>; // Zone ID -> enabled state
  terrorZoneBackupCreated?: boolean; // Whether backup has been created
  // Run tracker settings
  runTrackerAutoStart?: boolean; // Whether to automatically start runs when save files are modified
  runTrackerEndThreshold?: number; // Time in seconds before ending a run (default: 10)
  runTrackerMemoryReading?: boolean; // Whether to use memory reading for game detection (Windows only, default: false)
  runTrackerMemoryPollingInterval?: number; // How often to poll memory in milliseconds (default: 500)
  runTrackerShortcuts?: {
    startRun: string; // default: 'Ctrl+R'
    pauseRun: string; // default: 'Ctrl+Space'
    endRun: string; // default: 'Ctrl+E'
    endSession: string; // default: 'Ctrl+Shift+E'
  };
  runTrackerGlobalHotkeys?: boolean; // Whether run tracker shortcuts also work while other apps are focused (default: false)
};
