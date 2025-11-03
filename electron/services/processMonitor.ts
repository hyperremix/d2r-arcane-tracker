import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { EventBus } from './EventBus';

const execAsync = promisify(exec);

/**
 * Service for monitoring the Diablo 2 Resurrected process.
 * Detects when D2R.exe starts and stops, emitting events for integration with other services.
 */
export class ProcessMonitor {
  private checkInterval: NodeJS.Timeout | null = null;
  private d2rProcessId: number | null = null;
  private isMonitoring = false;
  private readonly checkIntervalMs = 2000; // Check every 2 seconds
  private readonly processName = 'D2R.exe';

  constructor(private eventBus: EventBus) {
    console.log('[ProcessMonitor] Initialized');
  }

  /**
   * Starts monitoring for the D2R process.
   * Will emit 'd2r-started' when process is detected and 'd2r-stopped' when it disappears.
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('[ProcessMonitor] Already monitoring');
      return;
    }

    // Check platform - only Windows is supported for now
    if (process.platform !== 'win32') {
      console.log('[ProcessMonitor] Platform not supported, skipping monitoring');
      return;
    }

    this.isMonitoring = true;
    console.log('[ProcessMonitor] Starting process monitoring');

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
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

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

    console.log('[ProcessMonitor] Stopped monitoring');
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
        console.log(`[ProcessMonitor] D2R process detected: PID ${processId}`);
        this.eventBus.emit('d2r-started', {
          processId,
          processName: this.processName,
        });
      } else if (processId === null && this.d2rProcessId !== null) {
        // Process just stopped
        const oldProcessId = this.d2rProcessId;
        this.d2rProcessId = null;
        console.log(`[ProcessMonitor] D2R process stopped: PID ${oldProcessId}`);
        this.eventBus.emit('d2r-stopped', {
          processId: null,
          processName: this.processName,
        });
      }
    } catch (error) {
      console.error('[ProcessMonitor] Error checking process:', error);
    }
  }

  /**
   * Finds the D2R.exe process ID using Windows tasklist command.
   * @returns Process ID if found, null otherwise
   * @private
   */
  private async findD2RProcess(): Promise<number | null> {
    try {
      // Use tasklist command to find D2R.exe process
      // Format: tasklist /FI "IMAGENAME eq D2R.exe" /FO CSV /NH
      const { stdout } = await execAsync(
        `tasklist /FI "IMAGENAME eq ${this.processName}" /FO CSV /NH`,
      );

      if (!stdout || stdout.trim() === '') {
        return null;
      }

      // Parse CSV output: "D2R.exe","12345","Session Name","Session#","Mem Usage"
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        const match = line.match(/"([^"]+)","(\d+)"/);
        if (match && match[1] === this.processName) {
          const pid = Number.parseInt(match[2], 10);
          if (!Number.isNaN(pid)) {
            return pid;
          }
        }
      }

      return null;
    } catch (_error) {
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
    console.log('[ProcessMonitor] Shutdown complete');
  }
}
