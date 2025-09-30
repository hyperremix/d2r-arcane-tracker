import type { IEthGrailData } from 'd2-holy-grail/client/src/common/definitions/union/IEthGrailData';
import { ethGrailSeedData } from 'd2-holy-grail/client/src/common/seeds/EthGrailSeedData';
import { holyGrailSeedData as original } from 'd2-holy-grail/client/src/common/seeds/HolyGrailSeedData';
import type { HolyGrailSeed, RuneType } from '../types/grail';
import { simplifyItemName } from '../utils/objects';
import { runesMapping } from './runes';
import { runewordsMapping } from './runewords';

/**
 * Mapping of rune names to their corresponding rune IDs.
 * This is generated from the runesMapping to create a reverse lookup for seeding.
 */
export const runesSeed: Record<string, string> = {};
Object.keys(runesMapping).forEach((runeId: string) => {
  runesSeed[runesMapping[runeId as RuneType].name.toLowerCase()] = runeId;
});

/**
 * Mapping of runeword IDs to their corresponding runeword names.
 * This is generated from the runewordsMapping to create a lookup for seeding.
 */
export const runewordsSeed: { [runewordId: string]: string } = {};
Object.keys(runewordsMapping).forEach((runewordName) => {
  runewordsSeed[`runeword${simplifyItemName(runewordName)}`] = runewordName;
});

/**
 * Retrieves Holy Grail seed data for database initialization.
 *
 * @overload
 * @param ethereal - When false, returns regular Holy Grail seed data
 * @returns Holy Grail seed data with uniques, sets, runes, and runewords
 *
 * @overload
 * @param ethereal - When true, returns ethereal-specific grail data
 * @returns Ethereal grail data for ethereal item tracking
 *
 * @param ethereal - Whether to return ethereal or regular grail data
 * @returns Either HolyGrailSeed or IEthGrailData based on the ethereal parameter
 */
export function getHolyGrailSeedData(ethereal: false): HolyGrailSeed;
export function getHolyGrailSeedData(ethereal: true): IEthGrailData;
export function getHolyGrailSeedData(ethereal: boolean): HolyGrailSeed | IEthGrailData {
  if (ethereal === true) {
    return ethGrailSeedData;
  }
  const holyGrailSeedData: HolyGrailSeed = {
    ...original,
    uniques: {
      ...original.uniques,
      other: {
        ...original.uniques.other,
        jewelry: {
          ...original.uniques.other.jewelry,
          rings: {
            Nagelring: {},
            'Manald Heal': {},
            'The Stone of Jordan': {},
            'Dwarf Star': {},
            'Raven Frost': {},
            "Bul-Kathos' Wedding Band": {},
            'Carrion Wind': {},
            "Nature's Peace": {},
            'Wisp Projector': {},
          },
        },
        'rainbow facet (jewel)': {
          'level up': {
            'Rainbow Facet: Cold Level-up': {},
            'Rainbow Facet: Fire Level-up': {},
            'Rainbow Facet: Lightning Level-up': {},
            'Rainbow Facet: Poison Level-up': {},
          },
          die: {
            'Rainbow Facet: Cold Death': {},
            'Rainbow Facet: Fire Death': {},
            'Rainbow Facet: Lightning Death': {},
            'Rainbow Facet: Poison Death': {},
          },
        },
      },
    },
  };
  holyGrailSeedData['runes'] = runesSeed;
  holyGrailSeedData['runewords'] = runewordsSeed;
  return holyGrailSeedData;
}
