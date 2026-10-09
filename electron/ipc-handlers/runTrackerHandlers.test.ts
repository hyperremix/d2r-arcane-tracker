import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mocks.handlers.set(channel, handler);
    }),
  },
}));

import type { BroadcastToRenderers } from '../ipc/broadcast';
import { EventBus } from '../services/EventBus';
import type { RunTrackerService } from '../services/runTracker';
import { initializeRunTrackerHandlers, type RunTrackerDatabase } from './runTrackerHandlers';

function invoke(channel: string, ...args: unknown[]) {
  const handler = mocks.handlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return handler({}, ...args);
}

describe('When the run tracker IPC handlers are initialized', () => {
  let eventBus: EventBus;
  let broadcastToRenderers: ReturnType<typeof vi.fn>;
  let database: { [K in keyof RunTrackerDatabase]: ReturnType<typeof vi.fn> };
  let runTracker: { startSession: ReturnType<typeof vi.fn>; endRun: ReturnType<typeof vi.fn> };
  let dispose: () => void;

  beforeEach(() => {
    mocks.handlers.clear();
    eventBus = new EventBus();
    broadcastToRenderers = vi.fn();
    database = {
      addRunItem: vi.fn(),
      getAllSessions: vi.fn(() => []),
      getOverallRunStatistics: vi.fn(),
      getRunItems: vi.fn(() => []),
      getRunsBySession: vi.fn(() => []),
      getSessionById: vi.fn(),
      getSessionItems: vi.fn(() => []),
    };
    runTracker = { startSession: vi.fn(() => ({ id: 'session-1' })), endRun: vi.fn() };
    dispose = initializeRunTrackerHandlers({
      runTracker: runTracker as unknown as RunTrackerService,
      database: database as unknown as RunTrackerDatabase,
      eventBus,
      broadcastToRenderers: broadcastToRenderers as unknown as BroadcastToRenderers,
    });
  });

  describe('If a session query is invoked', () => {
    it('Then it reads from the injected database', async () => {
      // Act
      await invoke('run-tracker:get-all-sessions', true);

      // Assert
      expect(database.getAllSessions).toHaveBeenCalledWith(true);
    });
  });

  describe('If a run command is invoked', () => {
    it('Then it is delegated to the run tracker', async () => {
      // Act
      const session = await invoke('run-tracker:start-session');
      const endResult = await invoke('run-tracker:end-run');

      // Assert
      expect(session).toEqual({ id: 'session-1' });
      expect(runTracker.endRun).toHaveBeenCalledWith(true);
      expect(endResult).toEqual({ success: true });
    });
  });

  describe('If a run item is added manually', () => {
    it('Then it is stored and announced to the renderers', async () => {
      // Act
      const result = await invoke('run-tracker:add-run-item', { runId: 'run-1', name: 'Shako' });

      // Assert
      expect(database.addRunItem).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run-1', name: 'Shako' }),
      );
      expect(broadcastToRenderers).toHaveBeenCalledWith('run-tracker:run-item-added', {
        runId: 'run-1',
        name: 'Shako',
      });
      expect(result).toMatchObject({ success: true });
    });
  });

  describe('If the handlers are disposed', () => {
    it('Then run tracker events are no longer forwarded', () => {
      // Arrange
      dispose();

      // Act
      eventBus.emit('run-item-added', { runId: 'run-1' });

      // Assert
      expect(broadcastToRenderers).not.toHaveBeenCalled();
    });
  });
});
