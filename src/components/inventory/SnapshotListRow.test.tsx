import { render, screen } from '@testing-library/react';
import type { CharacterInventorySnapshot } from 'electron/types/grail';
import { describe, expect, it, vi } from 'vitest';
import { SnapshotListRow } from './SnapshotListRow';

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
