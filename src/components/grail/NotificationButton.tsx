import type { ItemDetectionEvent } from 'electron/types/grail';
import { Bell, Star, Trophy, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGrailStore } from '@/stores/grailStore';

interface NotificationItem extends ItemDetectionEvent {
  id: string;
  timestamp: Date;
  dismissed: boolean;
  seen: boolean;
}

export function NotificationButton() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { settings } = useGrailStore();

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
    if (itemEvent.type === 'item-found' && itemEvent.match) {
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

  useEffect(() => {
    // Listen for item detection events
    const handleItemDetection = (
      _event: Electron.IpcRendererEvent,
      itemEvent: ItemDetectionEvent,
    ) => {
      // Add to notifications if in-app notifications are enabled
      if (settings.inAppNotifications) {
        const notification: NotificationItem = {
          ...itemEvent,
          id: `${Date.now()}_${itemEvent.item.id}`,
          timestamp: new Date(),
          dismissed: false,
          seen: false, // New notifications are unseen by default
        };

        setNotifications((prev) => [notification, ...prev.slice(0, 9)]); // Keep only last 10
      }

      // Play notification sound if enabled
      playNotificationSound();

      // Show native browser notification if enabled and supported
      if (
        settings.nativeNotifications &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        showBrowserNotification(itemEvent);
      }
    };

    window.ipcRenderer?.on('item-detection-event', handleItemDetection);

    return () => {
      window.ipcRenderer?.off('item-detection-event', handleItemDetection);
    };
  }, [
    settings.inAppNotifications,
    settings.nativeNotifications,
    showBrowserNotification,
    playNotificationSound,
  ]);

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
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative gap-2"
      >
        <Bell className="h-4 w-4" />
        Notifications
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
