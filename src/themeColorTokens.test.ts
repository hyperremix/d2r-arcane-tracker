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

const RAW_PALETTE_PATTERN = new RegExp(
  `${CLASS_START}${COLOR_UTILITY_PREFIX}-(?:${TAILWIND_PALETTE.join('|')})-\\d{2,3}(?:\\/\\d+)?${CLASS_END}`,
  'g',
);

const ARBITRARY_HEX_PATTERN = new RegExp(
  `${CLASS_START}${COLOR_UTILITY_PREFIX}-\\[#[0-9a-fA-F]{3,8}\\]`,
  'g',
);

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
    const isSource = /\.(?:tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name);
    return isSource ? [fullPath] : [];
  });
}

function findViolationsInText(
  text: string,
  location: string,
  pattern: RegExp,
  isViolation: (match: RegExpMatchArray) => boolean,
) {
  const violations: Violation[] = [];
  text.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(pattern)) {
      if (isViolation(match)) {
        violations.push({ location: `${location}:${index + 1}`, className: match[0] });
      }
    }
  });
  return violations;
}

function findViolations(pattern: RegExp, isViolation: (match: RegExpMatchArray) => boolean) {
  return collectSourceFiles(srcDir).flatMap((file) =>
    findViolationsInText(readFileSync(file, 'utf8'), relative(srcDir, file), pattern, isViolation),
  );
}

function getDefinedThemeColors(): Set<string> {
  const css = readFileSync(join(srcDir, 'index.css'), 'utf8');
  return new Set([...css.matchAll(/--color-([a-z0-9-]+):/g)].map((match) => match[1]));
}

describe('When scanning renderer source files for color utilities', () => {
  it('If stylesheets exist in the renderer, Then they are included in the scan', () => {
    // Arrange
    const expected = join(srcDir, 'index.css');

    // Act
    const files = collectSourceFiles(srcDir);

    // Assert
    expect(files).toContain(expected);
  });

  it('If a class sets a color, Then it does not use a raw Tailwind palette color', () => {
    // Arrange

    // Act
    const violations = findViolations(RAW_PALETTE_PATTERN, () => true);

    // Assert
    expect(violations).toEqual([]);
  });

  it('If a class sets a color, Then it does not use an arbitrary hex value', () => {
    // Arrange

    // Act
    const violations = findViolations(ARBITRARY_HEX_PATTERN, () => true);

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

type Rgb = [number, number, number];

interface Oklch {
  l: number;
  c: number;
  h: number;
}

type ThemeTokens = Record<string, Oklch>;

const AA_TEXT = 4.5;

/** Reads the opaque `oklch(L C H)` custom properties of the theme block that starts with `selector`. */
function getThemeTokens(selector: string): ThemeTokens {
  const css = readFileSync(join(srcDir, 'index.css'), 'utf8');
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('\n}', start));
  const tokens: ThemeTokens = {};
  for (const match of block.matchAll(/--([a-z0-9-]+): oklch\(([\d.]+) ([\d.]+) ([\d.]+)\);/g)) {
    tokens[match[1]] = { l: Number(match[2]), c: Number(match[3]), h: Number(match[4]) };
  }
  return tokens;
}

/** OKLCH to gamma-encoded sRGB (0-1), using the OKLab matrices from the CSS Color 4 spec. */
function toSrgb({ l, c, h }: Oklch): Rgb {
  const hue = (h * Math.PI) / 180;
  const a = c * Math.cos(hue);
  const b = c * Math.sin(hue);
  const lms = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ];
  const linear = [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ];
  const encode = (value: number) =>
    value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
  return linear.map((value) => Math.min(1, Math.max(0, encode(value)))) as Rgb;
}

/** A color at `alpha` opacity painted over an opaque surface, blended in sRGB like the browser. */
function over(color: Oklch, alpha: number, surface: Oklch): Rgb {
  const top = toSrgb(color);
  const bottom = toSrgb(surface);
  return top.map((value, index) => value * alpha + bottom[index] * (1 - alpha)) as Rgb;
}

function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first: Rgb, second: Rgb): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (x, y) => y - x,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

function hueDistance(first: Oklch, second: Oklch): number {
  const distance = Math.abs(first.h - second.h) % 360;
  return Math.min(distance, 360 - distance);
}

const themes = [
  ['light', ':root'],
  ['dark (and widget)', '.dark,\nbody.widget'],
] as const;

describe.each(themes)('When checking the %s theme accent tokens', (_name, selector) => {
  const tokens = getThemeTokens(selector);

  it('Then primary text passes WCAG AA on background, card and muted, and its /90 link hover on background and card', () => {
    // Arrange
    const { primary } = tokens;
    const surfaces = ['background', 'card', 'muted'] as const;
    const hoverSurfaces = ['background', 'card'] as const;

    // Act
    const ratios = [
      ...surfaces.map((surface) => contrast(toSrgb(primary), toSrgb(tokens[surface]))),
      ...hoverSurfaces.map((surface) =>
        contrast(over(primary, 0.9, tokens[surface]), toSrgb(tokens[surface])),
      ),
    ];

    // Assert
    for (const ratio of ratios) {
      expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('Then the primary foreground passes WCAG AA on filled primary, also at its /90 hover', () => {
    // Arrange
    const foreground = toSrgb(tokens['primary-foreground']);
    const sidebarForeground = toSrgb(tokens['sidebar-primary-foreground']);

    // Act
    const ratios = [
      contrast(foreground, toSrgb(tokens.primary)),
      contrast(foreground, over(tokens.primary, 0.9, tokens.background)),
      contrast(foreground, over(tokens.primary, 0.9, tokens.card)),
      contrast(sidebarForeground, toSrgb(tokens['sidebar-primary'])),
    ];

    // Assert
    for (const ratio of ratios) {
      expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('Then the ring, sidebar accent and first chart color are the primary blood red', () => {
    // Arrange
    const accentTokens = ['ring', 'sidebar-primary', 'sidebar-ring', 'chart-1'];

    // Act
    const values = accentTokens.map((token) => tokens[token]);

    // Assert
    for (const value of values) {
      expect(value).toEqual(tokens.primary);
    }
    expect(tokens.primary.h).toBeGreaterThanOrEqual(20);
    expect(tokens.primary.h).toBeLessThanOrEqual(30);
  });

  it('Then neither the primary nor any chart color reads as the unique item gold', () => {
    // Arrange
    const uniqueGold = tokens['item-unique'];
    const accentTokens = ['primary', 'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];

    // Act
    const distances = accentTokens.map((token) => hueDistance(tokens[token], uniqueGold));

    // Assert
    for (const distance of distances) {
      expect(distance).toBeGreaterThan(20);
    }
  });
});

describe('When scanning stylesheet text for color utilities', () => {
  it('If an @apply directive uses a raw palette utility, Then it is reported', () => {
    // Arrange
    const css = '.card {\n  @apply bg-muted text-red-500 hover:bg-blue-600/50;\n}';

    // Act
    const violations = findViolationsInText(css, 'sample.css', RAW_PALETTE_PATTERN, () => true);

    // Assert
    expect(violations).toEqual([
      { location: 'sample.css:2', className: 'text-red-500' },
      { location: 'sample.css:2', className: 'bg-blue-600/50' },
    ]);
  });

  it('If an @apply directive uses an arbitrary hex value, Then it is reported', () => {
    // Arrange
    const css = '.card {\n  @apply border-[#ff0000];\n}';

    // Act
    const violations = findViolationsInText(css, 'sample.css', ARBITRARY_HEX_PATTERN, () => true);

    // Assert
    expect(violations).toEqual([{ location: 'sample.css:2', className: 'border-[#ff0000]' }]);
  });

  it('If a stylesheet defines theme color variables or uses theme tokens, Then nothing is reported', () => {
    // Arrange
    const css =
      ':root {\n  --color-gray-500: #6b7280;\n}\n.card {\n  @apply bg-muted text-foreground/80;\n}';

    // Act
    const violations = [
      ...findViolationsInText(css, 'sample.css', RAW_PALETTE_PATTERN, () => true),
      ...findViolationsInText(css, 'sample.css', ARBITRARY_HEX_PATTERN, () => true),
    ];

    // Assert
    expect(violations).toEqual([]);
  });
});
