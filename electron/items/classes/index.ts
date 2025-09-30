import type { Item } from '../../types/grail';
import { amazon } from './amazon';
import { assassin } from './assassin';
import { barbarian } from './barbarian';
import { druid } from './druid';
import { necromancer } from './necromancer';
import { paladin } from './paladin';
import { sorceress } from './sorceress';

export const classes: Item[] = [
  ...amazon,
  ...assassin,
  ...barbarian,
  ...druid,
  ...necromancer,
  ...paladin,
  ...sorceress,
];
