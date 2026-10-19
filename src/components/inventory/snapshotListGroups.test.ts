import type { Character, CharacterInventorySnapshot } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import { groupSnapshotList, type SnapshotListGroup } from './snapshotListGroups';

function buildSnapshot(
  characterName: string,
  sourceFileType: CharacterInventorySnapshot['sourceFileType'],
): CharacterInventorySnapshot {
  return {
    snapshotId: `snap-${characterName}`,
    characterName,
    sourceFileType,
    sourceFilePath: `/saves/${characterName}.${sourceFileType}`,
    capturedAt: new Date('2024-01-01T00:00:00.000Z'),
    items: [],
  };
}

function buildCharacter(name: string, level: number): Character {
  return {
    id: `char-${name}`,
    name,
    characterClass: 'sorceress',
    level,
    hardcore: false,
    expansion: true,
    lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
    created: new Date('2024-01-01T00:00:00.000Z'),
  };
}

function toNames(groups: SnapshotListGroup[]): [string, string[]][] {
  return groups.map((group) => [
    group.kind,
    group.entries.map((entry) => entry.snapshot.characterName),
  ]);
}

describe('When the characters and stashes list is grouped', () => {
  it('If it holds shared stashes and characters, Then the shared stashes come first', () => {
    // Arrange
    const snapshots = [
      buildSnapshot('Runewords', 'd2s'),
      buildSnapshot('Shared Stash Softcore', 'd2i'),
      buildSnapshot('Sinsin', 'd2s'),
    ];
    const characters = [buildCharacter('Runewords', 1), buildCharacter('Sinsin', 93)];

    // Act
    const groups = groupSnapshotList(snapshots, characters);

    // Assert
    expect(toNames(groups)).toEqual([
      ['sharedStashes', ['Shared Stash Softcore']],
      ['characters', ['Sinsin', 'Runewords']],
    ]);
  });

  it('If characters have different levels, Then the highest level comes first', () => {
    // Arrange
    const snapshots = [
      buildSnapshot('Alpha', 'd2s'),
      buildSnapshot('Bravo', 'd2s'),
      buildSnapshot('Charlie', 'd2s'),
    ];
    const characters = [
      buildCharacter('Alpha', 81),
      buildCharacter('Bravo', 93),
      buildCharacter('Charlie', 1),
    ];

    // Act
    const groups = groupSnapshotList(snapshots, characters);

    // Assert
    expect(toNames(groups)).toEqual([['characters', ['Bravo', 'Alpha', 'Charlie']]]);
  });

  it('If characters share a level, Then they are ordered by name regardless of case', () => {
    // Arrange
    const snapshots = [
      buildSnapshot('Keys', 'd2s'),
      buildSnapshot('JEWELS', 'd2s'),
      buildSnapshot('Gems', 'd2s'),
    ];
    const characters = [
      buildCharacter('Keys', 1),
      buildCharacter('JEWELS', 1),
      buildCharacter('Gems', 1),
    ];

    // Act
    const groups = groupSnapshotList(snapshots, characters);

    // Assert
    expect(toNames(groups)).toEqual([['characters', ['Gems', 'JEWELS', 'Keys']]]);
  });

  it('If a character save is not a tracked character, Then it comes after the tracked ones', () => {
    // Arrange
    const snapshots = [buildSnapshot('Untracked', 'd2s'), buildSnapshot('Zed', 'd2s')];
    const characters = [buildCharacter('Zed', 1)];

    // Act
    const groups = groupSnapshotList(snapshots, characters);

    // Assert
    expect(toNames(groups)).toEqual([['characters', ['Zed', 'Untracked']]]);
  });

  it('If characters share a level and some saves are not tracked, Then the untracked ones still come last', () => {
    // Arrange
    const snapshots = [
      buildSnapshot('Alpha', 'd2s'),
      buildSnapshot('Zed', 'd2s'),
      buildSnapshot('Bob', 'd2s'),
      buildSnapshot('Cy', 'd2s'),
    ];
    const characters = [
      buildCharacter('Zed', 5),
      buildCharacter('Bob', 5),
      buildCharacter('Cy', 3),
    ];

    // Act
    const groups = groupSnapshotList(snapshots, characters);

    // Assert
    expect(toNames(groups)).toEqual([['characters', ['Bob', 'Zed', 'Cy', 'Alpha']]]);
  });

  it('If a tracked character is level 0, Then it ranks like an untracked save and is ordered by name among them', () => {
    // Arrange
    const snapshots = [
      buildSnapshot('Zeta', 'd2s'),
      buildSnapshot('Alpha', 'd2s'),
      buildSnapshot('Mid', 'd2s'),
    ];
    const characters = [buildCharacter('Zeta', 0), buildCharacter('Mid', 1)];

    // Act
    const groups = groupSnapshotList(snapshots, characters);

    // Assert
    expect(toNames(groups)).toEqual([['characters', ['Mid', 'Alpha', 'Zeta']]]);
  });

  it('If there are softcore and hardcore stashes, Then each softcore stash sits next to its hardcore counterpart', () => {
    // Arrange
    const snapshots = [
      buildSnapshot('Shared Stash Softcore', 'd2i'),
      buildSnapshot('Modern Shared Stash Softcore', 'd2i'),
      buildSnapshot('Shared Stash Hardcore', 'd2i'),
      buildSnapshot('Modern Shared Stash Hardcore', 'd2i'),
    ];

    // Act
    const groups = groupSnapshotList(snapshots, []);

    // Assert
    expect(toNames(groups)).toEqual([
      [
        'sharedStashes',
        [
          'Modern Shared Stash Hardcore',
          'Modern Shared Stash Softcore',
          'Shared Stash Hardcore',
          'Shared Stash Softcore',
        ],
      ],
    ]);
  });

  it('If a character is found, Then its entry carries the tracked character', () => {
    // Arrange
    const character = buildCharacter('Sinsin', 93);

    // Act
    const groups = groupSnapshotList([buildSnapshot('Sinsin', 'd2s')], [character]);

    // Assert
    expect(groups[0]?.entries[0]?.character).toBe(character);
  });

  it('If there are no snapshots, Then there are no groups', () => {
    // Arrange

    // Act
    const groups = groupSnapshotList([], []);

    // Assert
    expect(groups).toEqual([]);
  });
});
