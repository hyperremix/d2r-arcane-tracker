import { FolderCog, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';

interface D2RFolderPromptProps {
  /**
   * `page` is a centered empty state that replaces a page's content; `inline` is a compact box for
   * content that is still shown without the folder, such as the retail terror zone schedule.
   */
  layout: 'page' | 'inline';
}

/**
 * Asks to set the D2R installation folder, with a button that opens its setting. Shown wherever
 * something is read from the game files and no folder is set yet. It is a calm prompt, not an
 * error: problems with a folder that is set are shown as warnings by the features themselves.
 */
export function D2RFolderPrompt({ layout }: D2RFolderPromptProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isPage = layout === 'page';
  const Title = isPage ? 'h2' : 'p';

  return (
    <div
      data-testid="d2r-folder-prompt"
      className={cn(
        isPage
          ? 'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center'
          : 'flex items-start gap-3 rounded-lg border bg-muted/30 p-4',
      )}
    >
      <FolderCog
        aria-hidden="true"
        className={cn('shrink-0 text-muted-foreground', isPage ? 'size-10' : 'mt-0.5 size-5')}
      />
      <div className={cn('flex flex-col gap-1', isPage ? 'items-center gap-3' : 'items-start')}>
        <Title className={cn('font-semibold text-foreground', isPage ? 'text-lg' : 'text-sm')}>
          {t(translations.terrorZone.notConfigured.title)}
        </Title>
        <p className="max-w-md text-muted-foreground text-sm">
          {t(translations.terrorZone.notConfigured.description)}
        </p>
        <Button
          type="button"
          variant={isPage ? 'default' : 'outline'}
          size={isPage ? 'default' : 'sm'}
          onClick={() => navigate('/settings')}
          className="mt-2"
        >
          <Settings aria-hidden="true" />
          {t(translations.terrorZone.openInstallationSettings)}
        </Button>
      </div>
    </div>
  );
}
