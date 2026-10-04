import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backupSaveFile, configureSaveFileBackups } from './saveFileBackup';

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
