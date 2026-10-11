import { describe, expect, it } from 'vitest';
import { isPrerendered } from './isPrerendered';

function createRoot(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('When the client decides between hydrating and rendering the page', () => {
  it('If the root holds the prerendered page, then it is hydrated', () => {
    // Arrange
    const root = createRoot('<main><h1>D2R Arcane Tracker</h1></main>');

    // Act
    const result = isPrerendered(root);

    // Assert
    expect(result).toBe(true);
  });

  it('If the root only holds the dev server placeholder comment, then it is rendered on the client', () => {
    // Arrange
    const root = createRoot('<!--app-html-->');

    // Act
    const result = isPrerendered(root);

    // Assert
    expect(result).toBe(false);
  });

  it('If the root is empty, then it is rendered on the client', () => {
    // Arrange
    const root = createRoot('');

    // Act
    const result = isPrerendered(root);

    // Assert
    expect(result).toBe(false);
  });
});
