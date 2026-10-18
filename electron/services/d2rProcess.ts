import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** Image name of the Diablo II: Resurrected process. */
export const D2R_PROCESS_NAME = 'D2R.exe';

/** Mount point of the Linux process file system. */
const LINUX_PROC_ROOT = '/proc';

/**
 * Checks whether a file name or Windows/Unix path names the D2R executable (case-insensitive).
 * @param executable - `D2R.exe`, `C:\...\D2R.exe` or `/.../D2R.exe`
 */
function isD2RExecutable(executable: string): boolean {
  const name = executable.split(/[\\/]/).pop() ?? '';
  return name.toLowerCase() === D2R_PROCESS_NAME.toLowerCase();
}

/**
 * Checks whether one `/proc/<pid>` entry is D2R. Wine and Proton name the process after the
 * Windows executable (`comm` is `D2R.exe`) and rewrite its command line to the Windows one, so
 * either identifies the game; the command line covers Wine builds that leave `comm` as the loader.
 * @param processDir - The `/proc/<pid>` directory
 * @returns True if the process is D2R; false if not, or if it cannot be read (it may have exited)
 */
async function isD2RLinuxProcess(processDir: string): Promise<boolean> {
  try {
    const comm = await readFile(path.join(processDir, 'comm'), 'utf8');
    if (isD2RExecutable(comm.trim())) {
      return true;
    }
    const cmdline = await readFile(path.join(processDir, 'cmdline'), 'utf8');
    return isD2RExecutable(cmdline.split('\0')[0] ?? '');
  } catch {
    return false;
  }
}

/**
 * Looks up D2R running under Wine or Proton on Linux by reading `/proc`, without running a command.
 * @param procRoot - `/proc` override for tests
 * @returns The process ID, or null if D2R is not running
 * @throws If the process list cannot be read
 */
export async function findD2RProcessOnLinux(procRoot = LINUX_PROC_ROOT): Promise<number | null> {
  const entries = await readdir(procRoot);
  for (const entry of entries) {
    if (/^\d+$/.test(entry) && (await isD2RLinuxProcess(path.join(procRoot, entry)))) {
      return Number.parseInt(entry, 10);
    }
  }
  return null;
}

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
