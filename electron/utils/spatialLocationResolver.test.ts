import { describe, expect, it } from 'vitest';
import type { D2SItem } from '../types/grail';
import { resolveSpatialLocation } from './spatialLocationResolver';

describe('When resolveSpatialLocation is called', () => {
  describe('If inventory coordinates are already canonical', () => {
    it('Then coordinates are preserved as-is', () => {
      // Arrange
      const item: D2SItem = {
        location_id: 0,
        alt_position_id: 1,
        position_x: 3,
        position_y: 2,
        inv_width: 1,
        inv_height: 1,
      };

      // Act
      const result = resolveSpatialLocation({
        item,
        sourceFileType: 'd2s',
        fallbackLocation: 'inventory',
      });

      // Assert
      expect(result.gridX).toBe(3);
      expect(result.gridY).toBe(2);
    });
  });

  describe('If inventory bottom-row coordinates are off by one', () => {
    it('Then y is normalized into canonical 10x4 bounds', () => {
      // Arrange
      const item: D2SItem = {
        location_id: 0,
        alt_position_id: 1,
        position_x: 0,
        position_y: 4,
        inv_width: 1,
        inv_height: 1,
      };

      // Act
      const result = resolveSpatialLocation({
        item,
        sourceFileType: 'd2s',
        fallbackLocation: 'inventory',
      });

      // Assert
      expect(result.gridX).toBe(0);
      expect(result.gridY).toBe(3);
    });
  });

  describe('If inventory right-edge coordinates are off by one', () => {
    it('Then x is normalized into canonical 10x4 bounds', () => {
      // Arrange
      const item: D2SItem = {
        location_id: 0,
        alt_position_id: 1,
        position_x: 10,
        position_y: 0,
        inv_width: 1,
        inv_height: 1,
      };

      // Act
      const result = resolveSpatialLocation({
        item,
        sourceFileType: 'd2s',
        fallbackLocation: 'inventory',
      });

      // Assert
      expect(result.gridX).toBe(9);
      expect(result.gridY).toBe(0);
    });
  });

  describe('If inventory coordinates are truly expanded beyond canonical bounds', () => {
    it('Then coordinates remain unchanged for overflow handling', () => {
      // Arrange
      const item: D2SItem = {
        location_id: 0,
        alt_position_id: 1,
        position_x: 12,
        position_y: 4,
        inv_width: 1,
        inv_height: 1,
      };

      // Act
      const result = resolveSpatialLocation({
        item,
        sourceFileType: 'd2s',
        fallbackLocation: 'inventory',
      });

      // Assert
      expect(result.gridX).toBe(12);
      expect(result.gridY).toBe(4);
    });
  });

  describe('If location is stash', () => {
    it('Then stash coordinates are not normalized as inventory', () => {
      // Arrange
      const item: D2SItem = {
        location_id: 0,
        alt_position_id: 5,
        position_x: 10,
        position_y: 9,
        inv_width: 1,
        inv_height: 1,
      };

      // Act
      const result = resolveSpatialLocation({
        item,
        sourceFileType: 'd2s',
        fallbackLocation: 'stash',
      });

      // Assert
      expect(result.locationContext).toBe('stash');
      expect(result.gridX).toBe(10);
      expect(result.gridY).toBe(9);
    });
  });
});
