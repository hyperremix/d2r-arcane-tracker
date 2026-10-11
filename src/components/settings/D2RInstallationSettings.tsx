import { AlertTriangle, FolderOpen, HardDrive } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translations } from '@/i18n/translations';

/**
 * Returns the default D2R installation directory for the current platform (the Battle.net
 * default on Windows). Only used as the input placeholder and the browse dialog's start folder,
 * never as the field value, so an unsaved path never looks saved.
 * Kept in sync with WINDOWS_DEFAULT_D2R_INSTALL_PATH / MAC_DEFAULT_D2R_INSTALL_PATH in
 * electron/services/iconService.ts.
 * @returns {string} Platform-specific default installation path
 */
function getDefaultD2RPath(): string {
  return window.electronAPI?.platform === 'win32'
    ? 'C:\\Program Files (x86)\\Diablo II Resurrected'
    : '/Applications/Diablo II Resurrected.app';
}

/**
 * D2RInstallationSettings component that provides controls for configuring the D2R installation path.
 * This setting is shared between item icon management and terror zone configuration.
 * The field only ever shows the saved path. When none is saved, a notice says so and offers to
 * browse, or to use the default location if it exists on disk.
 * @returns {JSX.Element} A settings card with D2R installation path configuration
 */
export function D2RInstallationSettings() {
  const { t } = useTranslation();
  const d2rPathInputId = useId();
  const pathDescriptionId = useId();
  const saveErrorId = useId();

  const [d2rPath, setD2rPath] = useState<string>('');
  const [hasLoaded, setHasLoaded] = useState(false);
  // Default install path, only set if the main process confirmed it exists on disk
  const [suggestedPath, setSuggestedPath] = useState<string | undefined>(undefined);
  const [saveFailed, setSaveFailed] = useState(false);
  const defaultPath = getDefaultD2RPath();

  // Load the saved D2R path on mount; nothing is filled in when no path is saved
  useEffect(() => {
    const loadD2RPath = async () => {
      try {
        const path = await window.electronAPI?.icon.getD2RPath();
        if (path) {
          setD2rPath(path);
        }
      } catch (error) {
        console.error('Failed to load D2R path:', error);
      }

      try {
        const suggestion = await window.electronAPI?.icon.getSuggestedD2RPath();
        setSuggestedPath(suggestion || undefined);
      } catch (error) {
        console.error('Failed to get suggested D2R path:', error);
      } finally {
        setHasLoaded(true);
      }
    };

    loadD2RPath();
  }, []);

  const savePath = useCallback(async (newPath: string) => {
    setD2rPath(newPath);
    try {
      await window.electronAPI?.icon.setD2RPath(newPath);
      setSaveFailed(false);
    } catch (error) {
      console.error('Failed to save D2R path:', error);
      setSaveFailed(true);
    }
  }, []);

  const handleBrowseDirectory = useCallback(async () => {
    try {
      const result = await window.electronAPI?.dialog.showOpenDialog({
        title: t(translations.settings.d2rInstallation.title),
        defaultPath: d2rPath || suggestedPath || defaultPath,
        properties: ['openDirectory'],
      });

      if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
        await savePath(result.filePaths[0]);
      }
    } catch (error) {
      console.error('Failed to browse directory:', error);
    }
  }, [d2rPath, defaultPath, savePath, suggestedPath, t]);

  const isNotConfigured = hasLoaded && !d2rPath.trim();
  const describedBy = [pathDescriptionId, saveFailed ? saveErrorId : undefined]
    .filter(Boolean)
    .join(' ');

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
              onChange={(e) => savePath(e.target.value)}
              placeholder={defaultPath}
              aria-invalid={saveFailed || undefined}
              aria-describedby={describedBy}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleBrowseDirectory}
              title={t(translations.settings.d2rInstallation.browseForDirectory)}
              aria-label={t(translations.settings.d2rInstallation.browseForDirectory)}
            >
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <p id={pathDescriptionId} className="text-muted-foreground text-xs">
            {t(translations.settings.d2rInstallation.pathDescription)}
          </p>
          {saveFailed && (
            <p
              id={saveErrorId}
              role="alert"
              className="flex items-center gap-2 text-destructive text-sm"
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {t(translations.wizard.d2rInstallation.saveFailed)}
            </p>
          )}
        </div>

        {/* No saved path: say so, and only suggest the default location if it exists */}
        {isNotConfigured && (
          <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/50 p-4">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="flex-1 space-y-2">
              <p className="font-medium text-sm">
                {t(translations.settings.d2rInstallation.notConfigured)}
              </p>
              {suggestedPath ? (
                <>
                  <p className="text-muted-foreground text-xs">
                    {t(translations.wizard.d2rInstallation.suggestion)}
                  </p>
                  <p className="break-all font-mono text-xs">{suggestedPath}</p>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">
                  {t(translations.settings.d2rInstallation.notConfiguredHint)}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {suggestedPath && (
                  <Button size="sm" variant="outline" onClick={() => savePath(suggestedPath)}>
                    {t(translations.settings.d2rInstallation.useSuggestion)}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={handleBrowseDirectory}>
                  <FolderOpen className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t(translations.settings.d2rInstallation.browseForDirectory)}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
