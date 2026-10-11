import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The site's stylesheet only lets Tailwind scan the shared shadcn components the site imports.
 * A component the site imports but the list misses would render without its classes, so this
 * guard keeps the list in sync with the imports.
 */
const websiteSrcDir = resolve(__dirname);

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(fullPath);
    }
    const isSource = /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name);
    return isSource ? [fullPath] : [];
  });
}

function findImportedUiComponents(): string[] {
  const components = new Set<string>();
  for (const file of collectSourceFiles(websiteSrcDir)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from '@\/components\/ui\/([\w-]+)'/g)) {
      components.add(match[1]);
    }
  }
  return [...components].sort();
}

function findScannedUiComponents(): string[] {
  const css = readFileSync(join(websiteSrcDir, 'styles.css'), 'utf8');
  const match = css.match(/@source '\.\.\/\.\.\/src\/components\/ui\/\{([^}]*)\}\.tsx';/);
  return match ? match[1].split(',').map((name) => name.trim()) : [];
}

describe('When the website stylesheet scans the shared ui components (stylesheet guard)', () => {
  it('Then every ui component the site imports is scanned for Tailwind classes', () => {
    // Arrange
    const imported = findImportedUiComponents();

    // Act
    const scanned = findScannedUiComponents();

    // Assert
    expect(imported.length).toBeGreaterThan(0);
    expect(imported.filter((component) => !scanned.includes(component))).toEqual([]);
  });
});
