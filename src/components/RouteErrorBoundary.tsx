import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, useLocation, useNavigate, useRouteError } from 'react-router';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import { type ErrorDetails, ErrorFallback, toErrorDetails } from './ErrorFallback';

export interface RouteErrorBoundaryProps {
  /** Fill the whole window instead of the page area (used when the layout itself failed). */
  fullScreen?: boolean;
}

function getRouteErrorDetails(error: unknown): ErrorDetails {
  if (isRouteErrorResponse(error)) {
    const data = typeof error.data === 'string' ? error.data : undefined;
    return {
      message: [`${error.status} ${error.statusText}`.trim(), data].filter(Boolean).join('\n'),
    };
  }
  return toErrorDetails(error);
}

/**
 * Router `errorElement` that renders the in-app error screen for errors thrown
 * while rendering or loading a route. Navigating to any route clears the error.
 */
export function RouteErrorBoundary({ fullScreen = false }: RouteErrorBoundaryProps) {
  const { t } = useTranslation();
  const error = useRouteError();
  const location = useLocation();
  const navigate = useNavigate();

  // Re-navigating to the current location creates a new location entry, which
  // makes React Router reset its error boundary and render the page again.
  const handleRetry = useCallback(() => {
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: location.state },
    );
  }, [navigate, location]);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <ErrorFallback
      details={getRouteErrorDetails(error)}
      description={fullScreen ? undefined : t(translations.errorBoundary.pageDescription)}
      onRetry={handleRetry}
      onReload={handleReload}
      className={cn(fullScreen ? 'min-h-screen' : 'flex-1')}
    />
  );
}
