import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The site's stylesheet only lets Tailwind scan the shared shadcn components the site uses.
 * A component the site uses but the list misses would render without its classes, so this
 * guard keeps the list in sync with the imports.
 */
const websiteSrcDir = resolve(__dirname);
const uiDir = resolve(websiteSrcDir, '../../src/components/ui');

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

/** Every `@/components/ui/<name>` specifier in a quoted string: static, side-effect or dynamic. */
function uiImportsOf(source: string): string[] {
  return [...source.matchAll(/['"]@\/components\/ui\/([\w-]+)['"]/g)].map((match) => match[1]);
}

/** Every relative import in a ui component that resolves to another file in the ui folder. */
function siblingUiImportsOf(source: string): string[] {
  return [...source.matchAll(/['"](\.{1,2}\/[^'"]+)['"]/g)]
    .map((match) => resolve(uiDir, match[1]))
    .filter((path) => dirname(path) === uiDir)
    .map((path) => path.slice(uiDir.length + 1));
}

/** The ui components the site imports, plus the ui components those import in turn. */
function findNeededUiComponents(): string[] {
  const needed = new Set<string>();
  for (const file of collectSourceFiles(websiteSrcDir)) {
    for (const name of uiImportsOf(readFileSync(file, 'utf8'))) {
      needed.add(name);
    }
  }
  const queue = [...needed];
  for (let name = queue.pop(); name !== undefined; name = queue.pop()) {
    const source = readFileSync(join(uiDir, `${name}.tsx`), 'utf8');
    for (const sibling of siblingUiImportsOf(source)) {
      if (!needed.has(sibling)) {
        needed.add(sibling);
        queue.push(sibling);
      }
    }
  }
  return [...needed].sort();
}

/** The ui components named by the `@source` lines of styles.css, as a single file or `{a,b}`. */
function findScannedUiComponents(): string[] {
  const css = readFileSync(join(websiteSrcDir, 'styles.css'), 'utf8');
  const sources = [...css.matchAll(/@source\s+['"][^'"]*src\/components\/ui\/([^'"]+)\.tsx['"]/g)];
  if (sources.length === 0) {
    throw new Error('styles.css has no @source line for src/components/ui');
  }
  return sources
    .flatMap((match) => match[1].replace(/^\{|\}$/g, '').split(','))
    .map((n) => n.trim());
}

describe('When the website stylesheet scans the shared ui components (stylesheet guard)', () => {
  it('Then every ui component the site needs is scanned for Tailwind classes', () => {
    // Arrange
    const needed = findNeededUiComponents();
    const scanned = findScannedUiComponents();

    // Act
    const missing = needed.filter((component) => !scanned.includes(component));

    // Assert
    expect(needed.length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });
});
