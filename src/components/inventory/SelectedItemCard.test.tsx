import { render, screen } from '@testing-library/react';
import type { ParsedInventoryItem } from 'electron/types/inventory';
import { describe, expect, it, vi } from 'vitest';
import { SelectedItemCard } from './SelectedItemCard';

const ITEM: ParsedInventoryItem = {
  fingerprint: 'fingerprint-1',
  characterName: 'Sorc',
  sourceFileType: 'd2s',
  sourceFilePath: '/saves/Sorc.d2s',
  locationContext: 'inventory',
  itemName: 'El Rune',
  quality: 'normal',
  ethereal: false,
  socketCount: 0,
  rawItemJson: '{}',
  seenAt: new Date('2026-01-01T00:00:00Z'),
};

describe('When the selected item card shows the vault presence of an item', () => {
  it('If the item is present in the vault, Then the Present badge uses the success variant', () => {
    // Arrange
    const onVault = vi.fn();

    // Act
    render(<SelectedItemCard item={ITEM} isVaultPresent isVaulting={false} onVault={onVault} />);

    // Assert
    const badge = screen.getByText('Present');
    expect(badge).toHaveClass('bg-success/15', 'text-success');
    expect(badge).not.toHaveClass('bg-primary');
  });
});
