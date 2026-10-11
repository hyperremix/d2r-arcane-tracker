import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pageForRoot } from './pageForRoot';

function createRoot(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('When the client picks the page to hydrate', () => {
  it('If the root holds a prerendered guide page, then the guide page is hydrated with its article', () => {
    // Arrange
    const root = createRoot(
      '<main><article data-guide="run-tracker"><h1 id="run-tracker-guide">Run Tracker Guide</h1></article></main>',
    );

    // Act
    render(pageForRoot(root));

    // Assert
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Run Tracker Guide' })).toHaveAttribute(
      'id',
      'run-tracker-guide',
    );
  });

  it('If the root holds the home page, then the home page is hydrated', () => {
    // Arrange
    const root = createRoot('<main><h1>D2R Arcane Tracker</h1></main>');

    // Act
    render(pageForRoot(root));

    // Assert
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Download for Windows' })).toBeInTheDocument();
  });

  it('If the guide in the page is unknown, then the home page is rendered', () => {
    // Arrange
    const root = createRoot('<article data-guide="no-such-guide"></article>');

    // Act
    render(pageForRoot(root));

    // Assert
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });
});
