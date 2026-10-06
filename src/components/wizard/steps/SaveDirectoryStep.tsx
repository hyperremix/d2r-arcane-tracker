import type { D2SaveFile } from 'electron/types/grail';
import { AlertTriangle, CheckCircle, FolderOpen, FolderSearch } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';
import { useWizardStore } from '@/stores/wizardStore';

/**
 * Wizard step id used to report whether a save directory has been selected.
 */
export const SAVE_DIRECTORY_STEP_ID = 'saveDirectory';

/**
 * SaveDirectoryStep component - Step for configuring the save file directory.
 * Allows users to browse and select their D2R save directory with file validation.
 * @returns {JSX.Element} Save directory configuration step content
 */
export function SaveDirectoryStep() {
  const { t } = useTranslation();
  const saveDirId = useId();
  const notDetectedId = useId();
  const { settings, setSettings } = useGrailStore();
  const setStepValidity = useWizardStore((state) => state.setStepValidity);
  const [saveDir, setSaveDir] = useState<string>(settings.saveDir || '');
  const [saveFiles, setSaveFiles] = useState<D2SaveFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // The wizard can only proceed once a save directory is known
  useEffect(() => {
    setStepValidity(SAVE_DIRECTORY_STEP_ID, saveDir.trim().length > 0);
  }, [saveDir, setStepValidity]);

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
        title: t(translations.wizard.saveDirectory.dialogTitle),
        properties: ['openDirectory'],
      });

      if (result?.canceled || !result?.filePaths?.[0]) {
        return;
      }

      const newDirectory = result.filePaths[0];

      // Persist the directory and restart monitoring first, so nothing is updated if it fails
      await window.electronAPI?.saveFile.updateSaveDirectory(newDirectory);
      await setSettings({ saveDir: newDirectory });

      // Only reflect the directory (and mark the step valid) once it has been saved
      setSaveDir(newDirectory);

      // Load save files from the new directory
      const files = await window.electronAPI?.saveFile.getSaveFiles();
      setSaveFiles(files || []);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to browse directory:', error);
      setIsLoading(false);
    }
  }, [setSettings, t]);

  const handleRestoreDefault = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await window.electronAPI?.saveFile.restoreDefaultDirectory();
      if (result?.defaultDirectory) {
        // Apply the setting immediately
        await setSettings({ saveDir: result.defaultDirectory });
        setSaveDir(result.defaultDirectory);

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
  const isNotDetected = !saveDir && !isLoading;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-bold text-2xl">{t(translations.wizard.saveDirectory.title)}</h2>
        <p className="text-muted-foreground">{t(translations.wizard.saveDirectory.description)}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={saveDirId}>{t(translations.wizard.saveDirectory.pathLabel)}</Label>
          <div className="flex gap-2">
            <Input
              id={saveDirId}
              value={saveDir}
              readOnly
              placeholder={t(translations.wizard.saveDirectory.placeholder)}
              className="flex-1"
              aria-invalid={isNotDetected || undefined}
              aria-describedby={isNotDetected ? notDetectedId : undefined}
            />
            <Button onClick={handleBrowse} variant="outline">
              <FolderOpen className="mr-2 h-4 w-4" />
              {t(translations.wizard.saveDirectory.browse)}
            </Button>
          </div>
        </div>

        <Button onClick={handleRestoreDefault} variant="ghost" size="sm">
          {t(translations.wizard.saveDirectory.useDefault)}
        </Button>

        {/* Not detected: no directory was found automatically */}
        {isNotDetected && (
          <div
            id={notDetectedId}
            className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/50 p-4"
          >
            <FolderSearch className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <p className="font-medium text-sm">
                  {t(translations.wizard.saveDirectory.notDetectedTitle)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t(translations.wizard.saveDirectory.notDetectedDescription)}
                </p>
              </div>
              <Button onClick={handleBrowse} size="sm">
                <FolderOpen className="mr-2 h-4 w-4" />
                {t(translations.wizard.saveDirectory.browseForFolder)}
              </Button>
            </div>
          </div>
        )}

        {/* Validation Status */}
        {saveDir && !isLoading && (
          <div
            className={`flex items-start gap-2 rounded-lg border p-4 ${
              hasD2SFiles ? 'border-success/30 bg-success/10' : 'border-warning/30 bg-warning/10'
            }`}
          >
            {hasD2SFiles ? (
              <>
                <CheckCircle className="mt-0.5 h-5 w-5 text-success" />
                <div className="flex-1">
                  <p className="font-medium text-sm text-success">
                    {t(translations.wizard.saveDirectory.validated)}
                  </p>
                  <p className="text-success text-xs">
                    {t(translations.wizard.saveDirectory.foundCharacters, {
                      count: saveFiles.length,
                    })}
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
                <div className="flex-1">
                  <p className="font-medium text-sm text-warning">
                    {t(translations.wizard.saveDirectory.noCharacterFiles)}
                  </p>
                  <p className="text-warning text-xs">
                    {t(translations.wizard.saveDirectory.noCharacterFilesHint)}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="rounded-lg bg-info/10 p-4">
          <p className="text-info text-sm">
            <strong>{t(translations.wizard.saveDirectory.typicalLocation)}</strong>
          </p>
          <p className="font-mono text-info text-xs">
            {window.electronAPI?.platform === 'win32'
              ? t(translations.wizard.saveDirectory.typicalLocationWindows)
              : t(translations.wizard.saveDirectory.typicalLocationMac)}
          </p>
        </div>
      </div>
    </div>
  );
}
