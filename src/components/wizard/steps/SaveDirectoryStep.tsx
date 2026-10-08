import type { D2SaveFile } from 'electron/types/grail';
import { AlertTriangle, CheckCircle, FolderOpen, FolderSearch } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SaveDirectoryChangeDialog } from '@/components/settings/SaveDirectoryChangeDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SaveDirectoryChangeAction } from '@/hooks/useSaveDirectoryChange';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';
import { useWizardStore } from '@/stores/wizardStore';

/**
 * Wizard step id used to report whether a save directory has been selected.
 */
export const SAVE_DIRECTORY_STEP_ID = 'saveDirectory';

/**
 * A requested save directory change awaiting application.
 */
interface PendingDirectoryChange {
  action: SaveDirectoryChangeAction;
  directory: string;
}

/**
 * Normalizes a directory path for a best-effort equality check in the renderer.
 * The main process performs the authoritative comparison before clearing data.
 * @param {string} directory - Directory path to normalize
 * @returns {string} Normalized directory path
 */
function normalizeDirectory(directory: string): string {
  const trimmed = directory.trim().replace(/[\\/]+$/, '');
  return window.electronAPI?.platform === 'win32' ? trimmed.toLowerCase() : trimmed;
}

/**
 * Checks whether the database currently holds characters or grail progress.
 * @returns {Promise<boolean>} True if any user data exists
 */
async function hasExistingUserData(): Promise<boolean> {
  const [characters, progress] = await Promise.all([
    window.electronAPI?.grail.getCharacters(),
    window.electronAPI?.grail.getProgress(),
  ]);
  return (characters?.length ?? 0) > 0 || (progress?.length ?? 0) > 0;
}

/**
 * SaveDirectoryStep component - Step for configuring the save file directory.
 * Allows users to browse and select their D2R save directory with file validation.
 * Switching to a different directory while progress exists requires confirmation,
 * because the change permanently deletes existing characters and grail progress.
 * @returns {JSX.Element} Save directory configuration step content
 */
export function SaveDirectoryStep() {
  const { t } = useTranslation();
  const saveDirId = useId();
  const notDetectedId = useId();
  const { settings, reloadData } = useGrailStore();
  const setStepValidity = useWizardStore((state) => state.setStepValidity);
  const [saveDir, setSaveDir] = useState<string>(settings.saveDir || '');
  const [saveFiles, setSaveFiles] = useState<D2SaveFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingDirectoryChange | undefined>(undefined);
  const [hasError, setHasError] = useState(false);

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

  const applyDirectoryChange = useCallback(
    async (change: PendingDirectoryChange) => {
      setIsApplying(true);
      setHasError(false);

      try {
        // The main process persists the setting, clears data if needed and restarts monitoring
        if (change.action === 'restore') {
          const result = await window.electronAPI?.saveFile.restoreDefaultDirectory();
          setSaveDir(result?.defaultDirectory || change.directory);
        } else {
          await window.electronAPI?.saveFile.updateSaveDirectory(change.directory);
          setSaveDir(change.directory);
        }
      } catch (error) {
        console.error('Failed to change save directory:', error);
        setHasError(true);
        setPendingChange(undefined);
        setIsApplying(false);
        return;
      }

      // The change has been applied. Refreshing the UI is best effort: a failure here is
      // logged but must not report the (already completed) change as failed.
      try {
        // Reload settings, characters and progress so the UI isn't stale
        await reloadData();
      } catch (error) {
        console.error('Failed to reload data after save directory change:', error);
      }

      try {
        // Load save files from the new directory
        const files = await window.electronAPI?.saveFile.getSaveFiles();
        setSaveFiles(files || []);
      } catch (error) {
        console.error('Failed to load save files after save directory change:', error);
      }

      setPendingChange(undefined);
      setIsApplying(false);
    },
    [reloadData],
  );

  const requestDirectoryChange = useCallback(
    async (change: PendingDirectoryChange) => {
      setHasError(false);
      // `saveDir` is the directory the monitor is actually using (monitoring status), which is the
      // same effective directory (saveDir setting, else platform default) the main process compares
      // against before clearing data. Both only change together via the update/restore IPCs, so a
      // match here means main will not truncate. When the status is unknown, `saveDir` falls back
      // to '' or the stored setting, which errs toward asking for confirmation.
      const isSameDirectory =
        saveDir !== '' && normalizeDirectory(saveDir) === normalizeDirectory(change.directory);

      if (!isSameDirectory && (await hasExistingUserData())) {
        // Require explicit confirmation before wiping existing progress
        setPendingChange(change);
        return;
      }

      await applyDirectoryChange(change);
    },
    [applyDirectoryChange, saveDir],
  );

  const handleBrowse = useCallback(async () => {
    try {
      const result = await window.electronAPI?.dialog.showOpenDialog({
        title: t(translations.wizard.saveDirectory.dialogTitle),
        properties: ['openDirectory'],
      });

      if (result?.canceled || !result?.filePaths?.[0]) {
        return;
      }

      await requestDirectoryChange({ action: 'change', directory: result.filePaths[0] });
    } catch (error) {
      console.error('Failed to browse directory:', error);
      setHasError(true);
    }
  }, [requestDirectoryChange, t]);

  const handleRestoreDefault = useCallback(async () => {
    try {
      const defaultDirectory = await window.electronAPI?.saveFile.getDefaultDirectory();
      if (!defaultDirectory) {
        return;
      }

      await requestDirectoryChange({ action: 'restore', directory: defaultDirectory });
    } catch (error) {
      console.error('Failed to restore default directory:', error);
      setHasError(true);
    }
  }, [requestDirectoryChange]);

  const handleConfirmDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isApplying) {
        setPendingChange(undefined);
      }
    },
    [isApplying],
  );

  const handleConfirmChange = useCallback(() => {
    if (pendingChange) {
      applyDirectoryChange(pendingChange);
    }
  }, [applyDirectoryChange, pendingChange]);

  const isBusy = isLoading || isApplying;
  const hasD2SFiles = saveFiles.length > 0;
  const isNotDetected = !saveDir && !isBusy;

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
            <Button onClick={handleBrowse} variant="outline" disabled={isBusy}>
              <FolderOpen className="mr-2 h-4 w-4" />
              {t(translations.wizard.saveDirectory.browse)}
            </Button>
          </div>
        </div>

        <Button onClick={handleRestoreDefault} variant="ghost" size="sm" disabled={isBusy}>
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
              <Button onClick={handleBrowse} size="sm" disabled={isBusy}>
                <FolderOpen className="mr-2 h-4 w-4" />
                {t(translations.wizard.saveDirectory.browseForFolder)}
              </Button>
            </div>
          </div>
        )}

        {isApplying && (
          <output className="block text-muted-foreground text-sm">
            {t(translations.wizard.saveDirectory.applying)}
          </output>
        )}

        {hasError && (
          <p role="alert" className="text-destructive text-sm">
            {t(translations.wizard.saveDirectory.changeFailed)}
          </p>
        )}

        {/* Validation Status */}
        {saveDir && !isBusy && (
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

      <SaveDirectoryChangeDialog
        open={pendingChange !== undefined}
        onOpenChange={handleConfirmDialogOpenChange}
        action={pendingChange?.action ?? 'change'}
        isProcessing={isApplying}
        onConfirm={handleConfirmChange}
      />
    </div>
  );
}
