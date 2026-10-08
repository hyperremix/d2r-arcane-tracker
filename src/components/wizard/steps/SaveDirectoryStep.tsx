import type {
  D2SaveFile,
  SaveDirectoryInspection,
  SaveDirectoryInspectionStatus,
} from 'electron/types/grail';
import {
  AlertTriangle,
  CheckCircle,
  FolderCheck,
  FolderOpen,
  FolderSearch,
  Loader2,
} from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SaveDirectoryChangeDialog } from '@/components/settings/SaveDirectoryChangeDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SaveDirectoryChangeAction } from '@/hooks/useSaveDirectoryChange';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';
import { useWizardStore } from '@/stores/wizardStore';

/**
 * Wizard step id used to report whether a usable save directory has been selected.
 */
export const SAVE_DIRECTORY_STEP_ID = 'saveDirectory';

/**
 * Delay after the last keystroke before a typed/pasted path is inspected.
 */
export const SAVE_DIRECTORY_INSPECTION_DEBOUNCE_MS = 400;

/**
 * A requested save directory change awaiting application.
 */
interface PendingDirectoryChange {
  action: SaveDirectoryChangeAction;
  directory: string;
}

/**
 * Inspection outcome for a specific directory path.
 */
interface DirectoryInspectionState {
  directory: string;
  /** Undefined if the inspection failed. */
  result?: SaveDirectoryInspection;
}

/**
 * Current inspection of a directory as exposed by {@link useDirectoryInspection}.
 */
interface DirectoryInspection {
  isInspecting: boolean;
  result?: SaveDirectoryInspection;
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
 * Checks whether two directory paths refer to the same, non-empty directory.
 * @param {string} a - First directory path
 * @param {string} b - Second directory path
 * @returns {boolean} True if both paths are non-empty and equal after normalization
 */
function isSameDirectory(a: string, b: string): boolean {
  return a.trim() !== '' && normalizeDirectory(a) === normalizeDirectory(b);
}

/**
 * Checks whether the typed directory differs from the applied one and still needs applying.
 * @param {string} trimmedDraft - Trimmed input value
 * @param {string} saveDir - Applied directory
 * @returns {boolean} True if a non-empty typed directory differs from the applied one
 */
function isUnappliedDraft(trimmedDraft: string, saveDir: string): boolean {
  return trimmedDraft !== '' && !isSameDirectory(trimmedDraft, saveDir);
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
 * Inspects a directory through the main process once it stops changing for
 * {@link SAVE_DIRECTORY_INSPECTION_DEBOUNCE_MS}. Results for other paths are ignored.
 * @param {string} directory - Trimmed directory path to inspect
 * @param {boolean} enabled - Whether the directory should be inspected at all
 * @returns {DirectoryInspection} Inspection state for `directory`
 */
function useDirectoryInspection(directory: string, enabled: boolean): DirectoryInspection {
  const [inspection, setInspection] = useState<DirectoryInspectionState | undefined>(undefined);
  const inspectedDirectory = inspection?.directory;

  useEffect(() => {
    if (!enabled || inspectedDirectory === directory) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await window.electronAPI?.saveFile.inspectDirectory(directory);
        if (!cancelled) {
          setInspection({ directory, result });
        }
      } catch (error) {
        console.error('Failed to inspect save directory:', error);
        if (!cancelled) {
          setInspection({ directory, result: undefined });
        }
      }
    }, SAVE_DIRECTORY_INSPECTION_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [directory, enabled, inspectedDirectory]);

  const isCurrent = enabled && inspectedDirectory === directory;
  return {
    isInspecting: enabled && !isCurrent,
    result: isCurrent ? inspection?.result : undefined,
  };
}

/**
 * Decides whether a directory should be inspected: typed paths are always inspected, and the
 * applied directory is inspected when it has no character files so a better folder can be offered.
 * @param {string} trimmedDraft - Trimmed input value
 * @param {boolean} isBusy - Whether the step is loading or applying a change
 * @param {boolean} hasUnappliedDraft - Whether the input differs from the applied directory
 * @param {boolean} hasCharacterFiles - Whether the applied directory has character files
 * @returns {boolean} True if the directory should be inspected
 */
function shouldInspectDirectory(
  trimmedDraft: string,
  isBusy: boolean,
  hasUnappliedDraft: boolean,
  hasCharacterFiles: boolean,
): boolean {
  if (trimmedDraft === '' || isBusy) {
    return false;
  }
  return hasUnappliedDraft || !hasCharacterFiles;
}

/**
 * Inputs for {@link getSaveDirectoryViewState}.
 */
interface SaveDirectoryViewInput {
  saveDir: string;
  trimmedDraft: string;
  hasUnappliedDraft: boolean;
  hasCharacterFiles: boolean;
  isBusy: boolean;
  continueAnyway: boolean;
  inspection?: SaveDirectoryInspection;
}

/**
 * What the save directory step shows and whether it is valid.
 */
interface SaveDirectoryViewState {
  /** The wizard may proceed. */
  isStepValid: boolean;
  /** The typed directory exists and can be applied. */
  canApplyDraft: boolean;
  isNotDetected: boolean;
  isInputInvalid: boolean;
  showDraftStatus: boolean;
  showAppliedStatus: boolean;
  showContinueAnyway: boolean;
  /** A better folder to offer, if the chosen one looks like a parent/child mix-up. */
  suggestedDirectory?: string;
}

/**
 * Derives the step's view state. The step is only valid once the applied directory contains
 * character files, or the user explicitly chose to continue without them.
 * @param {SaveDirectoryViewInput} input - Current step state
 * @returns {SaveDirectoryViewState} Derived view state
 */
function getSaveDirectoryViewState(input: SaveDirectoryViewInput): SaveDirectoryViewState {
  const { saveDir, trimmedDraft, hasUnappliedDraft, hasCharacterFiles, isBusy } = input;
  const status = input.inspection?.status;
  const draftExists = status === 'noSaveFiles' || status === 'hasSaveFiles';
  const isNotDetected = !saveDir && !isBusy && trimmedDraft === '';
  const showAppliedStatus = saveDir !== '' && trimmedDraft !== '' && !hasUnappliedDraft && !isBusy;
  const suggestion = input.inspection?.suggestedDirectory;
  const showSuggestion =
    !isBusy && suggestion !== undefined && !isSameDirectory(suggestion, saveDir);

  return {
    isStepValid: showAppliedStatus && (hasCharacterFiles || input.continueAnyway),
    canApplyDraft: hasUnappliedDraft && !isBusy && draftExists,
    isNotDetected,
    isInputInvalid: isNotDetected || (hasUnappliedDraft && status !== undefined && !draftExists),
    showDraftStatus: hasUnappliedDraft && !isBusy,
    showAppliedStatus,
    showContinueAnyway: showAppliedStatus && !hasCharacterFiles,
    suggestedDirectory: showSuggestion ? suggestion : undefined,
  };
}

/**
 * Props for {@link DirectoryStatusBox}.
 */
interface DirectoryStatusBoxProps {
  tone: 'success' | 'warning';
  title: string;
  description?: string;
}

/**
 * Bordered status box describing the selected or typed directory.
 * @param {DirectoryStatusBoxProps} props - Tone, title and optional description
 * @returns {JSX.Element} Status box
 */
function DirectoryStatusBox({ tone, title, description }: DirectoryStatusBoxProps) {
  const isSuccess = tone === 'success';
  const Icon = isSuccess ? CheckCircle : AlertTriangle;
  const textClass = isSuccess ? 'text-success' : 'text-warning';

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border p-4 ${
        isSuccess ? 'border-success/30 bg-success/10' : 'border-warning/30 bg-warning/10'
      }`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${textClass}`} aria-hidden="true" />
      <div className="flex-1">
        <p className={`font-medium text-sm ${textClass}`}>{title}</p>
        {description && <p className={`text-xs ${textClass}`}>{description}</p>}
      </div>
    </div>
  );
}

/**
 * Status of a typed directory that has not been applied yet.
 * @param {DirectoryInspection} props - Inspection state of the typed directory
 * @returns {JSX.Element | null} Status content
 */
function DraftDirectoryStatus({ isInspecting, result }: DirectoryInspection) {
  const { t } = useTranslation();

  if (isInspecting) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t(translations.wizard.saveDirectory.checking)}
      </p>
    );
  }

  switch (result?.status) {
    case 'invalidPath':
      return (
        <DirectoryStatusBox
          tone="warning"
          title={t(translations.wizard.saveDirectory.invalidPath)}
        />
      );
    case 'notFound':
      return (
        <DirectoryStatusBox
          tone="warning"
          title={t(translations.wizard.saveDirectory.folderNotFound)}
        />
      );
    case 'noSaveFiles':
      return (
        <DirectoryStatusBox
          tone="warning"
          title={t(translations.wizard.saveDirectory.noCharacterFiles)}
          description={t(translations.wizard.saveDirectory.noCharacterFilesHint)}
        />
      );
    case 'hasSaveFiles':
      return (
        <DirectoryStatusBox
          tone="success"
          title={t(translations.wizard.saveDirectory.foundCharacters, {
            count: result.saveFileCount,
          })}
        />
      );
    default:
      return null;
  }
}

/**
 * Props for {@link AppliedDirectoryStatus}.
 */
interface AppliedDirectoryStatusProps {
  characterCount: number;
  inspectionStatus?: SaveDirectoryInspectionStatus;
}

/**
 * Status of the directory that is currently applied and monitored.
 * @param {AppliedDirectoryStatusProps} props - Character count and inspection status
 * @returns {JSX.Element} Status content
 */
function AppliedDirectoryStatus({ characterCount, inspectionStatus }: AppliedDirectoryStatusProps) {
  const { t } = useTranslation();

  if (characterCount > 0) {
    return (
      <DirectoryStatusBox
        tone="success"
        title={t(translations.wizard.saveDirectory.validated)}
        description={t(translations.wizard.saveDirectory.foundCharacters, {
          count: characterCount,
        })}
      />
    );
  }

  return (
    <DirectoryStatusBox
      tone="warning"
      title={
        inspectionStatus === 'notFound'
          ? t(translations.wizard.saveDirectory.folderNotFound)
          : t(translations.wizard.saveDirectory.noCharacterFiles)
      }
      description={t(translations.wizard.saveDirectory.noCharacterFilesHint)}
    />
  );
}

/**
 * Props for {@link DirectorySuggestion}.
 */
interface DirectorySuggestionProps {
  directory: string;
  onUse: () => void;
}

/**
 * Offers the actual save folder when the chosen one looks like its parent or a subfolder.
 * @param {DirectorySuggestionProps} props - Suggested directory and handler to apply it
 * @returns {JSX.Element} Suggestion content
 */
function DirectorySuggestion({ directory, onUse }: DirectorySuggestionProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/50 p-4">
      <FolderSearch className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex-1 space-y-2">
        <p className="font-medium text-sm">
          {t(translations.wizard.saveDirectory.suggestionTitle)}
        </p>
        <p className="text-muted-foreground text-xs">
          {t(translations.wizard.saveDirectory.suggestionDescription)}
        </p>
        <p className="break-all font-mono text-xs">{directory}</p>
        <Button size="sm" variant="outline" onClick={onUse}>
          {t(translations.wizard.saveDirectory.useSuggestion)}
        </Button>
      </div>
    </div>
  );
}

/**
 * Props for {@link ContinueAnywayOption}.
 */
interface ContinueAnywayOptionProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * Explicit opt-in to continue with a folder that has no character files yet.
 * @param {ContinueAnywayOptionProps} props - Checked state and change handler
 * @returns {JSX.Element} Checkbox with label and hint
 */
function ContinueAnywayOption({ checked, onCheckedChange }: ContinueAnywayOptionProps) {
  const { t } = useTranslation();
  const checkboxId = useId();
  const labelId = useId();
  const hintId = useId();

  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={checkboxId}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-labelledby={labelId}
        aria-describedby={hintId}
        className="mt-0.5"
      />
      <div className="space-y-1">
        <Label id={labelId} htmlFor={checkboxId} className="font-normal text-sm">
          {t(translations.wizard.saveDirectory.continueAnyway)}
        </Label>
        <p id={hintId} className="text-muted-foreground text-xs">
          {t(translations.wizard.saveDirectory.continueAnywayHint)}
        </p>
      </div>
    </div>
  );
}

/**
 * Props for {@link NotDetectedNotice}.
 */
interface NotDetectedNoticeProps {
  id: string;
  disabled: boolean;
  onBrowse: () => void;
}

/**
 * Shown when no save directory was found automatically.
 * @param {NotDetectedNoticeProps} props - Element id, disabled state and browse handler
 * @returns {JSX.Element} Notice content
 */
function NotDetectedNotice({ id, disabled, onBrowse }: NotDetectedNoticeProps) {
  const { t } = useTranslation();

  return (
    <div id={id} className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/50 p-4">
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
        <Button onClick={onBrowse} size="sm" disabled={disabled}>
          <FolderOpen className="mr-2 h-4 w-4" />
          {t(translations.wizard.saveDirectory.browseForFolder)}
        </Button>
      </div>
    </div>
  );
}

/**
 * SaveDirectoryStep component - Step for configuring the save file directory.
 * Users can browse for, type or paste their D2R save directory. Typed paths are inspected
 * (debounced) by the main process, which also suggests the actual save folder when the user
 * picked its parent or one of its subfolders. The step only becomes valid once the applied
 * directory contains character files, unless the user explicitly chooses to continue anyway.
 * Switching to a different directory while progress exists requires confirmation,
 * because the change permanently deletes existing characters and grail progress.
 * @returns {JSX.Element} Save directory configuration step content
 */
export function SaveDirectoryStep() {
  const { t } = useTranslation();
  const saveDirId = useId();
  const pathHintId = useId();
  const statusId = useId();
  const notDetectedId = useId();
  const { settings, reloadData } = useGrailStore();
  const setStepValidity = useWizardStore((state) => state.setStepValidity);
  // Directory the monitor is actually using
  const [saveDir, setSaveDir] = useState<string>(settings.saveDir || '');
  // Current input value, which may differ from `saveDir` while the user types
  const [draftDir, setDraftDir] = useState<string>(settings.saveDir || '');
  const [saveFiles, setSaveFiles] = useState<D2SaveFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingDirectoryChange | undefined>(undefined);
  const [hasError, setHasError] = useState(false);
  const [continueAnyway, setContinueAnyway] = useState(false);

  const isBusy = isLoading || isApplying;
  const trimmedDraft = draftDir.trim();
  const hasCharacterFiles = saveFiles.length > 0;
  const hasUnappliedDraft = isUnappliedDraft(trimmedDraft, saveDir);
  // Inspect typed paths, and the applied directory when it has no character files (for suggestions)
  const inspection = useDirectoryInspection(
    trimmedDraft,
    shouldInspectDirectory(trimmedDraft, isBusy, hasUnappliedDraft, hasCharacterFiles),
  );
  const view = getSaveDirectoryViewState({
    saveDir,
    trimmedDraft,
    hasUnappliedDraft,
    hasCharacterFiles,
    isBusy,
    continueAnyway,
    inspection: inspection.result,
  });
  const { isStepValid, suggestedDirectory } = view;

  useEffect(() => {
    setStepValidity(SAVE_DIRECTORY_STEP_ID, isStepValid);
  }, [isStepValid, setStepValidity]);

  // Load current save directory and files
  useEffect(() => {
    const loadSaveDirectory = async () => {
      try {
        setIsLoading(true);
        const status = await window.electronAPI?.saveFile.getMonitoringStatus();
        if (status?.directory) {
          setSaveDir(status.directory);
          setDraftDir(status.directory);
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
        let appliedDirectory = change.directory;
        if (change.action === 'restore') {
          const result = await window.electronAPI?.saveFile.restoreDefaultDirectory();
          appliedDirectory = result?.defaultDirectory || change.directory;
        } else {
          await window.electronAPI?.saveFile.updateSaveDirectory(change.directory);
        }
        setSaveDir(appliedDirectory);
        setDraftDir(appliedDirectory);
        setContinueAnyway(false);
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
        // Never keep the previous directory's files: they would wrongly validate the step
        setSaveFiles([]);
      }

      setPendingChange(undefined);
      setIsApplying(false);
    },
    [reloadData],
  );

  const requestDirectoryChange = useCallback(
    async (change: PendingDirectoryChange) => {
      setHasError(false);
      try {
        // `saveDir` is the directory the monitor is actually using (monitoring status), which is
        // the same effective directory (saveDir setting, else platform default) the main process
        // compares against before clearing data. Both only change together via the update/restore
        // IPCs, so a match here means main will not truncate. When the status is unknown,
        // `saveDir` falls back to '' or the stored setting, which errs toward asking for
        // confirmation.
        if (!isSameDirectory(saveDir, change.directory) && (await hasExistingUserData())) {
          // Require explicit confirmation before wiping existing progress
          setPendingChange(change);
          return;
        }

        await applyDirectoryChange(change);
      } catch (error) {
        console.error('Failed to request save directory change:', error);
        setHasError(true);
      }
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

  const { canApplyDraft } = view;

  const handleApplyDraft = useCallback(() => {
    if (canApplyDraft) {
      void requestDirectoryChange({ action: 'change', directory: trimmedDraft });
    }
  }, [canApplyDraft, requestDirectoryChange, trimmedDraft]);

  const handleDraftKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleApplyDraft();
      }
    },
    [handleApplyDraft],
  );

  const handleUseSuggestion = useCallback(() => {
    if (suggestedDirectory) {
      setDraftDir(suggestedDirectory);
      void requestDirectoryChange({ action: 'change', directory: suggestedDirectory });
    }
  }, [requestDirectoryChange, suggestedDirectory]);

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

  const describedBy = [pathHintId, statusId, view.isNotDetected ? notDetectedId : undefined]
    .filter(Boolean)
    .join(' ');

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
              type="text"
              value={draftDir}
              onChange={(event) => setDraftDir(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              disabled={isApplying}
              spellCheck={false}
              autoComplete="off"
              placeholder={t(translations.wizard.saveDirectory.placeholder)}
              className="flex-1"
              aria-invalid={view.isInputInvalid || undefined}
              aria-describedby={describedBy}
            />
            {hasUnappliedDraft && (
              <Button onClick={handleApplyDraft} disabled={!canApplyDraft}>
                <FolderCheck className="mr-2 h-4 w-4" />
                {t(translations.wizard.saveDirectory.useThisFolder)}
              </Button>
            )}
            <Button onClick={handleBrowse} variant="outline" disabled={isBusy}>
              <FolderOpen className="mr-2 h-4 w-4" />
              {t(translations.wizard.saveDirectory.browse)}
            </Button>
          </div>
          <p id={pathHintId} className="text-muted-foreground text-xs">
            {t(translations.wizard.saveDirectory.pathHint)}
          </p>
        </div>

        <Button onClick={handleRestoreDefault} variant="ghost" size="sm" disabled={isBusy}>
          {t(translations.wizard.saveDirectory.useDefault)}
        </Button>

        {view.isNotDetected && (
          <NotDetectedNotice id={notDetectedId} disabled={isBusy} onBrowse={handleBrowse} />
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

        {/* Validation status of the typed or applied directory */}
        <div id={statusId} aria-live="polite" className="space-y-4">
          {view.showDraftStatus && <DraftDirectoryStatus {...inspection} />}
          {view.showAppliedStatus && (
            <AppliedDirectoryStatus
              characterCount={saveFiles.length}
              inspectionStatus={inspection.result?.status}
            />
          )}
          {suggestedDirectory && (
            <DirectorySuggestion directory={suggestedDirectory} onUse={handleUseSuggestion} />
          )}
        </div>

        {view.showContinueAnyway && (
          <ContinueAnywayOption checked={continueAnyway} onCheckedChange={setContinueAnyway} />
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
