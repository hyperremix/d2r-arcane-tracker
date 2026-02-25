import { describe, expect, it } from 'vitest';
import {
  parseInventoryTextPayload,
  parseVaultTextPayload,
  serializeInventoryTextPayload,
} from './dragPayloads';

describe('When inventory drag payloads are parsed', () => {
  describe('If payload contains ISO date strings', () => {
    it('Then optional date fields are normalized to Date instances', () => {
      // Arrange
      const rawPayload = serializeInventoryTextPayload({
        fingerprint: 'fp-1',
        itemName: 'Shako',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
        lastSeenAt: new Date('2024-01-01T10:00:00.000Z'),
        vaultedAt: new Date('2024-01-01T10:01:00.000Z'),
        unvaultedAt: new Date('2024-01-01T10:02:00.000Z'),
      });

      // Act
      const parsed = parseInventoryTextPayload(rawPayload);

      // Assert
      expect(parsed?.lastSeenAt).toBeInstanceOf(Date);
      expect(parsed?.vaultedAt).toBeInstanceOf(Date);
      expect(parsed?.unvaultedAt).toBeInstanceOf(Date);
      expect(parsed?.lastSeenAt?.toISOString()).toBe('2024-01-01T10:00:00.000Z');
    });
  });

  describe('If payload contains an invalid date string', () => {
    it('Then parsing is rejected and returns undefined', () => {
      // Arrange
      const rawPayload = serializeInventoryTextPayload({
        fingerprint: 'fp-1',
        itemName: 'Shako',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
        lastSeenAt: 'not-a-date' as unknown as Date,
      });

      // Act
      const parsed = parseInventoryTextPayload(rawPayload);

      // Assert
      expect(parsed).toBeUndefined();
    });
  });
});

describe('When vault drag payloads are parsed', () => {
  describe('If payload is a plain vault item id', () => {
    it('Then parsing returns an item id with default dimensions', () => {
      // Arrange
      const rawPayload = 'vault-item-123';

      // Act
      const parsed = parseVaultTextPayload(rawPayload);

      // Assert
      expect(parsed).toEqual({
        id: 'vault-item-123',
        gridWidth: 1,
        gridHeight: 1,
      });
    });
  });
});
