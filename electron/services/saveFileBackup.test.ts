import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  backupSaveFile,
  buildBackupPrefix,
  buildCopyFileName,
  configureSaveFileBackups,
  listCopyFileNames,
  parseCopyFileName,
  pruneCopies,
} from './saveFileBackup';

describe('saveFileBackup', () => {
  let saveDirectory: string;
  let backupDirectory: string;

  beforeEach(async () => {
    saveDirectory = await mkdtemp(join(tmpdir(), 'save-files-'));
    backupDirectory = await mkdtemp(join(tmpdir(), 'save-backups-'));
  });

  afterEach(async () => {
    configureSaveFileBackups(undefined);
    await rm(saveDirectory, { recursive: true, force: true });
    await rm(backupDirectory, { recursive: true, force: true });
  });

  describe('When backups are configured', () => {
    it('Then it stores a byte-identical copy of the save file', async () => {
      // Arrange
      const saveFile = join(saveDirectory, 'Hero.d2s');
      await writeFile(saveFile, Buffer.from([1, 2, 3, 4]));
      configureSaveFileBackups(backupDirectory);

      // Act
      await backupSaveFile(saveFile);

      // Assert
      const backups = await readdir(backupDirectory);
      expect(backups).toHaveLength(1);
      expect([...(await readFile(join(backupDirectory, backups[0])))]).toEqual([1, 2, 3, 4]);
    });

    it('Then it keeps only the most recent backups of a file', async () => {
      // Arrange
      const saveFile = join(saveDirectory, 'Hero.d2s');
      await writeFile(saveFile, 'x');
      configureSaveFileBackups(backupDirectory);

      // Act
      for (let index = 0; index < 25; index += 1) {
        await backupSaveFile(saveFile);
      }

      // Assert
      expect(await readdir(backupDirectory)).toHaveLength(20);
    });
  });

  describe('If the save file does not exist yet', () => {
    it('Then it resolves without creating a backup', async () => {
      // Arrange
      configureSaveFileBackups(backupDirectory);

      // Act
      await backupSaveFile(join(saveDirectory, 'Missing.d2s'));

      // Assert
      expect(await readdir(backupDirectory)).toHaveLength(0);
    });
  });

  describe('If backups are not configured', () => {
    it('Then it does nothing', async () => {
      // Arrange
      const saveFile = join(saveDirectory, 'Hero.d2s');
      await writeFile(saveFile, 'x');

      // Act
      await backupSaveFile(saveFile);

      // Assert
      expect(await readdir(backupDirectory)).toHaveLength(0);
    });
  });
});

describe('When naming the copies of a save file', () => {
  it('If the same file is copied twice, Then the names differ and sort by the time they were taken', () => {
    // Arrange
    const filePath = join('saves', 'Hero.d2s');

    // Act
    const first = buildCopyFileName(filePath, '.snap');
    const second = buildCopyFileName(filePath, '.snap');

    // Assert
    expect(first).not.toBe(second);
    expect([second, first].sort()).toEqual([first, second]);
    expect(first.startsWith(buildBackupPrefix(filePath))).toBe(true);
    expect(first.endsWith('.snap')).toBe(true);
  });

  it('If equally named files are in different folders, Then their prefixes differ', () => {
    // Arrange
    const first = join('saves', 'one', 'Hero.d2s');
    const second = join('saves', 'two', 'Hero.d2s');

    // Act
    const prefixes = [buildBackupPrefix(first), buildBackupPrefix(second)];

    // Assert
    expect(prefixes[0]).not.toBe(prefixes[1]);
    expect(prefixes.every((prefix) => prefix.endsWith('-Hero.d2s.'))).toBe(true);
  });
});

describe('When reading the name of a copy', () => {
  it('If the name was built by buildCopyFileName, Then its parts are returned', () => {
    // Arrange
    const filePath = join('saves', 'Hero.d2s');
    const before = Date.now();
    const name = buildCopyFileName(filePath, '.bak');

    // Act
    const parsed = parseCopyFileName(name);

    // Assert
    expect(parsed).toMatchObject({
      prefix: buildBackupPrefix(filePath),
      saveFileName: 'Hero.d2s',
      extension: '.bak',
    });
    expect(parsed?.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(parsed?.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('If the name carries a time, Then createdAt is that time in UTC', () => {
    // Arrange
    const name = '0123abcd-Hero.d2s.2024-03-05T06-07-08-009Z-000001.snap';

    // Act
    const parsed = parseCopyFileName(name);

    // Assert
    expect(parsed?.createdAt.toISOString()).toBe('2024-03-05T06:07:08.009Z');
  });

  it.each([
    ['a plain save file name', 'Hero.d2s'],
    ['a name without the hash prefix', 'Hero.d2s.2024-03-05T06-07-08-009Z-000001.snap'],
    ['a name without a sequence number', '0123abcd-Hero.d2s.2024-03-05T06-07-08-009Z.snap'],
    ['a name with an impossible date', '0123abcd-Hero.d2s.2024-13-45T06-07-08-009Z-000001.snap'],
  ])('If the name is %s, Then it is not the name of a copy', (_, name) => {
    // Arrange (the table above)

    // Act
    const parsed = parseCopyFileName(name);

    // Assert
    expect(parsed).toBeUndefined();
  });
});

describe('When listing and pruning the copies of a save file', () => {
  const prefix = '0123abcd-Hero.d2s.';
  const otherPrefix = '4567ef01-Hero.d2s.';
  const copy = (copyPrefix: string, day: number, extension = '.snap') =>
    `${copyPrefix}2024-01-${String(day).padStart(2, '0')}T00-00-00-000Z-000001${extension}`;
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'save-copies-'));
    const names = [
      copy(prefix, 3),
      copy(prefix, 1),
      copy(prefix, 2),
      copy(prefix, 4, '.bak'),
      copy(otherPrefix, 1),
    ];
    await Promise.all(names.map((name) => writeFile(join(directory, name), 'x')));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('If copies of several files and kinds are in the directory, Then only the matching ones are listed, oldest first', async () => {
    // Arrange (the directory above)

    // Act
    const names = await listCopyFileNames(directory, prefix, '.snap');

    // Assert
    expect(names).toEqual([copy(prefix, 1), copy(prefix, 2), copy(prefix, 3)]);
  });

  it('If more copies exist than are kept, Then the oldest ones are deleted and other files stay', async () => {
    // Arrange (the directory above)

    // Act
    await pruneCopies(directory, prefix, '.snap', 2);

    // Assert
    expect((await readdir(directory)).sort()).toEqual(
      [copy(prefix, 2), copy(prefix, 3), copy(prefix, 4, '.bak'), copy(otherPrefix, 1)].sort(),
    );
  });

  it('If no more copies exist than are kept, Then nothing is deleted', async () => {
    // Arrange (the directory above)

    // Act
    await pruneCopies(directory, prefix, '.snap', 3);

    // Assert
    expect(await readdir(directory)).toHaveLength(5);
  });
});
