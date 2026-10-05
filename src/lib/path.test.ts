import { describe, expect, it } from 'vitest';
import { getFileName } from './path';

describe('When getFileName is called', () => {
  it('If the path uses POSIX separators, Then it returns the last segment', () => {
    // Arrange
    const filePath = '/Users/me/backups/holy-grail-backup.db';

    // Act
    const result = getFileName(filePath);

    // Assert
    expect(result).toBe('holy-grail-backup.db');
  });

  it('If the path uses Windows separators, Then it returns the last segment', () => {
    // Arrange
    const filePath = 'C:\\Users\\me\\Documents\\holy-grail-backup.db';

    // Act
    const result = getFileName(filePath);

    // Assert
    expect(result).toBe('holy-grail-backup.db');
  });

  it('If the path mixes separators, Then it returns the last segment', () => {
    // Arrange
    const filePath = 'C:\\Users\\me/exports\\run-analytics.csv';

    // Act
    const result = getFileName(filePath);

    // Assert
    expect(result).toBe('run-analytics.csv');
  });

  it('If the path has no separators, Then it returns the input unchanged', () => {
    // Arrange
    const filePath = 'run-analytics.csv';

    // Act
    const result = getFileName(filePath);

    // Assert
    expect(result).toBe('run-analytics.csv');
  });
});
