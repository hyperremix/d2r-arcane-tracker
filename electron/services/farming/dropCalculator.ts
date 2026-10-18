import type {
  BaseItem,
  DifficultyIndex,
  DropDataset,
  ItemRatio,
  QualityFactors,
  QualityRatio,
  SetItem,
  TreasureClass,
  UniqueItem,
} from './dropData';

/**
 * The drop math of the game, as reimplemented by D2MOO (`D2GAME_DropTC`, the item quality roll
 * and the unique and set selection): treasure class picks and NoDrop, the level upgrade of
 * treasure classes, the quality roll with magic find and the treasure class quality ratios, and
 * the limit of six items per drop.
 */

/** A monster drops at most this many items per kill. */
export const MAX_DROPS_PER_KILL = 6;

/** The set the game only lets Hell Bovines drop. */
export const COW_KING_SET_NAME = "Cow King's Leathers";

/** The monster class that can drop the Cow King's set. */
export const HELL_BOVINE_MONSTER_ID = 'hellbovine';

/** What decides which treasure classes and items are enabled. */
export interface DropConditionContext {
  difficulty: DifficultyIndex;
  /** Whether the monster is in a terror zone */
  desecrated: boolean;
}

const DIFFICULTY_NAMES = ['normal', 'nightmare', 'hell'];

/**
 * Evaluates a ConditionCalc or DropConditionCalc expression: a product of conditions. Difficulty
 * and terror zone conditions are evaluated; any other condition (herald tiers, herald monsters)
 * counts as not met, since the advisor doesn't model heralds.
 * @param expression - The expression, e.g. `cond('Difficulty', hell)*cond('Desecrated')`
 * @param context - The difficulty and whether the monster is terrorized
 * @returns Whether every condition is met
 */
export function evaluateDropCondition(expression: string, context: DropConditionContext): boolean {
  return expression.split('*').every((factor) => {
    const difficulty = /cond\('Difficulty',\s*(\w+)\)/i.exec(factor);
    if (difficulty) {
      return DIFFICULTY_NAMES[context.difficulty] === difficulty[1]?.toLowerCase();
    }
    if (/cond\('Desecrated'\)\s*==\s*0/i.test(factor)) return !context.desecrated;
    if (/cond\('Desecrated'\)/i.test(factor)) return context.desecrated;
    return false;
  });
}

const isConditionMet = (condition: string | undefined, context: DropConditionContext): boolean =>
  condition === undefined || evaluateDropCondition(condition, context);

/**
 * The player count NoDrop uses for `/players X` in a single player game: the other players count
 * half, so it only changes at /players 3, 5 and 7.
 * @param players - The /players setting (1-8)
 * @returns The player count of the NoDrop formula
 */
export function getNoDropPlayerCount(players: number): number {
  return Math.trunc((players - 1) / 2) + 1;
}

/**
 * Adjusts a treasure class's NoDrop for the player count: the chance of a pick dropping nothing
 * is raised to the power of the player count.
 * @param noDrop - The NoDrop of the treasure class
 * @param total - The sum of the probabilities of its entries
 * @param playerCount - The NoDrop player count, see {@link getNoDropPlayerCount}
 * @returns The NoDrop the pick uses
 */
export function adjustNoDrop(noDrop: number, total: number, playerCount: number): number {
  if (noDrop <= 0 || playerCount <= 1) return noDrop;
  const baseRatio = noDrop / (total + noDrop);
  let ratio = baseRatio;
  for (let i = playerCount - 1; i > 0; i--) {
    ratio *= baseRatio;
  }
  const inverseRatio = 1 - ratio;
  return inverseRatio === 0 ? 0 : Math.trunc((total / inverseRatio) * (1 - inverseRatio));
}

/**
 * Finds the treasure class a monster of a level drops from: the last of the following treasure
 * classes of the same group whose level the monster level reaches.
 * @param dataset - The drop data
 * @param name - The monster's treasure class
 * @param monsterLevel - The monster level
 * @returns The upgraded treasure class name, or undefined when the treasure class doesn't exist
 */
export function upgradeTreasureClass(
  dataset: DropDataset,
  name: string,
  monsterLevel: number,
): string | undefined {
  let treasureClass = dataset.treasureClasses.get(name);
  if (!treasureClass) return undefined;
  if (monsterLevel <= 0 || treasureClass.group === 0) return treasureClass.name;
  for (
    let next = dataset.treasureClassRows[treasureClass.position + 1];
    next && next.group === treasureClass.group && next.level <= monsterLevel;
    next = dataset.treasureClassRows[next.position + 1]
  ) {
    treasureClass = next;
  }
  return treasureClass.name;
}

/** A treasure class entry resolved the way the game does when it loads the table. */
export type ResolvedEntry =
  | { kind: 'treasureClass'; treasureClass: TreasureClass }
  | { kind: 'item'; item: BaseItem }
  | { kind: 'unique'; unique: UniqueItem }
  | { kind: 'set'; set: SetItem };

/**
 * Resolves a treasure class entry: an item code (up to four characters), then a treasure class,
 * then a unique or set item name. Entries that match nothing are left out by the game.
 */
export function resolveEntry(dataset: DropDataset, name: string): ResolvedEntry | undefined {
  const item = name.length <= 4 ? dataset.items.get(name) : undefined;
  if (item) return { kind: 'item', item };
  const treasureClass = dataset.treasureClasses.get(name);
  if (treasureClass) return { kind: 'treasureClass', treasureClass };
  const unique = dataset.uniquesByIndex.get(name);
  if (unique) return { kind: 'unique', unique };
  const set = dataset.setsByIndex.get(name);
  if (set) return { kind: 'set', set };
  return undefined;
}

/** An enabled entry of a treasure class, with its probability. */
interface ActiveEntry {
  entry: ResolvedEntry;
  probability: number;
}

/**
 * The entries of a treasure class that can drop in a context. Entries that point at a treasure
 * class whose condition isn't met are removed, along with their probability.
 */
export function getActiveEntries(
  dataset: DropDataset,
  treasureClass: TreasureClass,
  context: DropConditionContext,
): ActiveEntry[] {
  if (!isConditionMet(treasureClass.condition, context)) return [];
  const active: ActiveEntry[] = [];
  for (const { name, probability } of treasureClass.entries) {
    const entry = resolveEntry(dataset, name);
    if (!entry) continue;
    if (entry.kind === 'treasureClass' && !isConditionMet(entry.treasureClass.condition, context)) {
      continue;
    }
    active.push({ entry, probability });
  }
  return active;
}

/** The quality ratios a child treasure class inherits: the higher value of each. */
export function mergeQualityFactors(
  inherited: QualityFactors,
  own: QualityFactors,
): QualityFactors {
  return {
    unique: Math.max(inherited.unique, own.unique),
    set: Math.max(inherited.set, own.set),
    rare: Math.max(inherited.rare, own.rare),
    magic: Math.max(inherited.magic, own.magic),
  };
}

const NO_QUALITY: QualityFactors = { unique: 0, set: 0, rare: 0, magic: 0 };

/** The leaves of a treasure class tree that can drop at all. */
export interface ReachableLeaves {
  codes: Set<string>;
  /** Uniques the tree names directly */
  uniques: Set<UniqueItem>;
  /** Set items the tree names directly */
  sets: Set<SetItem>;
}

/**
 * Collects the items a treasure class tree can drop, per condition context. Probabilities don't
 * matter here: every enabled entry can be picked.
 */
export class ReachabilityIndex {
  private readonly cache = new Map<string, ReachableLeaves>();

  constructor(
    private readonly dataset: DropDataset,
    private readonly context: DropConditionContext,
  ) {}

  get(name: string): ReachableLeaves {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const leaves: ReachableLeaves = { codes: new Set(), uniques: new Set(), sets: new Set() };
    // Set before walking, so a cycle in broken data can't recurse forever
    this.cache.set(name, leaves);
    const treasureClass = this.dataset.treasureClasses.get(name);
    if (treasureClass) {
      for (const { entry } of getActiveEntries(this.dataset, treasureClass, this.context)) {
        this.add(leaves, entry);
      }
    }
    return leaves;
  }

  private add(leaves: ReachableLeaves, entry: ResolvedEntry): void {
    if (entry.kind === 'item') leaves.codes.add(entry.item.code);
    else if (entry.kind === 'unique') leaves.uniques.add(entry.unique);
    else if (entry.kind === 'set') leaves.sets.add(entry.set);
    else {
      const child = this.get(entry.treasureClass.name);
      for (const code of child.codes) leaves.codes.add(code);
      for (const unique of child.uniques) leaves.uniques.add(unique);
      for (const set of child.sets) leaves.sets.add(set);
    }
  }
}

/** Which leaves count as the item a drop calculation is for. */
export interface DropTargetMatcher {
  /** The base item code whose drops are counted per quality ratios */
  code: string;
  /** Whether a unique or set entry is the item itself, which then always drops as that item */
  isForcedTarget: (entry: ResolvedEntry) => boolean;
}

/** Expected drops of the target's base item, for one combination of quality ratios. */
export interface BaseItemDrops {
  quality: QualityFactors;
  expected: number;
}

/** The result of dropping from a treasure class. */
export interface TargetDrops {
  /** Expected drops of the target's base item, by quality ratios */
  baseItem: BaseItemDrops[];
  /** Expected drops of the target from entries that name it directly */
  forced: number;
}

interface WalkResult {
  /** Probability of each drop count (0-6) after the treasure class is done */
  counts: number[];
  baseItem: Map<string, BaseItemDrops>;
  forced: number;
}

const qualityKey = (quality: QualityFactors): string =>
  `${quality.unique},${quality.set},${quality.rare},${quality.magic}`;

const emptyCounts = (): number[] => new Array<number>(MAX_DROPS_PER_KILL + 1).fill(0);

/**
 * Calculates the expected number of drops of one item per kill from a treasure class tree, with
 * the game's pick order: positive picks roll each entry or NoDrop independently, negative picks
 * drop the entries in order (Item1 Prob1 times, then Item2 ...), a child treasure class finishes
 * all its picks before its parent continues, and dropping stops after six items.
 */
export class TargetDropWalker {
  private readonly cache = new Map<string, WalkResult>();

  /**
   * @param dataset - The drop data
   * @param context - Difficulty and terror zone state
   * @param playerCount - The NoDrop player count, see {@link getNoDropPlayerCount}
   * @param target - The item to count
   */
  constructor(
    private readonly dataset: DropDataset,
    private readonly context: DropConditionContext,
    private readonly playerCount: number,
    private readonly target: DropTargetMatcher,
  ) {}

  /**
   * Expected drops of the target per kill of a monster dropping from a treasure class.
   * @param name - The treasure class, after the level upgrade
   */
  drop(name: string): TargetDrops {
    const treasureClass = this.dataset.treasureClasses.get(name);
    if (!treasureClass) return { baseItem: [], forced: 0 };
    const result = this.walk(treasureClass, NO_QUALITY, 0, new Set());
    return { baseItem: [...result.baseItem.values()], forced: result.forced };
  }

  private walk(
    treasureClass: TreasureClass,
    inherited: QualityFactors,
    start: number,
    path: Set<string>,
  ): WalkResult {
    const quality = mergeQualityFactors(inherited, treasureClass.quality);
    const key = `${treasureClass.name}|${qualityKey(quality)}|${start}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const result: WalkResult = { counts: emptyCounts(), baseItem: new Map(), forced: 0 };
    result.counts[start] = 1;
    const entries = getActiveEntries(this.dataset, treasureClass, this.context);
    // A treasure class that contains itself (broken data) drops nothing more
    if (entries.length > 0 && !path.has(treasureClass.name) && start < MAX_DROPS_PER_KILL) {
      path.add(treasureClass.name);
      if (treasureClass.picks > 0) {
        this.walkRandomPicks(treasureClass, entries, quality, result, path);
      } else {
        this.walkOrderedPicks(treasureClass, entries, quality, result, path);
      }
      path.delete(treasureClass.name);
    }
    this.cache.set(key, result);
    return result;
  }

  private walkRandomPicks(
    treasureClass: TreasureClass,
    entries: ActiveEntry[],
    quality: QualityFactors,
    result: WalkResult,
    path: Set<string>,
  ): void {
    const total = entries.reduce((sum, { probability }) => sum + probability, 0);
    const noDrop = adjustNoDrop(treasureClass.noDrop, total, this.playerCount);
    for (let pick = 0; pick < treasureClass.picks; pick++) {
      const before = result.counts;
      result.counts = emptyCounts();
      result.counts[MAX_DROPS_PER_KILL] = before[MAX_DROPS_PER_KILL] ?? 0;
      for (let count = 0; count < MAX_DROPS_PER_KILL; count++) {
        const stateProbability = before[count] ?? 0;
        if (stateProbability === 0) continue;
        result.counts[count] =
          (result.counts[count] ?? 0) + (stateProbability * noDrop) / (total + noDrop);
        for (const { entry, probability } of entries) {
          const weight = (stateProbability * probability) / (total + noDrop);
          this.applyEntry(entry, quality, count, weight, result, path);
        }
      }
    }
  }

  private walkOrderedPicks(
    treasureClass: TreasureClass,
    entries: ActiveEntry[],
    quality: QualityFactors,
    result: WalkResult,
    path: Set<string>,
  ): void {
    const sequence: ResolvedEntry[] = [];
    for (const { entry, probability } of entries) {
      for (let i = 0; i < probability && sequence.length < -treasureClass.picks; i++) {
        sequence.push(entry);
      }
    }
    for (const entry of sequence) {
      const before = result.counts;
      result.counts = emptyCounts();
      result.counts[MAX_DROPS_PER_KILL] = before[MAX_DROPS_PER_KILL] ?? 0;
      for (let count = 0; count < MAX_DROPS_PER_KILL; count++) {
        const stateProbability = before[count] ?? 0;
        if (stateProbability > 0) {
          this.applyEntry(entry, quality, count, stateProbability, result, path);
        }
      }
    }
  }

  /** Adds the outcome of one picked entry, starting at a drop count, with a weight. */
  private applyEntry(
    entry: ResolvedEntry,
    quality: QualityFactors,
    count: number,
    weight: number,
    result: WalkResult,
    path: Set<string>,
  ): void {
    if (entry.kind !== 'treasureClass') {
      result.counts[count + 1] = (result.counts[count + 1] ?? 0) + weight;
      if (entry.kind === 'item' && entry.item.code === this.target.code) {
        this.addBaseItem(result, quality, weight);
      } else if (this.target.isForcedTarget(entry)) {
        result.forced += weight;
      }
      return;
    }
    const child = this.walk(entry.treasureClass, quality, count, path);
    child.counts.forEach((probability, end) => {
      result.counts[end] = (result.counts[end] ?? 0) + weight * probability;
    });
    for (const drops of child.baseItem.values()) {
      this.addBaseItem(result, drops.quality, weight * drops.expected);
    }
    result.forced += weight * child.forced;
  }

  private addBaseItem(result: WalkResult, quality: QualityFactors, expected: number): void {
    const key = qualityKey(quality);
    const existing = result.baseItem.get(key);
    if (existing) existing.expected += expected;
    else result.baseItem.set(key, { quality, expected });
  }
}

/**
 * Finds the itemratio.txt row of a base item: class-specific items and exceptional or elite items
 * (whose code differs from their normal version) have their own rows; of the rows that apply the
 * one with the highest version is used.
 */
export function findItemRatio(dataset: DropDataset, item: BaseItem): ItemRatio | undefined {
  const classSpecific = item.types.some((type) => dataset.itemTypes.get(type)?.classSpecific);
  const uber = item.normCode !== '' && item.normCode !== item.code;
  let found: ItemRatio | undefined;
  for (const ratio of dataset.itemRatios) {
    if (
      ratio.classSpecific === classSpecific &&
      ratio.uber === uber &&
      ratio.version <= 100 &&
      (!found || ratio.version >= found.version)
    ) {
      found = ratio;
    }
  }
  return found;
}

/** The magic find divisor of the unique roll: 250 × MF / (MF + 250) effective MF above 10% MF. */
const uniqueMagicFindDivisor = (divisor: number): number =>
  divisor > 110 ? Math.trunc((50 * (5 * divisor - 500)) / (divisor + 150)) + 100 : divisor;

/** The magic find divisor of the set roll: 500 × MF / (MF + 500) effective MF above 10% MF. */
const setMagicFindDivisor = (divisor: number): number =>
  divisor > 110 ? Math.trunc((100 * (5 * divisor - 500)) / (divisor + 400)) + 100 : divisor;

/**
 * The chance that a quality roll (unique or set) succeeds.
 * @param ratio - The quality's ratio, divisor and minimum from itemratio.txt
 * @param levelDifference - Item level minus the quality level of the base item
 * @param magicFind - The player's magic find in percent
 * @param factor - The treasure class quality ratio for this quality (out of 1024)
 * @param magicFindDivisor - Diminishing returns of magic find for this quality
 * @returns The chance, from 0 to 1
 */
function qualityRollChance(
  ratio: QualityRatio,
  levelDifference: number,
  magicFind: number,
  factor: number,
  magicFindDivisor: (divisor: number) => number,
): number {
  const level = ratio.ratio - Math.trunc(levelDifference / ratio.divisor);
  let base = level * 128;
  if (magicFind !== 0) {
    const divisor = magicFindDivisor(magicFind + 100);
    if (divisor !== 0) base = Math.trunc((12800 * level) / divisor);
  }
  base = Math.max(base, ratio.min);
  const chance = base - Math.trunc((base * factor) / 1024);
  return chance <= 128 ? 1 : 128 / chance;
}

/** The chance that an item's unique roll succeeds. */
export function uniqueRollChance(
  ratio: ItemRatio,
  levelDifference: number,
  magicFind: number,
  factor: number,
): number {
  return qualityRollChance(
    ratio.unique,
    levelDifference,
    magicFind,
    factor,
    uniqueMagicFindDivisor,
  );
}

/** The chance that an item's set roll succeeds (it is only made when the unique roll fails). */
export function setRollChance(
  ratio: ItemRatio,
  levelDifference: number,
  magicFind: number,
  factor: number,
): number {
  return qualityRollChance(ratio.set, levelDifference, magicFind, factor, setMagicFindDivisor);
}

/** What the quality roll of a dropped item depends on besides the treasure class. */
export interface ItemRollContext extends DropConditionContext {
  itemLevel: number;
  magicFind: number;
  /** Whether the monster is a Hell Bovine, the only monster that drops the Cow King's set */
  hellBovine: boolean;
}

/** The uniques of a base item that can be picked at an item level, with their weights. */
export function getEligibleUniques(
  dataset: DropDataset,
  code: string,
  context: ItemRollContext,
): UniqueItem[] {
  return (dataset.uniquesByCode.get(code) ?? []).filter(
    (unique) =>
      unique.spawnable &&
      unique.level <= context.itemLevel &&
      isConditionMet(unique.condition, context),
  );
}

/** The set items of a base item that can be picked at an item level. */
export function getEligibleSets(
  dataset: DropDataset,
  code: string,
  context: ItemRollContext,
): SetItem[] {
  return (dataset.setsByCode.get(code) ?? []).filter(
    (set) =>
      set.spawnable &&
      set.level <= context.itemLevel &&
      (set.setName !== COW_KING_SET_NAME || context.hellBovine) &&
      isConditionMet(set.condition, context),
  );
}

const pickWeight = (rarity: number): number => Math.max(rarity, 1);

/** Share of one entry in a weighted pick among candidates (0 when it isn't a candidate). */
function pickShare<T extends { rarity: number }>(candidate: T, candidates: T[]): number {
  if (!candidates.includes(candidate)) return 0;
  const total = candidates.reduce((sum, item) => sum + pickWeight(item.rarity), 0);
  return pickWeight(candidate.rarity) / total;
}

/** The base item and item ratio row of a base item that can have unique and set quality. */
function getQualityRollItem(
  dataset: DropDataset,
  code: string,
): { item: BaseItem; ratio: ItemRatio } | undefined {
  const item = dataset.items.get(code);
  if (!item) return undefined;
  if (item.types.some((type) => dataset.itemTypes.get(type)?.alwaysNormal)) return undefined;
  const ratio = findItemRatio(dataset, item);
  return ratio ? { item, ratio } : undefined;
}

/**
 * The chance that a dropped base item becomes a given unique: the unique roll succeeds and the
 * unique is picked among the base's uniques the item level allows, weighted by rarity. If no
 * unique is allowed the item becomes rare, so it never falls through to the set roll.
 */
export function getUniqueChance(
  dataset: DropDataset,
  unique: UniqueItem,
  quality: QualityFactors,
  context: ItemRollContext,
): number {
  const rollItem = getQualityRollItem(dataset, unique.code);
  if (!rollItem) return 0;
  const share = pickShare(unique, getEligibleUniques(dataset, unique.code, context));
  if (share === 0) return 0;
  const levelDifference = context.itemLevel - rollItem.item.level;
  return (
    uniqueRollChance(rollItem.ratio, levelDifference, context.magicFind, quality.unique) * share
  );
}

/**
 * The chance that a dropped base item becomes a given set item: the unique roll fails, the set
 * roll succeeds and the set item is picked among the base's set items, weighted by rarity.
 */
export function getSetChance(
  dataset: DropDataset,
  set: SetItem,
  quality: QualityFactors,
  context: ItemRollContext,
): number {
  const rollItem = getQualityRollItem(dataset, set.code);
  if (!rollItem) return 0;
  const share = pickShare(set, getEligibleSets(dataset, set.code, context));
  if (share === 0) return 0;
  const levelDifference = context.itemLevel - rollItem.item.level;
  const unique = uniqueRollChance(
    rollItem.ratio,
    levelDifference,
    context.magicFind,
    quality.unique,
  );
  const setChance = setRollChance(rollItem.ratio, levelDifference, context.magicFind, quality.set);
  return (1 - unique) * setChance * share;
}
