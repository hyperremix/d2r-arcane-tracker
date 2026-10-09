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
import { join } from 'node:path';
import { dialog, ipcMain } from 'electron';
import { initializeDialogHandlers, resetLastUsedDirectory } from './dialogHandlers';

type WriteFileHandler = (event: unknown, filePath: unknown, content: unknown) => Promise<unknown>;
type DialogHandler = (event: unknown, options: unknown) => Promise<unknown>;

function getDialogHandler(channel: 'dialog:showSaveDialog' | 'dialog:showOpenDialog') {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(([name]) => name === channel);
  if (!call) {
    throw new Error(`${channel} handler was not registered`);
  }
  return call[1] as DialogHandler;
}

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

describe('When a native dialog IPC handler is invoked', () => {
  const pickedDirectory = join('/', 'saves', 'Diablo II Resurrected');

  beforeEach(() => {
    vi.clearAllMocks();
    resetLastUsedDirectory();
    initializeDialogHandlers();
  });

  it('If no directory was picked before, Then the options are passed through unchanged', async () => {
    // Arrange
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] });
    const handler = getDialogHandler('dialog:showOpenDialog');
    const options = { properties: ['openDirectory'] };

    // Act
    await handler(null, options);

    // Assert
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(options);
  });

  it('If a folder was picked before and no defaultPath is given, Then the next dialog opens in its parent directory', async () => {
    // Arrange
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: [pickedDirectory],
    });
    const handler = getDialogHandler('dialog:showOpenDialog');
    await handler(null, { properties: ['openDirectory'] });

    // Act
    await handler(null, { properties: ['openFile'] });

    // Assert
    expect(dialog.showOpenDialog).toHaveBeenLastCalledWith({
      properties: ['openFile'],
      defaultPath: join('/', 'saves'),
    });
  });

  it('If a file was saved before and the next save dialog suggests a bare file name, Then the file name is placed in the last-used directory', async () => {
    // Arrange
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: false,
      filePath: join(pickedDirectory, 'run-analytics.csv'),
    });
    const handler = getDialogHandler('dialog:showSaveDialog');
    await handler(null, { defaultPath: 'run-analytics.csv' });

    // Act
    await handler(null, { defaultPath: 'session-export.json' });

    // Assert
    expect(dialog.showSaveDialog).toHaveBeenLastCalledWith({
      defaultPath: join(pickedDirectory, 'session-export.json'),
    });
  });

  it('If the caller passes an absolute defaultPath, Then it is kept as-is', async () => {
    // Arrange
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: [pickedDirectory],
    });
    const handler = getDialogHandler('dialog:showOpenDialog');
    await handler(null, { properties: ['openDirectory'] });
    const explicitPath = join('/', 'games', 'D2R');

    // Act
    await handler(null, { defaultPath: explicitPath, properties: ['openDirectory'] });

    // Assert
    expect(dialog.showOpenDialog).toHaveBeenLastCalledWith({
      defaultPath: explicitPath,
      properties: ['openDirectory'],
    });
  });

  it('If the user cancels the dialog, Then no directory is remembered', async () => {
    // Arrange
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: true,
      filePath: join(pickedDirectory, 'ignored.csv'),
    });
    const handler = getDialogHandler('dialog:showSaveDialog');
    await handler(null, { defaultPath: 'ignored.csv' });

    // Act
    await handler(null, { defaultPath: 'next.csv' });

    // Assert
    expect(dialog.showSaveDialog).toHaveBeenLastCalledWith({ defaultPath: 'next.csv' });
  });
});
