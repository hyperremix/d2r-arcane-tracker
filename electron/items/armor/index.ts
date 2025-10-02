import type { Item } from '../../types/grail';
import { belts } from './belts';
import { bodyArmors } from './body_armors';
import { boots } from './boots';
import { gloves } from './gloves';
import { helms } from './helms';
import { shields } from './shields';

export const armor: Item[] = [...belts, ...bodyArmors, ...boots, ...gloves, ...helms, ...shields];
