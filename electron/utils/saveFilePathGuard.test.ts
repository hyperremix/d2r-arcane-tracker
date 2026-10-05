import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertSaveFilePathAllowed } from './saveFilePathGuard';

describe('When validating renderer-supplied save file paths', () => {
  let root: string;
  let saveDir: string;
  let outsideDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'path-guard-'));
    saveDir = join(root, 'saves');
    outsideDir = join(root, 'outside');
    mkdirSync(saveDir);
    mkdirSync(outsideDir);
    writeFileSync(join(saveDir, 'Hero.d2s'), 'x');
    writeFileSync(join(outsideDir, 'Evil.d2s'), 'x');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe('If the path is a save file inside the save directory', () => {
    it('Then it is accepted for every save extension, case-insensitively', () => {
      // Arrange
      const paths = ['Hero.d2s', 'Stash.d2i', 'Old.sss', 'Old2.d2x', 'Upper.D2S'].map((name) =>
        join(saveDir, name),
      );

      // Act
      const run = () => {
        for (const path of paths) {
          assertSaveFilePathAllowed(path, saveDir, 'sourceFilePath');
        }
      };

      // Assert
      expect(run).not.toThrow();
    });
  });

  describe('If the path uses .. to climb out of the save directory', () => {
    it('Then it is rejected', () => {
      // Arrange
      const traversal = join(saveDir, '..', 'outside', 'Evil.d2s');

      // Act
      const run = () => assertSaveFilePathAllowed(traversal, saveDir, 'sourceFilePath');

      // Assert
      expect(run).toThrow(
        'sourceFilePath must be a save file inside the configured save directory',
      );
    });
  });

  describe('If the path is outside the save directory', () => {
    it('Then it is rejected', () => {
      // Arrange
      const outside = join(outsideDir, 'Evil.d2s');

      // Act
      const run = () => assertSaveFilePathAllowed(outside, saveDir, 'targetFilePath');

      // Assert
      expect(run).toThrow(
        'targetFilePath must be a save file inside the configured save directory',
      );
    });
  });

  describe('If the path is in a nested directory of the save directory', () => {
    it('Then it is rejected because the monitor only reads the directory itself', () => {
      // Arrange
      mkdirSync(join(saveDir, 'nested'));
      const nested = join(saveDir, 'nested', 'Hero.d2s');

      // Act
      const run = () => assertSaveFilePathAllowed(nested, saveDir, 'sourceFilePath');

      // Assert
      expect(run).toThrow('inside the configured save directory');
    });
  });

  describe('If the path has an extension that is not a save file', () => {
    it('Then it is rejected even inside the save directory', () => {
      // Arrange
      const notSave = join(saveDir, 'notes.txt');

      // Act
      const run = () => assertSaveFilePathAllowed(notSave, saveDir, 'sourceFilePath');

      // Assert
      expect(run).toThrow('must point to a Diablo II save file');
    });
  });

  describe('If a symlink inside the save directory points outside of it', () => {
    it('Then it is rejected', () => {
      // Arrange
      const link = join(saveDir, 'Link.d2s');
      symlinkSync(join(outsideDir, 'Evil.d2s'), link);

      // Act
      const run = () => assertSaveFilePathAllowed(link, saveDir, 'sourceFilePath');

      // Assert
      expect(run).toThrow('inside the configured save directory');
    });

    it('Then a file reached through a symlinked parent directory is rejected too', () => {
      // Arrange
      const linkedDir = join(saveDir, 'linked');
      symlinkSync(outsideDir, linkedDir);

      // Act
      const run = () =>
        assertSaveFilePathAllowed(join(linkedDir, 'New.d2s'), saveDir, 'sourceFilePath');

      // Assert
      expect(run).toThrow('inside the configured save directory');
    });
  });

  describe('If the save directory itself is reached through a symlink', () => {
    it('Then files inside it are still accepted', () => {
      // Arrange
      const linkedSaveDir = join(root, 'saves-link');
      symlinkSync(saveDir, linkedSaveDir);

      // Act
      const run = () =>
        assertSaveFilePathAllowed(join(saveDir, 'Hero.d2s'), linkedSaveDir, 'sourceFilePath');

      // Assert
      expect(run).not.toThrow();
    });
  });

  describe('If no save directory is configured', () => {
    it('Then every path is rejected', () => {
      // Arrange
      const path = join(saveDir, 'Hero.d2s');

      // Act
      const run = () => assertSaveFilePathAllowed(path, undefined, 'sourceFilePath');

      // Assert
      expect(run).toThrow('The save directory is not configured');
    });
  });

  describe('If the path is empty or contains a null byte', () => {
    it('Then it is rejected', () => {
      // Arrange
      const nullByte = `${join(saveDir, 'Hero.d2s')}\0.txt`;

      // Act
      const emptyRun = () => assertSaveFilePathAllowed('', saveDir, 'sourceFilePath');
      const nullRun = () => assertSaveFilePathAllowed(nullByte, saveDir, 'sourceFilePath');

      // Assert
      expect(emptyRun).toThrow('sourceFilePath must be a valid file path');
      expect(nullRun).toThrow('sourceFilePath must be a valid file path');
    });
  });
});
