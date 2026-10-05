import { describe, expect, it, vi } from 'vitest';
import { backup } from './management';
import type { DatabaseContext } from './types';

function createContext(backupImpl: (path: string) => Promise<unknown>): DatabaseContext {
  return { rawDb: { backup: backupImpl } } as unknown as DatabaseContext;
}

describe('When backing up the database', () => {
  it('If the underlying backup is still running, Then the returned promise stays pending until it finishes', async () => {
    // Arrange
    let finish: () => void = () => undefined;
    const rawBackup = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    let settled = false;

    // Act
    const pending = backup(createContext(rawBackup), '/tmp/backup.db').then(() => {
      settled = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    const settledBeforeFinish = settled;
    finish();
    await pending;

    // Assert
    expect(rawBackup).toHaveBeenCalledWith('/tmp/backup.db');
    expect(settledBeforeFinish).toBe(false);
    expect(settled).toBe(true);
  });

  it('If the underlying backup fails, Then the returned promise rejects with the error', async () => {
    // Arrange
    const rawBackup = vi.fn().mockRejectedValue(new Error('disk full'));

    // Act & Assert
    await expect(backup(createContext(rawBackup), '/tmp/backup.db')).rejects.toThrow('disk full');
  });
});
