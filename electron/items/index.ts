import type { Item } from '../types/grail';
import { runes } from './runes';
import { runewords } from './runewords';
import { sets } from './sets';
import { uniques } from './uniques';

export const items: Item[] = [...uniques, ...runes, ...runewords, ...sets];
