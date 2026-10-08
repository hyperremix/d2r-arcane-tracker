import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';

interface WizardSaveErrorProps {
  visible: boolean;
}

/**
 * Stand-in for `@/components/wizard/wizardSettingsSave` in test files that mock `grailStore`.
 * The real module imports the store, so with `isolate: false` it would be cached bound to that
 * mock for every later test file; the real component is covered by wizardSettingsSave.test.tsx.
 * Usage: `vi.mock('@/components/wizard/wizardSettingsSave', () => import('@/test/wizardSettingsSaveStub'))`
 */
export function WizardSaveError({ visible }: WizardSaveErrorProps) {
  const { t } = useTranslation();
  return visible ? <p role="alert">{t(translations.wizard.saveError)}</p> : null;
}
