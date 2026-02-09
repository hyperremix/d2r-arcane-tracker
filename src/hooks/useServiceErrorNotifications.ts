import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Listens for service error events from the main process and shows Sonner toasts.
 * Only critical, actionable errors are surfaced (e.g., database write failures,
 * broken file monitoring). This hook should be used at the app root level.
 */
export function useServiceErrorNotifications() {
  useEffect(() => {
    const unsubscribe = window.electronAPI.data.onServiceError((payload) => {
      if (payload.severity === 'error') {
        toast.error(payload.message, { description: payload.service });
      } else if (payload.severity === 'warn') {
        toast.warning(payload.message, { description: payload.service });
      }
    });

    return unsubscribe;
  }, []);
}
