import { execFileSync } from 'node:child_process';

const GIT_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Runs git in the repository and returns what it prints */
type RunGit = (args: string[], cwd: string) => string;

const runGit: RunGit = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

interface LastModifiedOptions {
  repositoryDir: string;
  /** Replaceable for tests */
  git?: RunGit;
  /** Replaceable for tests */
  now?: () => Date;
}

/**
 * Makes a function that returns the date (YYYY-MM-DD) of the last commit that changed any of
 * `paths` (relative to the repository), or today when git can't tell (no git, or files that aren't
 * committed yet).
 */
export function createLastModified({
  repositoryDir,
  git = runGit,
  now = () => new Date(),
}: LastModifiedOptions): (paths: string[]) => string {
  return (paths) => {
    try {
      const date = git(['log', '-1', '--format=%cs', '--', ...paths], repositoryDir).trim();
      if (GIT_DATE.test(date)) return date;
    } catch {
      // Falls back to the build date below
    }
    return now().toISOString().slice(0, 10);
  };
}
