import { describe, expect, it } from 'vitest';
import { items as catalogItems } from '../../items';
import {
  areaRow,
  baseItemRow,
  createFarmingTables,
  monsterRow,
  treasureClassRow,
  uniqueItemRow,
} from '../../test/helpers/farmingTables';
import { buildDropDataset } from './dropData';
import {
  buildLocations,
  buildTerrorZoneLocations,
  createTargetResolver,
  type FarmingTarget,
  findDroppableTargets,
  findItemSources,
  type LocationModel,
} from './farmingAdvisor';
import type { TerrorZoneData } from './terrorZoneLevels';

/**
 * A made-up Tower Cellar with one monster type, The Countess as its super unique and Griswold
 * (a super unique with a fixed level) in Tristram. Rings drop everywhere; runes only from the
 * upgraded treasure class of monsters of level 80 and up.
 */
const tables = createFarmingTables({
  treasureclassex: [
    treasureClassRow('Mon A', [['rin', 1]]),
    treasureClassRow('Mon (H) A', [['rin', 1]], { group: 3, level: 70 }),
    treasureClassRow(
      'Mon (H) B',
      [
        ['rin', 1],
        ['r01', 1],
      ],
      { group: 3, level: 80 },
    ),
    treasureClassRow('Champ (H)', [['rin', 1]]),
    treasureClassRow('Countess (H)', [['r01', 1]], { picks: 3 }),
    treasureClassRow('Countess (H) Desecrated', [['r01', 1]], { picks: 6 }),
    treasureClassRow('Griswold (H)', [['rin', 1]]),
    treasureClassRow('Andariel (H)', [['rin', 1]], { picks: 2 }),
  ],
  monstats: [
    monsterRow('ghoul', [8, 40, 70], {
      TreasureClass: 'Mon A',
      'TreasureClass(H)': 'Mon (H) A',
      'TreasureClassChamp(H)': 'Champ (H)',
      'TreasureClassUnique(H)': 'Mon (H) A',
    }),
    monsterRow('corruptrogue3', [8, 39, 69], {}),
    monsterRow('griswold', [5, 39, 84], {}, { boss: true }),
    monsterRow('andariel', [12, 49, 75], { 'TreasureClass(H)': 'Andariel (H)' }, { boss: true }),
  ],
  superuniques: [
    {
      Superunique: 'The Countess',
      Name: 'The Countess',
      Class: 'corruptrogue3',
      'TC(H)': 'Countess (H)',
      'TC(H) Desecrated': 'Countess (H) Desecrated',
    },
    { Superunique: 'Griswold', Name: 'Griswold', Class: 'griswold', 'TC(H)': 'Griswold (H)' },
  ],
  levels: [
    areaRow(25, 'Tower Cellar Level 5', [7, 42, 79], ['ghoul'], { elites: true }),
    areaRow(37, 'Catacombs Level 4', [12, 43, 73], []),
    areaRow(38, 'Tristram', [6, 39, 76], []),
  ],
  misc: [baseItemRow('rin', 1, 'ring'), baseItemRow('r01', 1, 'rune')],
  uniqueitems: [uniqueItemRow('High Ring', 'rin', 80)],
});
const dataset = buildDropDataset(tables, new Map());
const locations = buildLocations(dataset);
const find = (id: string, from: LocationModel[] = locations) =>
  from.find((location) => location.id === id);

const hellRules: TerrorZoneData['rules'] = [
  { boostLevel: 2, minLevel: 3, maxLevel: 45 },
  { boostLevel: 2, minLevel: 40, maxLevel: 71 },
  { boostLevel: 2, minLevel: 70, maxLevel: 96 },
];

describe('When the farming locations are built from the game data', () => {
  it('If the difficulty is Hell, Then area monsters use the area level and upgrade their treasure class', () => {
    // Arrange & Act
    const area = find('area:25:hell');

    // Assert
    expect(area?.spawns).toEqual([
      { monsterId: 'ghoul', kind: 'regular', level: 79, treasureClass: 'Mon (H) A' },
      { monsterId: 'ghoul', kind: 'champion', level: 81, treasureClass: 'Champ (H)' },
      { monsterId: 'ghoul', kind: 'unique', level: 82, treasureClass: 'Mon (H) B' },
    ]);
  });

  it('If the difficulty is Normal, Then area monsters use their own level', () => {
    // Arrange & Act
    const area = find('area:25:normal');

    // Assert
    expect(area?.spawns[0]).toEqual({
      monsterId: 'ghoul',
      kind: 'regular',
      level: 8,
      treasureClass: 'Mon A',
    });
  });

  it('If a super unique is placed in an area, Then it is 3 levels above the area, or above its own fixed level', () => {
    // Arrange & Act
    const countess = find('superUnique:The Countess:hell');
    const griswold = find('superUnique:Griswold:hell');

    // Assert
    expect(countess).toMatchObject({ name: 'The Countess', areaName: 'Tower Cellar Level 5' });
    expect(countess?.spawns[0]?.level).toBe(82);
    expect(griswold?.spawns[0]?.level).toBe(87);
  });

  it('If a boss is placed in an area, Then it keeps its own level and treasure class', () => {
    // Arrange & Act
    const andariel = find('boss:andariel:hell');

    // Assert
    expect(andariel?.spawns).toEqual([
      { monsterId: 'andariel', kind: 'boss', level: 75, treasureClass: 'Andariel (H)' },
    ]);
  });
});

describe('When the terrorized locations are built', () => {
  const terrorZones: TerrorZoneData = {
    zones: [{ id: 'Act1-Tower', areaIds: [25] }],
    rules: hellRules,
  };
  const terrorized = buildTerrorZoneLocations(dataset, terrorZones, 90);

  it('Then monsters are terrorized from the character level and super uniques use their terror zone treasure class', () => {
    // Arrange & Act
    const area = find('terrorZone:Act1-Tower:area:hell', terrorized);
    const countess = find('terrorZone:Act1-Tower:superUnique:The Countess:hell', terrorized);

    // Assert
    expect(area).toMatchObject({ name: 'Forgotten Tower', terrorZoneId: 'Act1-Tower' });
    expect(area?.spawns.map((spawn) => spawn.level)).toEqual([92, 94, 95]);
    expect(countess?.spawns).toEqual([
      {
        monsterId: 'corruptrogue3',
        kind: 'superUnique',
        level: 95,
        treasureClass: 'Countess (H) Desecrated',
      },
    ]);
  });

  it('If a super unique has a fixed level, Then it gets 3 more levels after terrorizing', () => {
    // Arrange
    const tristram: TerrorZoneData = {
      zones: [{ id: 'Act1-Tristram', areaIds: [38] }],
      rules: hellRules,
    };

    // Act
    const griswold = find(
      'terrorZone:Act1-Tristram:superUnique:Griswold:hell',
      buildTerrorZoneLocations(dataset, tristram, 90),
    );

    // Assert
    expect(griswold?.spawns[0]?.level).toBe(98);
  });
});

describe('When it is checked which items can drop where', () => {
  const rune: FarmingTarget = { kind: 'rune', code: 'r01' };
  const highRing = dataset.uniquesByIndex.get('High Ring');
  const ring: FarmingTarget | undefined = highRing && {
    kind: 'unique',
    code: 'rin',
    unique: highRing,
  };

  it('Then an item drops only where a monster reaches its treasure class and item level', () => {
    // Arrange
    const targets = [rune, ring, undefined];

    // Act
    const drops = findDroppableTargets(dataset, targets, locations);
    const byId = new Map(drops.map((drop) => [drop.location.id, drop.targetIndexes]));

    // Assert
    expect(byId.get('area:25:hell')).toEqual([0, 1]);
    expect(byId.get('area:25:normal')).toEqual([]);
    expect(byId.get('superUnique:The Countess:hell')).toEqual([0]);
    expect(byId.get('boss:andariel:hell')).toEqual([]);
  });

  it('Then the item sources list the drops per kill of each monster kind, most first', () => {
    // Arrange & Act
    const sources = findItemSources(dataset, rune, locations, { players: 1, magicFind: 0 });

    // Assert
    expect(sources).toEqual([
      expect.objectContaining({
        locationId: 'superUnique:The Countess:hell',
        monsterKind: 'superUnique',
        areaName: 'Tower Cellar Level 5',
        monsterLevel: { min: 82, max: 82 },
        dropsPerKill: { min: 3, max: 3 },
      }),
      expect.objectContaining({
        locationId: 'area:25:hell',
        monsterKind: 'unique',
        difficulty: 'hell',
        dropsPerKill: { min: 0.5, max: 0.5 },
      }),
    ]);
  });
});

describe('When grail items are matched to the game data', () => {
  const catalog = new Map(catalogItems.map((item) => [item.id, item]));
  const resolverData = buildDropDataset(
    createFarmingTables({
      armor: [baseItemRow('uap', 62, 'helm'), baseItemRow('xtp', 30, 'tors')],
      misc: [baseItemRow('r30', 1, 'rune')],
      uniqueitems: [
        uniqueItemRow('Harlequin Crest', 'uap', 69, { id: 9001 }),
        uniqueItemRow("Que-Hegan's Wisdon", 'xtp', 59, { id: 223 }),
      ],
    }),
    new Map(),
  );
  const resolve = createTargetResolver(resolverData);

  it.each([
    ['harlequincrest', { kind: 'unique', code: 'uap' }],
    // The game data misspells it; its id finds it the way Chronicle entries are found
    ['queheganswisdom', { kind: 'unique', code: 'xtp' }],
    ['ber', { kind: 'rune', code: 'r30' }],
  ])('If the grail item is %s, Then it is found in the game data', (itemId, expected) => {
    // Arrange
    const item = catalog.get(itemId);

    // Act
    const target = item ? resolve(item) : undefined;

    // Assert
    expect(target).toMatchObject(expected);
  });

  it('If the grail item is a runeword or missing from the game data, Then it has no target', () => {
    // Arrange
    const runeword = catalogItems.find((item) => item.type === 'runeword');
    const el = catalog.get('el');

    // Act
    const targets = [runeword && resolve(runeword), el && resolve(el)];

    // Assert
    expect(targets).toEqual([undefined, undefined]);
  });
});
