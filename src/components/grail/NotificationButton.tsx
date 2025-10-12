import type { ItemDetectionEvent } from 'electron/types/grail';
import { Bell, Star, Trophy, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGrailStore } from '@/stores/grailStore';

/**
 * Module-level flag to prevent duplicate IPC handler registration.
 * This is necessary because React Strict Mode in development will mount components twice,
 * and without this guard, multiple handlers would accumulate.
 */
let globalIpcHandlerRegistered = false;

/**
 * Interface extending ItemDetectionEvent with additional notification metadata.
 */
interface NotificationItem extends ItemDetectionEvent {
  id: string;
  timestamp: Date;
  dismissed: boolean;
  seen: boolean;
}

/**
 * NotificationButton component that displays and manages item detection notifications.
 * Shows a badge with unread count, plays sounds, and displays a dropdown of recent item discoveries.
 * @returns {JSX.Element} A notification button with dropdown showing recent item detections
 */
export function NotificationButton() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [notificationQueue, setNotificationQueue] = useState<ItemDetectionEvent[]>([]);
  const { settings } = useGrailStore();

  // Use refs to avoid useEffect re-registration on state/callback changes
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const processBatchRef = useRef<() => void>();

  const BATCH_DELAY = 1000; // 1 second

  const playNotificationSound = useCallback(() => {
    if (settings.enableSounds) {
      try {
        const audio = new Audio('/ding.mp3');
        audio.volume = settings.notificationVolume;
        audio.play().catch((error) => {
          console.warn('Failed to play notification sound:', error);
        });
      } catch (error) {
        console.warn('Failed to create audio for notification sound:', error);
      }
    }
  }, [settings.enableSounds, settings.notificationVolume]);

  const showBrowserNotification = useCallback((itemEvent: ItemDetectionEvent) => {
    if (itemEvent.type === 'item-found' && itemEvent.grailItem) {
      const notification = new Notification('Holy Grail Item Found!', {
        body: `${itemEvent.item.name} found by ${itemEvent.item.characterName}`,
        icon: '/logo.svg',
        tag: 'grail-item',
        requireInteraction: true,
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  }, []);

  const showBatchNotification = useCallback((events: ItemDetectionEvent[]) => {
    const itemNames = events.map((e) => e.item.name).join(', ');
    const notification = new Notification(`${events.length} Holy Grail Items Found!`, {
      body:
        itemNames.length > 100
          ? `${events.length} items including ${events[0].item.name}...`
          : itemNames,
      icon: '/logo.svg',
      tag: 'grail-batch',
      requireInteraction: true,
    });

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  }, []);

  const processBatch = useCallback(() => {
    if (notificationQueue.length === 0) return;

    console.log(
      `[NotificationButton] Processing batch of ${notificationQueue.length} notifications`,
    );

    // Add ALL queued items to in-app notifications
    if (settings.inAppNotifications) {
      const newNotifications = notificationQueue.map((itemEvent) => ({
        ...itemEvent,
        id: `${Date.now()}_${itemEvent.item.id}_${Math.random()}`,
        timestamp: new Date(),
        dismissed: false,
        seen: false,
      }));
      setNotifications((prev) => [
        ...newNotifications,
        ...prev.slice(0, 10 - newNotifications.length),
      ]);
    }

    // Play sound ONCE for the batch
    playNotificationSound();

    // Show native notification
    if (
      settings.nativeNotifications &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      if (notificationQueue.length === 1) {
        // Single item: show detailed notification
        showBrowserNotification(notificationQueue[0]);
      } else {
        // Multiple items: show batch notification
        showBatchNotification(notificationQueue);
      }
    }

    // Clear the queue
    setNotificationQueue([]);
  }, [
    notificationQueue,
    settings.inAppNotifications,
    settings.nativeNotifications,
    playNotificationSound,
    showBrowserNotification,
    showBatchNotification,
  ]);

  // Update ref whenever processBatch changes
  useEffect(() => {
    processBatchRef.current = processBatch;
  }, [processBatch]);

  useEffect(() => {
    // Singleton pattern: Prevent duplicate IPC handler registration
    // This is critical because React Strict Mode (development) will mount components twice
    if (globalIpcHandlerRegistered) {
      console.log(
        '[NotificationButton] IPC handler already registered globally, skipping duplicate registration',
      );
      return;
    }

    // Mark as registered before setting up handler
    globalIpcHandlerRegistered = true;

    // Listen for item detection events
    const handleItemDetection = (
      _event: Electron.IpcRendererEvent,
      itemEvent: ItemDetectionEvent,
    ) => {
      // Skip all notifications if silent flag is set
      // Silent flag is true during:
      // - Initial startup parsing: prevents spam for existing items
      // - Force re-scan: prevents re-notification of already found items
      // Items are still saved to database, only UI notifications are suppressed
      if (itemEvent.silent) {
        return;
      }

      console.log(`[NotificationButton] Queueing notification for ${itemEvent.item.name}`);

      // Add to queue
      setNotificationQueue((prev) => [...prev, itemEvent]);

      // Clear existing timer if any
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }

      // Set new timer to process batch after delay
      batchTimerRef.current = setTimeout(() => {
        // Use ref to get latest processBatch function
        if (processBatchRef.current) {
          processBatchRef.current();
        }
        batchTimerRef.current = null;
      }, BATCH_DELAY);
    };

    console.log('[NotificationButton] Registering IPC handler for item-detection-event');
    window.ipcRenderer?.on('item-detection-event', handleItemDetection);

    return () => {
      console.log('[NotificationButton] Unregistering IPC handler for item-detection-event');
      window.ipcRenderer?.off('item-detection-event', handleItemDetection);
      globalIpcHandlerRegistered = false;
    };
  }, []); // Empty dependency array - only run once on mount (but Strict Mode may try twice)

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n)));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const markAllAsSeen = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, seen: true })));
  }, []);

  // Mark notifications as seen when popover opens
  useEffect(() => {
    if (isOpen) {
      markAllAsSeen();
    }
  }, [isOpen, markAllAsSeen]);

  // Cleanup timer on unmount and process remaining queue
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }

      // Process any remaining items in queue on unmount using functional setState
      setNotificationQueue((currentQueue) => {
        if (currentQueue.length > 0) {
          console.log(
            `[NotificationButton] Component unmounting, processing ${currentQueue.length} remaining notifications`,
          );
          if (processBatchRef.current) {
            processBatchRef.current();
          }
        }
        return [];
      });
    };
  }, []); // Empty dependency array - cleanup only runs on unmount

  const activeNotifications = notifications.filter((n) => !n.dismissed);
  const unseenCount = activeNotifications.filter((n) => !n.seen).length;

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'unique':
        return 'bg-orange-500 text-white';
      case 'set':
        return 'bg-green-500 text-white';
      case 'rare':
        return 'bg-yellow-500 text-black';
      case 'magic':
        return 'bg-blue-500 text-white';
      case 'normal':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative gap-2"
      >
        <Bell className="h-4 w-4" />
        {unseenCount > 0 && (
          <Badge
            variant="destructive"
            className="-right-2 -top-2 absolute h-5 w-5 rounded-full p-0 text-xs"
          >
            {unseenCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsOpen(false);
              }
            }}
            aria-label="Close notifications"
          />

          {/* Popover */}
          <Card className="absolute top-full right-0 z-50 mt-2 w-80 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Recent Notifications
                </div>
                {activeNotifications.length > 0 && (
                  <Button
                    onClick={clearAllNotifications}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                  >
                    Clear All
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeNotifications.length === 0 ? (
                <div className="py-4 text-center text-gray-500">
                  <Trophy className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">No recent item detections</p>
                </div>
              ) : (
                activeNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`rounded-lg border p-3 ${
                      notification.type === 'item-found'
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                    } ${!notification.seen ? 'ring-2 ring-blue-200' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          {notification.type === 'item-found' ? (
                            <Trophy className="h-4 w-4 text-green-600" />
                          ) : (
                            <Star className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium text-sm">{notification.item.name}</span>
                          {notification.item.quality && (
                            <Badge
                              className={`text-xs ${getQualityColor(notification.item.quality)}`}
                            >
                              {notification.item.quality}
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-600 text-xs">
                          Found by {notification.item.characterName} •{' '}
                          {notification.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      <Button
                        onClick={() => dismissNotification(notification.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
