import { version } from '../../../package.json';
import { links } from '../content';

const SITE_URL = 'https://d2rarcanetracker.com/';
const AUTHOR_URL = 'https://github.com/hyperremix';

/**
 * schema.org data for search engines: the site and the app it is about. The app version comes
 * from package.json, so it follows each release.
 */
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      name: 'D2R Arcane Tracker',
      url: SITE_URL,
      inLanguage: 'en',
      publisher: { '@id': `${AUTHOR_URL}#person` },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}#app`,
      name: 'D2R Arcane Tracker',
      description:
        'Free Holy Grail tracker for Diablo II: Resurrected (D2R) on Windows. Reads your save files and records every unique, set item, rune and runeword you find.',
      applicationCategory: 'GameApplication',
      operatingSystem: 'Windows 10 or later (64-bit)',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      softwareVersion: version,
      downloadUrl: links.latestRelease,
      image: `${SITE_URL}logo.png`,
      screenshot: `${SITE_URL}og-image.jpg`,
      license: links.license,
      url: SITE_URL,
      sameAs: [links.repository],
      author: { '@id': `${AUTHOR_URL}#person` },
      publisher: { '@id': `${AUTHOR_URL}#person` },
    },
    {
      '@type': 'Person',
      '@id': `${AUTHOR_URL}#person`,
      name: 'hyperremix',
      url: AUTHOR_URL,
      sameAs: [AUTHOR_URL],
    },
  ],
};

/** Escapes `<` so the JSON can't close the script element it is embedded in. */
export function toScriptJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** Renders the structured data as JSON-LD, so it is part of the prerendered HTML. */
export function StructuredData() {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD has to be raw script text; it is built from static data and escaped by toScriptJson
      dangerouslySetInnerHTML={{ __html: toScriptJson(structuredData) }}
    />
  );
}
