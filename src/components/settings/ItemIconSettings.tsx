import { AlertCircle, AlertTriangle, CheckCircle, Image, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
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
import { useGrailStore } from '@/stores/grailStore';

/**
 * ItemIconSettings component that provides controls for converting D2R sprite files to PNGs.
 * Allows users to initiate sprite conversion using the D2R installation path.
 * @returns {JSX.Element} A settings card with sprite conversion controls
 */
export function ItemIconSettings() {
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
            Item Icon Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show Item Icons Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor={itemIconsSwitchId} className="font-medium text-sm">
                Show Item Icons
              </Label>
              <p className="text-gray-600 text-xs dark:text-gray-400">
                Display D2R item icons in cards
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
                <strong>✓ D2R installation path is valid</strong>
                <br />
                Game files found at: <code className="text-xs">{validationStatus.path}</code>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="font-bold text-red-800 dark:text-red-200">Error</AlertTitle>
              <AlertDescription className="space-y-2 text-red-800 dark:text-red-200">
                <p>{validationStatus.error || 'D2R installation path is not configured'}</p>
                {validationStatus.error?.includes('not found') && (
                  <div>
                    <p className="font-semibold text-sm">Game Files Must Be Extracted</p>
                    <p className="text-sm">
                      D2R stores game files in CASC (Content Addressable Storage Container) format.
                      These files must be extracted before item icons can be converted.
                    </p>
                    <div className="mt-2">
                      <p className="font-semibold text-sm">Extraction Steps:</p>
                      <ol className="mt-1 ml-4 list-decimal space-y-1 text-sm">
                        <li>
                          Download{' '}
                          <a
                            href="https://www.hiveworkshop.com/threads/ladiks-casc-viewer.331540/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-red-950 dark:hover:text-red-50"
                          >
                            Ladik's CASC Viewer
                          </a>
                        </li>
                        <li>Open the x64 version (or appropriate version for your OS)</li>
                        <li>In CASC Viewer, click "Open Storage"</li>
                        <li>
                          Select your D2R folder (e.g.,{' '}
                          <code className="text-xs">
                            C:\Program Files (x86)\Diablo II Resurrected
                          </code>
                          )
                        </li>
                        <li>Click "data" on the left side of the screen</li>
                        <li>
                          Click "data" again from the newly opened options, then click "Extract" at
                          the top
                        </li>
                        <li>
                          Wait for extraction (extracts ~40GB: global, hd, local folders to CascView
                          work folder)
                        </li>
                        <li>
                          Move the 3 extracted folders to{' '}
                          <code className="text-xs">
                            C:\Program Files (x86)\Diablo II Resurrected\Data
                          </code>
                        </li>
                        <li>After extraction, reload this page to verify</li>
                      </ol>
                    </div>
                    <p className="mt-2 text-xs">
                      <strong>Note:</strong> Extraction is a one-time process and does not modify
                      your game installation.
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
                  Converting Sprites...
                </>
              ) : (
                <>
                  <Image className="mr-2 h-4 w-4" />
                  Convert Sprite Files to PNG
                </>
              )}
            </Button>

            {/* Progress Bar */}
            {isConverting && (
              <div className="space-y-1">
                <Progress value={progressPercentage} className="h-2" />
                <p className="text-center text-gray-600 text-xs dark:text-gray-400">
                  {conversionProgress.current} / {conversionProgress.total} files
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
                {conversionResult.success ? '✓ Conversion Complete' : '✗ Conversion Failed'}
              </p>
              <div
                className={`mt-2 space-y-1 text-xs ${
                  conversionResult.success
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300'
                }`}
              >
                <p>Total files: {conversionResult.totalFiles}</p>
                <p>Converted: {conversionResult.convertedFiles}</p>
                <p>Skipped (already exists): {conversionResult.skippedFiles}</p>
                {conversionResult.errors.length > 0 && (
                  <p>Errors: {conversionResult.errors.length}</p>
                )}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
            <p className="text-blue-800 text-xs dark:text-blue-200">
              <strong>Why Conversion is Needed:</strong>
              <br />
              Diablo II: Resurrected stores item icons in a proprietary .sprite format that cannot
              be directly displayed in web technologies. This tool converts those .sprite files into
              standard PNG images that can be rendered in the app.
              <br />
              <br />
              <strong>About the Process:</strong>
              <br />
              Converted PNG images are stored in the app's data directory. Your game files will not
              be modified. The conversion is safe to run multiple times and only needs to be done
              once (or when game updates add new items).
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
              Convert Sprite Files
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This process will convert sprite files from your D2R installation to PNG format.
                Please review the following information:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>
                  Sprite files will be read from: <code>Data/hd/global/ui/items</code> (recursively)
                </li>
                <li>Converted PNGs will be saved to the app's user data directory</li>
                <li>
                  <strong>Your game files will NOT be modified</strong>
                </li>
                <li>This process is idempotent (safe to run multiple times)</li>
                <li>Conversion may take a few minutes depending on the number of files</li>
              </ul>
              <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  <strong>Disclaimer:</strong> While this process only reads game files and does not
                  modify them, you proceed at your own risk. It is recommended to ensure your game
                  installation is backed up.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvertSprites}>Start Conversion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
