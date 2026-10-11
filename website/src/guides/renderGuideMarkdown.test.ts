import { describe, expect, it } from 'vitest';
import { renderGuideMarkdown } from './renderGuideMarkdown';

function renderToDocument(markdown: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = renderGuideMarkdown(markdown);
  return container;
}

describe('When a guide is rendered from Markdown', () => {
  it('Then headings get the same ids as on GitHub', () => {
    // Arrange
    const markdown = [
      '# Run Tracker Guide',
      '## Setup',
      '### Auto mode (Windows only)',
      '### Game mode (Settings → Tracking → Game Mode)',
      '## Setup',
      '## `Code` and **bold**',
    ].join('\n\n');

    // Act
    const container = renderToDocument(markdown);

    // Assert
    const ids = [...container.querySelectorAll('h1, h2, h3')].map((heading) => heading.id);
    expect(ids).toEqual([
      'run-tracker-guide',
      'setup',
      'auto-mode-windows-only',
      'game-mode-settings--tracking--game-mode',
      'setup-1',
      'code-and-bold',
    ]);
  });

  it('If the same guide is rendered twice, then its heading ids are the same both times', () => {
    // Arrange
    const markdown = '## Setup\n\n## Setup';

    // Act
    renderGuideMarkdown(markdown);
    const container = renderToDocument(markdown);

    // Assert
    const ids = [...container.querySelectorAll('h2')].map((heading) => heading.id);
    expect(ids).toEqual(['setup', 'setup-1']);
  });

  it('Then links point to the guide pages, GitHub or the external site', () => {
    // Arrange
    const markdown =
      'See [Bookmarks](HOLY_GRAIL_GUIDE.md#bookmarks), [the README](../README.md#install) and [diablo2.io](https://diablo2.io/).';

    // Act
    const container = renderToDocument(markdown);

    // Assert
    const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([
      `${import.meta.env.BASE_URL}guides/holy-grail/#bookmarks`,
      'https://github.com/hyperremix/d2r-arcane-tracker/blob/main/README.md#install',
      'https://diablo2.io/',
    ]);
  });

  it('Then images load from GitHub with their alt text', () => {
    // Arrange
    const markdown = '![Statistics page](screenshots/statistics.webp)';

    // Act
    const container = renderToDocument(markdown);

    // Assert
    const image = container.querySelector('img');
    expect(image).toHaveAttribute(
      'src',
      'https://raw.githubusercontent.com/hyperremix/d2r-arcane-tracker/main/docs/screenshots/statistics.webp',
    );
    expect(image).toHaveAttribute('alt', 'Statistics page');
  });

  it('If a link uses an unsafe scheme, then only its text is rendered', () => {
    // Arrange
    const markdown = '[click me](javascript:alert(1))';

    // Act
    const container = renderToDocument(markdown);

    // Assert
    expect(container.querySelector('a')).toBeNull();
    expect(container).toHaveTextContent('click me');
  });

  it('If the Markdown contains raw HTML, then it is shown as text', () => {
    // Arrange
    const markdown = 'Before <script>alert(1)</script> after\n\n<div onclick="x()">block</div>';

    // Act
    const container = renderToDocument(markdown);

    // Assert
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('div')).toBeNull();
    expect(container).toHaveTextContent('<script>alert(1)</script>');
  });

  it('Then link titles and image alt text are escaped, and an image with an unsafe source shows its alt text', () => {
    // Arrange
    const markdown = [
      '[a link](https://example.com/ "Tom & <b> says")',
      `![An *emphasised* image](screenshots/statistics.webp "Shot's title")`,
      '![Alt <text>](javascript:alert(1))',
    ].join('\n\n');

    // Act
    const container = renderToDocument(markdown);

    // Assert
    expect(container.querySelector('a')?.getAttribute('title')).toBe('Tom & <b> says');
    const image = container.querySelector('img');
    expect(image?.getAttribute('alt')).toBe('An emphasised image');
    expect(image?.getAttribute('title')).toBe("Shot's title");
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(container.querySelectorAll('p')[2]).toHaveTextContent('Alt <text>');
  });

  it('Then GitHub Flavored Markdown tables are rendered', () => {
    // Arrange
    const markdown = '| Problem | Fix |\n| --- | --- |\n| No icons | Extract the game files |';

    // Act
    const container = renderToDocument(markdown);

    // Assert
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelector('td')).toHaveTextContent('No icons');
  });
});
