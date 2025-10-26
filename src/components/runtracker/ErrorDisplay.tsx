import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ErrorDisplayProps {
  error: string | null;
  errorType: 'network' | 'validation' | 'permission' | 'unknown' | null;
  retryCount: number;
  loading: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

export function ErrorDisplay({
  error,
  errorType,
  retryCount,
  loading,
  onRetry,
  onDismiss,
}: ErrorDisplayProps) {
  if (!error) return null;

  const getErrorIcon = () => {
    switch (errorType) {
      case 'network':
        return <RefreshCw className="h-4 w-4" />;
      case 'validation':
        return <AlertCircle className="h-4 w-4" />;
      case 'permission':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getErrorVariant = () => {
    switch (errorType) {
      case 'network':
        return 'default';
      case 'validation':
        return 'destructive';
      case 'permission':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const canRetry = errorType === 'network' && retryCount < 3;

  return (
    <Alert variant={getErrorVariant()}>
      <div className="flex items-start gap-2">
        {getErrorIcon()}
        <div className="flex-1">
          <AlertDescription className="text-sm">
            {error}
            {retryCount > 0 && (
              <span className="ml-2 text-muted-foreground">(Attempt {retryCount}/3)</span>
            )}
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
              Retry
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onDismiss} className="h-8 w-8 p-0">
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Alert>
  );
}
