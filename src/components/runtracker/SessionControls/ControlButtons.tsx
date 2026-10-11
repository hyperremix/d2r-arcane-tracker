import { Globe, Loader2, Pause, Play, Square, StopCircle, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';
import { ShortcutKey } from './ShortcutKey';

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

/** The run tracker shortcuts as `aria-keyshortcuts` values (undefined if a shortcut has no key). */
export type RunTrackerAriaShortcuts = Record<keyof RunTrackerShortcuts, string | undefined>;

export interface ControlButtonsProps {
  /** Platform-formatted shortcut labels shown as key chips. */
  shortcuts: RunTrackerShortcuts;
  /** The same shortcuts exposed to assistive technology. */
  ariaShortcuts: RunTrackerAriaShortcuts;
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
  /** Platform-formatted shortcut shown as a key chip inside the button. */
  shortcut?: string;
  /** The same shortcut as an `aria-keyshortcuts` value. */
  ariaShortcut?: string;
  variant: 'default' | 'outline' | 'destructive';
  size: 'sm' | 'lg';
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
}

// Button that swaps its icon for a spinner while pending and shows its keyboard shortcut as a key chip
function ActionButton({
  icon,
  label,
  shortcut,
  ariaShortcut,
  variant,
  size,
  disabled,
  pending,
  onClick,
}: ActionButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={pending}
      aria-keyshortcuts={ariaShortcut}
      className={size === 'lg' ? 'min-w-36 gap-2 px-4' : 'gap-2'}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {label}
      {shortcut && <ShortcutKey shortcut={shortcut} className="ml-1" />}
    </Button>
  );
}

/**
 * Live session actions: one primary, state-dependent action (Start New Session, Start Run or End Run)
 * plus secondary Pause/Resume and End Session. Each run action shows its keyboard shortcut as a key
 * chip. In auto mode the manual run actions are replaced by a notice explaining that runs are
 * tracked automatically.
 */
export function ControlButtons({
  shortcuts,
  ariaShortcuts,
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
      <ActionButton
        icon={<Play className="h-4 w-4" aria-hidden="true" />}
        label={t(translations.runTracker.sessionCard.startNewSession)}
        variant="default"
        size="lg"
        disabled={!canStartSession}
        pending={pending.startSession}
        onClick={onStartSession}
      />
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
            shortcut={shortcuts.startRun}
            ariaShortcut={ariaShortcuts.startRun}
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
              shortcut={shortcuts.endRun}
              ariaShortcut={ariaShortcuts.endRun}
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
              shortcut={shortcuts.pauseRun}
              ariaShortcut={ariaShortcuts.pauseRun}
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
          shortcut={shortcuts.endSession}
          ariaShortcut={ariaShortcuts.endSession}
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

/**
 * Indicator that the run tracker shortcuts are registered as OS-wide hotkeys, so they also work
 * while D2R is focused.
 */
export function GlobalHotkeysBadge() {
  const { t } = useTranslation();
  return (
    <Badge variant="outline">
      <Globe aria-hidden="true" />
      {t(translations.runTracker.controls.globalHotkeysActive)}
    </Badge>
  );
}
