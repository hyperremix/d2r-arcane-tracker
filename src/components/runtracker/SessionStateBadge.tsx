import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import type { LiveSessionState } from './liveSession';

interface SessionStateBadgeProps {
  state: LiveSessionState;
  className?: string;
}

const STATE_STYLES: Record<LiveSessionState, { badge: string; dot: string }> = {
  running: { badge: 'border-success/40 bg-success/10 text-success', dot: 'bg-success' },
  paused: { badge: 'border-warning/40 bg-warning/10 text-warning', dot: 'bg-warning' },
  idle: { badge: 'border-border bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  noSession: { badge: 'border-border text-muted-foreground', dot: 'bg-muted-foreground/50' },
};

const STATE_LABEL_KEYS: Record<LiveSessionState, string> = {
  running: translations.runTracker.controls.running,
  paused: translations.runTracker.controls.paused,
  idle: translations.runTracker.controls.idle,
  noSession: translations.runTracker.controls.noSession,
};

/**
 * Badge showing whether a run is running, paused, idle, or no session is active.
 * The badge is a polite live region so state changes are announced without interrupting.
 */
export function SessionStateBadge({ state, className }: SessionStateBadgeProps) {
  const { t } = useTranslation();
  const styles = STATE_STYLES[state];

  return (
    <output aria-live="polite" aria-atomic="true" data-state={state} className="inline-flex">
      <Badge
        variant="outline"
        className={cn('h-6 gap-1.5 px-2.5 text-sm', styles.badge, className)}
      >
        <span aria-hidden="true" className={cn('size-2 rounded-full', styles.dot)} />
        {t(STATE_LABEL_KEYS[state])}
      </Badge>
    </output>
  );
}
