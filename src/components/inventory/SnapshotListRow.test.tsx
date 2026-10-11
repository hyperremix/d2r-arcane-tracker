import { render, screen } from '@testing-library/react';
import type { Character, CharacterInventorySnapshot } from 'electron/types/grail';
import { describe, expect, it, vi } from 'vitest';
import { findSnapshotCharacter, SnapshotListRow } from './SnapshotListRow';

function buildSnapshot(sourceFileType: string): CharacterInventorySnapshot {
  return {
    characterName: 'Shared',
    sourceFileType,
    items: [],
  } as unknown as CharacterInventorySnapshot;
}

function renderRow(snapshot: CharacterInventorySnapshot) {
  return render(
    <SnapshotListRow
      snapshot={snapshot}
      onOpen={vi.fn()}
      onDragOver={vi.fn()}
      onDragLeave={vi.fn()}
      onDrop={vi.fn()}
    />,
  );
}

describe('When a shared stash snapshot row is rendered', () => {
  it.each([
    'd2i',
    'sss',
    'd2x',
  ])('If the file type is %s, Then it is labelled as a shared stash with the stash icon', (sourceFileType) => {
    // Arrange
    const snapshot = buildSnapshot(sourceFileType);

    // Act
    const { container } = renderRow(snapshot);

    // Assert
    expect(screen.getByText('Shared stash')).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-package')).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-user')).not.toBeInTheDocument();
  });

  it('If the file type is unknown, Then it keeps the generic person icon', () => {
    // Arrange
    const snapshot = buildSnapshot('mystery');

    // Act
    const { container } = renderRow(snapshot);

    // Assert
    expect(container.querySelector('svg.lucide-user')).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-package')).not.toBeInTheDocument();
  });
});

function buildCharacter(overrides: Partial<Character>): Character {
  return {
    id: 'char-1',
    name: 'Sorc',
    characterClass: 'sorceress',
    level: 90,
    hardcore: false,
    expansion: true,
    lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
    created: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildCharacterSnapshot(
  overrides: Partial<CharacterInventorySnapshot>,
): CharacterInventorySnapshot {
  return {
    characterName: 'Sorc',
    characterId: 'char-1',
    sourceFileType: 'd2s',
    items: [],
    ...overrides,
  } as unknown as CharacterInventorySnapshot;
}

describe('When the tracked character of a snapshot is looked up', () => {
  it('If the character id matches, Then that character is returned even when the name differs', () => {
    // Arrange
    const byId = buildCharacter({ id: 'char-1', name: 'Renamed' });
    const byName = buildCharacter({ id: 'char-2', name: 'Sorc' });

    // Act
    const result = findSnapshotCharacter(buildCharacterSnapshot({}), [byName, byId]);

    // Assert
    expect(result).toBe(byId);
  });

  it('If only the name matches, Then the character is found by name', () => {
    // Arrange
    const byName = buildCharacter({ id: 'char-2', name: 'Sorc' });
    const snapshot = buildCharacterSnapshot({ characterId: 'unknown-id' });

    // Act
    const result = findSnapshotCharacter(snapshot, [byName]);

    // Assert
    expect(result).toBe(byName);
  });

  it('If the snapshot has no character id, Then the character is found by name', () => {
    // Arrange
    const byName = buildCharacter({ id: 'char-2', name: 'Sorc' });
    const snapshot = buildCharacterSnapshot({ characterId: undefined });

    // Act
    const result = findSnapshotCharacter(snapshot, [byName]);

    // Assert
    expect(result).toBe(byName);
  });

  it('If the matching entry is a shared stash, Then no character is returned', () => {
    // Arrange
    const sharedStash = buildCharacter({
      id: 'char-1',
      name: 'Sorc',
      characterClass: 'shared_stash',
    });

    // Act
    const result = findSnapshotCharacter(buildCharacterSnapshot({}), [sharedStash]);

    // Assert
    expect(result).toBeUndefined();
  });

  it('If the snapshot is a shared stash file, Then no character is returned', () => {
    // Arrange
    const snapshot = buildCharacterSnapshot({ sourceFileType: 'd2i' });

    // Act
    const result = findSnapshotCharacter(snapshot, [buildCharacter({})]);

    // Assert
    expect(result).toBeUndefined();
  });

  it('If the file type is written in upper case, Then it still counts as a character save', () => {
    // Arrange
    const character = buildCharacter({});
    const snapshot = buildCharacterSnapshot({ sourceFileType: ' D2S ' as 'd2s' });

    // Act
    const result = findSnapshotCharacter(snapshot, [character]);

    // Assert
    expect(result).toBe(character);
  });
});
