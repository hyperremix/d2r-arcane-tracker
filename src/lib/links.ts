import { translations } from '@/i18n/translations';

/**
 * GitHub issue tracker where users can report bugs and request features.
 */
export const ISSUE_TRACKER_URL = 'https://github.com/hyperremix/d2r-arcane-tracker/issues';

function isDiablo2ioLink(link: string): boolean {
  return link.includes('diablo2.io');
}

/**
 * Returns the translation key of the "View on ..." label that names the external site an item or
 * runeword link opens (diablo2.io, otherwise d2runewizard).
 */
export function getExternalLinkLabelKey(link: string): string {
  return isDiablo2ioLink(link)
    ? translations.grail.itemDetails.viewOnDiablo2io
    : translations.grail.itemDetails.viewOnD2runewizard;
}

/**
 * Returns the translation key of the bare site name (diablo2.io, otherwise d2runewizard) that an
 * item or runeword link opens, for places that are too narrow for the full "View on ..." label.
 */
export function getExternalLinkSiteKey(link: string): string {
  return isDiablo2ioLink(link)
    ? translations.grail.itemDetails.siteDiablo2io
    : translations.grail.itemDetails.siteD2runewizard;
}
