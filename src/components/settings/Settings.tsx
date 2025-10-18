import { TooltipProvider } from '@/components/ui/tooltip';
import { DatabaseCard } from './Database';
import { GameModeSettings } from './GameModeSettings';
import { GameVersionSettings } from './GameVersionSettings';
import { GrailSettings } from './GrailSettings';
import { ItemIconSettings } from './ItemIconSettings';
import { NotificationSettings } from './NotificationSettings';
import { ReportIssues } from './ReportIssues';
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
  return (
    <TooltipProvider>
      <div className="h-[calc(100vh-48px)] overflow-y-auto">
        <div className="space-y-6 p-6">
          <UpdateSettings />
          <SaveFileMonitor />
          <GrailSettings />
          <NotificationSettings />
          <WidgetSettings />
          <ThemeSettings />
          <ItemIconSettings />
          <GameModeSettings />
          <GameVersionSettings />
          <DatabaseCard />
          <ReportIssues />
        </div>
      </div>
    </TooltipProvider>
  );
}
