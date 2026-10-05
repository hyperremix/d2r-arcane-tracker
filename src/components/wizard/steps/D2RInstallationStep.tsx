import { AlertTriangle, CheckCircle, FolderOpen, HardDrive, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * Validation state of the configured D2R installation path.
 */
type PathValidationState = 'idle' | 'validating' | 'valid' | 'invalid' | 'error';

/**
 * Returns the most common D2R installation directory for the current platform.
 * Used only as a suggestion; it is never saved unless the user accepts it.
 * @returns {string} Platform-specific suggested installation path
 */
function getSuggestedD2RPath(): string {
  return window.electronAPI?.platform === 'win32'
    ? 'C:\\Games\\Diablo II Resurrected'
    : '/Applications/Diablo II Resurrected.app';
}

/**
 * D2RInstallationStep component - Step for configuring the D2R installation path.
 * This setting is used by both item icon management and terror zone configuration.
 * The path is persisted on blur, Enter, Browse or when accepting the suggestion - never per keystroke.
 * @returns {JSX.Element} D2R installation path configuration step content
 */
export function D2RInstallationStep() {
  const { t } = useTranslation();
  const d2rPathInputId = useId();
  const pathHintId = useId();
  const validationId = useId();
  const { settings, setSettings } = useGrailStore();

  const [d2rPath, setD2rPath] = useState<string>(settings.d2rInstallPath || '');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [validation, setValidation] = useState<PathValidationState>('idle');
  const savedPathRef = useRef<string>(settings.d2rInstallPath || '');
  const suggestedPath = getSuggestedD2RPath();

  const validatePath = useCallback(async () => {
    setValidation('validating');
    try {
      const result = await window.electronAPI?.icon.validatePath();
      setValidation(result?.valid ? 'valid' : 'invalid');
    } catch (error) {
      console.error('Failed to validate D2R path:', error);
      setValidation('invalid');
    }
  }, []);

  const persistPath = useCallback(
    async (newPath: string) => {
      const trimmedPath = newPath.trim();
      setD2rPath(trimmedPath);

      if (trimmedPath === savedPathRef.current) {
        return;
      }

      try {
        await window.electronAPI?.icon.setD2RPath(trimmedPath);
        await setSettings({ d2rInstallPath: trimmedPath });
        savedPathRef.current = trimmedPath;
      } catch (error) {
        console.error('Failed to save D2R path:', error);
        setValidation('error');
        return;
      }

      if (trimmedPath) {
        await validatePath();
      } else {
        setValidation('idle');
      }
    },
    [setSettings, validatePath],
  );

  // Load D2R path on mount
  useEffect(() => {
    const loadD2RPath = async () => {
      try {
        const path = await window.electronAPI?.icon.getD2RPath();
        if (path) {
          setD2rPath(path);
          savedPathRef.current = path;
          await validatePath();
        }
      } catch (error) {
        console.error('Failed to load D2R path:', error);
      } finally {
        setHasLoaded(true);
      }
    };

    loadD2RPath();
  }, [validatePath]);

  const handleBrowseDirectory = useCallback(async () => {
    try {
      const result = await window.electronAPI?.dialog.showOpenDialog({
        title: t(translations.wizard.d2rInstallation.dialogTitle),
        defaultPath: d2rPath || suggestedPath,
        properties: ['openDirectory'],
      });

      if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
        await persistPath(result.filePaths[0]);
      }
    } catch (error) {
      console.error('Failed to browse directory:', error);
    }
  }, [d2rPath, persistPath, suggestedPath, t]);

  const handlePathChange = useCallback((newPath: string) => {
    // Only update local state while typing; the path is persisted and validated on blur
    setD2rPath(newPath);
    setValidation('idle');
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void persistPath(event.currentTarget.value);
      }
    },
    [persistPath],
  );

  const showSuggestion = hasLoaded && !d2rPath;
  const describedBy = [pathHintId, validation !== 'idle' ? validationId : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <HardDrive className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 font-semibold text-xl">
          {t(translations.wizard.d2rInstallation.title)}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t(translations.wizard.d2rInstallation.description)}
        </p>
      </div>

      <div className="space-y-4">
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
              onBlur={(e) => persistPath(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={suggestedPath}
              aria-invalid={validation === 'invalid' || validation === 'error' || undefined}
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
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
          <p id={pathHintId} className="text-muted-foreground text-xs">
            {t(translations.wizard.d2rInstallation.pathHint)}
          </p>
        </div>

        {/* Suggestion when no installation path was detected */}
        {showSuggestion && (
          <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1 space-y-2">
              <p className="font-medium text-sm">
                {t(translations.wizard.d2rInstallation.notDetectedTitle)}
              </p>
              <p className="text-muted-foreground text-xs">
                {t(translations.wizard.d2rInstallation.suggestion)}
              </p>
              <p className="break-all font-mono text-xs">{suggestedPath}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => persistPath(suggestedPath)}>
                  {t(translations.wizard.d2rInstallation.useSuggestion)}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleBrowseDirectory}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t(translations.settings.d2rInstallation.browseForDirectory)}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Validation state */}
        <div id={validationId} aria-live="polite">
          {validation === 'validating' && (
            <p className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t(translations.wizard.d2rInstallation.validating)}
            </p>
          )}
          {validation === 'valid' && (
            <p className="flex items-center gap-2 text-accent-green text-sm">
              <CheckCircle className="h-4 w-4" />
              {t(translations.wizard.d2rInstallation.valid)}
            </p>
          )}
          {validation === 'invalid' && (
            <div className="flex items-start gap-2 rounded-lg border p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-yellow" />
              <div className="space-y-1">
                <p className="font-medium text-sm">
                  {t(translations.wizard.d2rInstallation.invalid)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t(translations.wizard.d2rInstallation.invalidHint)}
                </p>
              </div>
            </div>
          )}
          {validation === 'error' && (
            <p className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              {t(translations.wizard.d2rInstallation.saveFailed)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
