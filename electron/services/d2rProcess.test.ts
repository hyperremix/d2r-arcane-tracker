import { describe, expect, it, vi } from 'vitest';
import { type ExecFileFunction, findD2RProcess, parseD2RProcessId } from './d2rProcess';

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
