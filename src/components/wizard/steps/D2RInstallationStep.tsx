import { FolderOpen, HardDrive } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGrailStore } from '@/stores/grailStore';

/**
 * D2RInstallationStep component - Step for configuring the D2R installation path.
 * This setting is used by both item icon management and terror zone configuration.
 * @returns {JSX.Element} D2R installation path configuration step content
 */
export function D2RInstallationStep() {
  const d2rPathInputId = useId();
  const { settings, setSettings } = useGrailStore();

  const [d2rPath, setD2rPath] = useState<string>(settings.d2rInstallPath || '');

  // Load D2R path on mount
  useEffect(() => {
    const loadD2RPath = async () => {
      try {
        const path = await window.electronAPI?.icon.getD2RPath();
        if (path) {
          setD2rPath(path);
          await setSettings({ d2rInstallPath: path });
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
  }, [setSettings]);

  const handleBrowseDirectory = useCallback(async () => {
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
        await setSettings({ d2rInstallPath: selectedPath });
      }
    } catch (error) {
      console.error('Failed to browse directory:', error);
    }
  }, [d2rPath, setSettings]);

  const handlePathChange = useCallback(
    async (newPath: string) => {
      setD2rPath(newPath);
      try {
        await window.electronAPI?.icon.setD2RPath(newPath);
        await setSettings({ d2rInstallPath: newPath });
      } catch (error) {
        console.error('Failed to save D2R path:', error);
      }
    },
    [setSettings],
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <HardDrive className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 font-semibold text-xl">D2R Installation Path</h2>
        <p className="mt-2 text-muted-foreground">
          Configure the path to your Diablo II: Resurrected installation. This setting is used by
          both item icon management and terror zone configuration features.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={d2rPathInputId} className="font-medium text-sm">
            Installation Path
          </Label>
          <div className="flex gap-2">
            <Input
              id={d2rPathInputId}
              type="text"
              value={d2rPath}
              onChange={(e) => handlePathChange(e.target.value)}
              placeholder={
                window.electronAPI?.platform === 'win32'
                  ? 'C:\\Games\\Diablo II Resurrected'
                  : '/Applications/Diablo II Resurrected.app'
              }
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
          <p className="text-muted-foreground text-xs">
            This path will be used to access game files for item icons and terror zone
            configuration.
          </p>
        </div>
      </div>
    </div>
  );
}
