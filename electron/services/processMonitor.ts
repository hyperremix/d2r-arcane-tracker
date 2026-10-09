import { createServiceLogger } from '../utils/serviceLogger';
import { D2R_PROCESS_NAME, findD2RProcess } from './d2rProcess';
import type { EventBus } from './EventBus';

const log = createServiceLogger('ProcessMonitor');

/**
 * Service for monitoring the Diablo 2 Resurrected process.
 * Detects when D2R.exe starts and stops, emitting events for integration with other services.
 */
export class ProcessMonitor {
  private checkInterval: NodeJS.Timeout | null = null;
  private d2rProcessId: number | null = null;
  private monitoring = false;
  private readonly checkIntervalMs = 2000; // Check every 2 seconds
  private readonly processName = D2R_PROCESS_NAME;

  /**
   * @param eventBus - Event bus the process start and stop events are emitted on
   * @param findProcess - Looks up the D2R process ID (null if not running)
   */
  constructor(
    private eventBus: EventBus,
    private readonly findProcess: () => Promise<number | null> = findD2RProcess,
  ) {
    log.info('constructor', 'Initialized');
  }

  /**
   * Starts monitoring for the D2R process.
   * Will emit 'd2r-started' when process is detected and 'd2r-stopped' when it disappears.
   */
  startMonitoring(): void {
    if (this.monitoring) {
      log.info('startMonitoring', 'Already monitoring');
      return;
    }

    // Check platform - only Windows is supported for now
    if (process.platform !== 'win32') {
      log.info('startMonitoring', 'Platform not supported, skipping monitoring');
      return;
    }

    this.monitoring = true;
    log.info('startMonitoring', 'Starting process monitoring');

    // Check immediately
    this.checkProcess();

    // Then check periodically
    this.checkInterval = setInterval(() => {
      this.checkProcess();
    }, this.checkIntervalMs);
  }

  /**
   * Stops monitoring for the D2R process.
   */
  stopMonitoring(): void {
    if (!this.monitoring) {
      return;
    }

    this.monitoring = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // If process was running, emit stopped event
    if (this.d2rProcessId !== null) {
      this.d2rProcessId = null;
      this.eventBus.emit('d2r-stopped', {
        processId: null,
        processName: this.processName,
      });
    }

    log.info('stopMonitoring', 'Stopped monitoring');
  }

  /**
   * Checks if D2R process is running and emits events for state changes.
   * @private
   */
  private async checkProcess(): Promise<void> {
    try {
      const processId = await this.findD2RProcess();

      if (processId !== null && this.d2rProcessId === null) {
        // Process just started
        this.d2rProcessId = processId;
        log.info('checkProcess', `D2R.exe detected (PID ${processId})`);
        this.eventBus.emit('d2r-started', {
          processId,
          processName: this.processName,
        });
      } else if (processId === null && this.d2rProcessId !== null) {
        // Process just stopped
        const oldProcessId = this.d2rProcessId;
        this.d2rProcessId = null;
        log.info('checkProcess', `D2R.exe stopped (PID ${oldProcessId})`);
        this.eventBus.emit('d2r-stopped', {
          processId: null,
          processName: this.processName,
        });
      }
    } catch (error) {
      log.error('checkProcess', error);
    }
  }

  /**
   * Finds the D2R.exe process ID.
   * @returns Process ID if found, null otherwise (also when the lookup fails)
   * @private
   */
  private async findD2RProcess(): Promise<number | null> {
    try {
      return await this.findProcess();
    } catch {
      // Process not found or error executing command
      return null;
    }
  }

  /**
   * Gets the current D2R process ID if running.
   * @returns Process ID if running, null otherwise
   */
  getProcessId(): number | null {
    return this.d2rProcessId;
  }

  /**
   * Whether the process is being polled. Only then does {@link isRunning} reflect the game state.
   */
  isMonitoring(): boolean {
    return this.monitoring;
  }

  /**
   * Checks if D2R is currently running.
   * @returns True if D2R process is detected
   */
  isRunning(): boolean {
    return this.d2rProcessId !== null;
  }

  /**
   * Cleans up resources and stops monitoring.
   */
  shutdown(): void {
    this.stopMonitoring();
    log.info('shutdown', 'Shutdown complete');
  }
}
