import { createHash } from 'node:crypto';
import { stripJsonComments } from '../lib/jsonUtils';

/**
 * Port of the game's offline terror zone rotation, as recovered from D2R 3.3.93847.
 * See docs/TERROR_ZONE_FINDINGS_2026.md for how the rotation works and how it was verified.
 */

const SECONDS_PER_MINUTE = 60;
const TWO_POW_32 = 2 ** 32;

/**
 * One entry of `desecrated_zones` in desecratedzones.json, reduced to what the rotation uses.
 */
export interface TerrorZoneScheduleConfig {
  /** First second (Unix time) the config applies to */
  startSeconds: number;
  /** First second (Unix time) it no longer applies to; Infinity when the config never ends */
  endSeconds: number;
  zoneDurationMinutes: number;
  breakDurationMinutes: number;
  /** Unsigned 64-bit seed; kept a BigInt because it does not fit a double */
  seed: bigint;
  /** Zone ids in game file order */
  zoneIds: string[];
}

/**
 * A window in which one zone is the terror zone.
 */
export interface TerrorZoneWindow {
  /** Unix time in seconds */
  startSeconds: number;
  /** Unix time in seconds, exclusive */
  endSeconds: number;
  zoneId: string;
}

/**
 * The config of the retail game (patch 3.x), used when the player's game file can't be read.
 */
export const RETAIL_TERROR_ZONE_CONFIG: TerrorZoneScheduleConfig = {
  startSeconds: Date.UTC(2025, 11, 5) / 1000,
  endSeconds: Number.POSITIVE_INFINITY,
  zoneDurationMinutes: 30,
  breakDurationMinutes: 0,
  seed: 16665365343970128666n,
  zoneIds: [
    'Act1-BurialGrounds',
    'Act1-Catacombs',
    'Act1-ColdPlains',
    'Act1-DarkWood',
    'Act1-BloodMoor',
    'Act1-Jail',
    'Act1-MooMooFarm',
    'Act1-Tristram',
    'Act1-Tower',
    'Act1-Monastery',
    'Act2-Sewers',
    'Act2-RockyWaste',
    'Act2-DryHills',
    'Act2-FarOasis',
    'Act2-LostCity',
    'Act2-TalRashas',
    'Act2-ArcaneSanctuary',
    'Act3-SpiderForest',
    'Act3-GreatMarsh',
    'Act3-FlayerJungle',
    'Act3-Kurast',
    'Act3-Travincal',
    'Act3-DuranceOfHate',
    'Act4_OuterSteppes',
    'Act4-RiverOfFlame',
    'Act4-ChaosSanctuary',
    'Act5-BloodyFoothils',
    'Act5-ArreatPlateau',
    'Act5-CrystallinePassage',
    'Act5-Halls',
    'Act5-GlacialTrail',
    'Act5-AncientsWay',
    'Act5-FrozenTundra',
    'Act5-WorldstoneKeep',
  ],
};

/**
 * Random fraction in [0, 1) for a point in time: the first four digest bytes (little endian)
 * of the SHA-1 of the time XOR the seed, as 8 little-endian bytes, divided by 2^32.
 */
function roll(timeSeconds: number, seed: bigint): number {
  const input = Buffer.alloc(8);
  input.writeBigUInt64LE(BigInt.asUintN(64, BigInt(timeSeconds) ^ seed));
  return createHash('sha1').update(input).digest().readUInt32LE(0) / TWO_POW_32;
}

/**
 * The zone index picked in every slot from slot 0 up to and including `lastSlot`.
 * Each zone has a weight (the weights sum to 1); the picked zone's weight is spread over the other
 * zones and reset to 0, so the zone picked last cannot repeat and others get likelier while they wait.
 */
function pickZoneIndices(
  startSeconds: number,
  periodSeconds: number,
  seed: bigint,
  zoneCount: number,
  lastSlot: number,
): number[] {
  const weights = new Array<number>(zoneCount).fill(1 / (zoneCount - 1));
  // The game starts as if a zone had been picked in the slot before the first one
  weights[Math.floor(roll(startSeconds - periodSeconds, seed) * zoneCount)] = 0;

  const picks: number[] = [];
  for (let slot = 0; slot <= lastSlot; slot++) {
    const slotRoll = roll(startSeconds + periodSeconds * slot, seed);
    // Rounding can leave the cumulative weight just below 1: the last zone is picked then
    let pick = zoneCount - 1;
    let share = 0;
    let cumulative = 0;
    for (let index = 0; index < zoneCount; index++) {
      cumulative += weights[index];
      if (slotRoll < cumulative) {
        pick = index;
        share = weights[index] / (zoneCount - 1);
        break;
      }
    }
    for (let index = 0; index < zoneCount; index++) {
      weights[index] += share;
    }
    weights[pick] = 0;
    picks.push(pick);
  }
  return picks;
}

/**
 * Whether the game can run a rotation for this config: it needs a positive slot length and a zone.
 */
function isUsableConfig(config: TerrorZoneScheduleConfig): boolean {
  return (
    config.zoneDurationMinutes > 0 &&
    config.breakDurationMinutes >= 0 &&
    config.zoneIds.length > 0 &&
    config.endSeconds > config.startSeconds
  );
}

/**
 * The windows of one config that end after `fromSeconds`, soonest first, at most `count` of them.
 * The first window may already have started. Windows start before the config ends and are cut off at its end.
 */
function getConfigWindows(
  config: TerrorZoneScheduleConfig,
  fromSeconds: number,
  count: number,
): TerrorZoneWindow[] {
  const periodSeconds =
    (config.zoneDurationMinutes + config.breakDurationMinutes) * SECONDS_PER_MINUTE;
  const zoneSeconds = config.zoneDurationMinutes * SECONDS_PER_MINUTE;
  const currentSlot = Math.floor((fromSeconds - config.startSeconds) / periodSeconds);
  // Inside a break the current slot's zone is over
  const firstSlot =
    config.startSeconds + currentSlot * periodSeconds + zoneSeconds <= fromSeconds
      ? currentSlot + 1
      : currentSlot;
  const picks = pickZoneIndices(
    config.startSeconds,
    periodSeconds,
    config.seed,
    config.zoneIds.length,
    firstSlot + count - 1,
  );

  const windows: TerrorZoneWindow[] = [];
  for (let slot = firstSlot; slot < firstSlot + count; slot++) {
    const startSeconds = config.startSeconds + slot * periodSeconds;
    if (startSeconds >= config.endSeconds) {
      break;
    }
    windows.push({
      startSeconds,
      endSeconds: Math.min(startSeconds + zoneSeconds, config.endSeconds),
      zoneId: config.zoneIds[picks[slot]],
    });
  }
  return windows;
}

/**
 * Lists the terror zone windows that end after `fromSeconds`, soonest first, like the game would
 * schedule them. The first window may already have started. The first config covering a time wins,
 * and each config rotates on its own from its start time. Nothing is scheduled while no config
 * covers the time, and an unusable config (no zones, or no zone duration) ends the list.
 * @param configs - The configs of desecratedzones.json
 * @param fromSeconds - Unix time in seconds
 * @param count - How many windows to return at most
 * @returns The windows, empty when no terror zone is scheduled
 */
export function getTerrorZoneWindows(
  configs: TerrorZoneScheduleConfig[],
  fromSeconds: number,
  count: number,
): TerrorZoneWindow[] {
  const windows: TerrorZoneWindow[] = [];
  let cursor = fromSeconds;
  while (windows.length < count) {
    const config = configs.find(
      (candidate) => candidate.startSeconds <= cursor && cursor < candidate.endSeconds,
    );
    if (!config) {
      // Skip to the next config, if there is one
      const nextStart = Math.min(
        ...configs.map((candidate) => candidate.startSeconds).filter((start) => start > cursor),
      );
      if (!Number.isFinite(nextStart)) {
        break;
      }
      cursor = nextStart;
      continue;
    }
    if (!isUsableConfig(config)) {
      break;
    }
    windows.push(...getConfigWindows(config, cursor, count - windows.length));
    if (config.endSeconds === Number.POSITIVE_INFINITY) {
      break;
    }
    cursor = config.endSeconds;
  }
  return windows;
}

/**
 * Reads the time of a `start_time_utc` / `end_time_utc` value (`YYYY-MM-DD HH:MM:SS`, UTC).
 * @returns Unix time in seconds, or undefined when the value isn't a date and time
 */
function parseUtcSeconds(value: unknown): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return undefined;
  }
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  return Date.UTC(year, month - 1, day, hour, minute, second) / 1000;
}

/**
 * Wraps the number of every `"seed"` property in quotes. `JSON.parse` would round a seed above 2^53.
 * Undo it with {@link unquoteSeeds} after `JSON.stringify` to write the file back unchanged.
 */
export function quoteSeeds(json: string): string {
  return json.replace(/("seed"\s*:\s*)(\d+)/g, '$1"$2"');
}

/**
 * Turns the quoted seeds of {@link quoteSeeds} back into numbers.
 */
export function unquoteSeeds(json: string): string {
  return json.replace(/("seed"\s*:\s*)"(\d+)"/g, '$1$2');
}

/**
 * Reads the rotation configs from the text of a desecratedzones.json file.
 * @param fileContent - The file content; comments are allowed
 * @returns The configs in file order
 * @throws If the text isn't JSON or has no `desecrated_zones` list
 */
export function parseTerrorZoneScheduleConfigs(fileContent: string): TerrorZoneScheduleConfig[] {
  const data = JSON.parse(quoteSeeds(stripJsonComments(fileContent)));
  if (!Array.isArray(data?.desecrated_zones)) {
    throw new Error('Invalid desecratedzones.json structure');
  }

  const configs: TerrorZoneScheduleConfig[] = [];
  for (const entry of data.desecrated_zones) {
    const startSeconds = parseUtcSeconds(entry?.start_time_utc);
    // The game doesn't load a config without a start time
    if (startSeconds === undefined) {
      continue;
    }
    configs.push({
      startSeconds,
      // An empty end time means the config never ends
      endSeconds: parseUtcSeconds(entry.end_time_utc) ?? Number.POSITIVE_INFINITY,
      zoneDurationMinutes: parseWholeMinutes(entry.zone_duration_minutes),
      breakDurationMinutes: parseWholeMinutes(entry.break_duration_minutes),
      seed: parseSeed(entry.seed),
      zoneIds: Array.isArray(entry.zones)
        ? entry.zones.flatMap((zone: { id?: unknown }) =>
            typeof zone?.id === 'string' ? [zone.id] : [],
          )
        : [],
    });
  }
  return configs;
}

/**
 * Reads a duration in minutes. The game reads it as an integer, so a fraction is dropped;
 * a missing or invalid duration is 0.
 */
function parseWholeMinutes(value: unknown): number {
  const minutes = Math.trunc(Number(value));
  return Number.isFinite(minutes) ? minutes : 0;
}

/**
 * Reads a seed, which `quoteSeeds` turned into a string; a missing seed is 0 like in the game.
 */
function parseSeed(value: unknown): bigint {
  return typeof value === 'string' && /^\d+$/.test(value) ? BigInt.asUintN(64, BigInt(value)) : 0n;
}
