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
      {/* The step title is shown in the wizard header */}
      <p className="text-muted-foreground">{t(translations.wizard.tracking.description)}</p>

      <GameModeStep />
      <hr className="border-border" />
      <GrailSettingsStep />
      <hr className="border-border" />
      <GameVersionStep />
    </div>
  );
}
