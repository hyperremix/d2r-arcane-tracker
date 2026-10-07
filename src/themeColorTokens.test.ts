import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards against color utilities that render without color (tokens missing from the theme)
 * or that bypass the theme (raw Tailwind palette colors and arbitrary hex values).
 */

const srcDir = dirname(fileURLToPath(import.meta.url));

// Class boundaries: a class is not part of a longer word, path or file name (e.g. `/images/placeholder-item.png`).
const CLASS_START = '(?<![\\w/.-])';
const CLASS_END = '(?![\\w/.-])';

const COLOR_UTILITY_PREFIX =
  '(?:text|bg|border(?:-[trblxyse])?|ring(?:-offset)?|fill|stroke|from|via|to|outline|divide|decoration|caret|placeholder|shadow)';

const TAILWIND_PALETTE = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
];

interface Violation {
  location: string;
  className: string;
}

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

function findViolations(pattern: RegExp, isViolation: (match: RegExpMatchArray) => boolean) {
  const violations: Violation[] = [];
  for (const file of collectSourceFiles(srcDir)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(pattern)) {
        if (isViolation(match)) {
          violations.push({
            location: `${relative(srcDir, file)}:${index + 1}`,
            className: match[0],
          });
        }
      }
    });
  }
  return violations;
}

function getDefinedThemeColors(): Set<string> {
  const css = readFileSync(join(srcDir, 'index.css'), 'utf8');
  return new Set([...css.matchAll(/--color-([a-z0-9-]+):/g)].map((match) => match[1]));
}

describe('When scanning renderer source files for color utilities', () => {
  it('If a class sets a color, Then it does not use a raw Tailwind palette color', () => {
    // Arrange
    const pattern = new RegExp(
      `${CLASS_START}${COLOR_UTILITY_PREFIX}-(?:${TAILWIND_PALETTE.join('|')})-\\d{2,3}(?:\\/\\d+)?${CLASS_END}`,
      'g',
    );

    // Act
    const violations = findViolations(pattern, () => true);

    // Assert
    expect(violations).toEqual([]);
  });

  it('If a class sets a color, Then it does not use an arbitrary hex value', () => {
    // Arrange
    const pattern = new RegExp(
      `${CLASS_START}${COLOR_UTILITY_PREFIX}-\\[#[0-9a-fA-F]{3,8}\\]`,
      'g',
    );

    // Act
    const violations = findViolations(pattern, () => true);

    // Assert
    expect(violations).toEqual([]);
  });

  it('If a class uses a theme color family, Then the exact token is defined in index.css', () => {
    // Arrange
    const definedColors = getDefinedThemeColors();
    const definedRoots = new Set([...definedColors].map((color) => color.split('-')[0]));
    const pattern = new RegExp(
      `${CLASS_START}${COLOR_UTILITY_PREFIX}-([a-z][a-z0-9-]*[a-z0-9])(?:\\/\\d+)?${CLASS_END}`,
      'g',
    );

    // Act
    const violations = findViolations(pattern, (match) => {
      const colorName = match[1];
      const root = colorName.split('-')[0];
      return definedRoots.has(root) && !definedColors.has(colorName);
    });

    // Assert
    expect(definedColors.has('success')).toBe(true);
    expect(violations).toEqual([]);
  });
});
