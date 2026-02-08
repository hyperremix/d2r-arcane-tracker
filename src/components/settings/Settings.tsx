import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';
import { useWizardStore } from '@/stores/wizardStore';
import { D2RInstallationSettings } from './D2RInstallationSettings';
import { DatabaseCard } from './Database';
import { GameModeSettings } from './GameModeSettings';
import { GameVersionSettings } from './GameVersionSettings';
import { GrailSettings } from './GrailSettings';
import { ItemIconSettings } from './ItemIconSettings';
import { NotificationSettings } from './NotificationSettings';
import { ReportIssues } from './ReportIssues';
import { RunTrackerSettings } from './RunTrackerSettings';
import { SaveFileMonitor } from './SaveFileMonitor';
import { ThemeSettings } from './ThemeSettings';
import { UpdateSettings } from './UpdateSettings';
import { WidgetSettings } from './WidgetSettings';

/**
 * Settings component that serves as the main settings page.
 * Displays all configuration options including save file monitoring, grail settings,
 * notifications, theme, game mode, game version, and database management.
 * @returns {JSX.Element} The main settings interface with all configuration cards
 */
export function Settings() {
  const { t } = useTranslation();
  const { openWizard } = useWizardStore();

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
          <UpdateSettings />
          <SaveFileMonitor />
          <D2RInstallationSettings />
          <GrailSettings />
          <NotificationSettings />
          <WidgetSettings />
          <RunTrackerSettings />
          <ThemeSettings />
          <ItemIconSettings />
          <GameModeSettings />
          <GameVersionSettings />
          <DatabaseCard />
          {/* Setup Wizard Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                {t(translations.settings.setupWizard.title)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                {t(translations.settings.setupWizard.description)}
              </p>
              <Button onClick={openWizard} variant="default">
                <Sparkles className="mr-2 h-4 w-4" />
                {t(translations.settings.setupWizard.runWizard)}
              </Button>
            </CardContent>
          </Card>
          <ReportIssues />
        </div>
      </div>
    </TooltipProvider>
  );
}
