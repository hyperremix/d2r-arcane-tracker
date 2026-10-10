import { GameMode } from 'electron/types/grail';
import type { LucideIcon } from 'lucide-react';
import { Shield, Sword, Users, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { gameModeDescriptionKeys, gameModeLabelKeys } from '@/lib/labelKeys';

/**
 * Available game modes with their icons; labels and descriptions come from the shared label keys.
 */
const gameModeOptions: { value: GameMode; Icon: LucideIcon }[] = [
  { value: GameMode.Both, Icon: Users },
  { value: GameMode.Softcore, Icon: Shield },
  { value: GameMode.Hardcore, Icon: Sword },
  { value: GameMode.Manual, Icon: Wrench },
];

interface GameModeSelectProps {
  /** Id of the select trigger, for the label rendered by the caller. */
  id: string;
  value: GameMode;
  onValueChange: (gameMode: GameMode) => void;
}

/**
 * Game mode select shared by the settings page and the setup wizard. The caller renders the label.
 */
export function GameModeSelect({ id, value, onValueChange }: GameModeSelectProps) {
  const { t } = useTranslation();
  const labelKey = gameModeLabelKeys[value] as string | undefined;

  return (
    <Select
      value={value}
      onValueChange={(selected) => selected && onValueChange(selected as GameMode)}
    >
      <SelectTrigger id={id}>
        <SelectValue>{labelKey ? t(labelKey) : null}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {gameModeOptions.map(({ value: mode, Icon }) => (
          <SelectItem key={mode} value={mode}>
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <div className="flex flex-col">
                <span className="font-medium">{t(gameModeLabelKeys[mode])}</span>
                <span className="text-muted-foreground text-xs">
                  {t(gameModeDescriptionKeys[mode])}
                </span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
