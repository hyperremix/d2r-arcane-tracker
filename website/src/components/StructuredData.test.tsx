import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { version } from '../../../package.json';
import { links } from '../content';
import { StructuredData } from './StructuredData';

interface JsonLdNode {
  '@type': string;
  [key: string]: unknown;
}

function findNode(graph: JsonLdNode[], type: string): JsonLdNode | undefined {
  return graph.find((node) => node['@type'] === type);
}

describe('When the structured data is rendered', () => {
  it('Then it is valid JSON-LD that describes the app with the package version', () => {
    // Arrange / Act
    const { container } = render(<StructuredData />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent ?? '') as {
      '@context': string;
      '@graph': JsonLdNode[];
    };

    // Assert
    expect(data['@context']).toBe('https://schema.org');
    const app = findNode(data['@graph'], 'SoftwareApplication');
    expect(app).toMatchObject({
      applicationCategory: 'GameApplication',
      softwareVersion: version,
      downloadUrl: links.latestRelease,
      offers: { '@type': 'Offer', price: '0' },
    });
    expect(findNode(data['@graph'], 'WebSite')).toMatchObject({
      url: 'https://hyperremix.github.io/d2r-arcane-tracker/',
    });
  });

  it('If it is prerendered to HTML, then the script holds raw JSON that parses', () => {
    // Arrange / Act
    const html = renderToString(<StructuredData />);
    const json = html.match(/<script type="application\/ld\+json">(.*)<\/script>/s)?.[1] ?? '';

    // Assert
    expect(json).not.toContain('&quot;');
    expect(JSON.parse(json)['@graph']).toEqual(
      expect.arrayContaining([expect.objectContaining({ softwareVersion: version })]),
    );
  });
});
