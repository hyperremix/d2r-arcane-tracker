import { TooltipProvider } from '@/components/ui/tooltip';
import { DatabaseCard } from './Database';
import { GameModeSettings } from './GameModeSettings';
import { GameVersionSettings } from './GameVersionSettings';
import { GrailSettings } from './GrailSettings';
import { NotificationSettings } from './NotificationSettings';
import { SaveFileMonitor } from './SaveFileMonitor';
import { ThemeSettings } from './ThemeSettings';

/**
 * Settings component that serves as the main settings page.
 * Displays all configuration options including save file monitoring, grail settings,
 * notifications, theme, game mode, game version, and database management.
 * @returns {JSX.Element} The main settings interface with all configuration cards
 */
export function Settings() {
  return (
    <TooltipProvider>
      <div className="container mx-auto space-y-6 p-6">
        <div className="space-y-6">
          <SaveFileMonitor />
          <GrailSettings />
          <NotificationSettings />
          <ThemeSettings />
          <GameModeSettings />
          <GameVersionSettings />
          <DatabaseCard />
        </div>
      </div>
    </TooltipProvider>
  );
}
