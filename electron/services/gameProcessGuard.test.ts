import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  default: { execFile: mocks.execFile },
  execFile: mocks.execFile,
}));

import { assertGameNotRunning } from './gameProcessGuard';

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
  let warnSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, 'platform', { value: 'win32' });
  });

  afterEach(() => {
    // Vitest runs with isolate: false, so a failing assertion must not leak the faked platform.
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    warnSpy?.mockRestore();
    warnSpy = undefined;
  });

  describe('If tasklist lists D2R.exe', () => {
    it('Then writes are refused with GAME_RUNNING', async () => {
      // Arrange
      mockTasklist({ stdout: '"D2R.exe","1234","Console","1","1,000 K"\r\n' });

      // Act
      const check = assertGameNotRunning();

      // Assert
      await expect(check).rejects.toThrow('GAME_RUNNING');
    });
  });

  describe('If tasklist reports no matching process', () => {
    it('Then writes are allowed', async () => {
      // Arrange
      mockTasklist({
        stdout: 'INFO: No tasks are running which match the specified criteria.\r\n',
      });

      // Act
      const check = assertGameNotRunning();

      // Assert
      await expect(check).resolves.toBeUndefined();
    });
  });

  describe('If tasklist itself fails', () => {
    it('Then the guard does not block the user', async () => {
      // Arrange
      mockTasklist(new Error('tasklist not found'));
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

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
      Object.defineProperty(process, 'platform', { value: 'linux' });

      // Act
      const check = assertGameNotRunning();

      // Assert
      await expect(check).resolves.toBeUndefined();
      expect(mocks.execFile).not.toHaveBeenCalled();
    });
  });
});
