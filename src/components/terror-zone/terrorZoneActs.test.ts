import type { TerrorZone } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import { getTerrorZoneAct, groupTerrorZonesByAct } from './terrorZoneActs';

function zone(id: string): TerrorZone {
  return { id, name: id, levels: [] };
}

describe('When reading the act of a terror zone id', () => {
  it('If the id starts with ActN and a dash, Then the act number is returned', () => {
    // Arrange & Act
    const act = getTerrorZoneAct('Act3-Travincal');

    // Assert
    expect(act).toBe(3);
  });

  it('If the id uses an underscore separator, Then the act number is returned', () => {
    // Arrange & Act
    const act = getTerrorZoneAct('Act4_OuterSteppes');

    // Assert
    expect(act).toBe(4);
  });

  it('If the id does not name an act, Then undefined is returned', () => {
    // Arrange & Act
    const acts = ['999', 'Zone 1', 'Act9-Unknown', 'Actor-Zone'].map(getTerrorZoneAct);

    // Assert
    expect(acts).toEqual([undefined, undefined, undefined, undefined]);
  });
});

describe('When grouping terror zones by act', () => {
  it('Then groups are in act order with zones without an act last, keeping file order within a group', () => {
    // Arrange
    const zones = [
      zone('Act5-WorldstoneKeep'),
      zone('999'),
      zone('Act1-ColdPlains'),
      zone('Act1-BloodMoor'),
      zone('Act2-Sewers'),
    ];

    // Act
    const groups = groupTerrorZonesByAct(zones);

    // Assert
    expect(groups.map((group) => [group.act, group.zones.map((z) => z.id)])).toEqual([
      [1, ['Act1-ColdPlains', 'Act1-BloodMoor']],
      [2, ['Act2-Sewers']],
      [5, ['Act5-WorldstoneKeep']],
      [undefined, ['999']],
    ]);
  });

  it('If there are no zones, Then no groups are returned', () => {
    // Arrange & Act
    const groups = groupTerrorZonesByAct([]);

    // Assert
    expect(groups).toEqual([]);
  });
});
