import type { Item } from '../../types/grail';
import { amulets } from './amulets';
import { charms } from './charms';
import { jewels } from './jewels';
import { rings } from './rings';

export const jewelry: Item[] = [...amulets, ...charms, ...jewels, ...rings];
