import { act, renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTerrorZoneConfig } from './useTerrorZoneConfig';

const windowGlobals = window as unknown as { electronAPI: unknown };
const originalElectronAPI = windowGlobals.electronAPI;

const zones = [
  { id: '1', name: 'Blood Moor', levels: [] },
  { id: '2', name: 'Cold Plains', levels: [] },
];

function setupTerrorZoneApi(overrides: Record<string, unknown> = {}) {
  const terrorZone = {
    validatePath: vi.fn().mockResolvedValue({ valid: true, path: '/d2r' }),
    getZones: vi.fn().mockResolvedValue(zones),
    getConfig: vi.fn().mockResolvedValue({ '2': false }),
    updateConfig: vi.fn().mockResolvedValue({ success: true, requiresRestart: true }),
    restoreOriginal: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
  windowGlobals.electronAPI = { terrorZone };
  return terrorZone;
}

describe('When useTerrorZoneConfig is used', () => {
  beforeEach(() => {
    vi.spyOn(toast, 'success').mockImplementation(() => 'toast-id');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    windowGlobals.electronAPI = originalElectronAPI;
    vi.mocked(toast.success).mockRestore();
    vi.mocked(console.error).mockRestore();
  });

  describe('If the game installation is valid', () => {
    it('Then it loads the zones with an explicit state for every zone', async () => {
      // Arrange
      setupTerrorZoneApi();

      // Act
      const { result } = renderHook(() => useTerrorZoneConfig());

      // Assert
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.zones).toEqual(zones);
      expect(result.current.config).toEqual({ '1': true, '2': false });
      expect(result.current.validationStatus.valid).toBe(true);
    });
  });

  describe('If a zone is toggled and the write fails', () => {
    it('Then the zone is rolled back and the error is set', async () => {
      // Arrange
      setupTerrorZoneApi({ updateConfig: vi.fn().mockResolvedValue({ success: false }) });
      const { result } = renderHook(() => useTerrorZoneConfig());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(() => result.current.toggleZone('1', false));

      // Assert
      expect(result.current.config['1']).toBe(true);
      expect(result.current.error).toBe('Failed to update terror zone configuration');
      expect(result.current.pendingZoneIds.size).toBe(0);
    });
  });

  describe('If the original file is restored', () => {
    it('Then it resolves to true and reloads the zones', async () => {
      // Arrange
      const api = setupTerrorZoneApi();
      const { result } = renderHook(() => useTerrorZoneConfig());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      let restored: boolean | undefined;
      await act(async () => {
        restored = await result.current.restoreOriginal();
      });

      // Assert
      expect(restored).toBe(true);
      expect(api.getZones).toHaveBeenCalledTimes(2);
      expect(result.current.isRestoring).toBe(false);
    });

    it('Then it resolves to false and sets the error if restoring fails', async () => {
      // Arrange
      setupTerrorZoneApi({ restoreOriginal: vi.fn().mockResolvedValue({ success: false }) });
      const { result } = renderHook(() => useTerrorZoneConfig());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      let restored: boolean | undefined;
      await act(async () => {
        restored = await result.current.restoreOriginal();
      });

      // Assert
      expect(restored).toBe(false);
      expect(result.current.error).toBe('Failed to restore original file');
    });
  });
});
