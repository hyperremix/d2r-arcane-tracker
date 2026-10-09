import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSourceAliases } from './aliases';

const rootDir = path.resolve('/repo');

/**
 * Applies the first matching alias the way Vite does, or returns the import unchanged.
 */
function resolveImport(source: string): string {
  const alias = getSourceAliases(rootDir).find(({ find }) => (find as RegExp).test(source));
  return alias ? source.replace(alias.find, alias.replacement) : source;
}

describe('getSourceAliases', () => {
  it('When an import starts with @/, then it resolves into src', () => {
    // Arrange
    const source = '@/components/ui/button';

    // Act
    const resolved = resolveImport(source);

    // Assert
    expect(resolved).toBe(`${path.join(rootDir, 'src')}/components/ui/button`);
  });

  it('When an import starts with electron/, then it resolves into the electron folder', () => {
    // Arrange
    const source = 'electron/types/grail';

    // Act
    const resolved = resolveImport(source);

    // Assert
    expect(resolved).toBe(`${path.join(rootDir, 'electron')}/types/grail`);
  });

  it.each([
    'electron',
    'electron-updater',
    '@dschu012/d2s',
  ])('If the import is the package %s, then it is left unchanged', (source) => {
    // Arrange (source from the table)

    // Act
    const resolved = resolveImport(source);

    // Assert
    expect(resolved).toBe(source);
  });
});
