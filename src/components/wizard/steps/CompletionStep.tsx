import { GameMode, GameVersion } from 'electron/types/grail';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import { gameModeLabelKeys, gameVersionLabelKeys, themeLabelKeys } from '@/lib/labelKeys';
import { useGrailStore } from '@/stores/grailStore';

/**
 * A label/value pair shown in the configuration summary.
 */
interface SummaryRow {
  labelKey: string;
  value: string;
  /** Render the value as a (possibly long) file system path. */
  isPath?: boolean;
}

/**
 * Save directory currently monitored and the number of character files found in it.
 */
interface SaveDirectorySummary {
  directory?: string;
  characterCount?: number;
}

/**
 * Loads the monitored save directory and its character file count for the summary.
 * Falls back to the stored setting if the monitoring status is unavailable.
 * @param {string | undefined} storedSaveDir - Save directory from settings
 * @returns {SaveDirectorySummary} The directory and character count, once loaded
 */
function useSaveDirectorySummary(storedSaveDir: string | undefined): SaveDirectorySummary {
  const [summary, setSummary] = useState<SaveDirectorySummary>({ directory: storedSaveDir });

  useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      let directory = storedSaveDir;
      let characterCount: number | undefined;
      try {
        const status = await window.electronAPI?.saveFile.getMonitoringStatus();
        directory = status?.directory || storedSaveDir;
      } catch (error) {
        console.error('Failed to load monitoring status for summary:', error);
      }
      try {
        const files = await window.electronAPI?.saveFile.getSaveFiles();
        characterCount = files?.length;
      } catch (error) {
        console.error('Failed to load save files for summary:', error);
      }
      if (!cancelled) {
        setSummary({ directory, characterCount });
      }
    };

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [storedSaveDir]);

  return summary;
}

/**
 * CompletionStep component - Final step of the setup wizard.
 * Displays a summary of configured settings and completion message.
 * @returns {JSX.Element} Completion step content
 */
export function CompletionStep() {
  const { t } = useTranslation();
  const { settings } = useGrailStore();
  const saveDirectorySummary = useSaveDirectorySummary(settings.saveDir || undefined);

  const enabledLabel = (enabled: boolean) =>
    enabled
      ? t(translations.wizard.completion.enabled)
      : t(translations.wizard.completion.disabled);

  const summaryRows: SummaryRow[] = [
    {
      labelKey: translations.wizard.completion.saveDirectory,
      value: saveDirectorySummary.directory || t(translations.wizard.completion.notSet),
      isPath: Boolean(saveDirectorySummary.directory),
    },
    ...(saveDirectorySummary.directory && saveDirectorySummary.characterCount !== undefined
      ? [
          {
            labelKey: translations.wizard.completion.characterFiles,
            value: String(saveDirectorySummary.characterCount),
          },
        ]
      : []),
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
        <div className="rounded-full bg-success p-4">
          <CheckCircle2 className="h-12 w-12 text-success-foreground" />
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
            <div key={row.labelKey} className="flex justify-between gap-4">
              <dt className="shrink-0 text-muted-foreground">{t(row.labelKey)}</dt>
              <dd
                className={
                  row.isPath ? 'min-w-0 break-all text-right font-medium font-mono' : 'font-medium'
                }
              >
                {row.value}
              </dd>
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
