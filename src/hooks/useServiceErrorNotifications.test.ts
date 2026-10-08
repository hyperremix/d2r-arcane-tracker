import { renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { useServiceErrorNotifications } from './useServiceErrorNotifications';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

type ServiceErrorListener = (payload: unknown) => void;

interface ToastAction {
  label: string;
  onClick: () => void;
}

let listener: ServiceErrorListener | undefined;
const mockUnsubscribe = vi.fn();
const mockElectronAPI = {
  data: {
    onServiceError: vi.fn((callback: ServiceErrorListener) => {
      listener = callback;
      return mockUnsubscribe;
    }),
  },
};
const mockClipboard = { writeText: vi.fn() };

const originalElectronAPI: unknown = window.electronAPI;
const originalClipboard = navigator.clipboard;

// Assign rather than redefine: other suites define `window.electronAPI` as non-configurable.
function setElectronAPI(value: unknown) {
  (window as unknown as { electronAPI: unknown }).electronAPI = value;
}

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, writable: true, configurable: true });
}

function emit(payload: unknown) {
  if (!listener) {
    throw new Error('Service error listener was not registered');
  }
  listener(payload);
}

function lastToastOptions(mock: unknown) {
  const calls = vi.mocked(mock as (...args: unknown[]) => unknown).mock.calls;
  return calls[calls.length - 1][1] as {
    id: string;
    description: string;
    duration: number;
    closeButton: boolean;
    action: ToastAction;
  };
}

const parseErrorPayload = {
  service: 'ItemDetection',
  operation: 'extractItemsFromSaveFile',
  severity: 'error',
  code: 'saveFileParseFailed',
  params: { fileName: 'Sorceress.d2s' },
  detail: 'Unexpected end of buffer',
  timestamp: Date.UTC(2026, 0, 1),
};

describe('When useServiceErrorNotifications is used', () => {
  let consoleWarnSpy: MockInstance;
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    listener = undefined;
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setElectronAPI(mockElectronAPI);
    setClipboard(mockClipboard);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
    setClipboard(originalClipboard);
  });

  describe('If a known error code is received', () => {
    it('Then shows a translated, persistent error toast deduplicated by service operation', () => {
      // Arrange
      renderHook(() => useServiceErrorNotifications({ onOpenSettings: vi.fn() }));

      // Act
      emit(parseErrorPayload);

      // Assert
      expect(toast.error).toHaveBeenCalledWith('Could not read save file', expect.any(Object));
      const options = lastToastOptions(toast.error);
      expect(options.id).toBe('ItemDetection.extractItemsFromSaveFile');
      expect(options.description).toBe(
        '"Sorceress.d2s" could not be parsed, so its items were not updated. Check your save file directory in Settings.',
      );
      expect(options.duration).toBe(Number.POSITIVE_INFINITY);
      expect(options.closeButton).toBe(true);
    });

    it('Then reuses the same toast id when the same operation fails again', () => {
      // Arrange
      renderHook(() => useServiceErrorNotifications({ onOpenSettings: vi.fn() }));

      // Act
      emit(parseErrorPayload);
      emit({ ...parseErrorPayload, params: { fileName: 'Paladin.d2s' }, timestamp: Date.now() });

      // Assert
      const ids = vi.mocked(toast.error).mock.calls.map((call) => (call[1] as { id: string }).id);
      expect(ids).toEqual([
        'ItemDetection.extractItemsFromSaveFile',
        'ItemDetection.extractItemsFromSaveFile',
      ]);
    });
  });

  describe('If a save file parse error action is clicked', () => {
    it('Then opens the settings', () => {
      // Arrange
      const onOpenSettings = vi.fn();
      renderHook(() => useServiceErrorNotifications({ onOpenSettings }));
      emit(parseErrorPayload);
      const { action } = lastToastOptions(toast.error);

      // Act
      action.onClick();

      // Assert
      expect(action.label).toBe('Open Settings');
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('If a database write error action is clicked', () => {
    it('Then copies the technical details to the clipboard and confirms it', async () => {
      // Arrange
      mockClipboard.writeText.mockResolvedValue(undefined);
      renderHook(() => useServiceErrorNotifications({ onOpenSettings: vi.fn() }));
      emit({
        service: 'DatabaseBatchWriter',
        operation: 'flush',
        severity: 'error',
        code: 'databaseWriteFailed',
        detail: 'SQLITE_BUSY: database is locked',
        timestamp: Date.UTC(2026, 0, 1),
      });
      const { action } = lastToastOptions(toast.error);

      // Act
      action.onClick();

      // Assert
      expect(action.label).toBe('Copy details');
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith('Details copied to clipboard', {
          id: 'serviceErrors.copyDetails',
        }),
      );
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        [
          '[DatabaseBatchWriter.flush] databaseWriteFailed (error)',
          'Time: 2026-01-01T00:00:00.000Z',
          'Detail: SQLITE_BUSY: database is locked',
        ].join('\n'),
      );
    });

    it('Then shows an error toast with a stable id if copying fails', async () => {
      // Arrange
      mockClipboard.writeText.mockRejectedValue(new Error('denied'));
      renderHook(() => useServiceErrorNotifications({ onOpenSettings: vi.fn() }));
      emit({ ...parseErrorPayload, code: 'databaseWriteFailed', operation: 'flush' });
      const { action } = lastToastOptions(toast.error);

      // Act
      action.onClick();

      // Assert
      await waitFor(() =>
        expect(toast.error).toHaveBeenLastCalledWith('Failed to copy details to clipboard', {
          id: 'serviceErrors.copyDetails',
        }),
      );
    });

    it('Then reuses the same toast id when copying fails repeatedly', async () => {
      // Arrange
      mockClipboard.writeText.mockRejectedValue(new Error('denied'));
      renderHook(() => useServiceErrorNotifications({ onOpenSettings: vi.fn() }));
      emit({ ...parseErrorPayload, code: 'databaseWriteFailed', operation: 'flush' });
      const { action } = lastToastOptions(toast.error);

      // Act
      action.onClick();
      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2));
      action.onClick();
      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(3));

      // Assert
      const copyFailureIds = vi
        .mocked(toast.error)
        .mock.calls.slice(1)
        .map((call) => (call[1] as { id: string }).id);
      expect(copyFailureIds).toEqual(['serviceErrors.copyDetails', 'serviceErrors.copyDetails']);
    });
  });

  describe('If an unknown error code is received', () => {
    it('Then shows the fallback copy with a copy details action', () => {
      // Arrange
      renderHook(() => useServiceErrorNotifications({ onOpenSettings: vi.fn() }));

      // Act
      emit({ ...parseErrorPayload, code: 'somethingNew' });

      // Assert
      expect(toast.error).toHaveBeenCalledWith('A background task failed', expect.any(Object));
      expect(lastToastOptions(toast.error).action.label).toBe('Copy details');
    });
  });

  describe('If a malformed payload is received', () => {
    it.each([
      ['a string', 'Failed to parse save file'],
      [
        'a legacy message payload',
        { service: 'X', operation: 'y', severity: 'error', message: 'm' },
      ],
      ['an invalid severity', { ...parseErrorPayload, severity: 'fatal' }],
      ['an unsupported warn severity', { ...parseErrorPayload, severity: 'warn' }],
    ])('Then ignores %s without showing a toast', (_label, payload) => {
      // Arrange
      renderHook(() => useServiceErrorNotifications({ onOpenSettings: vi.fn() }));

      // Act
      emit(payload);

      // Assert
      expect(toast.error).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('If the hook unmounts', () => {
    it('Then removes the service error listener', () => {
      // Arrange
      const { unmount } = renderHook(() =>
        useServiceErrorNotifications({ onOpenSettings: vi.fn() }),
      );

      // Act
      unmount();

      // Assert
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
