import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * jsdom does not load the compiled Tailwind stylesheet, so computed styles cannot be asserted.
 * These guards only check that the source rules the `font-display` / `font-ui` classes rely on
 * still exist in `src/index.css`.
 */
const css = readFileSync(resolve(__dirname, 'index.css'), 'utf8');

describe('When the global stylesheet source is read (stylesheet guard)', () => {
  it('Then --font-sans and --font-display reference Inter Variable and Cinzel Variable', () => {
    // Assert
    expect(css).toMatch(/--font-sans:\s*'Inter Variable'/);
    expect(css).toMatch(/--font-display:\s*'Cinzel Variable'/);
  });

  it('Then h1 and h2 headings are set in the display font', () => {
    // Assert
    expect(css).toMatch(/h1,\s*h2\s*\{[^}]*font-family:\s*var\(--font-display\)/);
  });

  it('Then the font-ui utility switches back to the sans font', () => {
    // Assert
    expect(css).toMatch(/@utility font-ui\s*\{[^}]*font-family:\s*var\(--font-sans\)/);
  });
});
