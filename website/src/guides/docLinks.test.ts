import { describe, expect, it } from 'vitest';
import { resolveDocLink } from './docLinks';

const base = import.meta.env.BASE_URL;
const repository = 'https://github.com/hyperremix/d2r-arcane-tracker';

describe('When a link in a guide is resolved for the site', () => {
  it('If it points to another guide, then it goes to that guide page and keeps the anchor', () => {
    // Arrange
    const href = 'HOLY_GRAIL_GUIDE.md#bookmarks';

    // Act
    const result = resolveDocLink(href, 'link');

    // Assert
    expect(result).toBe(`${base}guides/holy-grail/#bookmarks`);
  });

  it('If it points to a guide without an anchor, then it goes to the top of the guide page', () => {
    // Arrange
    const href = './RUN_TRACKER.md';

    // Act
    const result = resolveDocLink(href, 'link');

    // Assert
    expect(result).toBe(`${base}guides/run-tracker/`);
  });

  it('If it points to a guide with an empty anchor, then it goes to the top of the guide page', () => {
    // Arrange
    const href = 'RUN_TRACKER.md#';

    // Act
    const result = resolveDocLink(href, 'link');

    // Assert
    expect(result).toBe(`${base}guides/run-tracker/`);
  });

  it('If it points to a guide with a query string, then it goes to the file on GitHub', () => {
    // Arrange
    const href = 'RUN_TRACKER.md?plain=1#auto-mode-windows-only';

    // Act
    const result = resolveDocLink(href, 'link');

    // Assert
    expect(result).toBe(
      `${repository}/blob/main/docs/RUN_TRACKER.md?plain=1#auto-mode-windows-only`,
    );
  });

  it('If it is an anchor on the same page, then it stays as it is', () => {
    // Arrange
    const href = '#auto-mode-windows-only';

    // Act
    const result = resolveDocLink(href, 'link');

    // Assert
    expect(result).toBe('#auto-mode-windows-only');
  });

  it('If it points to a doc that is not a guide page, then it goes to the file on GitHub', () => {
    // Arrange
    const href = 'MEMORY_READING.md#adding-a-new-d2r-build';

    // Act
    const result = resolveDocLink(href, 'link');

    // Assert
    expect(result).toBe(`${repository}/blob/main/docs/MEMORY_READING.md#adding-a-new-d2r-build`);
  });

  it('If it points outside docs/, then it goes to the repository file on GitHub', () => {
    // Arrange
    const hrefs = ['../README.md#install', '../LICENSE', '/electron/main.ts'];

    // Act
    const results = hrefs.map((href) => resolveDocLink(href, 'link'));

    // Assert
    expect(results).toEqual([
      `${repository}/blob/main/README.md#install`,
      `${repository}/blob/main/LICENSE`,
      `${repository}/blob/main/electron/main.ts`,
    ]);
  });

  it('If it is an image in the repository, then it loads from the raw file on GitHub', () => {
    // Arrange
    const href = 'screenshots/statistics.webp';

    // Act
    const result = resolveDocLink(href, 'image');

    // Assert
    expect(result).toBe(
      'https://raw.githubusercontent.com/hyperremix/d2r-arcane-tracker/main/docs/screenshots/statistics.webp',
    );
  });

  it('If it is an http(s) or mailto URL, then it stays as it is', () => {
    // Arrange
    const hrefs = [
      'https://diablo2.io/',
      'http://example.com/a?b=c#d',
      'mailto:someone@example.com',
    ];

    // Act
    const results = hrefs.map((href) => resolveDocLink(href, 'link'));

    // Assert
    expect(results).toEqual(hrefs);
  });

  it('If it uses another scheme or is empty, then it is dropped', () => {
    // Arrange
    const hrefs = ['javascript:alert(1)', 'data:text/html,hi', ' ', 'http://'];

    // Act
    const results = hrefs.map((href) => resolveDocLink(href, 'link'));

    // Assert
    expect(results).toEqual([undefined, undefined, undefined, undefined]);
  });
});
