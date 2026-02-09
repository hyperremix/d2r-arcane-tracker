import { app } from 'electron';
import type { UpdateInfo as ElectronUpdaterInfo } from 'electron-updater';
import { autoUpdater } from 'electron-updater';
import type { UpdateInfo, UpdateStatus } from '../types/grail';

import { createServiceLogger } from '../utils/serviceLogger';

const log = createServiceLogger('UpdateService');

/**
 * Service for managing application updates using electron-updater.
 * Handles checking for updates, downloading, and installing new versions.
 */
class UpdateService {
  private updateStatus: UpdateStatus = {
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
  };

  private statusCallback?: (status: UpdateStatus) => void;

  /**
   * Initializes the update service with event handlers and configuration.
   * @param {boolean} checkOnStartup - Whether to check for updates immediately after initialization
   */
  initialize(checkOnStartup = true) {
    // Configure auto-updater
    autoUpdater.autoDownload = false; // Don't auto-download, let user confirm
    autoUpdater.autoInstallOnAppQuit = true; // Auto-install when app quits

    // Set up logging for debugging
    autoUpdater.logger = {
      info: (message) => log.info('autoUpdater', message),
      warn: (message) => log.warn('autoUpdater', message),
      error: (message) => log.error('autoUpdater', message),
      debug: (message) => log.info('autoUpdater', message),
    };

    // Register event handlers
    this.registerEventHandlers();

    // Check for updates on startup if enabled
    if (checkOnStartup) {
      // Delay the check slightly to ensure the app is fully initialized
      setTimeout(() => {
        log.info('initialize', 'Checking for updates on startup...');
        this.checkForUpdates().catch((error) => {
          log.error('initialize', 'Startup update check failed', error);
        });
      }, 3000); // Wait 3 seconds after app launch
    }
  }

  /**
   * Registers all auto-updater event handlers.
   */
  private registerEventHandlers() {
    autoUpdater.on('checking-for-update', () => {
      log.info('registerEventHandlers', 'Checking for updates...');
      this.updateStatus = {
        checking: true,
        available: false,
        downloading: false,
        downloaded: false,
      };
      this.notifyStatusChange();
    });

    autoUpdater.on('update-available', (info: ElectronUpdaterInfo) => {
      log.info('registerEventHandlers', `Update available: ${info.version}`);
      this.updateStatus = {
        checking: false,
        available: true,
        downloading: false,
        downloaded: false,
        info: this.mapUpdateInfo(info),
      };
      this.notifyStatusChange();
    });

    autoUpdater.on('update-not-available', (info: ElectronUpdaterInfo) => {
      log.info('registerEventHandlers', `Update not available. Current version: ${info.version}`);
      this.updateStatus = {
        checking: false,
        available: false,
        downloading: false,
        downloaded: false,
        info: this.mapUpdateInfo(info),
      };
      this.notifyStatusChange();
    });

    autoUpdater.on('download-progress', (progressObj) => {
      log.info('registerEventHandlers', `Download progress: ${progressObj.percent.toFixed(2)}%`);
      this.updateStatus = {
        ...this.updateStatus,
        downloading: true,
        info: {
          ...this.updateStatus.info,
          downloadedPercent: progressObj.percent,
        } as UpdateInfo,
      };
      this.notifyStatusChange();
    });

    autoUpdater.on('update-downloaded', (info: ElectronUpdaterInfo) => {
      log.info('registerEventHandlers', `Update downloaded: ${info.version}`);
      this.updateStatus = {
        checking: false,
        available: true,
        downloading: false,
        downloaded: true,
        info: this.mapUpdateInfo(info),
      };
      this.notifyStatusChange();
    });

    autoUpdater.on('error', (error) => {
      log.error('registerEventHandlers', error);
      this.updateStatus = {
        checking: false,
        available: false,
        downloading: false,
        downloaded: false,
        error: error.message,
      };
      this.notifyStatusChange();
    });
  }

  /**
   * Maps electron-updater's UpdateInfo to our custom UpdateInfo type.
   */
  private mapUpdateInfo(info: ElectronUpdaterInfo): UpdateInfo {
    return {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: this.extractReleaseNotes(info),
      downloadedPercent: this.updateStatus.info?.downloadedPercent ?? undefined,
    };
  }

  /**
   * Extracts release notes from the update info.
   */
  private extractReleaseNotes(info: ElectronUpdaterInfo): string | undefined {
    if (typeof info.releaseNotes === 'string') {
      return info.releaseNotes;
    }
    if (Array.isArray(info.releaseNotes) && info.releaseNotes.length > 0) {
      const note = info.releaseNotes[0];
      return typeof note === 'string' ? note : (note?.note ?? undefined);
    }
    return undefined;
  }

  /**
   * Notifies registered callback about status changes.
   */
  private notifyStatusChange() {
    if (this.statusCallback) {
      this.statusCallback(this.updateStatus);
    }
  }

  /**
   * Registers a callback to be notified of status changes.
   */
  setStatusCallback(callback: (status: UpdateStatus) => void) {
    this.statusCallback = callback;
  }

  /**
   * Checks for available updates.
   * @returns {Promise<UpdateStatus>} The current update status
   */
  async checkForUpdates(): Promise<UpdateStatus> {
    try {
      await autoUpdater.checkForUpdates();
      return this.updateStatus;
    } catch (error) {
      log.error('checkForUpdates', error);
      this.updateStatus = {
        checking: false,
        available: false,
        downloading: false,
        downloaded: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      this.notifyStatusChange();
      return this.updateStatus;
    }
  }

  /**
   * Downloads the available update.
   * @returns {Promise<{ success: boolean }>} Success indicator
   */
  async downloadUpdate(): Promise<{ success: boolean }> {
    try {
      if (!this.updateStatus.available) {
        throw new Error('No update available to download');
      }
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      log.error('downloadUpdate', error);
      this.updateStatus.error = error instanceof Error ? error.message : 'Unknown error';
      this.notifyStatusChange();
      return { success: false };
    }
  }

  /**
   * Quits the application and installs the downloaded update.
   */
  async quitAndInstall(): Promise<void> {
    if (!this.updateStatus.downloaded) {
      throw new Error('No update downloaded to install');
    }
    // setImmediate is used to ensure the IPC response is sent before quitting
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
  }

  /**
   * Gets the current update status.
   * @returns {UpdateStatus} The current status
   */
  getStatus(): UpdateStatus {
    return this.updateStatus;
  }

  /**
   * Gets the current application version.
   * @returns {string} The current version
   */
  getCurrentVersion(): string {
    return app.getVersion();
  }
}

export const updateService = new UpdateService();
