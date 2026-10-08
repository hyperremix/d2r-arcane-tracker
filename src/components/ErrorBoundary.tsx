import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorFallback, toErrorDetails } from '@/components/ErrorFallback';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: unknown;
  componentStack?: string;
}

/**
 * Error Boundary component to catch and handle React errors in production.
 * Displays a fallback UI when an error occurs and provides options to recover.
 * Errors thrown inside routes are handled by `RouteErrorBoundary` instead.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: undefined,
      componentStack: undefined,
    };
  }

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    // Log error details to console
    console.error('Error Boundary caught an error:', error, errorInfo);

    // Keep the component stack so it can be shown and copied
    this.setState({
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  handleReset = (): void => {
    // Reset error state
    this.setState({
      hasError: false,
      error: undefined,
      componentStack: undefined,
    });
  };

  handleReload = (): void => {
    // Reload the application
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          details={toErrorDetails(this.state.error, this.state.componentStack)}
          onRetry={this.handleReset}
          onReload={this.handleReload}
          className="min-h-screen"
        />
      );
    }

    return this.props.children;
  }
}
