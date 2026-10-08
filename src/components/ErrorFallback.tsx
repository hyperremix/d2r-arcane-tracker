import type { TFunction } from 'i18next';
import { AlertTriangle, Bug, ClipboardCopy, RefreshCw, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import { ISSUE_TRACKER_URL } from '@/lib/links';
import { cn } from '@/lib/utils';

/**
 * Normalized description of a caught error, independent of where it was caught.
 */
export interface ErrorDetails {
  message: string;
  stack?: string;
  componentStack?: string;
}

export interface ErrorFallbackProps {
  details: ErrorDetails;
  /** Explanation shown under the title. Defaults to the generic error boundary description. */
  description?: string;
  onRetry: () => void;
  onReload: () => void;
  className?: string;
}

type ActionStatus = 'idle' | 'copied' | 'copyFailed' | 'reportFailed';

/**
 * Converts any thrown value into displayable error details.
 * @param {unknown} error - The thrown value
 * @param {string} [componentStack] - Optional React component stack
 * @returns {ErrorDetails} Normalized error details
 */
export function toErrorDetails(error: unknown, componentStack?: string): ErrorDetails {
  if (error instanceof Error) {
    return {
      message: error.toString(),
      stack: error.stack || undefined,
      componentStack: componentStack || undefined,
    };
  }
  return { message: String(error), componentStack: componentStack || undefined };
}

/**
 * Reads the running app version from the main process. Never throws.
 * @returns {Promise<string | undefined>} The version, or undefined when unavailable
 */
async function getAppVersion(): Promise<string | undefined> {
  try {
    const info = await window.electronAPI?.update?.getUpdateInfo();
    return info?.currentVersion || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Builds the plain-text error report that is copied to the clipboard.
 */
function buildErrorReport(
  t: TFunction,
  details: ErrorDetails,
  appVersion: string | undefined,
): string {
  const sections = [
    `${t(translations.errorBoundary.appVersion)} ${appVersion ?? t(translations.common.unknown)}`,
    `${t(translations.errorBoundary.errorMessage)} ${details.message}`,
  ];
  if (details.stack) {
    sections.push(`${t(translations.errorBoundary.stackTrace)}\n${details.stack}`);
  }
  if (details.componentStack) {
    sections.push(
      `${t(translations.errorBoundary.componentStack)}\n${details.componentStack.trim()}`,
    );
  }
  return sections.join('\n\n');
}

/**
 * Presentational error screen shared by the app-level error boundary and the
 * router error element. Offers recovery, copy-to-clipboard and report actions.
 */
export function ErrorFallback({
  details,
  description,
  onRetry,
  onReload,
  className,
}: ErrorFallbackProps) {
  const { t } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle');

  // Move focus to the heading so keyboard and screen reader users land on the error.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      const appVersion = await getAppVersion();
      await navigator.clipboard.writeText(buildErrorReport(t, details, appVersion));
      setActionStatus('copied');
    } catch (error) {
      console.error('Failed to copy error details:', error);
      setActionStatus('copyFailed');
    }
  }, [t, details]);

  const handleReport = useCallback(async () => {
    try {
      // The main process resolves `{ success: false }` instead of rejecting when the URL can't be opened.
      const result = await window.electronAPI?.shell.openExternal(ISSUE_TRACKER_URL);
      if (!result?.success) {
        console.error('Failed to open issue tracker:', result?.error);
        setActionStatus('reportFailed');
        return;
      }
      setActionStatus('idle');
    } catch (error) {
      console.error('Failed to open issue tracker:', error);
      setActionStatus('reportFailed');
    }
  }, []);

  return (
    <div
      className={cn('flex items-center justify-center overflow-auto bg-background p-4', className)}
    >
      <Card className="w-full max-w-2xl border-destructive/50 bg-card p-8">
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
              <AlertTriangle aria-hidden="true" className="h-8 w-8 text-destructive" />
            </div>
          </div>

          <div className="text-center">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="font-bold text-2xl text-foreground outline-none"
            >
              {t(translations.errorBoundary.title)}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {description ?? t(translations.errorBoundary.description)}
            </p>
          </div>

          <details className="rounded-lg border border-destructive/30 bg-muted/50 p-4">
            <summary className="cursor-pointer font-semibold text-destructive hover:underline">
              {t(translations.errorBoundary.errorDetails)}
            </summary>
            <div className="mt-4 space-y-2">
              <div className="text-sm">
                <p className="font-semibold text-foreground">
                  {t(translations.errorBoundary.errorMessage)}
                </p>
                <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-destructive text-xs">
                  {details.message}
                </pre>
              </div>
              {details.stack && (
                <div className="text-sm">
                  <p className="font-semibold text-foreground">
                    {t(translations.errorBoundary.stackTrace)}
                  </p>
                  <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-muted-foreground text-xs">
                    {details.stack}
                  </pre>
                </div>
              )}
              {details.componentStack && (
                <div className="text-sm">
                  <p className="font-semibold text-foreground">
                    {t(translations.errorBoundary.componentStack)}
                  </p>
                  <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-muted-foreground text-xs">
                    {details.componentStack}
                  </pre>
                </div>
              )}
            </div>
          </details>

          <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:justify-center">
            <Button onClick={onRetry} variant="default">
              <RotateCcw aria-hidden="true" />
              {t(translations.errorBoundary.tryToRecover)}
            </Button>
            <Button onClick={onReload} variant="outline">
              <RefreshCw aria-hidden="true" />
              {t(translations.errorBoundary.reloadApplication)}
            </Button>
            <Button onClick={handleCopy} variant="outline">
              <ClipboardCopy aria-hidden="true" />
              {t(translations.errorBoundary.copyDetails)}
            </Button>
            <Button onClick={handleReport} variant="outline">
              <Bug aria-hidden="true" />
              {t(translations.errorBoundary.reportIssue)}
            </Button>
          </div>

          <output
            aria-live="polite"
            className={cn(
              'block min-h-4 text-center text-xs',
              actionStatus === 'copyFailed' || actionStatus === 'reportFailed'
                ? 'text-destructive'
                : 'text-muted-foreground',
            )}
          >
            {actionStatus === 'copied' && t(translations.errorBoundary.copySuccess)}
            {actionStatus === 'copyFailed' && t(translations.errorBoundary.copyFailed)}
            {actionStatus === 'reportFailed' && t(translations.errorBoundary.reportFailed)}
          </output>

          <p className="text-center text-muted-foreground text-xs">
            {t(translations.errorBoundary.persistHelp)}
          </p>
        </div>
      </Card>
    </div>
  );
}
