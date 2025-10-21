import { GameVersion } from 'electron/types/grail';
import { Gamepad2 } from 'lucide-react';
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
 * GameVersionStep component - Step for selecting the game version.
 * Allows users to choose between Resurrected or Classic.
 * @returns {JSX.Element} Game version selection step content
 */
export function GameVersionStep() {
  const gameVersionId = useId();
  const { settings, setSettings } = useGrailStore();
  const gameVersion = settings.gameVersion || GameVersion.Resurrected;

  const handleGameVersionChange = (value: GameVersion) => {
    setSettings({ gameVersion: value });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-bold text-2xl">Game Version</h2>
        <p className="text-muted-foreground">Select which version of Diablo II you're playing.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={gameVersionId}>Select Game Version</Label>
          <Select value={gameVersion} onValueChange={handleGameVersionChange}>
            <SelectTrigger id={gameVersionId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gameVersions.map((version) => (
                <SelectItem key={version.value} value={version.value}>
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">{version.label}</span>
                      <span className="text-muted-foreground text-xs">{version.description}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
          <p className="text-blue-800 text-sm dark:text-blue-200">
            <strong>Note:</strong> The game version setting affects item detection compatibility and
            may influence which save file formats are supported. Make sure to select the version
            that matches your Diablo II installation.
          </p>
        </div>
      </div>
    </div>
  );
}
