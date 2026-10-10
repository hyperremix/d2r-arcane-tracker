import type { TerrorZone, TerrorZoneValidationResult } from 'electron/types/grail';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { translations } from '@/i18n/translations';

/**
 * Sonner toast id shared by all successful writes so repeated saves update one toast.
 */
const SAVE_TOAST_ID = 'terror-zone-config-saved';

type BulkAction = 'enableAll' | 'disableAll';

/**
 * A write that has been queued but has not started yet. Changes made while it waits share it.
 */
interface QueuedWrite {
  zoneIds: Set<string>;
  promise: Promise<void>;
}

/**
 * Builds a configuration with an explicit enabled state for every zone.
 */
function buildConfig(
  zones: TerrorZone[],
  isEnabled: (zone: TerrorZone) => boolean,
): Record<string, boolean> {
  return Object.fromEntries(zones.map((zone) => [zone.id, isEnabled(zone)]));
}

/**
 * Loads the terror zones and their configuration, and writes changes to the game file.
 * Changes are shown optimistically; writes run one after another and roll back the zones they
 * covered if they fail. Successful writes show a toast, failures set `error`.
 */
export function useTerrorZoneConfig() {
  const { t } = useTranslation();
  const [zones, setZones] = useState<TerrorZone[]>([]);
  const [config, setConfig] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [pendingZoneIds, setPendingZoneIds] = useState<ReadonlySet<string>>(() => new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | undefined>(undefined);
  const [isRestoring, setIsRestoring] = useState(false);
  const [validationStatus, setValidationStatus] = useState<TerrorZoneValidationResult>({
    valid: false,
    errorCode: 'pathNotConfigured',
  });
  const [error, setError] = useState<string | undefined>(undefined);

  // The configuration the user wants (shown optimistically) and the last one written successfully.
  const desiredConfigRef = useRef<Record<string, boolean>>({});
  const persistedConfigRef = useRef<Record<string, boolean>>({});
  // Writes replace the whole game file, so they run one after another.
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const queuedWriteRef = useRef<QueuedWrite | undefined>(undefined);

  const applyConfig = useCallback((nextConfig: Record<string, boolean>) => {
    desiredConfigRef.current = nextConfig;
    setConfig(nextConfig);
  }, []);

  /**
   * Loads the validation status, zones and configuration.
   * Resolves to `false` when loading failed (the load error is shown), otherwise `true`.
   */
  const loadData = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(undefined);

      // Validate path first
      const validation = await window.electronAPI.terrorZone.validatePath();
      setValidationStatus(validation);

      if (!validation.valid) {
        // Don't set error state for path validation issues - they're shown in the validation alert
        return true;
      }

      // Load zones and config in parallel
      const [zonesData, configData] = await Promise.all([
        window.electronAPI.terrorZone.getZones(),
        window.electronAPI.terrorZone.getConfig(),
      ]);

      // Store an explicit state for every zone: the main process only keeps zones marked `true`,
      // while zones without a stored flag are enabled in the game file.
      const loadedConfig = buildConfig(zonesData, (zone) => configData[zone.id] ?? true);
      setZones(zonesData);
      persistedConfigRef.current = loadedConfig;
      applyConfig(loadedConfig);
      return true;
    } catch (err) {
      console.error('Failed to load terror zone data:', err);
      setError(t(translations.terrorZone.errors.loadFailed));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [applyConfig, t]);

  // Load zones and configuration on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Queues a write of the desired configuration to the game file for the given zones.
   * The configuration is read when the write starts, so changes made while an earlier write is
   * running share the next queued write and its result. If that write fails, the zones it covered
   * are rolled back to their last saved state before the next write starts.
   * Resolves once the write succeeds and rejects if it fails.
   */
  const persistDesiredConfig = useCallback(
    (zoneIds: string[]): Promise<void> => {
      const queued = queuedWriteRef.current;
      if (queued) {
        for (const zoneId of zoneIds) {
          queued.zoneIds.add(zoneId);
        }
        return queued.promise;
      }

      const coveredZoneIds = new Set(zoneIds);
      const promise = writeQueueRef.current.then(async () => {
        queuedWriteRef.current = undefined;
        const snapshot = desiredConfigRef.current;
        try {
          const result = await window.electronAPI.terrorZone.updateConfig(snapshot);
          if (!result.success) {
            throw new Error('Failed to update terror zone configuration');
          }
          persistedConfigRef.current = snapshot;
        } catch (err) {
          console.error('Failed to update terror zone configuration:', err);
          const rolledBack = { ...desiredConfigRef.current };
          for (const zoneId of coveredZoneIds) {
            rolledBack[zoneId] = persistedConfigRef.current[zoneId] ?? true;
          }
          applyConfig(rolledBack);
          throw err;
        }
      });
      queuedWriteRef.current = { zoneIds: coveredZoneIds, promise };
      writeQueueRef.current = promise.catch(() => undefined);
      return promise;
    },
    [applyConfig],
  );

  const handleSaveSuccess = useCallback(
    (title: string) => {
      setError(undefined);
      toast.success(title, {
        id: SAVE_TOAST_ID,
        description: t(translations.terrorZone.feedback.restartToApply, {
          flags: t(translations.terrorZone.flagsValue),
        }),
      });
    },
    [t],
  );

  /** Enables or disables a single zone. */
  const toggleZone = useCallback(
    async (zoneId: string, enabled: boolean) => {
      setPendingZoneIds((previous) => new Set(previous).add(zoneId));
      applyConfig({ ...desiredConfigRef.current, [zoneId]: enabled });

      try {
        await persistDesiredConfig([zoneId]);
        handleSaveSuccess(t(translations.terrorZone.feedback.saved));
      } catch {
        setError(t(translations.terrorZone.errors.updateFailed));
      } finally {
        setPendingZoneIds((previous) => {
          const next = new Set(previous);
          next.delete(zoneId);
          return next;
        });
      }
    },
    [applyConfig, handleSaveSuccess, persistDesiredConfig, t],
  );

  /** Enables or disables all zones at once. */
  const runBulkUpdate = useCallback(
    async (action: BulkAction) => {
      const enabled = action === 'enableAll';
      setBulkAction(action);
      applyConfig(buildConfig(zones, () => enabled));

      try {
        await persistDesiredConfig(zones.map((zone) => zone.id));
        handleSaveSuccess(t(translations.terrorZone.feedback.saved));
      } catch {
        setError(
          t(
            enabled
              ? translations.terrorZone.errors.enableAllFailed
              : translations.terrorZone.errors.disableAllFailed,
          ),
        );
      } finally {
        setBulkAction(undefined);
      }
    },
    [applyConfig, handleSaveSuccess, persistDesiredConfig, t, zones],
  );

  /**
   * Restores the original game file and reloads the zones.
   * Resolves to `true` once the file was restored (even if reloading failed), `false` otherwise.
   */
  const restoreOriginal = useCallback(async (): Promise<boolean> => {
    try {
      setIsRestoring(true);
      const result = await window.electronAPI.terrorZone.restoreOriginal();
      if (!result.success) {
        throw new Error('Failed to restore original file');
      }

      // Reload data after restore; a failed reload keeps its own load error instead of a success
      const reloaded = await loadData();
      if (reloaded) {
        handleSaveSuccess(t(translations.terrorZone.feedback.restored));
      }
      return true;
    } catch (err) {
      console.error('Failed to restore original:', err);
      setError(t(translations.terrorZone.errors.restoreFailed));
      return false;
    } finally {
      setIsRestoring(false);
    }
  }, [handleSaveSuccess, loadData, t]);

  return {
    zones,
    config,
    isLoading,
    pendingZoneIds,
    bulkAction,
    isRestoring,
    validationStatus,
    error,
    toggleZone,
    runBulkUpdate,
    restoreOriginal,
  };
}
