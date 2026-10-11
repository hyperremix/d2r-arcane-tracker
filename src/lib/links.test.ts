import { describe, expect, it } from 'vitest';
import { translations } from '@/i18n/translations';
import { getExternalLinkLabelKey, getExternalLinkSiteKey } from './links';

describe('getExternalLinkLabelKey', () => {
  it('When the link points to diablo2.io, Then it returns the diablo2.io label key', () => {
    // Arrange
    const link = 'https://diablo2.io/runewords/steel-t1.html';

    // Act
    const key = getExternalLinkLabelKey(link);

    // Assert
    expect(key).toBe(translations.grail.itemDetails.viewOnDiablo2io);
  });

  it('When the link points to d2runewizard, Then it returns the d2runewizard label key', () => {
    // Arrange
    const link = 'https://d2runewizard.com/runewords/Steel';

    // Act
    const key = getExternalLinkLabelKey(link);

    // Assert
    expect(key).toBe(translations.grail.itemDetails.viewOnD2runewizard);
  });
});

describe('getExternalLinkSiteKey', () => {
  it.each([
    [
      'diablo2.io',
      'https://diablo2.io/runewords/steel-t1.html',
      translations.grail.itemDetails.siteDiablo2io,
    ],
    [
      'd2runewizard',
      'https://d2runewizard.com/runewords/Steel',
      translations.grail.itemDetails.siteD2runewizard,
    ],
  ])('When the link points to %s, Then it returns that site name key', (_site, link, expectedKey) => {
    // Arrange & Act
    const key = getExternalLinkSiteKey(link);

    // Assert
    expect(key).toBe(expectedKey);
  });
});
