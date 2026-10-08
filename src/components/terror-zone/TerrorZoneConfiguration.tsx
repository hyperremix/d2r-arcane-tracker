import type {
  TerrorZone,
  TerrorZoneValidationErrorCode,
  TerrorZoneValidationResult,
} from 'electron/types/grail';
import {
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Info,
  Loader2,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import type { MouseEvent } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TooltipProvider } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';

/**
 * Maps validation error codes from the main process to translation keys.
 */
const validationErrorKeys: Record<TerrorZoneValidationErrorCode, string> = {
  pathNotConfigured: translations.terrorZone.pathNotConfigured,
  directoryNotFound: translations.terrorZone.validationErrors.directoryNotFound,
  gameFileNotFound: translations.terrorZone.validationErrors.gameFileNotFound,
  invalidStructure: translations.terrorZone.validationErrors.invalidStructure,
  corruptedFile: translations.terrorZone.validationErrors.corruptedFile,
  unknown: translations.terrorZone.validationErrors.unknown,
};

/**
 * Sonner toast id shared by all successful writes so repeated saves update one toast.
 */
const SAVE_TOAST_ID = 'terror-zone-config-saved';

/**
 * User guide for this page, opened in the system browser.
 */
const TERROR_ZONE_GUIDE_URL =
  'https://github.com/hyperremix/d2r-arcane-tracker/blob/main/docs/TERROR_ZONE_CONFIGURATION.md';

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
 * TerrorZoneConfiguration component that serves as the main terror zone configuration page.
 * Allows users to enable/disable specific terror zones by modifying the game's desecratedzones.json file.
 * @returns {JSX.Element} The main terror zone configuration interface
 */
export function TerrorZoneConfiguration() {
  const { t } = useTranslation();
  const zoneLabelIdPrefix = useId();
  const zoneSwitchIdPrefix = useId();
  const [zones, setZones] = useState<TerrorZone[]>([]);
  const [config, setConfig] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [pendingZoneIds, setPendingZoneIds] = useState<ReadonlySet<string>>(() => new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | undefined>(undefined);
  const [isRestoring, setIsRestoring] = useState(false);
  const [validationStatus, setValidationStatus] = useState<TerrorZoneValidationResult>({
    valid: false,
    errorCode: 'pathNotConfigured',
  });
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showDisableAllDialog, setShowDisableAllDialog] = useState(false);
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

  const handleZoneToggle = useCallback(
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

  const handleEnableAll = useCallback(() => runBulkUpdate('enableAll'), [runBulkUpdate]);

  const handleConfirmDisableAll = useCallback(() => {
    setShowDisableAllDialog(false);
    return runBulkUpdate('disableAll');
  }, [runBulkUpdate]);

  const handleRestoreOriginal = useCallback(async () => {
    try {
      setIsRestoring(true);
      const result = await window.electronAPI.terrorZone.restoreOriginal();
      if (!result.success) {
        throw new Error('Failed to restore original file');
      }

      // Reload data after restore; a failed reload keeps its own load error instead of a success
      const reloaded = await loadData();
      setShowRestoreDialog(false);
      if (reloaded) {
        handleSaveSuccess(t(translations.terrorZone.feedback.restored));
      }
    } catch (err) {
      console.error('Failed to restore original:', err);
      setError(t(translations.terrorZone.errors.restoreFailed));
    } finally {
      setIsRestoring(false);
    }
  }, [handleSaveSuccess, loadData, t]);

  const handleOpenGuide = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    void window.electronAPI?.shell.openExternal(TERROR_ZONE_GUIDE_URL);
  }, []);

  // Filter zones based on search term
  const filteredZones = zones.filter(
    (zone) =>
      zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      zone.id.toString().includes(searchTerm),
  );

  // Count enabled zones (default to enabled when config flag is undefined)
  const enabledCount = zones.reduce((count, zone) => {
    return (config[zone.id] ?? true) ? count + 1 : count;
  }, 0);
  const totalCount = zones.length;

  const validationErrorMessage = validationStatus.valid
    ? undefined
    : t(validationErrorKeys[validationStatus.errorCode]);
  const showExtractionGuide = validationStatus.errorCode === 'gameFileNotFound';
  const isBulkSaving = bulkAction !== undefined;
  const isWriteInProgress = isBulkSaving || isRestoring || pendingZoneIds.size > 0;
  const areActionsDisabled = isWriteInProgress || !validationStatus.valid;

  const pageHeader = (
    <PageHeader
      title={t(translations.terrorZone.title)}
      description={t(translations.terrorZone.description)}
    />
  );

  if (isLoading) {
    return (
      <TooltipProvider>
        <PageShell>
          {pageHeader}
          <Card>
            <CardContent>
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">
                  {t(translations.terrorZone.loadingTerrorZones)}
                </div>
              </div>
            </CardContent>
          </Card>
        </PageShell>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <PageShell padded={false}>
        <div className="space-y-6 p-6">
          {pageHeader}
          <Card>
            <CardContent className="space-y-4">
              {/* Warning Alert */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{t(translations.common.warning)}</strong>{' '}
                  {t(translations.terrorZone.warning)}
                </AlertDescription>
              </Alert>

              {/* Requirements for changes to take effect in game */}
              {validationStatus.valid && (
                <Alert live="polite">
                  <Info className="h-4 w-4" />
                  <AlertTitle>{t(translations.terrorZone.requirements.title)}</AlertTitle>
                  <AlertDescription>
                    <ul className="ml-4 list-disc space-y-1">
                      <li>
                        {t(translations.terrorZone.requirements.launchWithFlags)}{' '}
                        <code className="rounded bg-muted px-1 text-foreground">
                          {t(translations.terrorZone.flagsValue)}
                        </code>
                      </li>
                      <li>{t(translations.terrorZone.requirements.restartAfterChanges)}</li>
                    </ul>
                    <a
                      href={TERROR_ZONE_GUIDE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleOpenGuide}
                      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                    >
                      {t(translations.terrorZone.requirements.openGuide)}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </AlertDescription>
                </Alert>
              )}

              {/* Validation Status */}
              {!validationStatus.valid && (
                <Alert className="border-destructive/30 bg-destructive/10">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <AlertTitle className="font-bold text-destructive">
                    {t(translations.common.error)}
                  </AlertTitle>
                  <AlertDescription className="space-y-2 text-destructive">
                    <p>{validationErrorMessage}</p>
                    {showExtractionGuide && (
                      <div>
                        <p className="font-semibold text-sm">
                          {t(translations.terrorZone.gameFilesMustBeExtracted)}
                        </p>
                        <p className="text-sm">
                          {t(translations.terrorZone.cascDescription)}
                          <strong> {t(translations.terrorZone.allFilesMustBeExtracted)}</strong>{' '}
                          {t(translations.terrorZone.launchFlags)}{' '}
                          <code className="rounded bg-background/60 px-1">
                            {t(translations.terrorZone.flagsValue)}
                          </code>{' '}
                          {t(translations.terrorZone.flagsSuffix)}
                        </p>
                        <div className="mt-2">
                          <p className="font-semibold text-sm">
                            {t(translations.terrorZone.extractionSteps)}
                          </p>
                          <ol className="mt-1 ml-4 list-decimal space-y-1 text-sm">
                            <li>
                              {t(translations.settings.itemIcons.downloadCascViewer)}{' '}
                              <a
                                href="https://www.hiveworkshop.com/threads/ladiks-casc-viewer.331540/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:decoration-2"
                              >
                                {t(translations.settings.itemIcons.ladiksCascViewer)}
                              </a>
                            </li>
                            <li>{t(translations.settings.itemIcons.openX64Version)}</li>
                            <li>{t(translations.settings.itemIcons.openStorage)}</li>
                            <li>{t(translations.settings.itemIcons.selectD2rFolder)}</li>
                            <li>{t(translations.settings.itemIcons.clickData)}</li>
                            <li>{t(translations.settings.itemIcons.clickDataExtract)}</li>
                            <li>{t(translations.settings.itemIcons.waitForExtraction)}</li>
                            <li>{t(translations.settings.itemIcons.moveFolders)}</li>
                            <li>
                              {t(translations.terrorZone.createShortcut)}{' '}
                              <code className="rounded bg-background/60 px-1 text-xs">
                                {t(translations.terrorZone.flagsValue)}
                              </code>{' '}
                              {t(translations.terrorZone.toTheTarget)}
                            </li>
                            <li>{t(translations.terrorZone.alwaysLaunchShortcut)}</li>
                          </ol>
                        </div>
                        <p className="mt-2 text-xs">
                          <strong>{t(translations.common.note)}</strong>{' '}
                          {t(translations.terrorZone.extractionNote)}
                        </p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Display */}
              {error && (
                <Alert className="border-destructive/30 bg-destructive/10">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-destructive">{error}</AlertDescription>
                </Alert>
              )}

              {/* Search and Controls */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t(translations.terrorZone.searchPlaceholder)}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground text-sm">
                    {t(translations.terrorZone.zonesEnabled, {
                      enabled: enabledCount,
                      total: totalCount,
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEnableAll}
                      disabled={areActionsDisabled}
                    >
                      {bulkAction === 'enableAll' && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      )}
                      {t(translations.terrorZone.enableAll)}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDisableAllDialog(true)}
                      disabled={areActionsDisabled}
                    >
                      {bulkAction === 'disableAll' && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      )}
                      {t(translations.terrorZone.disableAll)}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRestoreDialog(true)}
                      disabled={areActionsDisabled}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {t(translations.terrorZone.restoreOriginal)}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Zone List */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {filteredZones.map((zone) => {
                  const isPending = isBulkSaving || pendingZoneIds.has(zone.id);
                  return (
                    <div key={zone.id} className="flex flex-1 items-center gap-4">
                      <Switch
                        id={`${zoneSwitchIdPrefix}-${zone.id}`}
                        aria-labelledby={`${zoneLabelIdPrefix}-${zone.id}`}
                        aria-busy={isPending || undefined}
                        checked={config[zone.id] ?? true}
                        onCheckedChange={(checked: boolean) => handleZoneToggle(zone.id, checked)}
                        disabled={isPending || isRestoring || !validationStatus.valid}
                      />
                      <Label
                        id={`${zoneLabelIdPrefix}-${zone.id}`}
                        htmlFor={`${zoneSwitchIdPrefix}-${zone.id}`}
                        className="font-medium"
                      >
                        {zone.name}
                      </Label>
                      {isPending && (
                        <Loader2
                          className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredZones.length === 0 && searchTerm && (
                <div className="py-8 text-center text-muted-foreground">
                  {t(translations.terrorZone.noZonesFound, { searchTerm })}
                </div>
              )}

              {/* Info Text */}
              <div className="border-t pt-2 text-muted-foreground text-xs">
                {t(translations.terrorZone.infoText)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Restore Confirmation Dialog */}
        <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t(translations.terrorZone.restoreOriginalFile)}</AlertDialogTitle>
              <AlertDialogDescription>
                {t(translations.terrorZone.restoreDescription)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRestoring}>
                {t(translations.common.cancel)}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRestoreOriginal}
                disabled={isRestoring}
                variant="destructive"
              >
                {isRestoring
                  ? t(translations.terrorZone.restoring)
                  : t(translations.terrorZone.restoreOriginal)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Disable All Confirmation Dialog */}
        <AlertDialog open={showDisableAllDialog} onOpenChange={setShowDisableAllDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t(translations.terrorZone.disableAllDialog.title)}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(translations.terrorZone.disableAllDialog.description)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t(translations.common.cancel)}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDisableAll} variant="destructive">
                {t(translations.terrorZone.disableAll)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageShell>
    </TooltipProvider>
  );
}
