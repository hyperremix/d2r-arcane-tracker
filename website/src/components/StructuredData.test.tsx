import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { version } from '../../../package.json';
import { links } from '../content';
import { StructuredData, toScriptJson } from './StructuredData';

interface JsonLdNode {
  '@type': string;
  [key: string]: unknown;
}

interface JsonLd {
  '@context': string;
  '@graph': JsonLdNode[];
}

function findNode(graph: JsonLdNode[], type: string): JsonLdNode | undefined {
  return graph.find((node) => node['@type'] === type);
}

function readIndexHtml(): Document {
  const html = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('When the structured data is rendered', () => {
  it('Then it is valid JSON-LD that describes the app with the package version', () => {
    // Arrange
    const { container } = render(<StructuredData />);
    const script = container.querySelector('script[type="application/ld+json"]');

    // Act
    const data = JSON.parse(script?.textContent ?? '') as JsonLd;

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
    // Arrange
    const html = renderToString(<StructuredData />);

    // Act
    const json = html.match(/<script type="application\/ld\+json">(.*)<\/script>/s)?.[1] ?? '';

    // Assert
    expect(json).not.toContain('&quot;');
    expect(JSON.parse(json)['@graph']).toEqual(
      expect.arrayContaining([expect.objectContaining({ softwareVersion: version })]),
    );
  });

  it('Then its description, site URL and image match the head tags in index.html', () => {
    // Arrange
    const head = readIndexHtml();
    const { container } = render(<StructuredData />);
    const script = container.querySelector('script[type="application/ld+json"]');

    // Act
    const data = JSON.parse(script?.textContent ?? '') as JsonLd;

    // Assert
    const app = findNode(data['@graph'], 'SoftwareApplication');
    const site = findNode(data['@graph'], 'WebSite');
    expect(app?.description).toBe(
      head.querySelector('meta[name="description"]')?.getAttribute('content'),
    );
    expect(site?.url).toBe(head.querySelector('link[rel="canonical"]')?.getAttribute('href'));
    expect(app?.screenshot).toBe(
      head.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    );
  });
});

describe('When data containing a closing script tag is serialized for a script element', () => {
  it('Then every < is escaped and the JSON still round-trips', () => {
    // Arrange
    const data = { text: '</script><script>alert(1)</script>' };

    // Act
    const json = toScriptJson(data);

    // Assert
    expect(json).not.toContain('<');
    expect(json).toContain('\\u003c/script>');
    expect(JSON.parse(json)).toEqual(data);
  });
});
