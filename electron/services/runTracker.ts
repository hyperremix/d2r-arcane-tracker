import type { GrailDatabase } from '../database/database';
import type { Run, SaveFileEvent, Session } from '../types/grail';
import type { EventBus } from './EventBus';

/**
 * Service for tracking gaming sessions and runs by monitoring save file changes.
 * Automatically detects when players enter/exit games and manages run lifecycle.
 */
export class RunTrackerService {
  private currentSession: Session | null = null;
  private currentRun: Run | null = null;
  private lastSaveFileTime: Date | null = null;
  private inGameThreshold = 10000; // 10 seconds (will be updated from settings)
  private paused = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private eventBus: EventBus,
    private database: GrailDatabase,
  ) {
    this.loadSettings();
    this.restoreState();
    this.startMonitoring();
  }

  /**
   * Loads run tracker settings from the database.
   */
  private loadSettings(): void {
    try {
      const settings = this.database.getAllSettings();
      this.inGameThreshold = (settings.runTrackerEndThreshold ?? 10) * 1000; // Convert to milliseconds
    } catch (error) {
      console.error('[RunTrackerService] Failed to load settings:', error);
      // Keep default threshold
    }
  }

  /**
   * Updates run tracker settings dynamically.
   */
  updateSettings(): void {
    this.loadSettings();
  }

  /**
   * Handles save file events from the save file monitor.
   * Decides when to start/stop runs based on save file activity.
   */
  handleSaveFileEvent(event: SaveFileEvent): void {
    // Skip auto-tracking when paused
    if (this.paused) {
      return;
    }

    // Check if auto-start is enabled
    const settings = this.database.getAllSettings();
    if (!settings.runTrackerAutoStart) {
      return;
    }

    const now = new Date();

    // If save file modified, update last save time
    if (event.type === 'modified') {
      this.lastSaveFileTime = now;

      // Check if we should start a new run
      if (!this.currentRun) {
        // No active run, start a new one
        this.startRun(event.file.name, false);
      }
    }
  }

  /**
   * Starts a new session.
   * Creates a new session if one doesn't exist.
   */
  startSession(characterId?: string): Session {
    if (this.currentSession) {
      return this.currentSession;
    }

    const now = new Date();
    const session: Session = {
      id: `session-${Date.now()}`,
      characterId,
      startTime: now,
      totalRunTime: 0,
      totalSessionTime: 0,
      runCount: 0,
      archived: false,
      created: now,
      lastUpdated: now,
    };

    this.currentSession = session;
    this.database.upsertSession(session);

    this.eventBus.emit('session-started', { session });

    console.log('[RunTrackerService] Session started:', session.id);
    return session;
  }

  /**
   * Ends the current session.
   */
  endSession(): void {
    if (!this.currentSession) {
      return;
    }

    // End any active run first
    if (this.currentRun) {
      this.endRun(false);
    }

    const now = new Date();
    const session = {
      ...this.currentSession,
      endTime: now,
      totalSessionTime: now.getTime() - this.currentSession.startTime.getTime(),
      lastUpdated: now,
    };

    this.database.upsertSession(session);
    this.eventBus.emit('session-ended', { session });

    console.log('[RunTrackerService] Session ended:', session.id);

    this.currentSession = null;
  }

  /**
   * Archives a session.
   */
  archiveSession(sessionId: string): void {
    this.database.archiveSession(sessionId);
    console.log('[RunTrackerService] Session archived:', sessionId);
  }

  /**
   * Starts a new run.
   */
  startRun(characterId: string, manual: boolean = false): Run {
    // Ensure we have a session
    if (!this.currentSession) {
      this.startSession(characterId);
    }

    const session = this.currentSession;
    if (!session) {
      throw new Error('Failed to create or retrieve session');
    }

    // Get next run number
    const runs = this.database.getRunsBySession(session.id);
    const runNumber = runs.length + 1;

    const now = new Date();
    const run: Run = {
      id: `run-${Date.now()}`,
      sessionId: session.id,
      characterId,
      runNumber,
      startTime: now,
      created: now,
      lastUpdated: now,
    };

    this.currentRun = run;
    this.database.upsertRun(run);

    // Update session run count
    const updatedSession = {
      ...session,
      runCount: session.runCount + 1,
      lastUpdated: now,
    };
    this.database.upsertSession(updatedSession);

    this.eventBus.emit('run-started', { run, session: updatedSession, manual });

    console.log('[RunTrackerService] Run started:', run.id, 'manual:', manual);
    return run;
  }

  /**
   * Ends the current run.
   */
  endRun(manual: boolean = false): void {
    if (!this.currentRun || !this.currentSession) {
      return;
    }

    const now = new Date();
    const run = {
      ...this.currentRun,
      endTime: now,
      duration: now.getTime() - this.currentRun.startTime.getTime(),
      lastUpdated: now,
    };

    this.database.upsertRun(run);

    // Update session statistics
    const session = {
      ...this.currentSession,
      totalRunTime: this.currentSession.totalRunTime + (run.duration || 0),
      totalSessionTime: now.getTime() - this.currentSession.startTime.getTime(),
      lastUpdated: now,
    };
    this.database.upsertSession(session);

    this.eventBus.emit('run-ended', { run, session, manual });

    console.log('[RunTrackerService] Run ended:', run.id, 'duration:', run.duration, 'ms');

    this.currentRun = null;
  }

  /**
   * Pauses automatic tracking.
   * Manual commands still work.
   */
  pauseRun(): void {
    if (this.paused || !this.currentRun) {
      return;
    }

    if (!this.currentSession) {
      return;
    }

    this.paused = true;

    this.eventBus.emit('run-paused', { run: this.currentRun, session: this.currentSession });

    console.log('[RunTrackerService] Run paused');
  }

  /**
   * Resumes automatic tracking.
   */
  resumeRun(): void {
    if (!this.paused) {
      return;
    }

    if (!this.currentSession) {
      return;
    }

    this.paused = false;

    if (this.currentRun) {
      this.eventBus.emit('run-resumed', { run: this.currentRun, session: this.currentSession });
      console.log('[RunTrackerService] Run resumed');
    }
  }

  /**
   * Sets the run type for the current run.
   */
  setRunType(runType: string): void {
    if (!this.currentRun) {
      return;
    }

    const now = new Date();
    const run = {
      ...this.currentRun,
      runType,
      lastUpdated: now,
    };

    this.currentRun = run;
    this.database.upsertRun(run);

    console.log('[RunTrackerService] Run type set:', runType);
  }

  /**
   * Gets the active session.
   */
  getActiveSession(): Session | null {
    return this.currentSession;
  }

  /**
   * Gets the active run.
   */
  getActiveRun(): Run | null {
    return this.currentRun;
  }

  /**
   * Gets the database instance for external access.
   */
  getDatabase(): GrailDatabase {
    return this.database;
  }

  /**
   * Gets the current state of the run tracker.
   */
  getState() {
    return {
      isRunning: this.currentRun !== null,
      isPaused: this.paused,
      activeSession: this.currentSession,
      activeRun: this.currentRun,
    };
  }

  /**
   * Restores state from database on startup.
   */
  private restoreState(): void {
    const activeSession = this.database.getActiveSession();
    if (!activeSession) {
      return;
    }

    this.currentSession = activeSession;

    // Try to restore active run if exists
    const activeRun = this.database.getActiveRun(activeSession.id);
    if (activeRun) {
      this.currentRun = activeRun;
    }

    console.log(
      '[RunTrackerService] State restored - session:',
      activeSession.id,
      'run:',
      activeRun?.id,
    );
  }

  /**
   * Starts monitoring for run timeout.
   * Checks periodically if no save file activity for threshold.
   */
  private startMonitoring(): void {
    // Check every second if threshold exceeded
    this.checkInterval = setInterval(() => {
      if (this.paused || !this.currentRun) {
        return;
      }

      if (!this.lastSaveFileTime) {
        return;
      }

      const now = Date.now();
      const timeSinceLastSave = now - this.lastSaveFileTime.getTime();

      if (timeSinceLastSave > this.inGameThreshold) {
        // No save file activity for threshold period, end the run
        console.log(
          '[RunTrackerService] No save activity for',
          timeSinceLastSave,
          'ms, ending run',
        );
        this.endRun(false);
      }
    }, 1000);
  }

  /**
   * Stops monitoring and cleans up resources.
   */
  shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // End current session and run on shutdown
    if (this.currentRun) {
      this.endRun(false);
    }

    if (this.currentSession) {
      this.endSession();
    }

    console.log('[RunTrackerService] Shutdown complete');
  }
}
