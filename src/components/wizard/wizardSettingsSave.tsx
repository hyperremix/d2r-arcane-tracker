import type { Settings } from 'electron/types/grail';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';
import type { SettingsSaveResult } from '@/stores/settingsStore';

/**
 * Saves wizard settings and tracks whether the latest save failed. The error toast is
 * suppressed because the modal wizard could not be interacted with outside of its dialog;
 * pair with {@link WizardSaveError} to show the failure inline instead.
 * @returns {{ saveSettings: (update: Partial<Settings>) => Promise<SettingsSaveResult>, saveFailed: boolean }} The save function and the failure flag
 */
export function useWizardSettingsSave() {
  const setSettings = useGrailStore((state) => state.setSettings);
  const [saveFailed, setSaveFailed] = useState(false);

  const saveSettings = useCallback(
    async (update: Partial<Settings>): Promise<SettingsSaveResult> => {
      const result = await setSettings(update, { notifyOnError: false });
      setSaveFailed(!result.success);
      return result;
    },
    [setSettings],
  );

  return { saveSettings, saveFailed };
}

interface WizardSaveErrorProps {
  visible: boolean;
}

/**
 * Inline alert shown in a wizard step when its settings could not be saved.
 * @param {WizardSaveErrorProps} props - Component props
 * @returns {JSX.Element | null} The alert, or nothing when there is no failure
 */
export function WizardSaveError({ visible }: WizardSaveErrorProps) {
  const { t } = useTranslation();

  if (!visible) {
    return null;
  }

  return (
    <p role="alert" className="text-destructive text-sm">
      {t(translations.wizard.saveError)}
    </p>
  );
}
