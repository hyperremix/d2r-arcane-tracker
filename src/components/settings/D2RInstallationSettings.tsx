import { AlertTriangle, FolderOpen, HardDrive } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translations } from '@/i18n/translations';
import { getDefaultD2RPath } from '@/lib/d2rInstallPath';

/**
 * D2RInstallationSettings component that provides controls for configuring the D2R installation path.
 * This setting is shared between item icon management and terror zone configuration.
 * The field only ever shows the path stored in the settings, which is also what Terror Zones reads.
 * When none is saved, a notice says so and offers the default location if it exists on disk.
 * The path is persisted on blur, Enter, Browse or when accepting the suggestion - never per keystroke.
 * @returns {JSX.Element} A settings card with D2R installation path configuration
 */
export function D2RInstallationSettings() {
  const { t } = useTranslation();
  const d2rPathInputId = useId();
  const pathDescriptionId = useId();
  const saveErrorId = useId();
  const notConfiguredId = useId();

  const [d2rPath, setD2rPath] = useState<string>('');
  // The saved path was read successfully; the "not saved" notice must not show before that
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasSavedPath, setHasSavedPath] = useState(false);
  // Default install path, only set if the main process confirmed it exists on disk
  const [suggestedPath, setSuggestedPath] = useState<string | undefined>(undefined);
  const [saveFailed, setSaveFailed] = useState(false);
  // Last path known to be persisted, restored when a save fails
  const savedPathRef = useRef('');
  // Path currently being saved, so Enter followed by blur does not save it twice
  const savingPathRef = useRef<string | undefined>(undefined);
  // Incremented on every commit and keystroke, so only the latest save updates the UI
  const saveRequestRef = useRef(0);
  const defaultPath = getDefaultD2RPath();

  // Load the stored path on mount (the same setting Terror Zones reads); nothing is filled in
  // when none is saved. icon:getD2RPath is not used because it auto-detects and persists a path.
  useEffect(() => {
    const loadD2RPath = async () => {
      try {
        const settings = await window.electronAPI?.grail.getSettings();
        const path = settings?.d2rInstallPath ?? '';
        savedPathRef.current = path;
        setHasSavedPath(path.trim() !== '');
        setD2rPath(path);
        setHasLoaded(true);
      } catch (error) {
        console.error('Failed to load D2R path:', error);
      }

      try {
        const suggestion = await window.electronAPI?.icon.getSuggestedD2RPath();
        setSuggestedPath(suggestion || undefined);
      } catch (error) {
        console.error('Failed to get suggested D2R path:', error);
      }
    };

    loadD2RPath();
  }, []);

  const savePath = useCallback(async (newPath: string) => {
    const trimmedPath = newPath.trim();
    setD2rPath(trimmedPath);

    if (savingPathRef.current === trimmedPath) {
      return;
    }

    // Any newer commit or typing makes the outcome of older saves irrelevant to the UI
    saveRequestRef.current += 1;
    const requestId = saveRequestRef.current;

    if (trimmedPath === savedPathRef.current) {
      setSaveFailed(false);
      return;
    }

    savingPathRef.current = trimmedPath;
    try {
      await window.electronAPI?.icon.setD2RPath(trimmedPath);
      savedPathRef.current = trimmedPath;
      setHasSavedPath(trimmedPath !== '');
      if (requestId === saveRequestRef.current) {
        setSaveFailed(false);
      }
    } catch (error) {
      console.error('Failed to save D2R path:', error);
      if (requestId === saveRequestRef.current) {
        // Nothing was persisted, so the field and the notice go back to what is saved
        setD2rPath(savedPathRef.current);
        setSaveFailed(true);
      }
    } finally {
      if (savingPathRef.current === trimmedPath) {
        savingPathRef.current = undefined;
      }
    }
  }, []);

  const handlePathChange = useCallback((newPath: string) => {
    // Typing supersedes any save still in flight, so a late failure cannot overwrite the text
    saveRequestRef.current += 1;
    setD2rPath(newPath);
  }, []);

  const handleBrowseDirectory = useCallback(async () => {
    try {
      const result = await window.electronAPI?.dialog.showOpenDialog({
        title: t(translations.settings.d2rInstallation.title),
        defaultPath: savedPathRef.current || suggestedPath || defaultPath,
        properties: ['openDirectory'],
      });

      if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
        await savePath(result.filePaths[0]);
      }
    } catch (error) {
      console.error('Failed to browse directory:', error);
    }
  }, [defaultPath, savePath, suggestedPath, t]);

  const isNotConfigured = hasLoaded && !hasSavedPath;
  const describedBy = [
    pathDescriptionId,
    isNotConfigured ? notConfiguredId : undefined,
    saveFailed ? saveErrorId : undefined,
  ]
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
              onChange={(e) => handlePathChange(e.target.value)}
              onBlur={(e) => void savePath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void savePath(e.currentTarget.value);
                }
              }}
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
          <output
            id={notConfiguredId}
            className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/50 p-4"
          >
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
              {suggestedPath && (
                <Button size="sm" variant="outline" onClick={() => savePath(suggestedPath)}>
                  {t(translations.wizard.d2rInstallation.useSuggestion)}
                </Button>
              )}
            </div>
          </output>
        )}
      </CardContent>
    </Card>
  );
}
