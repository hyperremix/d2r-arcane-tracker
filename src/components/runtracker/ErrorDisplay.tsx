import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';
import type { RunTrackerError, RunTrackerErrorType } from '@/stores/runTrackerStore';

interface ErrorDisplayProps {
  error: RunTrackerError | null;
  errorType: RunTrackerErrorType | null;
  /** Whether the failed action can be run again. */
  canRetry: boolean;
  loading: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

export function ErrorDisplay({
  error,
  errorType,
  canRetry,
  loading,
  onRetry,
  onDismiss,
}: ErrorDisplayProps) {
  const { t } = useTranslation();

  if (!error) return null;

  return (
    <Alert variant={errorType === 'validation' ? 'destructive' : 'default'}>
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4" />
        <div className="flex-1">
          <AlertDescription className="text-sm">
            {t(translations.runTracker.errors[error.code])}
          </AlertDescription>
        </div>
        <div className="flex items-center gap-2">
          {canRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={loading}
              className="h-8 px-2"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              {t(translations.common.retry)}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-8 w-8 p-0"
            aria-label={t(translations.runTracker.errorDisplay.dismiss)}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </Alert>
  );
}
