import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import {
  applyLastUsedDirectory,
  initializeDialogHandlers,
  resetLastUsedDirectory,
} from './dialogHandlers';

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

describe('When applyLastUsedDirectory is called', () => {
  const pickedDirectory = join('/', 'saves', 'Diablo II Resurrected');
  const rememberedDirectory = join('/', 'saves');

  async function rememberPickedDirectory() {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: [pickedDirectory],
    });
    await getDialogHandler('dialog:showOpenDialog')(null, { properties: ['openDirectory'] });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetLastUsedDirectory();
    initializeDialogHandlers();
  });

  it('If no directory is remembered, Then the options are returned unchanged', () => {
    // Arrange
    const options = { defaultPath: 'run-analytics.csv' };

    // Act
    const result = applyLastUsedDirectory(options);

    // Assert
    expect(result).toBe(options);
  });

  it('If a directory is remembered and the options have no defaultPath, Then the options are copied with the remembered directory', async () => {
    // Arrange
    await rememberPickedDirectory();
    const options = { properties: ['openFile'] };

    // Act
    const result = applyLastUsedDirectory(options);

    // Assert
    expect(result).toEqual({ properties: ['openFile'], defaultPath: rememberedDirectory });
    expect(options).toEqual({ properties: ['openFile'] });
  });

  it('If the defaultPath is an empty string, Then it is replaced by the remembered directory', async () => {
    // Arrange
    await rememberPickedDirectory();

    // Act
    const result = applyLastUsedDirectory({ defaultPath: '' });

    // Assert
    expect(result).toEqual({ defaultPath: rememberedDirectory });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'run-analytics.csv'],
    ['a number', 42],
  ])('If the options are %s, Then they are returned unchanged without throwing', async (_label, options) => {
    // Arrange
    await rememberPickedDirectory();

    // Act
    const result = applyLastUsedDirectory(options);

    // Assert
    expect(result).toBe(options);
  });

  it('If the options are an array, Then the array is returned unchanged', async () => {
    // Arrange
    await rememberPickedDirectory();
    const options = ['openFile'];

    // Act
    const result = applyLastUsedDirectory(options);

    // Assert
    expect(result).toBe(options);
  });

  it.each([
    ['a nested relative path', 'a/b'],
    ['a parent-relative path', '../x'],
  ])('If the defaultPath is %s, Then it is left untouched', async (_label, defaultPath) => {
    // Arrange
    await rememberPickedDirectory();
    const options = { defaultPath };

    // Act
    const result = applyLastUsedDirectory(options);

    // Assert
    expect(result).toBe(options);
    expect(result.defaultPath).toBe(defaultPath);
  });

  it('If the defaultPath is not a string, Then the options are returned unchanged', async () => {
    // Arrange
    await rememberPickedDirectory();
    const options = { defaultPath: 42 };

    // Act
    const result = applyLastUsedDirectory(options);

    // Assert
    expect(result).toBe(options);
  });
});

describe('When a native dialog IPC handler receives unusual input or fails', () => {
  const pickedDirectory = join('/', 'saves', 'Diablo II Resurrected');

  beforeEach(() => {
    vi.clearAllMocks();
    resetLastUsedDirectory();
    initializeDialogHandlers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'not-options'],
  ])('If the open dialog options are %s, Then the IPC validator rejects them before Electron is called', async (_label, options) => {
    // Arrange
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: [pickedDirectory],
    });
    const handler = getDialogHandler('dialog:showOpenDialog');
    await handler(null, { properties: ['openDirectory'] });
    const callsBefore = vi.mocked(dialog.showOpenDialog).mock.calls.length;

    // Act
    const result = handler(null, options);

    // Assert
    await expect(result).rejects.toThrow('Invalid dialog options');
    expect(vi.mocked(dialog.showOpenDialog).mock.calls.length).toBe(callsBefore);
  });

  it('If an open dialog is canceled, Then the remembered directory is not updated', async () => {
    // Arrange
    const handler = getDialogHandler('dialog:showOpenDialog');
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [pickedDirectory],
    });
    await handler(null, { properties: ['openDirectory'] });
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: true,
      filePaths: [join('/', 'elsewhere', 'Canceled')],
    });
    await handler(null, { properties: ['openDirectory'] });
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: true, filePaths: [] });

    // Act
    await handler(null, { properties: ['openFile'] });

    // Assert
    expect(dialog.showOpenDialog).toHaveBeenLastCalledWith({
      properties: ['openFile'],
      defaultPath: join('/', 'saves'),
    });
  });

  it('If the open dialog throws, Then the error propagates and the remembered directory is unchanged', async () => {
    // Arrange
    const handler = getDialogHandler('dialog:showOpenDialog');
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [pickedDirectory],
    });
    await handler(null, { properties: ['openDirectory'] });
    vi.mocked(dialog.showOpenDialog).mockRejectedValueOnce(new Error('dialog failed'));

    // Act
    const promise = handler(null, { properties: ['openFile'] });

    // Assert
    await expect(promise).rejects.toThrow('dialog failed');
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: true, filePaths: [] });
    await handler(null, { properties: ['openFile'] });
    expect(dialog.showOpenDialog).toHaveBeenLastCalledWith({
      properties: ['openFile'],
      defaultPath: join('/', 'saves'),
    });
  });

  it('If the save dialog throws, Then the error propagates and no directory is remembered', async () => {
    // Arrange
    const handler = getDialogHandler('dialog:showSaveDialog');
    vi.mocked(dialog.showSaveDialog).mockRejectedValueOnce(new Error('save dialog failed'));

    // Act
    const promise = handler(null, { defaultPath: 'run-analytics.csv' });

    // Assert
    await expect(promise).rejects.toThrow('save dialog failed');
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: true, filePath: '' });
    await handler(null, { defaultPath: 'next.csv' });
    expect(dialog.showSaveDialog).toHaveBeenLastCalledWith({ defaultPath: 'next.csv' });
  });
});
