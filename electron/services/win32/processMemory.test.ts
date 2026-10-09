import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecFileFunction } from '../d2rProcess';

const win32 = vi.hoisted(() => ({
  OpenProcess: vi.fn(),
  GetLastError: vi.fn(() => 87),
}));

vi.mock('win32-api', () => ({
  Kernel32: {
    load: vi.fn(() => ({ OpenProcess: win32.OpenProcess, GetLastError: win32.GetLastError })),
  },
  ffi: {
    load: vi.fn(() => ({ func: vi.fn(() => vi.fn(() => true)) })),
  },
}));

import { WindowsMemoryReaderImpl } from './processMemory';

/** An `execFile` stand-in that answers with the given output or error. */
function createExecFile(stdout: string, error: Error | null = null) {
  return vi.fn<ExecFileFunction>((_file, _args, _options, callback) => {
    callback(error, stdout);
  });
}

describe('When the Win32 process memory reader is used', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  describe('If the module info of a running process is requested', () => {
    it('Then PowerShell runs without a shell and its output is parsed', async () => {
      // Arrange
      const execFile = createExecFile('7FF600000000,2048\r\n');
      const reader = new WindowsMemoryReaderImpl(execFile);

      // Act
      const moduleInfo = await reader.getModuleInfo(1234, 'D2R.exe');

      // Assert
      expect(moduleInfo).toEqual({ baseAddress: '7FF600000000', size: 2048 });
      expect(execFile).toHaveBeenCalledTimes(1);
      const [file, args, options] = execFile.mock.calls[0];
      expect(file).toBe('powershell');
      expect(args.slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-Command']);
      expect(args[3]).toContain('Get-Process -Id 1234');
      expect(args[3]).toContain("$_.ModuleName -eq 'D2R.exe'");
      expect(options).toEqual({ windowsHide: true });
    });
  });

  describe('If PowerShell fails', () => {
    it('Then no module info is returned', async () => {
      // Arrange
      const execFile = createExecFile('', new Error('powershell not found'));
      const reader = new WindowsMemoryReaderImpl(execFile);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      // Act
      const moduleInfo = await reader.getModuleInfo(1234, 'D2R.exe');

      // Assert
      expect(moduleInfo).toBeNull();
      consoleError.mockRestore();
    });
  });

  describe('If the module name is not a plain file name', () => {
    it('Then PowerShell is not run', async () => {
      // Arrange
      const execFile = createExecFile('');
      const reader = new WindowsMemoryReaderImpl(execFile);
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      // Act
      const moduleInfo = await reader.getModuleInfo(1234, "D2R.exe'; Remove-Item x; '");

      // Assert
      expect(moduleInfo).toBeNull();
      expect(execFile).not.toHaveBeenCalled();
      consoleWarn.mockRestore();
    });
  });

  describe('If a process is opened', () => {
    it('Then the handle from OpenProcess is returned without running another process first', async () => {
      // Arrange
      win32.OpenProcess.mockReturnValue(0x42);
      const execFile = createExecFile('');
      const reader = new WindowsMemoryReaderImpl(execFile);

      // Act
      const handle = await reader.openProcess(1234);

      // Assert
      expect(handle).toBe(0x42);
      expect(execFile).not.toHaveBeenCalled();
    });

    it('When OpenProcess fails because the process does not exist, Then null is returned', async () => {
      // Arrange
      win32.OpenProcess.mockReturnValue(0);
      const reader = new WindowsMemoryReaderImpl(createExecFile(''));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      // Act
      const handle = await reader.openProcess(999_999);

      // Assert
      expect(handle).toBeNull();
      expect(win32.GetLastError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});
