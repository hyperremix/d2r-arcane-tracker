import type { SaveFileEvent } from '../types/grail';
import { GameMode } from '../types/grail';
import type { EventBus } from './EventBus';
import type { GrailProgressService } from './grailProgressService';
import type { ItemDetectionService } from './itemDetection';
import type { SaveFileMonitor } from './saveFileMonitor';
import type { SettingsService } from './settingsService';

/** Delay before save file monitoring starts automatically, so every service is set up first. */
export const MONITORING_AUTO_START_DELAY_MS = 1000;

/** Dependencies of the {@link GrailDetectionPipeline}. */
export interface GrailDetectionPipelineDependencies {
  eventBus: EventBus;
  settings: Pick<SettingsService, 'get' | 'onUpdated'>;
  saveFileMonitor: Pick<SaveFileMonitor, 'startMonitoring' | 'stopMonitoringIfActive'>;
  itemDetection: Pick<ItemDetectionService, 'analyzeSaveFile'>;
  grailProgress: Pick<GrailProgressService, 'recordSaveFile'>;
}

/**
 * Turns save file changes into grail progress: the items of every modified save file are analyzed,
 * and the character and the grail items found are recorded together.
 *
 * It also decides when save file monitoring runs: monitoring starts shortly after `start` unless
 * the game mode is Manual, stops when the game mode switches to Manual and resumes when it switches
 * back. `dispose` removes the listeners and cancels a pending automatic start.
 */
export class GrailDetectionPipeline {
  private readonly disposers: Array<() => void> = [];
  private started = false;

  constructor(private readonly deps: GrailDetectionPipelineDependencies) {}

  /**
   * Subscribes to save file events and game mode changes and schedules the automatic monitoring
   * start. Calling it again does nothing.
   */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    const { eventBus, saveFileMonitor, settings } = this.deps;

    // emitAsync awaits this listener, so save files are analyzed one after another
    this.disposers.push(eventBus.on('save-file-event', (event) => this.recordSaveFile(event)));

    const autoStartTimeout = setTimeout(() => {
      void this.startMonitoringUnlessManual();
    }, MONITORING_AUTO_START_DELAY_MS);
    this.disposers.push(() => clearTimeout(autoStartTimeout));

    // Keep monitoring in sync with game mode changes from any renderer view (e.g. the setup wizard)
    let manualModeActive = this.isManualGameMode();
    this.disposers.push(
      settings.onUpdated(async (changes) => {
        if (changes.gameMode === undefined) {
          return;
        }
        const wasManual = manualModeActive;
        manualModeActive = changes.gameMode === GameMode.Manual;
        try {
          if (manualModeActive) {
            // Queued behind any start still in flight, so the watcher cannot come up in Manual mode
            await saveFileMonitor.stopMonitoringIfActive();
          } else if (wasManual) {
            await saveFileMonitor.startMonitoring();
          }
        } catch (error) {
          console.error('Failed to update save file monitoring for the game mode:', error);
        }
      }),
    );
  }

  /** Removes the listeners and cancels a pending automatic monitoring start. */
  dispose(): void {
    for (const dispose of this.disposers.splice(0)) {
      dispose();
    }
    this.started = false;
  }

  /**
   * Analyzes a modified save file for grail items and records the character together with the
   * items found. Other events only record the character.
   */
  private async recordSaveFile(event: SaveFileEvent): Promise<void> {
    const { itemDetection, grailProgress } = this.deps;
    const foundItems =
      event.type === 'modified'
        ? await itemDetection.analyzeSaveFile(
            event.file,
            event.parsedItems ?? [],
            event.silent,
            event.isInitialScan,
          )
        : [];

    // Store the character and the progress of the found items in one transaction
    grailProgress.recordSaveFile(event.file, foundItems);
  }

  private async startMonitoringUnlessManual(): Promise<void> {
    try {
      if (this.isManualGameMode()) {
        console.log('[GrailDetectionPipeline] Manual mode active, not auto-starting monitoring');
        return;
      }
      await this.deps.saveFileMonitor.startMonitoring();
    } catch (error) {
      console.error('Failed to auto-start save file monitoring:', error);
    }
  }

  /**
   * Checks whether the persisted game mode is Manual, where save file monitoring must stay off.
   * @returns True if the game mode is Manual; false otherwise or if settings cannot be read
   */
  private isManualGameMode(): boolean {
    try {
      return this.deps.settings.get('gameMode') === GameMode.Manual;
    } catch (error) {
      console.warn('[isManualGameMode] Failed to read game mode from settings:', error);
      return false;
    }
  }
}
