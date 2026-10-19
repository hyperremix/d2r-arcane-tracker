import { FolderCheck, FolderCog, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';

interface D2RFolderPromptProps {
  /**
   * `page` is a centered block for the page whose feature needs the folder; `inline` is a one-line
   * hint for content that is still shown without it, such as the retail terror zone schedule.
   */
  layout: 'page' | 'inline';
  /** What the folder is needed for here */
  description: string;
  /** Called after a found installation folder was saved, so the data can be read again */
  onFolderSet?: () => void;
}

/**
 * Asks the main process for a D2R installation in a well-known folder. Nothing is saved: the
 * user confirms the folder with the prompt's button.
 * @returns The installation folder once found, otherwise undefined
 */
function useSuggestedD2RPath(): string | undefined {
  const [suggestedPath, setSuggestedPath] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const suggestion = await window.electronAPI.icon.getSuggestedD2RPath();
        if (!cancelled) setSuggestedPath(suggestion || undefined);
      } catch (error) {
        console.error('Failed to get suggested D2R path:', error);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return suggestedPath;
}

/**
 * Asks to set the D2R installation folder. When the game is found in a well-known folder, it
 * offers that folder with one click; the button to its setting is always there. Shown wherever
 * something is read from the game files and no folder is set yet. It is a calm prompt, not an
 * error: problems with a folder that is set are shown as warnings by the features themselves.
 */
export function D2RFolderPrompt({ layout, description, onFolderSet }: D2RFolderPromptProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hydrateSettings = useGrailStore((state) => state.hydrateSettings);
  const suggestedPath = useSuggestedD2RPath();
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const isPage = layout === 'page';
  const primaryVariant = isPage ? 'default' : 'outline';
  const secondaryVariant = isPage ? 'outline' : 'ghost';

  const saveSuggestedPath = async (folder: string) => {
    setIsSaving(true);
    setSaveFailed(false);
    try {
      // The main process saves the path and updates the icon service; the store mirrors it after
      await window.electronAPI.icon.setD2RPath(folder);
      hydrateSettings({ d2rInstallPath: folder });
      onFolderSet?.();
    } catch (error) {
      console.error('Failed to save D2R path:', error);
      setSaveFailed(true);
    } finally {
      setIsSaving(false);
    }
  };

  const actions = (
    <div className={cn('flex max-w-full flex-wrap gap-2', isPage && 'justify-center')}>
      {suggestedPath && (
        <Button
          type="button"
          variant={primaryVariant}
          size={isPage ? 'default' : 'sm'}
          disabled={isSaving}
          onClick={() => void saveSuggestedPath(suggestedPath)}
          className="max-w-full"
        >
          <FolderCheck aria-hidden="true" />
          <span className="truncate">
            {t(translations.terrorZone.notConfigured.useFolder, { path: suggestedPath })}
          </span>
        </Button>
      )}
      <Button
        type="button"
        variant={suggestedPath ? secondaryVariant : primaryVariant}
        size={isPage ? 'default' : 'sm'}
        onClick={() => navigate('/settings')}
      >
        <Settings aria-hidden="true" />
        {t(translations.terrorZone.openInstallationSettings)}
      </Button>
    </div>
  );

  const saveError = saveFailed && (
    <p role="alert" className="text-destructive text-sm">
      {t(translations.wizard.d2rInstallation.saveFailed)}
    </p>
  );

  if (!isPage) {
    return (
      <div
        data-testid="d2r-folder-prompt"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
      >
        <FolderCog aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">{description}</p>
        {actions}
        {saveError}
      </div>
    );
  }

  return (
    <div
      data-testid="d2r-folder-prompt"
      className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
    >
      <FolderCog aria-hidden="true" className="size-10 shrink-0 text-muted-foreground" />
      <h2 className="font-semibold text-foreground text-lg">
        {t(translations.terrorZone.notConfigured.title)}
      </h2>
      <p className="max-w-md text-muted-foreground text-sm">{description}</p>
      <div className="mt-2 flex max-w-full flex-col items-center gap-2">
        {actions}
        {saveError}
      </div>
    </div>
  );
}
