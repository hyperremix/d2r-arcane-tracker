import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLastModified } from './lastModified';

const repositoryDir = '/repository';
const buildDate = new Date('2026-10-11T12:00:00Z');
const now = () => buildDate;

afterEach(() => {
  vi.useRealTimers();
});

describe('When the last modification date of files is looked up', () => {
  it('Then git is asked for the last commit that changed the paths, in the repository', () => {
    // Arrange
    const git = vi.fn(() => '2026-09-15\n');
    const lastModified = createLastModified({ repositoryDir, git, now });

    // Act
    const result = lastModified(['website', 'docs/screenshots']);

    // Assert
    expect(result).toBe('2026-09-15');
    expect(git).toHaveBeenCalledWith(
      ['log', '-1', '--format=%cs', '--', 'website', 'docs/screenshots'],
      repositoryDir,
    );
  });

  it('If no commit changed the paths yet, then it is the build date', () => {
    // Arrange
    const lastModified = createLastModified({ repositoryDir, git: () => '', now });

    // Act
    const result = lastModified(['docs/NEW_GUIDE.md']);

    // Assert
    expect(result).toBe('2026-10-11');
  });

  it('If git prints something that is not a date, then it is the build date', () => {
    // Arrange
    const lastModified = createLastModified({ repositoryDir, git: () => 'fatal: nope', now });

    // Act
    const result = lastModified(['docs/RUN_TRACKER.md']);

    // Assert
    expect(result).toBe('2026-10-11');
  });

  it('If git is not available, then it is the build date', () => {
    // Arrange
    const git = () => {
      throw new Error('spawn git ENOENT');
    };
    const lastModified = createLastModified({ repositoryDir, git, now });

    // Act
    const result = lastModified(['docs/RUN_TRACKER.md']);

    // Assert
    expect(result).toBe('2026-10-11');
  });

  it('If the git runner is not given, then the real git is used for committed files', () => {
    // Arrange
    const cwd = process.cwd();
    const expected = execFileSync('git', ['log', '-1', '--format=%cs', '--', 'package.json'], {
      cwd,
      encoding: 'utf8',
    }).trim();
    const unrelatedBuildDate = () => new Date('1999-01-01T00:00:00Z');
    const lastModified = createLastModified({ repositoryDir: cwd, now: unrelatedBuildDate });

    // Act
    const result = lastModified(['package.json']);

    // Assert
    expect(expected).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe(expected);
  });

  it('If the clock is not given, then the build date is today', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T23:59:59Z'));
    const lastModified = createLastModified({ repositoryDir, git: () => '' });

    // Act
    const result = lastModified(['docs/NEW_GUIDE.md']);

    // Assert
    expect(result).toBe('2026-10-11');
  });
});
