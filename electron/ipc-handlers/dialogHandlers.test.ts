import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const writeFile = vi.fn();
  return { ...actual, default: { ...actual, writeFile }, writeFile };
});

import { writeFile } from 'node:fs/promises';
import { ipcMain } from 'electron';
import { initializeDialogHandlers } from './dialogHandlers';

type WriteFileHandler = (event: unknown, filePath: unknown, content: unknown) => Promise<unknown>;

function getWriteFileHandler(): WriteFileHandler {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === 'dialog:writeFile');
  if (!call) {
    throw new Error('dialog:writeFile handler was not registered');
  }
  return call[1] as WriteFileHandler;
}

describe('When the dialog:writeFile IPC handler is invoked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeDialogHandlers();
  });

  it('If the path and content are valid, Then it writes the file and reports success', async () => {
    // Arrange
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const handler = getWriteFileHandler();

    // Act
    const result = await handler(null, '/tmp/run-analytics.csv', 'Metric,Value');

    // Assert
    expect(writeFile).toHaveBeenCalledWith('/tmp/run-analytics.csv', 'Metric,Value', 'utf-8');
    expect(result).toEqual({ success: true });
  });

  it('If the file path is empty, Then it rejects without writing', async () => {
    // Arrange
    const handler = getWriteFileHandler();

    // Act
    const promise = handler(null, '   ', 'content');

    // Assert
    await expect(promise).rejects.toThrow('Invalid file path');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('If the file path is relative, Then it rejects without writing', async () => {
    // Arrange
    const handler = getWriteFileHandler();

    // Act
    const promise = handler(null, '../outside/run-analytics.csv', 'content');

    // Assert
    await expect(promise).rejects.toThrow('Invalid file path');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('If the file path is not a string, Then it rejects without writing', async () => {
    // Arrange
    const handler = getWriteFileHandler();

    // Act
    const promise = handler(null, { path: '/tmp/x' }, 'content');

    // Assert
    await expect(promise).rejects.toThrow('Invalid file path');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('If the content is not a string, Then it rejects without writing', async () => {
    // Arrange
    const handler = getWriteFileHandler();

    // Act
    const promise = handler(null, '/tmp/run-analytics.csv', 42);

    // Assert
    await expect(promise).rejects.toThrow('Invalid file content');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('If writing to disk fails, Then the error is propagated to the renderer', async () => {
    // Arrange
    vi.mocked(writeFile).mockRejectedValue(new Error('EACCES: permission denied'));
    const handler = getWriteFileHandler();

    // Act
    const promise = handler(null, '/readonly/run-analytics.csv', 'content');

    // Assert
    await expect(promise).rejects.toThrow('EACCES: permission denied');
  });
});
