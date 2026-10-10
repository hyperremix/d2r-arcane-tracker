import { render, screen } from '@testing-library/react';
import type { VaultItem } from 'electron/types/grail';
import { describe, expect, it, vi } from 'vitest';
import { SelectedVaultItemPanel } from './SelectedVaultItemPanel';

const RUNE_ROW = {
  id: 'vault-rune',
  itemName: 'El Rune',
  sourceFilePath: '/saves/Sorc.d2s',
  sourceFileType: 'd2s',
  locationContext: 'inventory',
  gridX: 1,
  gridY: 2,
  stackCount: 2,
  rawItemJson: '{"code":"r01","quantity":2}',
} as VaultItem;

describe('When the selected vault item panel is rendered', () => {
  it('If the row is the stack that was taken out, Then it offers to put it back', () => {
    // Arrange / Act
    render(<SelectedVaultItemPanel item={RUNE_ROW} isUnvaulting={false} onUnvault={vi.fn()} />);

    // Assert
    expect(screen.getByRole('button', { name: 'Put back where it was' })).toBeInTheDocument();
  });

  it('If the row is a stack that other stacks were merged into, Then it shows the drag hint instead of a put-back button', () => {
    // Arrange
    const mergedRow = { ...RUNE_ROW, stackCount: 5 } as VaultItem;

    // Act
    render(<SelectedVaultItemPanel item={mergedRow} isUnvaulting={false} onUnvault={vi.fn()} />);

    // Assert
    expect(screen.queryByRole('button', { name: 'Put back where it was' })).not.toBeInTheDocument();
    expect(screen.getByText(/drag the item onto a free spot/)).toBeInTheDocument();
  });
});
