import { GameMode } from 'electron/types/grail';
import { Shield, Sword, Users, Wrench } from 'lucide-react';
import { useCallback, useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGrailStore } from '@/stores/grailStore';

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

export function GameModeSettings() {
  const gameModeSelectId = useId();
  const { settings, setSettings } = useGrailStore();

  const updateGameMode = useCallback(
    (gameMode: GameMode) => {
      setSettings({ gameMode });
    },
    [setSettings],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Game Mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={gameModeSelectId}>Select Game Mode</Label>
          <Select value={settings.gameMode} onValueChange={updateGameMode}>
            <SelectTrigger id={gameModeSelectId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gameModes.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  <div className="flex items-center gap-2">
                    {mode.icon}
                    <div className="flex flex-col">
                      <span className="font-medium">{mode.label}</span>
                      <span className="text-gray-500 text-xs">{mode.description}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded bg-blue-50 p-3">
          <p className="text-blue-800 text-sm">
            <strong>Note:</strong> The game mode setting determines which characters' items are
            tracked. This affects item detection from save files and may influence your completion
            statistics.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
