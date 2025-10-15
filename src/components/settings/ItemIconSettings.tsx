import { AlertTriangle, FolderOpen, Image, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useGrailStore } from '@/stores/grailStore';

/**
 * ItemIconSettings component that provides controls for converting D2R sprite files to PNGs.
 * Allows users to configure D2R installation path and initiate sprite conversion.
 * @returns {JSX.Element} A settings card with D2R path configuration and sprite conversion controls
 */
export function ItemIconSettings() {
  const d2rPathInputId = useId();
  const itemIconsSwitchId = useId();
  const { settings, setSettings } = useGrailStore();

  const [d2rPath, setD2rPath] = useState<string>('');
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

  const toggleItemIcons = async (checked: boolean) => {
    await setSettings({ showItemIcons: checked });
  };

  // Load D2R path on mount
  useEffect(() => {
    const loadD2RPath = async () => {
      try {
        const path = await window.electronAPI?.icon.getD2RPath();
        if (path) {
          setD2rPath(path);
        } else {
          // Set default path based on platform
          const defaultPath =
            window.electronAPI.platform === 'win32'
              ? 'C:\\Games\\Diablo II Resurrected'
              : '/Applications/Diablo II Resurrected.app';
          setD2rPath(defaultPath);
        }
      } catch (error) {
        console.error('Failed to load D2R path:', error);
      }
    };

    loadD2RPath();
  }, []);

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

  const handleBrowseDirectory = async () => {
    try {
      const result = await window.electronAPI?.dialog.showOpenDialog({
        title: 'Select D2R Installation Directory',
        defaultPath: d2rPath,
        properties: ['openDirectory'],
      });

      if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        setD2rPath(selectedPath);
        await window.electronAPI?.icon.setD2RPath(selectedPath);
      }
    } catch (error) {
      console.error('Failed to browse directory:', error);
    }
  };

  const handlePathChange = async (newPath: string) => {
    setD2rPath(newPath);
    try {
      await window.electronAPI?.icon.setD2RPath(newPath);
    } catch (error) {
      console.error('Failed to save D2R path:', error);
    }
  };

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

          {/* D2R Installation Path */}
          <div className="space-y-2">
            <Label htmlFor={d2rPathInputId} className="font-medium text-sm">
              D2R Installation Path
            </Label>
            <div className="flex gap-2">
              <Input
                id={d2rPathInputId}
                type="text"
                value={d2rPath}
                onChange={(e) => handlePathChange(e.target.value)}
                placeholder="C:\Games\Diablo II Resurrected"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleBrowseDirectory}
                title="Browse for directory"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-gray-600 text-xs dark:text-gray-400">
              Path to your Diablo II: Resurrected installation directory
            </p>
          </div>

          {/* Convert Button */}
          <div className="space-y-2">
            <Button
              onClick={() => setShowWarningDialog(true)}
              disabled={isConverting || !d2rPath}
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
