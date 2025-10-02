import type { Item } from '../../types/grail';
import { oneHandedAxes } from './1h_axes';
import { oneHandedClubs } from './1h_clubs';
import { oneHandedSwords } from './1h_swords';
import { twoHandedAxes } from './2h_axes';
import { twoHandedClubs } from './2h_clubs';
import { twoHandedSwords } from './2h_swords';
import { bows } from './bows';
import { crossbows } from './crossbows';
import { daggers } from './daggers';
import { polearms } from './polearms';
import { scepters } from './scepters';
import { spears } from './spears';
import { staves } from './staves';
import { throwing } from './throwing';
import { wands } from './wands';

export const weapons: Item[] = [
  ...oneHandedAxes,
  ...oneHandedClubs,
  ...oneHandedSwords,
  ...twoHandedAxes,
  ...twoHandedClubs,
  ...twoHandedSwords,
  ...bows,
  ...crossbows,
  ...daggers,
  ...polearms,
  ...scepters,
  ...spears,
  ...staves,
  ...throwing,
  ...wands,
];
