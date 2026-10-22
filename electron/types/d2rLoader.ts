/**
 * The D2RLoader bridge: the optional Arcane Tracker plugin for D2RLoader and its connection to the
 * app (see `plugin/PROTOCOL.md`).
 *
 * Shared by the main process and the renderer.
 */
import type { Item } from './catalog';

/** Loopback port the app listens on for the plugin unless the user changes it. */
export const DEFAULT_D2RLOADER_PORT = 41733;

/** Lowest port the user can choose; lower ports need administrator rights on some systems. */
export const MIN_D2RLOADER_PORT = 1024;

/** Highest TCP port. */
export const MAX_D2RLOADER_PORT = 65535;

/** Kinds of grail items the plugin reports. */
export const D2RLOADER_ITEM_KINDS = ['unique', 'set', 'rune'] as const;

/** Kind of a grail item the plugin reports. */
export type D2RLoaderItemKind = (typeof D2RLOADER_ITEM_KINDS)[number];

/** A grail-relevant item as the plugin describes it. */
export interface D2RLoaderItem {
  kind: D2RLoaderItemKind;
  /** Zero-based UniqueItems or SetItems row; -1 for runes. */
  recordId: number;
  /** Item code without padding spaces, for example `uap`. */
  code: string;
  ethereal: boolean;
}

/** Commands the plugin sends when the player presses one of its keybinds. */
export const D2RLOADER_COMMANDS = ['toggle-session'] as const;

/** A command the plugin sends when the player presses one of its keybinds. */
export type D2RLoaderCommand = (typeof D2RLOADER_COMMANDS)[number];

/** An event the plugin reports. */
export type D2RLoaderEvent =
  | { type: 'game-joined' }
  | { type: 'game-left' }
  | { type: 'level-changed'; levelId: number; previousLevelId: number }
  | { type: 'item-picked-up'; item: D2RLoaderItem }
  | { type: 'command'; action: D2RLoaderCommand };

/** State of the plugin connection, shown in the settings. */
export interface D2RLoaderStatus {
  /** Whether the user turned the connection on. */
  enabled: boolean;
  /** Whether the app listens for the plugin. */
  listening: boolean;
  /** Port the app listens on, or tries to. */
  port: number;
  /** Whether the plugin reached the app in the last few seconds. */
  connected: boolean;
  /** Version of the connected plugin. */
  pluginVersion?: string;
  /** Why the app can't listen: the port is used by another program, or another error. */
  error?: 'portInUse' | 'listenFailed';
}

/** Where D2RLoader and the plugin are, and whether the plugin is installed. */
export interface D2RLoaderInstallation {
  /** The D2R folder from the settings; undefined when none is set. */
  gameFolder?: string;
  /** Whether D2RLoader.exe is in the D2R folder. */
  loaderFound: boolean;
  /** Whether this build of the app ships the plugin. */
  pluginBundled: boolean;
  /** Whether the plugin DLL is in D2RLoader's plugin folder. */
  pluginInstalled: boolean;
  /** Whether the installed DLL is the one this app ships. */
  pluginUpToDate: boolean;
  /** Whether the plugin's config file has the app's port and token. */
  configured: boolean;
}

/** Outcome of installing, updating or removing the plugin. */
export interface D2RLoaderInstallResult {
  installation: D2RLoaderInstallation;
  /** Set when the user declined the administrator prompt. */
  canceled?: boolean;
}

/** Sent to the renderers when the player picks up a grail item that isn't found yet. */
export interface D2RLoaderPickupPayload {
  grailItem: Item;
  ethereal: boolean;
}

/** Outcome of importing Run Counter's runs and drops. */
export interface RunCounterImportResult {
  /** Folder the CSV files were read from. */
  folder: string;
  /** Whether the folder has Run Counter's runs.csv. */
  found: boolean;
  sessions: number;
  runs: number;
  items: number;
  /** Runs that were already imported before and were skipped. */
  skippedRuns: number;
}
