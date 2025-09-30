import { GameVersion } from 'electron/types/grail';
import { Gamepad2 } from 'lucide-react';
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

/**
 * Available game versions with their labels and descriptions.
 */
const gameVersions: { value: GameVersion; label: string; description: string }[] = [
  {
    value: GameVersion.Resurrected,
    label: 'Diablo II: Resurrected',
    description: 'Modern remaster with enhanced graphics and quality of life improvements',
  },
  {
    value: GameVersion.Classic,
    label: 'Diablo II: Classic',
    description: 'Original Diablo II with Lord of Destruction expansion',
  },
];

/**
 * GameVersionSettings component that allows users to select the Diablo II game version.
 * Provides options for Diablo II: Resurrected or Diablo II: Classic.
 * @returns {JSX.Element} A settings card with game version selection dropdown
 */
export function GameVersionSettings() {
  const gameVersionSelectId = useId();
  const { settings, setSettings } = useGrailStore();

  const updateGameVersion = useCallback(
    (gameVersion: GameVersion) => {
      setSettings({ gameVersion });
    },
    [setSettings],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5" />
          Game Version
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={gameVersionSelectId}>Select Game Version</Label>
          <Select value={settings.gameVersion} onValueChange={updateGameVersion}>
            <SelectTrigger id={gameVersionSelectId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gameVersions.map((version) => (
                <SelectItem key={version.value} value={version.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{version.label}</span>
                    <span className="text-gray-500 text-xs">{version.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded bg-blue-50 p-3">
          <p className="text-blue-800 text-sm">
            <strong>Note:</strong> The game version setting affects item detection compatibility and
            may influence which save file formats are supported. Make sure to select the version
            that matches your Diablo II installation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
