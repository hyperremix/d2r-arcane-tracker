import { fireEvent, render, screen } from '@testing-library/react';
import { runes } from 'electron/items/runes';
import i18n from 'i18next';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en/common.json';
import { translations } from '@/i18n/translations';
import { RunesTabSection } from './RunesTabSection';

const RUNE_NAME_KEY = translations.inventoryBrowser.tooltip.runeName;

describe('When RunesTabSection renders placeholder rune tiles', () => {
  beforeEach(() => {
    i18n.addResource('en', 'common', RUNE_NAME_KEY, 'Translated rune label: {{name}}');
  });

  afterEach(() => {
    i18n.addResource('en', 'common', RUNE_NAME_KEY, en.inventoryBrowser.tooltip.runeName);
  });

  describe('If no rune is owned', () => {
    it('Then the tooltip rune label is produced by t() instead of hard-coded copy', async () => {
      // Arrange
      const firstRune = runes[0];
      if (!firstRune) {
        throw new Error('Expected rune data to contain at least one rune');
      }
      const { container } = render(<RunesTabSection items={[]} renderOwnedTile={() => null} />);
      const trigger = container.querySelector('[data-slot="tooltip-trigger"]');
      expect(trigger).toBeTruthy();

      // Act
      fireEvent.focus(trigger as Element);

      // Assert
      expect(
        await screen.findByText(`Translated rune label: ${firstRune.name}`),
      ).toBeInTheDocument();
      expect(screen.queryByText(`${firstRune.name} Rune`)).not.toBeInTheDocument();
    });
  });
});
