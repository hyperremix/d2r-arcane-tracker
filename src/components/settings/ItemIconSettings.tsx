import { AlertCircle, AlertTriangle, CheckCircle, Image, RefreshCw } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * ItemIconSettings component that provides controls for converting D2R sprite files to PNGs.
 * Allows users to initiate sprite conversion using the D2R installation path.
 * @returns {JSX.Element} A settings card with sprite conversion controls
 */
export function ItemIconSettings() {
  const { t } = useTranslation();
  const itemIconsSwitchId = useId();
  const { settings, setSettings } = useGrailStore();

  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState({ current: 0, total: 0 });
  const [conversionResult, setConversionResult] = useState<{
    success: boolean;
    totalFiles: number;
    convertedFiles: number;
    skippedFiles: number;
    errors: Array<{ file: string; error: string }>;
  } | null>(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    valid: boolean;
    path?: string;
    error?: string;
  }>({ valid: false });

  const toggleItemIcons = async (checked: boolean) => {
    await setSettings({ showItemIcons: checked });
  };

  const loadValidation = useCallback(async () => {
    const validation = await window.electronAPI.icon.validatePath();
    setValidationStatus(validation);
  }, []);

  // Load validation on mount
  useEffect(() => {
    loadValidation();
  }, [loadValidation]);

  // Listen for conversion progress updates
  useEffect(() => {
    const handleProgress = (_event: unknown, progress: { current: number; total: number }) => {
      setConversionProgress(progress);
    };

    window.ipcRenderer?.on('icon:conversionProgress', handleProgress);

    return () => {
      window.ipcRenderer?.off('icon:conversionProgress', handleProgress);
    };
  }, []);

  const handleConvertSprites = useCallback(async () => {
    setShowWarningDialog(false);
    setIsConverting(true);
    setConversionProgress({ current: 0, total: 0 });
    setConversionResult(null);

    try {
      const result = await window.electronAPI?.icon.convertSprites();
      setConversionResult(result || null);
    } catch (error) {
      console.error('Sprite conversion failed:', error);
      setConversionResult({
        success: false,
        totalFiles: 0,
        convertedFiles: 0,
        skippedFiles: 0,
        errors: [{ file: 'N/A', error: String(error) }],
      });
    } finally {
      setIsConverting(false);
    }
  }, []);

  const progressPercentage =
    conversionProgress.total > 0
      ? (conversionProgress.current / conversionProgress.total) * 100
      : 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Image className="h-5 w-5" />
            {t(translations.settings.itemIcons.title)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show Item Icons Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor={itemIconsSwitchId} className="font-medium text-sm">
                {t(translations.settings.itemIcons.showItemIcons)}
              </Label>
              <p className="text-gray-600 text-xs dark:text-gray-400">
                {t(translations.settings.itemIcons.showItemIconsDescription)}
              </p>
            </div>
            <Switch
              id={itemIconsSwitchId}
              checked={settings.showItemIcons}
              onCheckedChange={toggleItemIcons}
            />
          </div>

          {/* Validation Status */}
          {validationStatus.valid ? (
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <strong>✓ {t(translations.settings.itemIcons.pathValid)}</strong>
                <br />
                {t(translations.settings.itemIcons.gameFilesFoundAt)}{' '}
                <code className="text-xs">{validationStatus.path}</code>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="font-bold text-red-800 dark:text-red-200">
                {t(translations.common.error)}
              </AlertTitle>
              <AlertDescription className="space-y-2 text-red-800 dark:text-red-200">
                <p>
                  {validationStatus.error || t(translations.settings.itemIcons.pathNotConfigured)}
                </p>
                {validationStatus.error?.includes('not found') && (
                  <div>
                    <p className="font-semibold text-sm">
                      {t(translations.settings.itemIcons.gameFilesMustBeExtracted)}
                    </p>
                    <p className="text-sm">{t(translations.settings.itemIcons.cascDescription)}</p>
                    <div className="mt-2">
                      <p className="font-semibold text-sm">
                        {t(translations.settings.itemIcons.extractionSteps)}
                      </p>
                      <ol className="mt-1 ml-4 list-decimal space-y-1 text-sm">
                        <li>
                          {t(translations.settings.itemIcons.downloadCascViewer)}{' '}
                          <a
                            href="https://www.hiveworkshop.com/threads/ladiks-casc-viewer.331540/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-red-950 dark:hover:text-red-50"
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
                        <li>{t(translations.settings.itemIcons.reloadToVerify)}</li>
                      </ol>
                    </div>
                    <p className="mt-2 text-xs">
                      <strong>{t(translations.common.note)}</strong>{' '}
                      {t(translations.settings.itemIcons.extractionNote)}
                    </p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Convert Button */}
          <div className="space-y-2">
            <Button
              onClick={() => setShowWarningDialog(true)}
              disabled={isConverting || !validationStatus.valid}
              className="w-full"
            >
              {isConverting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  {t(translations.settings.itemIcons.convertingSprites)}
                </>
              ) : (
                <>
                  <Image className="mr-2 h-4 w-4" />
                  {t(translations.settings.itemIcons.convertSpritesToPng)}
                </>
              )}
            </Button>

            {/* Progress Bar */}
            {isConverting && (
              <div className="space-y-1">
                <Progress value={progressPercentage} className="h-2" />
                <p className="text-center text-gray-600 text-xs dark:text-gray-400">
                  {t(translations.settings.itemIcons.filesProgress, {
                    current: conversionProgress.current,
                    total: conversionProgress.total,
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Conversion Result */}
          {conversionResult && (
            <div
              className={`rounded-lg p-3 ${
                conversionResult.success
                  ? 'bg-green-50 dark:bg-green-950'
                  : 'bg-red-50 dark:bg-red-950'
              }`}
            >
              <p
                className={`font-medium text-sm ${
                  conversionResult.success
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-red-800 dark:text-red-200'
                }`}
              >
                {conversionResult.success ? '✓ ' : '✗ '}
                {conversionResult.success
                  ? t(translations.settings.itemIcons.conversionComplete)
                  : t(translations.settings.itemIcons.conversionFailed)}
              </p>
              <div
                className={`mt-2 space-y-1 text-xs ${
                  conversionResult.success
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300'
                }`}
              >
                <p>
                  {t(translations.settings.itemIcons.totalFiles, {
                    count: conversionResult.totalFiles,
                  })}
                </p>
                <p>
                  {t(translations.settings.itemIcons.converted, {
                    count: conversionResult.convertedFiles,
                  })}
                </p>
                <p>
                  {t(translations.settings.itemIcons.skippedAlreadyExists, {
                    count: conversionResult.skippedFiles,
                  })}
                </p>
                {conversionResult.errors.length > 0 && (
                  <p>
                    {t(translations.settings.itemIcons.errors, {
                      count: conversionResult.errors.length,
                    })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
            <p className="text-blue-800 text-xs dark:text-blue-200">
              <strong>{t(translations.settings.itemIcons.whyConversionNeeded)}</strong>
              <br />
              {t(translations.settings.itemIcons.whyConversionDescription)}
              <br />
              <br />
              <strong>{t(translations.settings.itemIcons.aboutTheProcess)}</strong>
              <br />
              {t(translations.settings.itemIcons.aboutTheProcessDescription)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Warning Dialog */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              {t(translations.settings.itemIcons.convertSpriteFilesTitle)}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>{t(translations.settings.itemIcons.convertDescription)}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>{t(translations.settings.itemIcons.spriteFilesReadFrom)}</li>
                <li>{t(translations.settings.itemIcons.convertedPngsSaved)}</li>
                <li>
                  <strong>{t(translations.settings.itemIcons.gameFilesNotModified)}</strong>
                </li>
                <li>{t(translations.settings.itemIcons.idempotent)}</li>
                <li>{t(translations.settings.itemIcons.conversionMayTake)}</li>
              </ul>
              <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  <strong>{t(translations.common.warning)}</strong>{' '}
                  {t(translations.settings.itemIcons.disclaimer)}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t(translations.common.cancel)}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvertSprites}>
              {t(translations.settings.itemIcons.startConversion)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
