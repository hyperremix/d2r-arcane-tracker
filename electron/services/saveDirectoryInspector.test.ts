import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  D2R_SAVE_FOLDER_NAME,
  inspectSaveDirectory,
  MAX_SAVE_DIRECTORY_PATH_LENGTH,
} from './saveDirectoryInspector';

describe('When inspectSaveDirectory is called', () => {
  let tempDir: string;
  let savedGames: string;
  let saveFolder: string;

  /**
   * Creates a file (and its parent folders) inside the temp directory.
   */
  const createFile = (filePath: string) => {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, '');
  };

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'save-dir-inspector-'));
    savedGames = path.join(tempDir, 'Saved Games');
    saveFolder = path.join(savedGames, D2R_SAVE_FOLDER_NAME);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('If the path is not usable', () => {
    it('Then an empty path is reported as invalid', async () => {
      // Arrange & Act
      const result = await inspectSaveDirectory('   ');

      // Assert
      expect(result).toEqual({ status: 'invalidPath', saveFileCount: 0 });
    });

    it('Then a relative path is reported as invalid', async () => {
      // Arrange & Act
      const result = await inspectSaveDirectory('Saved Games/Diablo II Resurrected');

      // Assert
      expect(result).toEqual({ status: 'invalidPath', saveFileCount: 0 });
    });

    it('Then an overly long path is reported as invalid', async () => {
      // Arrange
      const longPath = `/${'a'.repeat(MAX_SAVE_DIRECTORY_PATH_LENGTH)}`;

      // Act
      const result = await inspectSaveDirectory(longPath);

      // Assert
      expect(result).toEqual({ status: 'invalidPath', saveFileCount: 0 });
    });
  });

  describe('If the directory does not exist', () => {
    it('Then it is reported as not found', async () => {
      // Arrange & Act
      const result = await inspectSaveDirectory(path.join(tempDir, 'missing'));

      // Assert
      expect(result).toEqual({ status: 'notFound', saveFileCount: 0 });
    });

    it('Then a file path is reported as not found', async () => {
      // Arrange
      const filePath = path.join(tempDir, 'notes.txt');
      createFile(filePath);

      // Act
      const result = await inspectSaveDirectory(filePath);

      // Assert
      expect(result.status).toBe('notFound');
    });
  });

  describe('If the directory contains character files', () => {
    it('Then only .d2s files are counted, case-insensitively', async () => {
      // Arrange
      createFile(path.join(saveFolder, 'Sorceress.d2s'));
      createFile(path.join(saveFolder, 'Paladin.D2S'));
      createFile(path.join(saveFolder, 'SharedStashSoftCoreV2.d2i'));
      createFile(path.join(saveFolder, 'Settings.json'));
      mkdirSync(path.join(saveFolder, 'folder.d2s'));

      // Act
      const result = await inspectSaveDirectory(`  ${saveFolder}  `);

      // Assert
      expect(result).toEqual({ status: 'hasSaveFiles', saveFileCount: 2 });
    });
  });

  describe('If the directory has no character files', () => {
    it('Then it is reported without a suggestion when no save folder is nearby', async () => {
      // Arrange
      mkdirSync(savedGames, { recursive: true });

      // Act
      const result = await inspectSaveDirectory(savedGames);

      // Assert
      expect(result).toEqual({ status: 'noSaveFiles', saveFileCount: 0 });
    });

    it('Then the D2R subfolder is suggested when the parent folder was chosen', async () => {
      // Arrange
      createFile(path.join(saveFolder, 'Sorceress.d2s'));

      // Act
      const result = await inspectSaveDirectory(savedGames);

      // Assert
      expect(result).toEqual({
        status: 'noSaveFiles',
        saveFileCount: 0,
        suggestedDirectory: saveFolder,
      });
    });

    it('Then the D2R subfolder is matched case-insensitively', async () => {
      // Arrange
      const lowerCaseFolder = path.join(savedGames, D2R_SAVE_FOLDER_NAME.toLowerCase());
      createFile(path.join(lowerCaseFolder, 'Sorceress.d2s'));

      // Act
      const result = await inspectSaveDirectory(savedGames);

      // Assert
      expect(result.suggestedDirectory).toBe(lowerCaseFolder);
    });

    it('Then an empty D2R subfolder is not suggested', async () => {
      // Arrange
      mkdirSync(saveFolder, { recursive: true });

      // Act
      const result = await inspectSaveDirectory(savedGames);

      // Assert
      expect(result.suggestedDirectory).toBeUndefined();
    });

    it('Then the enclosing D2R folder is suggested when one of its subfolders was chosen', async () => {
      // Arrange
      createFile(path.join(saveFolder, 'Sorceress.d2s'));
      const modsFolder = path.join(saveFolder, 'mods', 'MyMod');
      mkdirSync(modsFolder, { recursive: true });

      // Act
      const result = await inspectSaveDirectory(modsFolder);

      // Assert
      expect(result).toEqual({
        status: 'noSaveFiles',
        saveFileCount: 0,
        suggestedDirectory: saveFolder,
      });
    });

    it('Then the enclosing D2R folder is suggested even if the chosen subfolder does not exist', async () => {
      // Arrange
      createFile(path.join(saveFolder, 'Sorceress.d2s'));

      // Act
      const result = await inspectSaveDirectory(path.join(saveFolder, 'missing'));

      // Assert
      expect(result).toEqual({
        status: 'notFound',
        saveFileCount: 0,
        suggestedDirectory: saveFolder,
      });
    });
  });
});
