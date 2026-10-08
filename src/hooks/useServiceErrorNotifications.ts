import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { translations } from '@/i18n/translations';
import type { IncomingServiceError } from '@/lib/serviceErrors';
import {
  formatServiceErrorDetails,
  getServiceErrorAction,
  getServiceErrorCopy,
  getServiceErrorToastId,
  parseServiceErrorPayload,
} from '@/lib/serviceErrors';

const COPY_DETAILS_TOAST_ID = 'serviceErrors.copyDetails';

/**
 * Options for {@link useServiceErrorNotifications}.
 */
export interface UseServiceErrorNotificationsOptions {
  /** Navigates to the settings page. Called from the "Open Settings" toast action. */
  onOpenSettings: () => void;
}

/**
 * Listens for service error events from the main process and shows Sonner toasts.
 * Only critical, actionable errors are surfaced (e.g., database write failures,
 * unreadable save files). Payloads are validated, copy is translated from the error code,
 * repeated errors of the same service operation replace the existing toast, and each toast
 * offers a contextual action. This hook should be used at the app root level.
 * @param options - Callbacks for the toast actions
 */
export function useServiceErrorNotifications({
  onOpenSettings,
}: UseServiceErrorNotificationsOptions): void {
  const { t } = useTranslation();
  const onOpenSettingsRef = useRef(onOpenSettings);

  useEffect(() => {
    onOpenSettingsRef.current = onOpenSettings;
  }, [onOpenSettings]);

  useEffect(() => {
    const copyDetails = async (payload: IncomingServiceError) => {
      try {
        await navigator.clipboard.writeText(formatServiceErrorDetails(payload));
        toast.success(t(translations.serviceErrors.copySuccess), { id: COPY_DETAILS_TOAST_ID });
      } catch (error) {
        console.error('[useServiceErrorNotifications] Failed to copy error details:', error);
        toast.error(t(translations.serviceErrors.copyFailed), { id: COPY_DETAILS_TOAST_ID });
      }
    };

    const unsubscribe = window.electronAPI.data.onServiceError((value: unknown) => {
      const payload = parseServiceErrorPayload(value);
      if (!payload) {
        console.warn('[useServiceErrorNotifications] Ignoring malformed service error:', value);
        return;
      }

      const copy = getServiceErrorCopy(payload.code);
      const action =
        getServiceErrorAction(payload.code) === 'openSettings'
          ? {
              label: t(translations.grail.itemGrid.openSettings),
              onClick: () => onOpenSettingsRef.current(),
            }
          : {
              label: t(translations.serviceErrors.copyDetails),
              onClick: () => {
                void copyDetails(payload);
              },
            };

      toast.error(t(copy.titleKey, payload.params), {
        id: getServiceErrorToastId(payload),
        description: t(copy.descriptionKey, payload.params),
        duration: Number.POSITIVE_INFINITY,
        closeButton: true,
        action,
      });
    });

    return unsubscribe;
  }, [t]);
}
