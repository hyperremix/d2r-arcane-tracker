import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameProcessGuard } from './gameProcessGuard';

function createProcessMonitor(state: { monitoring: boolean; running: boolean }) {
  return {
    isMonitoring: vi.fn(() => state.monitoring),
    isRunning: vi.fn(() => state.running),
  };
}

describe('When the game process guard checks for D2R', () => {
  let warnSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    warnSpy?.mockRestore();
    warnSpy = undefined;
  });

  describe('If the process monitor is monitoring', () => {
    it('Then its state is used without a new process lookup', async () => {
      // Arrange
      const findProcess = vi.fn();
      const assertGameNotRunning = createGameProcessGuard({
        processMonitor: createProcessMonitor({ monitoring: true, running: true }),
        findProcess,
        platform: 'win32',
      });

      // Act
      const check = assertGameNotRunning();

      // Assert
      await expect(check).rejects.toThrow('GAME_RUNNING');
      expect(findProcess).not.toHaveBeenCalled();
    });

    it('If it has not seen the game, Then writes are allowed', async () => {
      // Arrange
      const assertGameNotRunning = createGameProcessGuard({
        processMonitor: createProcessMonitor({ monitoring: true, running: false }),
        findProcess: vi.fn(),
        platform: 'win32',
      });

      // Act
      const check = assertGameNotRunning();

      // Assert
      await expect(check).resolves.toBeUndefined();
    });
  });

  describe('If the process monitor is not monitoring', () => {
    it('Then the process is looked up and a running game refuses writes', async () => {
      // Arrange
      const findProcess = vi.fn().mockResolvedValue(1234);
      const assertGameNotRunning = createGameProcessGuard({
        processMonitor: createProcessMonitor({ monitoring: false, running: false }),
        findProcess,
        platform: 'win32',
      });

      // Act
      const check = assertGameNotRunning();

      // Assert
      await expect(check).rejects.toThrow('GAME_RUNNING');
      expect(findProcess).toHaveBeenCalledTimes(1);
    });

    it('If the lookup finds no game, Then writes are allowed', async () => {
      // Arrange
      const assertGameNotRunning = createGameProcessGuard({
        findProcess: vi.fn().mockResolvedValue(null),
        platform: 'win32',
      });

      // Act
      const check = assertGameNotRunning();

      // Assert
      await expect(check).resolves.toBeUndefined();
    });

    it('If the lookup fails, Then the guard does not block the user', async () => {
      // Arrange
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const assertGameNotRunning = createGameProcessGuard({
        findProcess: vi.fn().mockRejectedValue(new Error('tasklist not found')),
        platform: 'win32',
      });

      // Act
      const check = assertGameNotRunning();

      // Assert
      await expect(check).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('If the platform is not Windows', () => {
    it('Then no process lookup is attempted', async () => {
      // Arrange
      const findProcess = vi.fn();
      const assertGameNotRunning = createGameProcessGuard({ findProcess, platform: 'linux' });

      // Act
      const check = assertGameNotRunning();

      // Assert
      await expect(check).resolves.toBeUndefined();
      expect(findProcess).not.toHaveBeenCalled();
    });
  });
});
