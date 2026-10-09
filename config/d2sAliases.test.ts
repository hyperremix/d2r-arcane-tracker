import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getD2sSourceAliases } from './d2sAliases';

describe('getD2sSourceAliases', () => {
  let rootDir: string;
  let d2sRoot: string;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), 'd2s-aliases-'));
    d2sRoot = path.join(rootDir, 'node_modules', '@dschu012', 'd2s');
    mkdirSync(d2sRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('When the compiled d2s lib build is present, then it returns no aliases', () => {
    // Arrange
    mkdirSync(path.join(d2sRoot, 'lib'), { recursive: true });
    writeFileSync(path.join(d2sRoot, 'lib', 'index.js'), '');

    // Act
    const aliases = getD2sSourceAliases(rootDir);

    // Assert
    expect(aliases).toEqual([]);
  });

  it('If the compiled d2s lib build is missing, then it aliases deep and bare imports to src', () => {
    // Arrange
    const srcDir = path.join(d2sRoot, 'src');

    // Act
    const aliases = getD2sSourceAliases(rootDir);

    // Assert
    expect(aliases).toEqual([
      { find: /^@dschu012\/d2s\/lib\//, replacement: `${srcDir}/` },
      { find: '@dschu012/d2s', replacement: path.join(srcDir, 'index.ts') },
    ]);
  });

  it('If the compiled d2s lib build is missing, then the deep import alias matches lib subpaths only', () => {
    // Arrange
    const [deepAlias] = getD2sSourceAliases(rootDir);
    const pattern = deepAlias.find as RegExp;

    // Act
    const deepMatch = pattern.test('@dschu012/d2s/lib/d2/items');
    const bareMatch = pattern.test('@dschu012/d2s');

    // Assert
    expect(deepMatch).toBe(true);
    expect(bareMatch).toBe(false);
  });
});
