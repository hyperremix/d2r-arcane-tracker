import type { Item } from '../types/grail';
import { armor } from './armor';
import { classes } from './classes';
import { jewelry } from './jewelry';
import { runes } from './runes';
import { runewords } from './runewords';
import { sets } from './sets';
import { weapons } from './weapons';

export const items: Item[] = [
  ...armor,
  ...classes,
  ...jewelry,
  ...weapons,
  ...runes,
  ...runewords,
  ...sets,
];
