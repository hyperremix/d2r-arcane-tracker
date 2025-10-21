import type { D2SaveFile } from 'electron/types/grail';
import { AlertTriangle, CheckCircle, FolderOpen } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGrailStore } from '@/stores/grailStore';

/**
 * SaveDirectoryStep component - Step for configuring the save file directory.
 * Allows users to browse and select their D2R save directory with file validation.
 * @returns {JSX.Element} Save directory configuration step content
 */
export function SaveDirectoryStep() {
  const saveDirId = useId();
  const { settings, setSettings } = useGrailStore();
  const [saveDir, setSaveDir] = useState<string>(settings.saveDir || '');
  const [saveFiles, setSaveFiles] = useState<D2SaveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load current save directory and files
  useEffect(() => {
    const loadSaveDirectory = async () => {
      try {
        setIsLoading(true);
        const status = await window.electronAPI?.saveFile.getMonitoringStatus();
        if (status?.directory) {
          setSaveDir(status.directory);
        }

        // Load save files
        const files = await window.electronAPI?.saveFile.getSaveFiles();
        setSaveFiles(files || []);
      } catch (error) {
        console.error('Failed to load save directory:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSaveDirectory();
  }, []);

  const handleBrowse = useCallback(async () => {
    try {
      const result = await window.electronAPI?.dialog.showOpenDialog({
        title: 'Select Save File Directory',
        properties: ['openDirectory'],
      });

      if (result?.canceled || !result?.filePaths?.[0]) {
        return;
      }

      const newDirectory = result.filePaths[0];
      setSaveDir(newDirectory);

      // Apply the setting immediately and restart monitoring
      await setSettings({ saveDir: newDirectory });
      await window.electronAPI?.saveFile.updateSaveDirectory(newDirectory);

      // Load save files from the new directory
      const files = await window.electronAPI?.saveFile.getSaveFiles();
      setSaveFiles(files || []);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to browse directory:', error);
      setIsLoading(false);
    }
  }, [setSettings]);

  const handleRestoreDefault = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await window.electronAPI?.saveFile.restoreDefaultDirectory();
      if (result?.defaultDirectory) {
        setSaveDir(result.defaultDirectory);

        // Apply the setting immediately
        await setSettings({ saveDir: result.defaultDirectory });

        // Get current save files to validate
        const files = await window.electronAPI?.saveFile.getSaveFiles();
        setSaveFiles(files || []);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to restore default directory:', error);
      setIsLoading(false);
    }
  }, [setSettings]);

  const hasD2SFiles = saveFiles.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-bold text-2xl">Save File Directory</h2>
        <p className="text-muted-foreground">
          Select the directory where your Diablo II: Resurrected save files are located.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={saveDirId}>Save Directory Path</Label>
          <div className="flex gap-2">
            <Input
              id={saveDirId}
              value={saveDir}
              readOnly
              placeholder="Select your save directory..."
              className="flex-1"
            />
            <Button onClick={handleBrowse} variant="outline">
              <FolderOpen className="mr-2 h-4 w-4" />
              Browse
            </Button>
          </div>
        </div>

        <Button onClick={handleRestoreDefault} variant="ghost" size="sm">
          Use Default Directory
        </Button>

        {/* Validation Status */}
        {saveDir && !isLoading && (
          <div
            className={`flex items-start gap-2 rounded-lg border p-4 ${
              hasD2SFiles
                ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
                : 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950'
            }`}
          >
            {hasD2SFiles ? (
              <>
                <CheckCircle className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <p className="font-medium text-green-800 text-sm dark:text-green-200">
                    Directory validated
                  </p>
                  <p className="text-green-700 text-xs dark:text-green-300">
                    Found {saveFiles.length} character file{saveFiles.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <div className="flex-1">
                  <p className="font-medium text-sm text-yellow-800 dark:text-yellow-200">
                    No character files found
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Make sure you've selected the correct directory containing your .d2s files
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
          <p className="text-blue-800 text-sm dark:text-blue-200">
            <strong>Typical location:</strong>
          </p>
          <p className="font-mono text-blue-700 text-xs dark:text-blue-300">
            {window.electronAPI?.platform === 'win32'
              ? 'C:\\Users\\[YourUsername]\\Saved Games\\Diablo II Resurrected'
              : '~/Library/Application Support/Diablo II Resurrected'}
          </p>
        </div>
      </div>
    </div>
  );
}
