import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Translation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { translations } from '@/i18n/translations';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch and handle React errors in production.
 * Displays a fallback UI when an error occurs and provides options to recover.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details to console
    console.error('Error Boundary caught an error:', error, errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // In production, you could send error to logging service
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = (): void => {
    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    // Reload the application
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Translation>
          {(t) => (
            <div className="flex min-h-screen items-center justify-center bg-background p-4">
              <Card className="w-full max-w-2xl border-destructive/50 bg-card p-8">
                <div className="space-y-6">
                  {/* Error Icon */}
                  <div className="flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
                      <svg
                        className="h-8 w-8 text-destructive"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <title>{t(translations.common.error)}</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Error Title */}
                  <div className="text-center">
                    <h1 className="font-bold text-2xl text-foreground">
                      {t(translations.errorBoundary.title)}
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                      {t(translations.errorBoundary.description)}
                    </p>
                  </div>

                  {/* Error Details (collapsed by default) */}
                  {this.state.error && (
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
                            {this.state.error.toString()}
                          </pre>
                        </div>
                        {this.state.errorInfo && (
                          <div className="text-sm">
                            <p className="font-semibold text-foreground">
                              {t(translations.errorBoundary.componentStack)}
                            </p>
                            <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-muted-foreground text-xs">
                              {this.state.errorInfo.componentStack}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button onClick={this.handleReset} variant="default">
                      {t(translations.errorBoundary.tryToRecover)}
                    </Button>
                    <Button onClick={this.handleReload} variant="outline">
                      {t(translations.errorBoundary.reloadApplication)}
                    </Button>
                  </div>

                  {/* Help Text */}
                  <p className="text-center text-muted-foreground text-xs">
                    {t(translations.errorBoundary.persistHelp)}
                  </p>
                </div>
              </Card>
            </div>
          )}
        </Translation>
      );
    }

    return this.props.children;
  }
}
