import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards against color utilities that render without color (tokens missing from the theme)
 * or that bypass the theme (raw Tailwind palette colors and arbitrary hex values).
 *
 * Also guards the accent: primary stays blood red (not item gold), its text and filled
 * states, including the /90 hovers, pass WCAG AA in the light and dark themes, and the
 * ring, sidebar accent and first chart color follow primary.
 *
 * Status colors: destructive stays clearly distinct from the accent, and destructive and
 * success text pass WCAG AA on the surfaces and tints they are shown on.
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
const BLOOD_RED_HUE_MIN = 20;
const BLOOD_RED_HUE_MAX = 30;
const MIN_HUE_DISTANCE_FROM_GOLD = 20;
const HOVER_ALPHA = 0.9;

/** Reads the opaque `oklch(L C H)` custom properties of the theme block that starts with `selector`, whatever the line endings. */
function parseThemeTokens(stylesheet: string, selector: string): ThemeTokens {
  const css = stylesheet.replace(/\r\n/g, '\n');
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf('\n}', start);
  if (start === -1 || end === -1) {
    throw new Error(`Theme block "${selector}" not found in the stylesheet`);
  }
  const block = css.slice(start, end);
  const tokens: ThemeTokens = {};
  for (const match of block.matchAll(/--([a-z0-9-]+): oklch\(([\d.]+) ([\d.]+) ([\d.]+)\);/g)) {
    tokens[match[1]] = { l: Number(match[2]), c: Number(match[3]), h: Number(match[4]) };
  }
  return tokens;
}

function getThemeTokens(selector: string): ThemeTokens {
  return parseThemeTokens(readFileSync(join(srcDir, 'index.css'), 'utf8'), selector);
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

/** Euclidean distance in OKLab (deltaE OK): about 0.02 is barely noticeable, 0.1 is clearly different. */
function perceptualDistance(first: Oklch, second: Oklch): number {
  const toLab = ({ l, c, h }: Oklch) => [
    l,
    c * Math.cos((h * Math.PI) / 180),
    c * Math.sin((h * Math.PI) / 180),
  ];
  const [l1, a1, b1] = toLab(first);
  const [l2, a2, b2] = toLab(second);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const themes = [
  ['light', ':root'],
  ['dark (and widget)', '.dark,\nbody.widget'],
] as const;

/** Names every check that falls below WCAG AA text contrast, so a failure points at the token and surface. */
function belowAa(checks: Record<string, number>): string[] {
  return Object.entries(checks)
    .filter(([, ratio]) => ratio < AA_TEXT)
    .map(([label, ratio]) => `${label}: ${ratio.toFixed(2)}`);
}

describe.each(themes)('When checking the %s theme accent tokens', (_name, selector) => {
  const tokens = getThemeTokens(selector);
  const textSurfaces = ['background', 'card', 'muted'] as const;
  const hoverSurfaces = ['background', 'card'] as const;

  it('If primary is used as text, Then it passes WCAG AA on background, card and muted', () => {
    // Arrange
    const { primary } = tokens;

    // Act
    const failing = belowAa(
      Object.fromEntries(
        textSurfaces.map((surface) => [
          `primary on ${surface}`,
          contrast(toSrgb(primary), toSrgb(tokens[surface])),
        ]),
      ),
    );

    // Assert
    expect(failing).toEqual([]);
  });

  it('If primary text link is hovered at /90, Then it passes WCAG AA on background and card', () => {
    // Arrange
    const { primary } = tokens;

    // Act
    const failing = belowAa(
      Object.fromEntries(
        hoverSurfaces.map((surface) => [
          `primary/90 on ${surface}`,
          contrast(over(primary, HOVER_ALPHA, tokens[surface]), toSrgb(tokens[surface])),
        ]),
      ),
    );

    // Assert
    expect(failing).toEqual([]);
  });

  it('If the primary foreground sits on filled primary, Then it passes WCAG AA', () => {
    // Arrange
    const foreground = toSrgb(tokens['primary-foreground']);
    const sidebarForeground = toSrgb(tokens['sidebar-primary-foreground']);

    // Act
    const failing = belowAa({
      'primary-foreground on primary': contrast(foreground, toSrgb(tokens.primary)),
      'sidebar-primary-foreground on sidebar-primary': contrast(
        sidebarForeground,
        toSrgb(tokens['sidebar-primary']),
      ),
    });

    // Assert
    expect(failing).toEqual([]);
  });

  it('If filled primary is hovered at /90, Then the primary foreground passes WCAG AA', () => {
    // Arrange
    const foreground = toSrgb(tokens['primary-foreground']);

    // Act
    const failing = belowAa(
      Object.fromEntries(
        hoverSurfaces.map((surface) => [
          `primary-foreground on primary/90 over ${surface}`,
          contrast(foreground, over(tokens.primary, HOVER_ALPHA, tokens[surface])),
        ]),
      ),
    );

    // Assert
    expect(failing).toEqual([]);
  });

  it('If a token is part of the accent, Then ring, sidebar accent and first chart color equal primary', () => {
    // Arrange
    const accentTokens = ['ring', 'sidebar-primary', 'sidebar-ring', 'chart-1'];

    // Act
    const different = accentTokens.filter(
      (token) => JSON.stringify(tokens[token]) !== JSON.stringify(tokens.primary),
    );

    // Assert
    expect(different).toEqual([]);
  });

  it('If primary is the accent, Then its hue stays in the blood red range', () => {
    // Arrange
    const { h } = tokens.primary;

    // Act
    const inRange = h >= BLOOD_RED_HUE_MIN && h <= BLOOD_RED_HUE_MAX;

    // Assert
    expect({ h, inRange }).toEqual({ h, inRange: true });
  });

  it('If primary or a chart color is shown, Then it is not within the unique item gold hue', () => {
    // Arrange
    const uniqueGold = tokens['item-unique'];
    const accentTokens = ['primary', 'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];

    // Act
    const tooClose = accentTokens.filter(
      (token) => hueDistance(tokens[token], uniqueGold) <= MIN_HUE_DISTANCE_FROM_GOLD,
    );

    // Assert
    expect(tooClose).toEqual([]);
  });
});

/** Resting tint behind destructive text (buttons and badges): /10 in the light theme, /20 in dark. */
const statusThemes = [
  ['light', ':root', 0.1],
  ['dark (and widget)', '.dark,\nbody.widget', 0.2],
] as const;
const MIN_DESTRUCTIVE_DISTANCE_FROM_PRIMARY = 0.1;
const SUCCESS_BADGE_TINT = 0.15;

describe.each(
  statusThemes,
)('When checking the %s theme status tokens', (_name, selector, destructiveTint) => {
  const tokens = getThemeTokens(selector);
  const surfaces = ['background', 'card'] as const;

  it('If destructive sits next to the accent, Then it differs from primary by a clearly visible distance', () => {
    // Arrange
    const { primary, destructive } = tokens;

    // Act
    const distance = perceptualDistance(primary, destructive);

    // Assert
    expect(distance).toBeGreaterThanOrEqual(MIN_DESTRUCTIVE_DISTANCE_FROM_PRIMARY);
  });

  it('If destructive is used as text, Then it passes WCAG AA on background, card, muted and its own tint', () => {
    // Arrange
    const { destructive } = tokens;
    const text = toSrgb(destructive);

    // Act
    const failing = belowAa({
      ...Object.fromEntries(
        (['background', 'card', 'muted'] as const).map((surface) => [
          `destructive on ${surface}`,
          contrast(text, toSrgb(tokens[surface])),
        ]),
      ),
      ...Object.fromEntries(
        surfaces.map((surface) => [
          `destructive on destructive tint over ${surface}`,
          contrast(text, over(destructive, destructiveTint, tokens[surface])),
        ]),
      ),
    });

    // Assert
    expect(failing).toEqual([]);
  });

  it('If a success badge shows success text on its tint, Then it passes WCAG AA', () => {
    // Arrange
    const { success } = tokens;

    // Act
    const failing = belowAa(
      Object.fromEntries(
        surfaces.map((surface) => [
          `success on success/15 over ${surface}`,
          contrast(toSrgb(success), over(success, SUCCESS_BADGE_TINT, tokens[surface])),
        ]),
      ),
    );

    // Assert
    expect(failing).toEqual([]);
  });
});

describe('When parsing theme tokens from stylesheet text', () => {
  const css =
    ':root {\n  --primary: oklch(0.44 0.16 25);\n}\n.dark,\nbody.widget {\n  --primary: oklch(0.67 0.18 27);\n}\n';

  it('If the stylesheet uses CRLF line endings, Then the multi-line dark selector is still parsed', () => {
    // Arrange
    const crlfCss = css.replace(/\n/g, '\r\n');

    // Act
    const tokens = parseThemeTokens(crlfCss, '.dark,\nbody.widget');

    // Assert
    expect(tokens.primary).toEqual({ l: 0.67, c: 0.18, h: 27 });
  });

  it('If the selector is not in the stylesheet, Then parsing fails with a clear error', () => {
    // Arrange
    const selector = '.missing';

    // Act
    const parse = () => parseThemeTokens(css, selector);

    // Assert
    expect(parse).toThrow('Theme block ".missing" not found in the stylesheet');
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

describe('When checking links that sit on the muted surface', () => {
  it('If release notes contain links, Then they use the shared link style instead of the accent', () => {
    // Arrange
    const css = readFileSync(join(srcDir, 'index.css'), 'utf8');

    // Act
    const rule = css.match(/\.release-notes a \{([^}]*)\}/)?.[1] ?? '';

    // Assert
    expect(rule).toContain(
      'text-foreground underline decoration-muted-foreground underline-offset-4 hover:decoration-foreground',
    );
    expect(rule).not.toContain('text-primary');
  });
});
