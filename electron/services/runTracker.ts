import type { GrailDatabase } from '../database/database';
import type { Run, Session } from '../types/grail';
import type { EventBus } from './EventBus';
import type { MemoryReader } from './memoryReader';

/**
 * Service for tracking gaming sessions and runs using memory reading (auto mode).
 * Automatically detects when players enter/exit games via D2R memory reading and manages run lifecycle.
 */
export class RunTrackerService {
  private currentSession: Session | null = null;
  private currentRun: Run | null = null;
  private paused = false;
  private memoryReader: MemoryReader | null = null;
  private autoModeEnabled = false;

  constructor(
    private eventBus: EventBus,
    private database: GrailDatabase,
    memoryReader?: MemoryReader | null,
  ) {
    this.memoryReader = memoryReader || null;
    this.loadSettings();
    // Don't restore state automatically - sessions should only be created manually
    // this.restoreState();

    // Clean up any stale sessions from previous app crashes or improper shutdowns
    this.cleanupStaleSessions();

    this.setupEventListeners();

    // Start memory reading if auto mode is enabled
    if (this.autoModeEnabled && this.memoryReader) {
      this.memoryReader.startPolling();
    }
  }

  /**
   * Sets up event listeners for memory reading events.
   * @private
   */
  private setupEventListeners(): void {
    // Listen for game-entered events from memory reader
    this.eventBus.on('game-entered', (payload) => {
      this.handleGameEntered(payload.characterId);
    });

    // Listen for game-exited events from memory reader
    this.eventBus.on('game-exited', (payload) => {
      this.handleGameExited(payload.characterId);
    });
  }

  /**
   * Loads run tracker settings from the database.
   */
  private loadSettings(): void {
    try {
      const settings = this.database.getAllSettings();

      // Auto mode is only available on Windows with memory reading
      this.autoModeEnabled =
        settings.runTrackerMemoryReading === true && process.platform === 'win32';

      // Update memory reader polling interval if enabled
      if (this.memoryReader && this.autoModeEnabled) {
        const pollingInterval = settings.runTrackerMemoryPollingInterval ?? 500;
        this.memoryReader.updatePollingInterval(pollingInterval);
      }
    } catch (error) {
      console.error('[RunTrackerService] Failed to load settings:', error);
    }
  }

  /**
   * Cleans up stale sessions from previous app crashes or improper shutdowns.
   * Closes any sessions that were left open (end_time IS NULL) by setting their end_time.
   * @private
   */
  private cleanupStaleSessions(): void {
    try {
      console.log('[RunTrackerService] Checking for stale sessions...');
      // Get the active session from database (sessions with end_time IS NULL)
      const staleSession = this.database.getActiveSession();

      if (staleSession) {
        // Since we're not restoring state, any session in the database with end_time IS NULL
        // is a stale session that should be closed
        const now = new Date();
        const closedSession = {
          ...staleSession,
          endTime: now,
          totalSessionTime: now.getTime() - staleSession.startTime.getTime(),
          lastUpdated: now,
        };

        this.database.upsertSession(closedSession);
        console.log(
          `[RunTrackerService] ✓ Cleaned up stale session: ${staleSession.id} (was left open from previous app run)`,
        );
      } else {
        console.log('[RunTrackerService] ✓ No stale sessions found');
      }
    } catch (error) {
      console.error('[RunTrackerService] Failed to cleanup stale sessions:', error);
    }
  }

  /**
   * Updates run tracker settings dynamically.
   */
  updateSettings(): void {
    const wasAutoModeEnabled = this.autoModeEnabled;
    this.loadSettings();

    // If auto mode was just enabled, start memory reading
    if (this.autoModeEnabled && !wasAutoModeEnabled && this.memoryReader) {
      console.log('[RunTrackerService] Auto mode enabled, starting memory reader');
      this.memoryReader.startPolling();
    }

    // If auto mode was just disabled, stop memory reading
    if (!this.autoModeEnabled && wasAutoModeEnabled && this.memoryReader) {
      console.log('[RunTrackerService] Auto mode disabled, stopping memory reader');
      this.memoryReader.stopPolling();
    }
  }

  /**
   * Sets the memory reader instance.
   * Used for dependency injection when memory reader is created after RunTrackerService.
   */
  setMemoryReader(memoryReader: MemoryReader | null): void {
    this.memoryReader = memoryReader;
    this.loadSettings();

    // Start memory reading if auto mode is enabled
    if (this.autoModeEnabled && this.memoryReader) {
      this.memoryReader.startPolling();
    }
  }

  /**
   * Handles game-entered event from memory reader.
   * Starts a new run when player enters a game (auto mode only).
   */
  handleGameEntered(characterId?: string): void {
    // Skip if paused or auto mode not enabled
    if (this.paused || !this.autoModeEnabled) {
      return;
    }

    // Require an active session for auto mode
    if (!this.currentSession) {
      console.warn(
        '[RunTrackerService] No active session - cannot auto-start run. Please start a session manually first.',
      );
      return;
    }

    // If already in a run, don't start a new one
    if (this.currentRun) {
      return;
    }

    // Find character if characterId provided
    let finalCharacterId = characterId;
    if (characterId) {
      const character = this.database.getCharacterById(characterId);
      if (!character) {
        // Try finding by name if characterId is actually a name
        const characterByName = this.database.getCharacterByName(characterId);
        finalCharacterId = characterByName?.id;
      }
    }

    console.log('[RunTrackerService] Auto-starting run');
    this.startRun(finalCharacterId, false);
  }

  /**
   * Handles game-exited event from memory reader.
   * Ends the current run when player exits a game.
   */
  handleGameExited(_characterId?: string): void {
    // Skip if paused
    if (this.paused) {
      return;
    }

    // End current run if active
    if (this.currentRun) {
      console.log('[RunTrackerService] Game exited detected, ending run');
      this.endRun(false);
    }
  }

  /**
   * Starts a new session.
   * Creates a new session if one doesn't exist.
   */
  startSession(): Session {
    console.log('[RunTrackerService] startSession() called');

    if (this.currentSession) {
      console.log('[RunTrackerService] Returning existing session:', this.currentSession.id);
      return this.currentSession;
    }

    const now = new Date();
    const session: Session = {
      id: `session-${Date.now()}`,
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

    console.log('[RunTrackerService] ✓ NEW SESSION CREATED:', session.id);
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
   * Requires an active session - will throw error if no session exists.
   */
  startRun(characterId?: string, manual: boolean = false): Run {
    // Require an active session - don't auto-create
    if (!this.currentSession) {
      throw new Error('No active session. Please start a session first before starting a run.');
    }

    const session = this.currentSession;

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

    // Update the in-memory currentSession to reflect the changes
    this.currentSession = updatedSession;

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

    // Update the in-memory currentSession to reflect the changes
    this.currentSession = session;

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
   * Returns whether memory reading is available (valid offsets found).
   */
  isMemoryReadingAvailable(): boolean {
    return this.memoryReader?.isOffsetsValid() ?? false;
  }

  /**
   * Gets the current state of the run tracker.
   */
  getState() {
    const state = {
      isRunning: this.currentRun !== null,
      isPaused: this.paused,
      activeSession: this.currentSession,
      activeRun: this.currentRun,
    };
    console.log('[RunTrackerService] getState() called:', {
      hasSession: state.activeSession !== null,
      hasRun: state.activeRun !== null,
      sessionId: state.activeSession?.id,
    });
    return state;
  }

  /**
   * Stops monitoring and cleans up resources.
   */
  shutdown(): void {
    // Stop memory reading if running
    if (this.memoryReader) {
      this.memoryReader.stopPolling();
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
