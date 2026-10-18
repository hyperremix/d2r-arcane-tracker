import { stripJsonComments } from '../../lib/jsonUtils';

/**
 * Terror zone monster levels, from the `game_difficulties` of desecratedzones.json.
 */

/** The terror zone level settings of one difficulty. */
export interface TerrorZoneLevelRule {
  /** Levels above the character level (`boost_level`) */
  boostLevel: number;
  /** Lowest and highest terrorized level of regular monsters (`bound_incl_min`/`bound_incl_max`) */
  minLevel: number;
  maxLevel: number;
}

export interface TerrorZoneDefinition {
  id: string;
  /** levels.txt Ids of the zone's areas */
  areaIds: number[];
}

export interface TerrorZoneData {
  zones: TerrorZoneDefinition[];
  /** Level rules for Normal, Nightmare and Hell */
  rules: [TerrorZoneLevelRule, TerrorZoneLevelRule, TerrorZoneLevelRule];
}

const DIFFICULTY_KEYS = ['normal', 'nightmare', 'hell'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseRule(value: unknown): TerrorZoneLevelRule | undefined {
  const defaults = isRecord(value) ? value.defaults : undefined;
  if (!isRecord(defaults)) return undefined;
  const { boost_level: boost, bound_incl_min: min, bound_incl_max: max } = defaults;
  if (typeof boost !== 'number' || typeof min !== 'number' || typeof max !== 'number') {
    return undefined;
  }
  return { boostLevel: boost, minLevel: min, maxLevel: max };
}

function parseZones(value: unknown): TerrorZoneDefinition[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((zone) => {
    if (typeof zone.id !== 'string' || !Array.isArray(zone.levels)) return [];
    const areaIds = zone.levels
      .filter(isRecord)
      .map((level) => level.level_id)
      .filter((id): id is number => typeof id === 'number');
    return [{ id: zone.id, areaIds }];
  });
}

/**
 * Reads the zones and the level rules of the first config in desecratedzones.json. The Reign of
 * the Warlock rules (`rotw`) are used when the file has them, otherwise the Lord of Destruction
 * ones (`expansion`).
 * @param text - The content of desecratedzones.json
 * @returns The zones and rules, or undefined when the file has no usable zones or rules
 */
export function parseTerrorZoneData(text: string): TerrorZoneData | undefined {
  const data: unknown = JSON.parse(stripJsonComments(text));
  const configs = isRecord(data) ? data.desecrated_zones : undefined;
  const config = Array.isArray(configs) ? configs[0] : undefined;
  if (!isRecord(config) || !isRecord(config.game_difficulties)) return undefined;
  const difficulties = config.game_difficulties.rotw ?? config.game_difficulties.expansion;
  if (!isRecord(difficulties)) return undefined;
  const [normal, nightmare, hell] = DIFFICULTY_KEYS.map((key) => parseRule(difficulties[key]));
  const zones = parseZones(config.zones);
  if (!normal || !nightmare || !hell || zones.length === 0) return undefined;
  return { zones, rules: [normal, nightmare, hell] };
}

/**
 * The level of a terrorized monster. The terror zone level is the character level plus the boost,
 * kept within the difficulty's bounds; champions add 2 and uniques 3 to it like they do to the
 * area level, and a monster never ends up below its normal level.
 * @param originalLevel - The monster's level outside a terror zone
 * @param bonus - 0 for regular monsters, 2 for champions, 3 for uniques, super uniques and bosses
 * @param characterLevel - The level of the character that made the game
 * @param rule - The level rule of the difficulty
 * @returns The terrorized monster level
 */
export function getTerrorizedLevel(
  originalLevel: number,
  bonus: number,
  characterLevel: number,
  rule: TerrorZoneLevelRule,
): number {
  const zoneLevel = Math.min(
    Math.max(characterLevel + rule.boostLevel, rule.minLevel),
    rule.maxLevel,
  );
  return Math.max(originalLevel, zoneLevel + bonus);
}
