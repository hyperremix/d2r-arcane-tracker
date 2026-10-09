/**
 * Application update status.
 *
 * Shared by the main process and the renderer; re-exported from `./grail`.
 */

/**
 * Information about an available update.
 */
export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  downloadedPercent?: number;
}

/**
 * Current status of the application update process.
 */
export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error?: string;
  info?: UpdateInfo;
}
