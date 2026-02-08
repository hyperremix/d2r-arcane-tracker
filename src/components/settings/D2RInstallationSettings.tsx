import { FolderOpen, HardDrive } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translations } from '@/i18n/translations';

/**
 * D2RInstallationSettings component that provides controls for configuring the D2R installation path.
 * This setting is shared between item icon management and terror zone configuration.
 * @returns {JSX.Element} A settings card with D2R installation path configuration
 */
export function D2RInstallationSettings() {
  const { t } = useTranslation();
  const d2rPathInputId = useId();

  const [d2rPath, setD2rPath] = useState<string>('');

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

  const handleBrowseDirectory = useCallback(async () => {
    try {
      const result = await window.electronAPI?.dialog.showOpenDialog({
        title: t(translations.settings.d2rInstallation.title),
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
  }, [d2rPath, t]);

  const handlePathChange = useCallback(async (newPath: string) => {
    setD2rPath(newPath);
    try {
      await window.electronAPI?.icon.setD2RPath(newPath);
    } catch (error) {
      console.error('Failed to save D2R path:', error);
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <HardDrive className="h-5 w-5" />
          {t(translations.settings.d2rInstallation.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* D2R Installation Path */}
        <div className="space-y-2">
          <Label htmlFor={d2rPathInputId} className="font-medium text-sm">
            {t(translations.settings.d2rInstallation.installationPath)}
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
              title={t(translations.settings.d2rInstallation.browseForDirectory)}
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-gray-600 text-xs dark:text-gray-400">
            {t(translations.settings.d2rInstallation.pathDescription)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
