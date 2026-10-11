import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { GuidePage } from '../components/GuidePage';
import { features, requireGuide } from '../content';
import { RESERVED_IDS, reservedHeadingIds } from './reservedIds';

const indexHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../index.html'),
  'utf8',
);

/** Ids of the elements in `container`, without the ones React and Base UI generate (`base-ui-:r1:`) */
function ownIds(container: Element): string[] {
  return [...container.querySelectorAll('[id]')]
    .map((element) => element.id)
    .filter((id) => !id.startsWith('base-ui-:'));
}

describe('When the ids the pages use themselves are listed', () => {
  it('Then they include every id of the home page, the guide pages and index.html', () => {
    // Arrange
    // The feature anchors only exist on the home page, and some match guide headings on purpose
    // (the feature tour links to them), so they can't clash with a heading on a guide page.
    const featureIds = new Set<string>(features.map((feature) => feature.id));
    const home = render(<App />);
    const homeIds = ownIds(home.container).filter((id) => !featureIds.has(id));
    home.unmount();
    const guidePage = render(
      <GuidePage guide={requireGuide('run-tracker')} html="<p>No headings</p>" />,
    );
    const guidePageIds = ownIds(guidePage.container);
    const templateIds = [...indexHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);

    // Act
    const unlisted = [...homeIds, ...guidePageIds, ...templateIds].filter(
      (id) => !RESERVED_IDS.has(id),
    );

    // Assert
    expect(homeIds.length).toBeGreaterThan(0);
    expect(templateIds).toContain('root');
    expect(unlisted).toEqual([]);
  });
});

describe('When the heading ids of a rendered guide are checked', () => {
  it('Then the headings with an id the page uses are listed', () => {
    // Arrange
    const html = '<h1 id="title">A</h1><h2 id="features">B</h2><h3 class="x" id="top">C</h3>';

    // Act
    const result = reservedHeadingIds(html);

    // Assert
    expect(result).toEqual(['features', 'top']);
  });

  it('If an element that is not a heading has such an id, then it is not listed', () => {
    // Arrange
    const html = '<h2 id="details">A</h2><p id="main">B</p>';

    // Act
    const result = reservedHeadingIds(html);

    // Assert
    expect(result).toEqual([]);
  });
});
