import { Globe, Loader2, Pause, Play, Square, StopCircle, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';

export interface ControlButtonsPending {
  startSession: boolean;
  startRun: boolean;
  pauseResume: boolean;
  endRun: boolean;
  endSession: boolean;
}

export interface RunTrackerShortcuts {
  startRun: string;
  pauseRun: string;
  endRun: string;
  endSession: string;
}

export interface ControlButtonsProps {
  shortcuts: RunTrackerShortcuts;
  hasSession: boolean;
  hasActiveRun: boolean;
  autoModeEnabled: boolean;
  canStartSession: boolean;
  canStartRun: boolean;
  canPauseResume: boolean;
  canEndRun: boolean;
  canEndSession: boolean;
  isPaused: boolean;
  pending: ControlButtonsPending;
  onStartSession: () => void;
  onStartRun: () => void;
  onPauseRun: () => void;
  onResumeRun: () => void;
  onEndRun: () => void;
  onEndSession: () => void;
}

interface ActionButtonProps {
  icon: ReactNode;
  label: string;
  tooltip?: string;
  variant: 'default' | 'outline' | 'destructive';
  size: 'sm' | 'lg';
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
}

// Button that swaps its icon for a spinner while pending and optionally shows a shortcut tooltip
function ActionButton({
  icon,
  label,
  tooltip,
  variant,
  size,
  disabled,
  pending,
  onClick,
}: ActionButtonProps) {
  const content = (
    <>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {label}
    </>
  );
  const buttonProps = {
    variant,
    size,
    onClick,
    disabled: disabled || pending,
    'aria-busy': pending,
    className: size === 'lg' ? 'min-w-36 gap-2 px-4' : 'gap-2',
  };

  if (!tooltip) {
    return <Button {...buttonProps}>{content}</Button>;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<Button {...buttonProps} />}>{content}</TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Live session actions: one primary, state-dependent action (Start New Session, Start Run or End Run)
 * plus secondary Pause/Resume and End Session. In auto mode the manual run actions are replaced by
 * a notice explaining that runs are tracked automatically.
 */
export function ControlButtons({
  shortcuts,
  hasSession,
  hasActiveRun,
  autoModeEnabled,
  canStartSession,
  canStartRun,
  canPauseResume,
  canEndRun,
  canEndSession,
  isPaused,
  pending,
  onStartSession,
  onStartRun,
  onPauseRun,
  onResumeRun,
  onEndRun,
  onEndSession,
}: ControlButtonsProps) {
  const { t } = useTranslation();

  if (!hasSession) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          icon={<Play className="h-4 w-4" aria-hidden="true" />}
          label={t(translations.runTracker.sessionCard.startNewSession)}
          variant="default"
          size="lg"
          disabled={!canStartSession}
          pending={pending.startSession}
          onClick={onStartSession}
        />
      </div>
    );
  }

  const showManualRunActions = !autoModeEnabled;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {showManualRunActions && !hasActiveRun && (
          <ActionButton
            icon={<Play className="h-4 w-4" aria-hidden="true" />}
            label={t(translations.runTracker.controls.startRun)}
            tooltip={t(translations.runTracker.controls.startRunTooltip, {
              shortcut: shortcuts.startRun,
            })}
            variant="default"
            size="lg"
            disabled={!canStartRun}
            pending={pending.startRun}
            onClick={onStartRun}
          />
        )}

        {showManualRunActions && hasActiveRun && (
          <>
            <ActionButton
              icon={<Square className="h-4 w-4" aria-hidden="true" />}
              label={t(translations.runTracker.controls.endRun)}
              tooltip={t(translations.runTracker.controls.endRunTooltip, {
                shortcut: shortcuts.endRun,
              })}
              variant="default"
              size="lg"
              disabled={!canEndRun}
              pending={pending.endRun}
              onClick={onEndRun}
            />
            <ActionButton
              icon={
                isPaused ? (
                  <Play className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Pause className="h-4 w-4" aria-hidden="true" />
                )
              }
              label={
                isPaused
                  ? t(translations.runTracker.controls.resume)
                  : t(translations.runTracker.controls.pause)
              }
              tooltip={
                isPaused
                  ? t(translations.runTracker.controls.resumeRunTooltip, {
                      shortcut: shortcuts.pauseRun,
                    })
                  : t(translations.runTracker.controls.pauseRunTooltip, {
                      shortcut: shortcuts.pauseRun,
                    })
              }
              variant="outline"
              size="sm"
              disabled={!canPauseResume}
              pending={pending.pauseResume}
              onClick={isPaused ? onResumeRun : onPauseRun}
            />
          </>
        )}

        <ActionButton
          icon={<StopCircle className="h-4 w-4" aria-hidden="true" />}
          label={t(translations.runTracker.controls.endSession)}
          tooltip={t(translations.runTracker.controls.endSessionTooltip, {
            shortcut: shortcuts.endSession,
          })}
          variant="destructive"
          size="sm"
          disabled={!canEndSession}
          pending={pending.endSession}
          onClick={onEndSession}
        />
      </div>

      {autoModeEnabled && (
        <div className="flex items-start gap-2 rounded-md border border-info/40 bg-info/10 p-3">
          <Timer className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-medium text-sm">
              {t(translations.runTracker.controls.autoTracking)}
            </p>
            <p className="text-muted-foreground text-xs">
              {t(translations.runTracker.controls.autoTrackingDescription)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface ShortcutsInfoProps {
  shortcuts: RunTrackerShortcuts;
  /** Whether the shortcuts are registered as OS-wide hotkeys (work while D2R is focused). */
  globalHotkeysActive?: boolean;
}

/**
 * Compact reminder of the configured run tracker keyboard shortcuts.
 */
export function ShortcutsInfo({ shortcuts, globalHotkeysActive = false }: ShortcutsInfoProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-3">
      <p className="text-muted-foreground text-xs">
        <strong>{t(translations.runTracker.controls.shortcutsInfo)}</strong>{' '}
        {t(translations.runTracker.controls.shortcutsDetail, {
          startRun: shortcuts.startRun,
          pauseRun: shortcuts.pauseRun,
          endRun: shortcuts.endRun,
          endSession: shortcuts.endSession,
        })}
      </p>
      {globalHotkeysActive && (
        <Badge variant="outline">
          <Globe aria-hidden="true" />
          {t(translations.runTracker.controls.globalHotkeysActive)}
        </Badge>
      )}
    </div>
  );
}
