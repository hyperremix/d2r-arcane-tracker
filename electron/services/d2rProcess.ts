import { execFile } from 'node:child_process';

/** Image name of the Diablo II: Resurrected process. */
export const D2R_PROCESS_NAME = 'D2R.exe';

/**
 * Reads the process ID of D2R from `tasklist /FO CSV /NH` output.
 * @param stdout - Output lines like `"D2R.exe","12345","Console","1","1,000 K"`
 * @returns The process ID, or null if D2R is not listed
 */
export function parseD2RProcessId(stdout: string): number | null {
  for (const line of stdout.trim().split('\n')) {
    const match = line.match(/"([^"]+)","(\d+)"/);
    if (match && match[1].toLowerCase() === D2R_PROCESS_NAME.toLowerCase()) {
      const pid = Number.parseInt(match[2], 10);
      if (!Number.isNaN(pid)) {
        return pid;
      }
    }
  }
  return null;
}

/** The `execFile` call signature used to run `tasklist`. */
export type ExecFileFunction = (
  file: string,
  args: readonly string[],
  options: { windowsHide: boolean },
  callback: (error: Error | null, stdout: string | Buffer) => void,
) => unknown;

/**
 * Looks up the running D2R process with Windows' `tasklist`, without a shell.
 * @param execFileImpl - `execFile` override for tests
 * @returns The process ID, or null if D2R is not running
 * @throws If `tasklist` cannot be run
 */
export function findD2RProcess(
  execFileImpl: ExecFileFunction = execFile as unknown as ExecFileFunction,
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    execFileImpl(
      'tasklist',
      ['/FI', `IMAGENAME eq ${D2R_PROCESS_NAME}`, '/FO', 'CSV', '/NH'],
      { windowsHide: true },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(parseD2RProcessId(String(stdout)));
      },
    );
  });
}
