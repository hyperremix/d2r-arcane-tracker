import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrailDatabase } from '../database/database';
import type { Run } from '../types/grail';
import type { EventBus } from './EventBus';
import { RunTrackerService } from './runTracker';

// Mock database
const mockDatabase: Partial<GrailDatabase> = {
  getAllSettings: vi.fn(),
  upsertSession: vi.fn(),
  archiveSession: vi.fn(),
  getRunsBySession: vi.fn(),
  upsertRun: vi.fn(),
  getActiveSession: vi.fn(),
  getActiveRun: vi.fn(),
};

// Mock event bus
const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  listenerCount: vi.fn(() => 0),
  clear: vi.fn(),
} as unknown as EventBus;

describe('When RunTrackerService is instantiated', () => {
  let service: RunTrackerService;

  let runsBySession: Map<string, Run[]>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

    runsBySession = new Map<string, Run[]>();

    mockDatabase.getAllSettings = vi.fn().mockReturnValue({
      runTrackerMemoryReading: false, // Auto mode disabled for tests
      runTrackerMemoryPollingInterval: 500,
    });

    mockDatabase.getActiveSession = vi.fn().mockReturnValue(null);
    mockDatabase.getCharacterByName = vi.fn().mockReturnValue({
      id: 'char-1',
      name: 'TestCharacter',
      characterClass: 'sorceress',
      level: 90,
      hardcore: false,
      expansion: true,
      lastUpdated: new Date(),
      created: new Date(),
    });
    mockDatabase.getRunsBySession = vi.fn().mockImplementation((sessionId: string) => {
      return runsBySession.get(sessionId) || [];
    });

    mockDatabase.upsertRun = vi.fn().mockImplementation((run: Run) => {
      const runs = runsBySession.get(run.sessionId) || [];
      // Check if run already exists
      const existingIndex = runs.findIndex((r) => r.id === run.id);
      if (existingIndex >= 0) {
        runs[existingIndex] = run; // Update existing
      } else {
        runs.push(run); // Add new
      }
      runsBySession.set(run.sessionId, runs);
    });

    service = new RunTrackerService(mockEventBus, mockDatabase as GrailDatabase);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (service) {
      service.shutdown();
    }
  });

  describe('If startSession is called', () => {
    it('Then should create a new session with correct data', () => {
      // Arrange
      const now = new Date('2024-01-01T10:00:00Z');
      vi.setSystemTime(now);

      // Act
      const session = service.startSession();

      // Assert
      expect(session).toBeDefined();
      expect(session.id).toContain('session-');
      expect(session.startTime).toEqual(now);
      expect(session.totalRunTime).toBe(0);
      expect(session.totalSessionTime).toBe(0);
      expect(session.runCount).toBe(0);
      expect(session.archived).toBe(false);
      expect(mockDatabase.upsertSession).toHaveBeenCalledWith(session);
      expect(mockEventBus.emit).toHaveBeenCalledWith('session-started', { session });
    });

    it('Then should return existing session if already started', () => {
      // Arrange
      const firstSession = service.startSession();
      vi.clearAllMocks();

      // Act
      const secondSession = service.startSession();

      // Assert
      expect(secondSession).toBe(firstSession);
      expect(mockDatabase.upsertSession).not.toHaveBeenCalled();
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('Then should work without character ID', () => {
      // Arrange
      const now = new Date('2024-01-01T10:00:00Z');
      vi.setSystemTime(now);

      // Act
      const session = service.startSession();

      // Assert
      expect(session).toBeDefined();
    });
  });

  describe('If endSession is called', () => {
    it('Then should end the current session', () => {
      // Arrange
      const now = new Date('2024-01-01T10:00:00Z');
      vi.setSystemTime(now);
      service.startSession();
      const later = new Date('2024-01-01T11:00:00Z');
      vi.setSystemTime(later);
      vi.clearAllMocks();

      // Act
      service.endSession();

      // Assert
      expect(mockDatabase.upsertSession).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'session-ended',
        expect.objectContaining({ session: expect.objectContaining({ endTime: later }) }),
      );
    });

    it('Then should end active run before ending session', () => {
      // Arrange
      service.startSession();
      service.startRun('char-1');
      vi.clearAllMocks();

      // Act
      service.endSession();

      // Assert
      expect(mockDatabase.upsertRun).toHaveBeenCalled();
      expect(mockDatabase.upsertSession).toHaveBeenCalledTimes(2); // Once for run count, once for end
    });

    it('Then should do nothing if no active session', () => {
      // Arrange
      vi.clearAllMocks();

      // Act
      service.endSession();

      // Assert
      expect(mockDatabase.upsertSession).not.toHaveBeenCalled();
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('If startRun is called', () => {
    it('Then should create a new run', () => {
      // Arrange
      const characterId = 'char-1';
      const now = new Date('2024-01-01T10:00:00Z');
      vi.setSystemTime(now);
      service.startSession();
      vi.clearAllMocks();

      // Act
      const run = service.startRun(characterId);

      // Assert
      expect(run).toBeDefined();
      expect(run.id).toContain('run-');
      expect(run.sessionId).toBeDefined();
      expect(run.characterId).toBe(characterId);
      expect(run.runNumber).toBe(1);
      expect(mockDatabase.upsertRun).toHaveBeenCalledWith(run);
      expect(mockEventBus.emit).toHaveBeenCalledWith('run-started', expect.any(Object));
    });

    it('Then should throw error if no active session', () => {
      // Arrange
      const characterId = 'char-1';

      // Act & Assert
      expect(() => service.startRun(characterId)).toThrow(
        'No active session. Please start a session first before starting a run.',
      );
    });

    it('Then should increment run number for subsequent runs', () => {
      // Arrange
      const characterId = 'char-1';
      service.startSession();

      // Act & Assert
      const run1 = service.startRun(characterId);
      expect(run1.runNumber).toBe(1);

      // End the first run before starting a second
      service.endRun();
      const run2 = service.startRun(characterId);
      expect(run2.runNumber).toBe(2);
    });

    it('Then should update session run count', () => {
      // Arrange
      const characterId = 'char-1';
      service.startSession();
      vi.clearAllMocks();

      // Act
      service.startRun(characterId);

      // Assert
      expect(mockDatabase.upsertSession).toHaveBeenCalledWith(
        expect.objectContaining({ runCount: 1 }),
      );
    });
  });

  describe('If endRun is called', () => {
    it('Then should end the current run and calculate duration', () => {
      // Arrange
      const characterId = 'char-1';
      service.startSession();
      const startTime = new Date('2024-01-01T10:00:00Z');
      vi.setSystemTime(startTime);
      service.startRun(characterId);

      const endTime = new Date('2024-01-01T10:05:00Z'); // 5 minutes later
      vi.setSystemTime(endTime);
      vi.clearAllMocks();

      // Act
      service.endRun();

      // Assert
      expect(mockDatabase.upsertRun).toHaveBeenCalledWith(
        expect.objectContaining({ endTime, duration: 300000 }), // 5 minutes in ms
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('run-ended', expect.any(Object));
    });

    it('Then should update session statistics', () => {
      // Arrange
      const characterId = 'char-1';
      service.startSession();
      service.startRun(characterId);
      vi.clearAllMocks();

      // Act
      service.endRun();

      // Assert
      expect(mockDatabase.upsertSession).toHaveBeenCalledWith(
        expect.objectContaining({
          totalRunTime: expect.any(Number),
          totalSessionTime: expect.any(Number),
        }),
      );
    });

    it('Then should do nothing if no active run', () => {
      // Arrange
      service.startSession();
      vi.clearAllMocks();

      // Act
      service.endRun();

      // Assert
      expect(mockDatabase.upsertRun).not.toHaveBeenCalled();
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('If pauseRun is called', () => {
    it('Then should pause the current run', () => {
      // Arrange
      const characterId = 'char-1';
      service.startSession();
      service.startRun(characterId);
      vi.clearAllMocks();

      // Act
      service.pauseRun();

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('run-paused', expect.any(Object));
      expect(service.getState().isPaused).toBe(true);
    });

    it('Then should do nothing if no active run', () => {
      // Arrange
      service.startSession();
      vi.clearAllMocks();

      // Act
      service.pauseRun();

      // Assert
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('Then should do nothing if already paused', () => {
      // Arrange
      const characterId = 'char-1';
      service.startSession();
      service.startRun(characterId);
      service.pauseRun();
      vi.clearAllMocks();

      // Act
      service.pauseRun();

      // Assert
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('If resumeRun is called', () => {
    it('Then should resume the paused run', () => {
      // Arrange
      const characterId = 'char-1';
      service.startSession();
      service.startRun(characterId);
      service.pauseRun();
      vi.clearAllMocks();

      // Act
      service.resumeRun();

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('run-resumed', expect.any(Object));
      expect(service.getState().isPaused).toBe(false);
    });

    it('Then should do nothing if not paused', () => {
      // Arrange
      const characterId = 'char-1';
      service.startSession();
      service.startRun(characterId);
      vi.clearAllMocks();

      // Act
      service.resumeRun();

      // Assert
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('If setRunType is called', () => {
    it('Then should update the current run type', () => {
      // Arrange
      const characterId = 'char-1';
      service.startSession();
      service.startRun(characterId);
      const runType = 'Mephisto';
      vi.clearAllMocks();

      // Act
      service.setRunType(runType);

      // Assert
      expect(mockDatabase.upsertRun).toHaveBeenCalledWith(expect.objectContaining({ runType }));
    });

    it('Then should do nothing if no active run', () => {
      // Arrange
      service.startSession();
      vi.clearAllMocks();

      // Act
      service.setRunType('Mephisto');

      // Assert
      expect(mockDatabase.upsertRun).not.toHaveBeenCalled();
    });
  });

  // Save file event handling tests removed - auto mode now uses memory reading only

  describe('If archiveSession is called', () => {
    it('Then should archive the session', () => {
      // Arrange
      const sessionId = 'session-1';
      vi.clearAllMocks();

      // Act
      service.archiveSession(sessionId);

      // Assert
      expect(mockDatabase.archiveSession).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('If getState is called', () => {
    it('Then should return current run tracker state', () => {
      // Arrange
      const characterId = 'char-1';
      service.startSession();
      service.startRun(characterId);

      // Act
      const state = service.getState();

      // Assert
      expect(state.isRunning).toBe(true);
      expect(state.isPaused).toBe(false);
      expect(state.activeSession).toBeDefined();
      expect(state.activeRun).toBeDefined();
    });
  });

  describe('If shutdown is called', () => {
    it('Then should cleanup and end active run and session', () => {
      // Arrange
      const characterId = 'char-1';
      service.startSession();
      service.startRun(characterId);
      vi.clearAllMocks();

      // Act
      service.shutdown();

      // Assert
      expect(mockDatabase.upsertRun).toHaveBeenCalled();
      expect(mockDatabase.upsertSession).toHaveBeenCalled();
    });
  });
});
