import type { TerrorZone } from 'electron/types/grail';

/**
 * Zone ids in desecratedzones.json start with their act, e.g. `Act1-BurialGrounds` or
 * `Act4_OuterSteppes`.
 */
const ZONE_ACT_PATTERN = /^Act([1-5])[-_]/i;

/**
 * Terror zones of one act, or of no known act when `act` is undefined.
 */
export interface TerrorZoneActGroup {
  act: number | undefined;
  zones: TerrorZone[];
}

/**
 * Reads the act (1-5) from a terror zone id.
 * @param zoneId - The zone id from the game file
 * @returns The act number, or undefined if the id does not name an act
 */
export function getTerrorZoneAct(zoneId: string): number | undefined {
  const match = ZONE_ACT_PATTERN.exec(zoneId);
  return match ? Number(match[1]) : undefined;
}

/**
 * Groups terror zones by act in ascending act order, followed by zones without a known act.
 * Zones keep their game file order within a group, and acts without zones are left out.
 * @param zones - The zones to group
 * @returns The non-empty act groups
 */
export function groupTerrorZonesByAct(zones: TerrorZone[]): TerrorZoneActGroup[] {
  const zonesByAct = new Map<number | undefined, TerrorZone[]>();
  for (const zone of zones) {
    const act = getTerrorZoneAct(zone.id);
    const actZones = zonesByAct.get(act);
    if (actZones) {
      actZones.push(zone);
    } else {
      zonesByAct.set(act, [zone]);
    }
  }

  return [...zonesByAct.entries()]
    .map(([act, actZones]) => ({ act, zones: actZones }))
    .sort((a, b) => (a.act ?? Number.POSITIVE_INFINITY) - (b.act ?? Number.POSITIVE_INFINITY));
}
