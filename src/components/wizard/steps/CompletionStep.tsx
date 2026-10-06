import { GameMode, GameVersion } from 'electron/types/grail';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  gameModeLabelKeys,
  gameVersionLabelKeys,
  themeLabelKeys,
} from '@/components/wizard/labelKeys';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * A label/value pair shown in the configuration summary.
 */
interface SummaryRow {
  labelKey: string;
  value: string;
}

/**
 * CompletionStep component - Final step of the setup wizard.
 * Displays a summary of configured settings and completion message.
 * @returns {JSX.Element} Completion step content
 */
export function CompletionStep() {
  const { t } = useTranslation();
  const { settings } = useGrailStore();

  const enabledLabel = (enabled: boolean) =>
    enabled
      ? t(translations.wizard.completion.enabled)
      : t(translations.wizard.completion.disabled);

  const summaryRows: SummaryRow[] = [
    {
      labelKey: translations.wizard.completion.saveDirectory,
      value: settings.saveDir
        ? t(translations.wizard.completion.configured)
        : t(translations.wizard.completion.notSet),
    },
    {
      labelKey: translations.wizard.completion.gameMode,
      value: t(gameModeLabelKeys[settings.gameMode || GameMode.Both]),
    },
    {
      labelKey: translations.wizard.completion.gameVersion,
      value: t(gameVersionLabelKeys[settings.gameVersion || GameVersion.Resurrected]),
    },
    {
      labelKey: translations.wizard.completion.normalItems,
      value: enabledLabel(settings.grailNormal ?? true),
    },
    {
      labelKey: translations.wizard.completion.etherealItems,
      value: enabledLabel(Boolean(settings.grailEthereal)),
    },
    {
      labelKey: translations.wizard.completion.runes,
      value: enabledLabel(Boolean(settings.grailRunes)),
    },
    {
      labelKey: translations.wizard.completion.runewords,
      value: enabledLabel(Boolean(settings.grailRunewords)),
    },
    {
      labelKey: translations.wizard.completion.theme,
      value: t(themeLabelKeys[settings.theme || 'system']),
    },
    {
      labelKey: translations.wizard.completion.notifications,
      value: enabledLabel(settings.enableSounds ?? true),
    },
    {
      labelKey: translations.wizard.completion.widget,
      value: enabledLabel(Boolean(settings.widgetEnabled)),
    },
  ];

  const nextSteps = [
    translations.wizard.completion.nextStepPlay,
    translations.wizard.completion.nextStepMonitor,
    translations.wizard.completion.nextStepProgress,
    translations.wizard.completion.nextStepStatistics,
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-gradient-to-br from-green-500 to-emerald-500 p-4">
          <CheckCircle2 className="h-12 w-12 text-white" />
        </div>
        <h2 className="font-bold text-2xl">{t(translations.wizard.completion.title)}</h2>
        <p className="max-w-lg text-muted-foreground">
          {t(translations.wizard.completion.description)}
        </p>
      </div>

      <div className="space-y-4 rounded-lg border bg-muted/30 p-6">
        <h3 className="flex items-center gap-2 font-semibold text-lg">
          <Sparkles className="h-5 w-5" />
          {t(translations.wizard.completion.summary)}
        </h3>
        <dl className="space-y-2 text-sm">
          {summaryRows.map((row) => (
            <div key={row.labelKey} className="flex justify-between">
              <dt className="text-muted-foreground">{t(row.labelKey)}</dt>
              <dd className="font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-lg border-2 border-primary/50 border-dashed bg-primary/5 p-6">
        <h3 className="font-semibold text-lg">{t(translations.wizard.completion.nextSteps)}</h3>
        <ol className="mt-3 space-y-2 text-sm">
          {nextSteps.map((key, index) => (
            <li key={key} className="flex items-start gap-2">
              <span className="text-primary" aria-hidden="true">
                {index + 1}.
              </span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="text-center text-muted-foreground text-sm">
        {t(translations.wizard.completion.finishHint)}
      </div>
    </div>
  );
}
