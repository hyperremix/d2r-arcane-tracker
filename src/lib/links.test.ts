import { describe, expect, it } from 'vitest';
import { translations } from '@/i18n/translations';
import { getExternalLinkLabelKey } from './links';

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
