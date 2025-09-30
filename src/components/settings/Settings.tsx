import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DatabaseCard } from './Database';
import { GameModeSettings } from './GameModeSettings';
import { GameVersionSettings } from './GameVersionSettings';
import { GrailSettings } from './GrailSettings';
import { NotificationSettings } from './NotificationSettings';
import { SaveFileMonitor } from './SaveFileMonitor';

/**
 * Settings component that serves as the main settings page.
 * Displays all configuration options including save file monitoring, grail settings,
 * notifications, game mode, game version, and database management.
 * @returns {JSX.Element} The main settings interface with all configuration cards
 */
export function Settings() {
  return (
    <TooltipProvider>
      <div className="container mx-auto space-y-6 p-6">
        {/* Header with back button */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            <h2 className="font-semibold text-xl">Settings</h2>
          </div>
          <Button asChild variant="ghost" size="sm" className="w-fit">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <div className="space-y-6">
          <SaveFileMonitor />
          <GrailSettings />
          <NotificationSettings />
          <GameModeSettings />
          <GameVersionSettings />
          <DatabaseCard />
        </div>
      </div>
    </TooltipProvider>
  );
}
