import type { Item } from '../types/grail';
import { armor } from './armor';
import { classes } from './classes';
import { jewelry } from './jewelry';
import { weapons } from './weapons';

export const uniques: Item[] = [...armor, ...classes, ...jewelry, ...weapons];
