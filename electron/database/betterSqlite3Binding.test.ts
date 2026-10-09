import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

describe('When a suite stubs process.platform before opening a database', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('If the stubbed platform differs from the host, Then better-sqlite3 still loads the host binary', () => {
    // Arrange
    const foreignPlatform = originalPlatform === 'win32' ? 'linux' : 'win32';
    Object.defineProperty(process, 'platform', { value: foreignPlatform, configurable: true });

    // Act
    const db = new Database(':memory:');
    const value = db.prepare('SELECT 1').pluck().get();
    db.close();

    // Assert
    expect(value).toBe(1);
  });
});
