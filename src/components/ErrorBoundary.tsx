import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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
        <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
          <Card className="w-full max-w-2xl border-red-500/50 bg-gray-800 p-8">
            <div className="space-y-6">
              {/* Error Icon */}
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                  <svg
                    className="h-8 w-8 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <title>Error</title>
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
                <h1 className="font-bold text-2xl text-white">Something went wrong</h1>
                <p className="mt-2 text-gray-400">
                  An unexpected error occurred. You can try to recover or reload the application.
                </p>
              </div>

              {/* Error Details (collapsed by default) */}
              {this.state.error && (
                <details className="rounded-lg border border-red-500/30 bg-gray-900/50 p-4">
                  <summary className="cursor-pointer font-semibold text-red-400 hover:text-red-300">
                    Error Details
                  </summary>
                  <div className="mt-4 space-y-2">
                    <div className="text-sm">
                      <p className="font-semibold text-gray-300">Error Message:</p>
                      <pre className="mt-1 overflow-x-auto rounded bg-gray-950 p-2 text-red-400 text-xs">
                        {this.state.error.toString()}
                      </pre>
                    </div>
                    {this.state.errorInfo && (
                      <div className="text-sm">
                        <p className="font-semibold text-gray-300">Component Stack:</p>
                        <pre className="mt-1 max-h-48 overflow-auto rounded bg-gray-950 p-2 text-gray-400 text-xs">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button
                  onClick={this.handleReset}
                  variant="default"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Try to Recover
                </Button>
                <Button onClick={this.handleReload} variant="outline">
                  Reload Application
                </Button>
              </div>

              {/* Help Text */}
              <p className="text-center text-gray-500 text-xs">
                If this error persists, please report it with the error details shown above.
              </p>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
