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
    this.restoreState();
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

    console.log('[RunTrackerService] Game entered detected, starting run');
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
    if (this.currentSession) {
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
  startRun(characterId?: string, manual: boolean = false): Run {
    // Ensure we have a session
    if (!this.currentSession) {
      this.startSession();
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
