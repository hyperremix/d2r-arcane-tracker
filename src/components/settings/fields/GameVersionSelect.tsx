import { GameVersion } from 'electron/types/grail';
import { Gamepad2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { gameVersionDescriptionKeys, gameVersionLabelKeys } from '@/lib/labelKeys';

/**
 * Available game versions; labels and descriptions come from the shared label keys.
 */
const gameVersionValues: GameVersion[] = [GameVersion.Resurrected, GameVersion.Classic];

interface GameVersionSelectProps {
  /** Id of the select trigger, for the label rendered by the caller. */
  id: string;
  value: GameVersion;
  onValueChange: (gameVersion: GameVersion) => void;
}

/**
 * Game version select shared by the settings page and the setup wizard. The caller renders the
 * label.
 */
export function GameVersionSelect({ id, value, onValueChange }: GameVersionSelectProps) {
  const { t } = useTranslation();
  const items = gameVersionValues.map((version) => ({
    value: version,
    label: t(gameVersionLabelKeys[version]),
  }));

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(selected) => selected && onValueChange(selected as GameVersion)}
    >
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {gameVersionValues.map((version) => (
          <SelectItem key={version} value={version}>
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" />
              <div className="flex flex-col">
                <span className="font-medium">{t(gameVersionLabelKeys[version])}</span>
                <span className="text-muted-foreground text-xs">
                  {t(gameVersionDescriptionKeys[version])}
                </span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
