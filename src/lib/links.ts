import { translations } from '@/i18n/translations';

/**
 * GitHub issue tracker where users can report bugs and request features.
 */
export const ISSUE_TRACKER_URL = 'https://github.com/hyperremix/d2r-arcane-tracker/issues';

/**
 * Returns the translation key of the "View on ..." label that names the external site an item or
 * runeword link opens (diablo2.io, otherwise d2runewizard).
 */
export function getExternalLinkLabelKey(link: string): string {
  return link.includes('diablo2.io')
    ? translations.grail.itemDetails.viewOnDiablo2io
    : translations.grail.itemDetails.viewOnD2runewizard;
}
