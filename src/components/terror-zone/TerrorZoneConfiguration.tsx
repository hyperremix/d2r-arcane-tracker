import type {
  TerrorZone,
  TerrorZoneValidationErrorCode,
  TerrorZoneValidationResult,
} from 'electron/types/grail';
import { AlertCircle, AlertTriangle, RotateCcw, Search, XCircle } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [isSaving, setIsSaving] = useState(false);
  const [validationStatus, setValidationStatus] = useState<TerrorZoneValidationResult>({
    valid: false,
    errorCode: 'pathNotConfigured',
  });
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate path first
      const validation = await window.electronAPI.terrorZone.validatePath();
      setValidationStatus(validation);

      if (!validation.valid) {
        // Don't set error state for path validation issues - they're shown in the validation alert
        return;
      }

      // Load zones and config in parallel
      const [zonesData, configData] = await Promise.all([
        window.electronAPI.terrorZone.getZones(),
        window.electronAPI.terrorZone.getConfig(),
      ]);

      setZones(zonesData);
      setConfig(configData);
    } catch (err) {
      console.error('Failed to load terror zone data:', err);
      setError(t(translations.terrorZone.errors.loadFailed));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Load zones and configuration on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleZoneToggle = useCallback(
    async (zoneId: string, enabled: boolean) => {
      try {
        setIsSaving(true);
        const newConfig = { ...config, [zoneId]: enabled };
        setConfig(newConfig);

        const result = await window.electronAPI.terrorZone.updateConfig(newConfig);
        if (!result.success) {
          throw new Error('Failed to update terror zone configuration');
        }
      } catch (err) {
        console.error('Failed to update zone:', err);
        setError(t(translations.terrorZone.errors.updateFailed));
        // Revert the change
        setConfig(config);
      } finally {
        setIsSaving(false);
      }
    },
    [config, t],
  );

  const handleEnableAll = useCallback(async () => {
    try {
      setIsSaving(true);
      const newConfig: Record<string, boolean> = {};
      zones.forEach((zone) => {
        newConfig[zone.id] = true;
      });
      setConfig(newConfig);

      const result = await window.electronAPI.terrorZone.updateConfig(newConfig);
      if (!result.success) {
        throw new Error('Failed to enable all zones');
      }
    } catch (err) {
      console.error('Failed to enable all zones:', err);
      setError(t(translations.terrorZone.errors.enableAllFailed));
      setConfig(config);
    } finally {
      setIsSaving(false);
    }
  }, [zones, config, t]);

  const handleDisableAll = useCallback(async () => {
    try {
      setIsSaving(true);
      const newConfig: Record<string, boolean> = {};
      zones.forEach((zone) => {
        newConfig[zone.id] = false;
      });
      setConfig(newConfig);

      const result = await window.electronAPI.terrorZone.updateConfig(newConfig);
      if (!result.success) {
        throw new Error('Failed to disable all zones');
      }
    } catch (err) {
      console.error('Failed to disable all zones:', err);
      setError(t(translations.terrorZone.errors.disableAllFailed));
      setConfig(config);
    } finally {
      setIsSaving(false);
    }
  }, [zones, config, t]);

  const handleRestoreOriginal = useCallback(async () => {
    try {
      setIsSaving(true);
      const result = await window.electronAPI.terrorZone.restoreOriginal();
      if (!result.success) {
        throw new Error('Failed to restore original file');
      }

      // Reload data after restore
      await loadData();
      setShowRestoreDialog(false);
    } catch (err) {
      console.error('Failed to restore original:', err);
      setError(t(translations.terrorZone.errors.restoreFailed));
    } finally {
      setIsSaving(false);
    }
  }, [loadData, t]);

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

  if (isLoading) {
    return (
      <TooltipProvider>
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5" />
                  {t(translations.terrorZone.title)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">
                    {t(translations.terrorZone.loadingTerrorZones)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5" />
                {t(translations.terrorZone.title)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Warning Alert */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{t(translations.common.warning)}</strong>{' '}
                  {t(translations.terrorZone.warning)}
                </AlertDescription>
              </Alert>

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
                      disabled={isSaving || !validationStatus.valid}
                    >
                      {t(translations.terrorZone.enableAll)}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisableAll}
                      disabled={isSaving || !validationStatus.valid}
                    >
                      {t(translations.terrorZone.disableAll)}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRestoreDialog(true)}
                      disabled={isSaving || !validationStatus.valid}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {t(translations.terrorZone.restoreOriginal)}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Zone List */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {filteredZones.map((zone) => (
                  <div key={zone.id} className="flex flex-1 items-center gap-4">
                    <Switch
                      id={`${zoneSwitchIdPrefix}-${zone.id}`}
                      aria-labelledby={`${zoneLabelIdPrefix}-${zone.id}`}
                      checked={config[zone.id] ?? true}
                      onCheckedChange={(checked: boolean) => handleZoneToggle(zone.id, checked)}
                      disabled={isSaving || !validationStatus.valid}
                    />
                    <Label
                      id={`${zoneLabelIdPrefix}-${zone.id}`}
                      htmlFor={`${zoneSwitchIdPrefix}-${zone.id}`}
                      className="font-medium"
                    >
                      {zone.name}
                    </Label>
                  </div>
                ))}
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
              <AlertDialogCancel disabled={isSaving}>
                {t(translations.common.cancel)}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRestoreOriginal}
                disabled={isSaving}
                variant="destructive"
              >
                {isSaving
                  ? t(translations.terrorZone.restoring)
                  : t(translations.terrorZone.restoreOriginal)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
