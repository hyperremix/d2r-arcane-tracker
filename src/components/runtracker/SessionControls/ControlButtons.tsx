import { Loader2, Pause, Play, Square, StopCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';

export interface ControlButtonsProps {
  shortcuts: {
    startRun: string;
    pauseRun: string;
    endRun: string;
    endSession: string;
  };
  canStartRun: boolean;
  canPauseResume: boolean;
  canEndRun: boolean;
  canEndSession: boolean;
  isPaused: boolean;
  loading: boolean;
  onStartRun: () => void;
  onPauseRun: () => void;
  onResumeRun: () => void;
  onEndRun: () => void;
  onEndSession: () => void;
}

export function ControlButtons({
  shortcuts,
  canStartRun,
  canPauseResume,
  canEndRun,
  canEndSession,
  isPaused,
  loading,
  onStartRun,
  onPauseRun,
  onResumeRun,
  onEndRun,
  onEndSession,
}: ControlButtonsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {/* Start Run Button */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="default"
                size="sm"
                onClick={onStartRun}
                disabled={!canStartRun || loading}
                className="flex items-center gap-2"
              />
            }
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {t(translations.runTracker.controls.startRun)}
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {t(translations.runTracker.controls.startRunTooltip, {
                shortcut: shortcuts.startRun,
              })}
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Pause/Resume Button */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                onClick={isPaused ? onResumeRun : onPauseRun}
                disabled={!canPauseResume || loading}
                className="flex items-center gap-2"
              />
            }
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isPaused ? (
              <Play className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            {isPaused
              ? t(translations.runTracker.controls.resume)
              : t(translations.runTracker.controls.pause)}
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isPaused
                ? t(translations.runTracker.controls.resumeRunTooltip, {
                    shortcut: shortcuts.pauseRun,
                  })
                : t(translations.runTracker.controls.pauseRunTooltip, {
                    shortcut: shortcuts.pauseRun,
                  })}
            </p>
          </TooltipContent>
        </Tooltip>

        {/* End Run Button */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                onClick={onEndRun}
                disabled={!canEndRun || loading}
                className="flex items-center gap-2"
              />
            }
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            {t(translations.runTracker.controls.endRun)}
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {t(translations.runTracker.controls.endRunTooltip, {
                shortcut: shortcuts.endRun,
              })}
            </p>
          </TooltipContent>
        </Tooltip>

        {/* End Session Button */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="destructive"
                size="sm"
                onClick={onEndSession}
                disabled={!canEndSession || loading}
                className="flex items-center gap-2"
              />
            }
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <StopCircle className="h-4 w-4" />
            )}
            {t(translations.runTracker.controls.endSession)}
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {t(translations.runTracker.controls.endSessionTooltip, {
                shortcut: shortcuts.endSession,
              })}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Keyboard Shortcuts Info */}
      <div className="rounded-md bg-muted p-3">
        <p className="text-muted-foreground text-xs">
          <strong>{t(translations.runTracker.controls.shortcutsInfo)}</strong>{' '}
          {t(translations.runTracker.controls.shortcutsDetail, {
            startRun: shortcuts.startRun,
            pauseRun: shortcuts.pauseRun,
            endRun: shortcuts.endRun,
            endSession: shortcuts.endSession,
          })}
        </p>
      </div>
    </div>
  );
}
