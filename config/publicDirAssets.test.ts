import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolvePublicDirFile } from './publicDirAssets';

describe('resolvePublicDirFile', () => {
  let rootDir: string;
  let publicDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), 'public-dir-assets-'));
    publicDir = path.join(rootDir, 'public');
    mkdirSync(path.join(publicDir, 'images'), { recursive: true });
    writeFileSync(path.join(publicDir, 'logo.png'), '');
    writeFileSync(path.join(publicDir, 'images', 'placeholder-item.svg'), '');
    writeFileSync(path.join(rootDir, 'package.json'), '{}');
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it.each([
    ['/logo.png', ['logo.png']],
    ['/images/placeholder-item.svg', ['images', 'placeholder-item.svg']],
  ])('When %s is a file in the public dir, then it resolves to its absolute path', (source, segments) => {
    // Arrange
    const expected = path.join(publicDir, ...segments);

    // Act
    const resolved = resolvePublicDirFile(publicDir, source);

    // Assert
    expect(resolved).toBe(expected);
  });

  it.each([
    '/',
    '/images',
    '/images/',
  ])('When %s is a directory, then it does not resolve', (source) => {
    // Arrange / Act
    const resolved = resolvePublicDirFile(publicDir, source);

    // Assert
    expect(resolved).toBeUndefined();
  });

  it.each([
    '/../package.json',
    '/images/../../package.json',
    '/..',
  ])('When %s escapes the public dir, then it does not resolve', (source) => {
    // Arrange / Act
    const resolved = resolvePublicDirFile(publicDir, source);

    // Assert
    expect(resolved).toBeUndefined();
  });

  it.each([
    '/missing.png',
    '/logo.png?url',
    '/logo.png?raw',
    'logo.png',
    './logo.png',
    '@/logo.png',
  ])('When %s is missing, suffixed or not root-relative, then it falls through', (source) => {
    // Arrange / Act
    const resolved = resolvePublicDirFile(publicDir, source);

    // Assert
    expect(resolved).toBeUndefined();
  });
});
