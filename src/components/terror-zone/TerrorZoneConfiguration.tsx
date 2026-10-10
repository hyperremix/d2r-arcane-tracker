import type { TerrorZone, TerrorZoneValidationErrorCode } from 'electron/types/grail';
import {
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  XCircle,
} from 'lucide-react';
import type { MouseEvent } from 'react';
import { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
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
import { groupTerrorZonesByAct } from './terrorZoneActs';
import { useTerrorZoneConfig } from './useTerrorZoneConfig';

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
 * Validation errors that are fixed by changing the D2R installation path in Settings.
 */
const installationPathErrorCodes: ReadonlySet<TerrorZoneValidationErrorCode> = new Set([
  'pathNotConfigured',
  'directoryNotFound',
]);

/**
 * User guide for this page, opened in the system browser.
 */
const TERROR_ZONE_GUIDE_URL =
  'https://github.com/hyperremix/d2r-arcane-tracker/blob/main/docs/TERROR_ZONE_CONFIGURATION.md';

/**
 * TerrorZoneConfiguration component that serves as the main terror zone configuration page.
 * Allows users to enable/disable specific terror zones by modifying the game's desecratedzones.json file.
 * @returns {JSX.Element} The main terror zone configuration interface
 */
export function TerrorZoneConfiguration() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const zoneLabelIdPrefix = useId();
  const zoneSwitchIdPrefix = useId();
  const actHeadingIdPrefix = useId();
  const searchInputId = useId();
  const {
    zones,
    config,
    isLoading,
    pendingZoneIds,
    bulkAction,
    isRestoring,
    validationStatus,
    error,
    hasChangesToApply,
    toggleZone,
    runBulkUpdate,
    restoreOriginal,
  } = useTerrorZoneConfig();
  const [searchTerm, setSearchTerm] = useState('');
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showDisableAllDialog, setShowDisableAllDialog] = useState(false);

  const handleEnableAll = useCallback(() => runBulkUpdate('enableAll'), [runBulkUpdate]);

  const handleConfirmDisableAll = useCallback(() => {
    setShowDisableAllDialog(false);
    return runBulkUpdate('disableAll');
  }, [runBulkUpdate]);

  const handleRestoreOriginal = useCallback(async () => {
    if (await restoreOriginal()) {
      setShowRestoreDialog(false);
    }
  }, [restoreOriginal]);

  const handleOpenGuide = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    void window.electronAPI?.shell.openExternal(TERROR_ZONE_GUIDE_URL);
  }, []);

  // Filter zones based on search term, then group them by act
  const filteredZones = zones.filter(
    (zone) =>
      zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      zone.id.toString().includes(searchTerm),
  );
  const zoneGroups = groupTerrorZonesByAct(filteredZones);
  // Zones without a known act only get an "Other zones" heading when acts are shown next to them
  const showGroupHeadings = zoneGroups.some((group) => group.act !== undefined);

  // Count enabled zones (default to enabled when config flag is undefined)
  const enabledCount = zones.reduce((count, zone) => {
    return (config[zone.id] ?? true) ? count + 1 : count;
  }, 0);
  const totalCount = zones.length;

  const validationErrorMessage = validationStatus.valid
    ? undefined
    : t(validationErrorKeys[validationStatus.errorCode]);
  const showExtractionGuide = validationStatus.errorCode === 'gameFileNotFound';
  const showInstallationSettingsAction =
    !validationStatus.valid && installationPathErrorCodes.has(validationStatus.errorCode);
  const isBulkSaving = bulkAction !== undefined;
  const isWriteInProgress = isBulkSaving || isRestoring || pendingZoneIds.size > 0;
  const areActionsDisabled = isWriteInProgress || !validationStatus.valid;

  const renderZoneSwitch = (zone: TerrorZone) => {
    const isPending = isBulkSaving || pendingZoneIds.has(zone.id);
    return (
      <div key={zone.id} className="flex flex-1 items-center gap-4">
        <Switch
          id={`${zoneSwitchIdPrefix}-${zone.id}`}
          aria-labelledby={`${zoneLabelIdPrefix}-${zone.id}`}
          aria-busy={isPending || undefined}
          checked={config[zone.id] ?? true}
          onCheckedChange={(checked: boolean) => toggleZone(zone.id, checked)}
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
  };

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
              {/* Warning and, once the installation is valid, what changes need to show up in game */}
              <Alert variant="warning" live="polite">
                <AlertTriangle aria-hidden="true" />
                <AlertDescription className="gap-2">
                  <p>
                    <strong>{t(translations.common.warning)}</strong>{' '}
                    {t(translations.terrorZone.warning)}
                  </p>
                  {validationStatus.valid && (
                    <>
                      <p className="font-semibold">
                        {t(translations.terrorZone.requirements.title)}
                      </p>
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
                    </>
                  )}
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
                    {showInstallationSettingsAction && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/settings')}
                      >
                        <Settings aria-hidden="true" />
                        {t(translations.terrorZone.openInstallationSettings)}
                      </Button>
                    )}
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
                  <Label htmlFor={searchInputId} className="sr-only">
                    {t(translations.terrorZone.searchLabel)}
                  </Label>
                  <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id={searchInputId}
                    placeholder={t(translations.terrorZone.searchPlaceholder)}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">
                      {t(translations.terrorZone.zonesEnabled, {
                        enabled: enabledCount,
                        total: totalCount,
                      })}
                    </span>
                    {/* Stays mounted so the restart reminder is announced when it appears */}
                    <output aria-live="polite" className="inline-flex items-center gap-1.5">
                      {hasChangesToApply && (
                        <>
                          <RefreshCw className="h-4 w-4 text-warning" aria-hidden="true" />
                          <span className="font-medium text-warning">
                            {t(translations.terrorZone.restartPending)}
                          </span>
                        </>
                      )}
                    </output>
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

              {/* Zone List, grouped by act */}
              <div className="space-y-6">
                {zoneGroups.map((group) => {
                  const groupKey = group.act ?? 'other';
                  const headingId = `${actHeadingIdPrefix}-${groupKey}`;
                  return (
                    <section
                      key={groupKey}
                      aria-labelledby={showGroupHeadings ? headingId : undefined}
                      className="space-y-3"
                    >
                      {showGroupHeadings && (
                        <h2 id={headingId} className="font-semibold text-muted-foreground text-sm">
                          {group.act === undefined
                            ? t(translations.terrorZone.otherZones)
                            : t(translations.terrorZone.actHeading, { act: group.act })}
                        </h2>
                      )}
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
                        {group.zones.map(renderZoneSwitch)}
                      </div>
                    </section>
                  );
                })}
              </div>

              {filteredZones.length === 0 && searchTerm && (
                <div className="py-8 text-center text-muted-foreground">
                  {t(translations.terrorZone.noZonesFound, { searchTerm })}
                </div>
              )}
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
