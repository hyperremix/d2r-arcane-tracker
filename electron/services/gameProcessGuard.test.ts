import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  default: { execFile: mocks.execFile },
  execFile: mocks.execFile,
}));

import { assertGameNotRunning, isGameRunning } from './gameProcessGuard';

function mockTasklist(result: { stdout: string } | Error): void {
  mocks.execFile.mockImplementation(
    (
      _file: string,
      _args: string[],
      callback: (error: Error | null, result?: { stdout: string }) => void,
    ) => {
      if (result instanceof Error) {
        callback(result);
      } else {
        callback(null, result);
      }
    },
  );
}

describe('When the game process guard checks for D2R', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, 'platform', { value: 'win32' });
  });

  describe('If tasklist lists D2R.exe', () => {
    it('Then the game counts as running and writes are refused', async () => {
      // Arrange
      mockTasklist({ stdout: '"D2R.exe","1234","Console","1","1,000 K"\r\n' });

      // Act & Assert
      expect(await isGameRunning()).toBe(true);
      await expect(assertGameNotRunning()).rejects.toThrow('GAME_RUNNING');
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('If tasklist reports no matching process', () => {
    it('Then writes are allowed', async () => {
      // Arrange
      mockTasklist({
        stdout: 'INFO: No tasks are running which match the specified criteria.\r\n',
      });

      // Act & Assert
      expect(await isGameRunning()).toBe(false);
      await expect(assertGameNotRunning()).resolves.toBeUndefined();
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('If tasklist itself fails', () => {
    it('Then the guard does not block the user', async () => {
      // Arrange
      mockTasklist(new Error('tasklist not found'));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      // Act & Assert
      expect(await isGameRunning()).toBe(false);
      warn.mockRestore();
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('If the platform is not Windows', () => {
    it('Then no process lookup is attempted', async () => {
      // Arrange
      Object.defineProperty(process, 'platform', { value: 'linux' });

      // Act & Assert
      expect(await isGameRunning()).toBe(false);
      expect(mocks.execFile).not.toHaveBeenCalled();
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });
});
