import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escapeHtml';

describe('When text is escaped for HTML and XML', () => {
  it('Then &, <, >, double quotes and apostrophes become entities', () => {
    // Arrange
    const text = `<a href="x" title='y'>Tom & Jerry</a>`;

    // Act
    const result = escapeHtml(text);

    // Assert
    expect(result).toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;');
  });

  it('If the text contains an entity already, then its ampersand is escaped once more', () => {
    // Arrange
    const text = '&amp; &#39;';

    // Act
    const result = escapeHtml(text);

    // Assert
    expect(result).toBe('&amp;amp; &amp;#39;');
  });

  it('If the text has nothing to escape, then it stays as it is', () => {
    // Arrange
    const text = 'Holy Grail – D2R Arcane Tracker';

    // Act
    const result = escapeHtml(text);

    // Assert
    expect(result).toBe(text);
  });

  it('Then the result parses back to the original text as HTML content and as an attribute', () => {
    // Arrange
    const text = `Ladik's "CASC" <Viewer> & more`;

    // Act
    const escaped = escapeHtml(text);
    const container = document.createElement('div');
    container.innerHTML = `<p title="${escaped}" data-single='${escaped}'>${escaped}</p>`;

    // Assert
    const paragraph = container.querySelector('p');
    expect(paragraph?.textContent).toBe(text);
    expect(paragraph?.getAttribute('title')).toBe(text);
    expect(paragraph?.getAttribute('data-single')).toBe(text);
  });
});
