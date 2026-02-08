import { MessageCircle } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';

/**
 * ReportIssues component that provides a link to report bugs on GitHub.
 * Displays information about reporting issues and a button to open the GitHub issues page.
 * @returns {JSX.Element} A settings card with bug reporting information and action button
 */
export function ReportIssues() {
  const { t } = useTranslation();

  const handleOpenIssues = useCallback(async () => {
    await window.electronAPI?.shell.openExternal(
      'https://github.com/hyperremix/d2r-arcane-tracker/issues',
    );
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5" />
          {t(translations.settings.reportIssues.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <p className="text-gray-600 text-sm dark:text-gray-400">
            {t(translations.settings.reportIssues.description)}
          </p>
          <Button onClick={handleOpenIssues} size="sm" className="gap-2">
            {t(translations.settings.reportIssues.openGithubIssues)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
