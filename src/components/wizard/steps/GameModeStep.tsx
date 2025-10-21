import { GameMode } from 'electron/types/grail';
import { Shield, Sword, Users, Wrench } from 'lucide-react';
import { useId } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGrailStore } from '@/stores/grailStore';

/**
 * Available game modes with their labels, descriptions, and icons.
 */
const gameModes: { value: GameMode; label: string; description: string; icon: React.ReactNode }[] =
  [
    {
      value: GameMode.Both,
      label: 'Both Softcore & Hardcore',
      description: 'Track items from both softcore and hardcore characters',
      icon: <Users className="h-4 w-4" />,
    },
    {
      value: GameMode.Softcore,
      label: 'Softcore Only',
      description: 'Track items only from softcore characters',
      icon: <Shield className="h-4 w-4" />,
    },
    {
      value: GameMode.Hardcore,
      label: 'Hardcore Only',
      description: 'Track items only from hardcore characters',
      icon: <Sword className="h-4 w-4" />,
    },
    {
      value: GameMode.Manual,
      label: 'Manual Entry',
      description: 'Manually enter items without automatic save file monitoring',
      icon: <Wrench className="h-4 w-4" />,
    },
  ];

/**
 * GameModeStep component - Step for selecting the game mode.
 * Allows users to choose between Both, Softcore, Hardcore, or Manual tracking.
 * @returns {JSX.Element} Game mode selection step content
 */
export function GameModeStep() {
  const gameModeId = useId();
  const { settings, setSettings } = useGrailStore();
  const gameMode = settings.gameMode || GameMode.Both;

  const handleGameModeChange = (value: GameMode) => {
    setSettings({ gameMode: value });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-bold text-2xl">Game Mode</h2>
        <p className="text-muted-foreground">
          Choose which character types you want to track in your Holy Grail.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={gameModeId}>Select Game Mode</Label>
          <Select value={gameMode} onValueChange={handleGameModeChange}>
            <SelectTrigger id={gameModeId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gameModes.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  <div className="flex items-center gap-2">
                    {mode.icon}
                    <div className="flex flex-col">
                      <span className="font-medium">{mode.label}</span>
                      <span className="text-muted-foreground text-xs">{mode.description}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
          <p className="text-blue-800 text-sm dark:text-blue-200">
            <strong>Note:</strong> The game mode setting determines which characters' items are
            tracked. This affects item detection from save files and may influence your completion
            statistics.
          </p>
        </div>
      </div>
    </div>
  );
}
