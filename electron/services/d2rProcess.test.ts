import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ExecFileFunction,
  findD2RProcess,
  findD2RProcessOnLinux,
  parseD2RProcessId,
} from './d2rProcess';

function createExecFile(result: { stdout: string } | Error) {
  return vi.fn<ExecFileFunction>((_file, _args, _options, callback) => {
    if (result instanceof Error) {
      callback(result, '');
    } else {
      callback(null, result.stdout);
    }
  });
}

describe('When the D2R process is looked up', () => {
  describe('If tasklist lists D2R.exe', () => {
    it('Then its process ID is returned', async () => {
      // Arrange
      const execFile = createExecFile({ stdout: '"D2R.exe","1234","Console","1","1,000 K"\r\n' });

      // Act
      const processId = await findD2RProcess(execFile);

      // Assert
      expect(processId).toBe(1234);
    });

    it('Then tasklist is run directly, without a shell or a console window', async () => {
      // Arrange
      const execFile = createExecFile({ stdout: '' });

      // Act
      await findD2RProcess(execFile);

      // Assert
      expect(execFile).toHaveBeenCalledWith(
        'tasklist',
        ['/FI', 'IMAGENAME eq D2R.exe', '/FO', 'CSV', '/NH'],
        { windowsHide: true },
        expect.any(Function),
      );
    });
  });

  describe('If tasklist reports no matching process', () => {
    it('Then null is returned', async () => {
      // Arrange
      const execFile = createExecFile({
        stdout: 'INFO: No tasks are running which match the specified criteria.\r\n',
      });

      // Act
      const processId = await findD2RProcess(execFile);

      // Assert
      expect(processId).toBeNull();
    });
  });

  describe('If tasklist cannot be run', () => {
    it('Then the lookup rejects', async () => {
      // Arrange
      const execFile = createExecFile(new Error('tasklist not found'));

      // Act
      const lookup = findD2RProcess(execFile);

      // Assert
      await expect(lookup).rejects.toThrow('tasklist not found');
    });
  });
});

describe('When tasklist output is parsed', () => {
  it('If another process is listed, Then it is ignored', () => {
    // Act
    const processId = parseD2RProcessId('"D2R-launcher.exe","99","Console","1","1 K"');

    // Assert
    expect(processId).toBeNull();
  });
});

describe('When the D2R process is looked up on Linux', () => {
  let procRoot: string;

  /**
   * Adds a fake process entry with the given `comm` and NUL-separated `cmdline` files.
   */
  const addProcess = (pid: string, comm: string, cmdline: string[]) => {
    const processDir = path.join(procRoot, pid);
    mkdirSync(processDir, { recursive: true });
    writeFileSync(path.join(processDir, 'comm'), `${comm}\n`);
    writeFileSync(path.join(processDir, 'cmdline'), `${cmdline.join('\0')}\0`);
  };

  beforeEach(() => {
    procRoot = mkdtempSync(path.join(os.tmpdir(), 'd2r-proc-'));
  });

  afterEach(() => {
    rmSync(procRoot, { recursive: true, force: true });
  });

  describe('If D2R.exe runs under Wine or Proton', () => {
    it('Then its process ID is found by the process name Wine sets', async () => {
      // Arrange
      addProcess('100', 'bash', ['/bin/bash']);
      addProcess('4321', 'D2R.exe', ['C:\\Program Files (x86)\\Diablo II Resurrected\\D2R.exe']);

      // Act
      const processId = await findD2RProcessOnLinux(procRoot);

      // Assert
      expect(processId).toBe(4321);
    });

    it('Then it is also found by the executable in its command line', async () => {
      // Arrange
      addProcess('77', 'wine64-preloader', ['Z:\\home\\deck\\Games\\D2R\\d2r.exe', '-w']);

      // Act
      const processId = await findD2RProcessOnLinux(procRoot);

      // Assert
      expect(processId).toBe(77);
    });
  });

  describe('If only other processes run', () => {
    it('Then null is returned, and non-process entries and launchers are ignored', async () => {
      // Arrange
      addProcess('12', 'Diablo II Resur', [
        'C:\\Program Files (x86)\\Diablo II Resurrected\\Diablo II Resurrected Launcher.exe',
      ]);
      addProcess('13', 'vim', ['vim', 'D2R.exe']);
      mkdirSync(path.join(procRoot, 'self'));
      writeFileSync(path.join(procRoot, 'uptime'), '1.0 1.0');

      // Act
      const processId = await findD2RProcessOnLinux(procRoot);

      // Assert
      expect(processId).toBeNull();
    });
  });

  describe('If a process entry cannot be read', () => {
    it('Then it is skipped and the other processes are still checked', async () => {
      // Arrange
      mkdirSync(path.join(procRoot, '5'));
      addProcess('6', 'D2R.exe', ['D2R.exe']);

      // Act
      const processId = await findD2RProcessOnLinux(procRoot);

      // Assert
      expect(processId).toBe(6);
    });
  });

  describe('If the process list cannot be read', () => {
    it('Then the lookup rejects', async () => {
      // Arrange
      const missingRoot = path.join(procRoot, 'missing');

      // Act
      const lookup = findD2RProcessOnLinux(missingRoot);

      // Assert
      await expect(lookup).rejects.toThrow();
    });
  });
});
