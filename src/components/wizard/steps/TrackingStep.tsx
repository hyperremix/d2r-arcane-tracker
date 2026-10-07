import { Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import { GameModeStep } from './GameModeStep';
import { GameVersionStep } from './GameVersionStep';
import { GrailSettingsStep } from './GrailSettingsStep';

/**
 * TrackingStep component - "What to track" wizard step that groups the game mode,
 * grail contents and game version choices into a single step. All of them have
 * sensible defaults, so the user can usually just continue.
 * @returns {JSX.Element} Tracking step content
 */
export function TrackingStep() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6" aria-hidden="true" />
          <h2 className="font-bold text-2xl">{t(translations.wizard.tracking.title)}</h2>
        </div>
        <p className="text-muted-foreground">{t(translations.wizard.tracking.description)}</p>
      </div>

      <GameModeStep />
      <hr className="border-border" />
      <GrailSettingsStep />
      <hr className="border-border" />
      <GameVersionStep />
    </div>
  );
}
