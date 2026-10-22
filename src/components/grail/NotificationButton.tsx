import type { D2RLoaderPickupPayload } from 'electron/types/d2rLoader';
import type { GrailProgress, Item, ItemDetectionEvent } from 'electron/types/grail';
import { Bell, Trophy, X } from 'lucide-react';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { ItemCard } from '@/components/grail/ItemCard';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { translations } from '@/i18n/translations';
import { combineUnsubscribers, onMainEvent } from '@/lib/ipcEvents';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';
import dingSound from '/ding.mp3';
import logoUrl from '/logo.png';

/**
 * A grail find to announce: one the save file detection recorded, or one the D2RLoader plugin
 * reported as picked up, which the save file detection records once the game saves.
 */
interface Find {
  grailItem: Item;
  ethereal: boolean;
  /** Character that found the item; the plugin doesn't know it. */
  characterName?: string;
  /** Picked up in game and announced before the game saved it. */
  provisional: boolean;
}

/**
 * A find with additional notification metadata.
 */
interface NotificationItem extends Find {
  id: string;
  timestamp: Date;
  dismissed: boolean;
  seen: boolean;
  normalProgress: GrailProgress[];
  etherealProgress: GrailProgress[];
}

/** What the save file detection recorded for a pickup it confirmed. */
type PickupConfirmation = Pick<NotificationItem, 'normalProgress' | 'etherealProgress'> &
  Pick<Find, 'characterName'>;

/**
 * A pickup that the save file didn't confirm within this time (the item was dropped again, or the
 * game wasn't saved) no longer suppresses the announcement of a later find of the same item.
 */
const PENDING_PICKUP_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** Identifies the grail item version of a find. */
function getFindKey(find: Find): string {
  return `${find.grailItem.id}:${find.ethereal}`;
}

/**
 * Whether a find was announced as a pickup that the save file hasn't confirmed yet.
 * @param pendingPickups - Pickup times by find key
 * @param key - Find key
 * @param now - Current time in milliseconds
 */
function isPendingPickup(pendingPickups: Map<string, number>, key: string, now: number): boolean {
  const pickedUpAt = pendingPickups.get(key);
  return pickedUpAt !== undefined && now - pickedUpAt <= PENDING_PICKUP_MAX_AGE_MS;
}

/** Reads the progress of a grail item, split into its normal and ethereal versions. */
async function fetchProgress(
  itemId: string,
): Promise<Pick<NotificationItem, 'normalProgress' | 'etherealProgress'>> {
  let allProgress: GrailProgress[] = [];
  try {
    allProgress = (await window.electronAPI?.grail.getProgressByItem(itemId)) ?? [];
  } catch (error) {
    console.error('Failed to fetch progress for item:', error);
  }
  return {
    normalProgress: allProgress.filter((p) => !p.isEthereal),
    etherealProgress: allProgress.filter((p) => p.isEthereal),
  };
}

/** Turns a notification of a pickup into a regular find, if the save file confirmed that pickup. */
function applyConfirmation(
  notification: NotificationItem,
  confirmations: ReadonlyMap<string, PickupConfirmation>,
): NotificationItem {
  const confirmation = notification.provisional
    ? confirmations.get(getFindKey(notification))
    : undefined;
  return confirmation ? { ...notification, ...confirmation, provisional: false } : notification;
}

/**
 * Records that the save file confirmed a pickup and turns its notifications into regular finds,
 * with the character from the save file and the progress the detection recorded. The confirmation
 * is kept for notifications that are not shown yet: the save file may be detected while the pickup
 * still waits for the batch timer.
 */
async function confirmPickup(
  find: Find,
  key: string,
  confirmations: Map<string, PickupConfirmation>,
  setNotifications: Dispatch<SetStateAction<NotificationItem[]>>,
): Promise<void> {
  const progress = await fetchProgress(find.grailItem.id);
  confirmations.set(key, { ...progress, characterName: find.characterName });
  setNotifications((prev) =>
    prev.map((notification) => applyConfirmation(notification, confirmations)),
  );
}

/**
 * NotificationButton component that displays and manages item detection notifications.
 * Shows a badge with unread count, plays sounds, and displays a dropdown of recent item discoveries.
 * @returns {JSX.Element} A notification button with dropdown showing recent item detections
 */
export function NotificationButton() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [notificationQueue, setNotificationQueue] = useState<Find[]>([]);
  const [iconPath, setIconPath] = useState<string>(logoUrl);
  // Characters are loaded and kept in sync by the grail store
  const characters = useGrailStore((state) => state.characters);
  const { enableSounds, notificationVolume, inAppNotifications, nativeNotifications } =
    useGrailStore(
      useShallow((state) => ({
        enableSounds: state.settings.enableSounds,
        notificationVolume: state.settings.notificationVolume,
        inAppNotifications: state.settings.inAppNotifications,
        nativeNotifications: state.settings.nativeNotifications,
      })),
    );

  // Use refs to avoid useEffect re-registration on state/callback changes
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const processBatchRef = useRef<() => void>();
  // Picked-up item versions announced before the game saved them, by find key, with the time they
  // were picked up. Their save file detection is not announced a second time.
  const pendingPickupsRef = useRef(new Map<string, number>());
  // What the save file recorded for pickups it confirmed, by find key; applied to notifications
  // that are shown after the confirmation
  const confirmationsRef = useRef(new Map<string, PickupConfirmation>());

  const BATCH_DELAY = 500; // 0.5 seconds

  // Fetch the icon path on mount
  useEffect(() => {
    const fetchIconPath = async () => {
      try {
        const path = await window.electronAPI?.getIconPath();
        if (path) {
          setIconPath(path);
        }
      } catch (error) {
        console.error('Failed to fetch icon path:', error);
      }
    };

    fetchIconPath();
  }, []);

  const playNotificationSound = useCallback(() => {
    if (enableSounds) {
      try {
        const audio = new Audio(dingSound);
        audio.volume = notificationVolume;

        // Add detailed logging to diagnose the issue
        console.log('[NotificationButton] Attempting to play sound:', {
          path: dingSound,
          volume: audio.volume,
          enableSounds,
        });

        audio
          .play()
          .then(() => {
            console.log('[NotificationButton] ✅ Sound played successfully');
          })
          .catch((error) => {
            console.error('[NotificationButton] ❌ Failed to play sound:', error);
            // Log more details about the error
            console.error('Error details:', {
              name: error.name,
              message: error.message,
              audioSrc: audio.src,
              audioReadyState: audio.readyState,
            });
          });
      } catch (error) {
        console.error('[NotificationButton] ❌ Failed to create audio:', error);
      }
    } else {
      console.log('[NotificationButton] Sound disabled in settings');
    }
  }, [enableSounds, notificationVolume]);

  const showBrowserNotification = useCallback(
    (find: Find) => {
      const itemName = find.grailItem.name;
      const notification = find.provisional
        ? new Notification(t(translations.grail.notifications.itemPickedUp), {
            body: find.ethereal
              ? t(translations.grail.notifications.etherealItemPickedUp, { itemName })
              : itemName,
            icon: iconPath,
            tag: 'grail-item',
            requireInteraction: true,
          })
        : new Notification(t(translations.grail.notifications.holyGrailItemFound), {
            body: t(translations.grail.notifications.itemFoundBy, {
              itemName,
              characterName: find.characterName,
            }),
            icon: iconPath,
            tag: 'grail-item',
            requireInteraction: true,
          });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    },
    [iconPath, t],
  );

  const showBatchNotification = useCallback(
    (events: Find[]) => {
      const itemNames = events.map((e) => e.grailItem.name).join(', ');
      const notification = new Notification(
        t(translations.grail.notifications.multipleItemsFound, { count: events.length }),
        {
          body:
            itemNames.length > 100
              ? t(translations.grail.notifications.multipleItemsIncluding, {
                  count: events.length,
                  firstName: events[0].grailItem.name,
                })
              : itemNames,
          icon: iconPath,
          tag: 'grail-batch',
          requireInteraction: true,
        },
      );

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    },
    [iconPath, t],
  );

  const processBatch = useCallback(async () => {
    if (notificationQueue.length === 0) return;

    // Add ALL queued items to in-app notifications
    if (inAppNotifications) {
      // Fetch progress data for each item
      const newNotifications = await Promise.all(
        notificationQueue.map(async (find) => ({
          ...find,
          ...(await fetchProgress(find.grailItem.id)),
          id: `${Date.now()}_${find.grailItem.id}_${Math.random()}`,
          timestamp: new Date(),
          dismissed: false,
          seen: false,
        })),
      );

      setNotifications((prev) => [
        ...newNotifications.map((notification) =>
          applyConfirmation(notification, confirmationsRef.current),
        ),
        ...prev.slice(0, 10 - newNotifications.length),
      ]);
    }

    // Play sound ONCE for the batch
    playNotificationSound();

    // Show native notification
    if (nativeNotifications && 'Notification' in window && Notification.permission === 'granted') {
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
    inAppNotifications,
    nativeNotifications,
    playNotificationSound,
    showBrowserNotification,
    showBatchNotification,
  ]);

  // Update ref whenever processBatch changes
  useEffect(() => {
    processBatchRef.current = processBatch;
  }, [processBatch]);

  useEffect(() => {
    const enqueue = (find: Find) => {
      setNotificationQueue((prev) => [...prev, find]);

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

    // Listen for item detection events. The cleanup removes exactly this listener, so React Strict
    // Mode's mount/unmount/mount in development does not leave a duplicate behind.
    const handleItemDetection = (itemEvent: ItemDetectionEvent) => {
      const find: Find = {
        grailItem: itemEvent.grailItem,
        ethereal: Boolean(itemEvent.item.ethereal),
        characterName: itemEvent.item.characterName,
        provisional: false,
      };
      // The save file confirms a pickup the plugin announced: update its notification instead of
      // announcing the item again. This also holds for a silent detection, which only suppresses
      // new notifications.
      const key = getFindKey(find);
      if (isPendingPickup(pendingPickupsRef.current, key, Date.now())) {
        pendingPickupsRef.current.delete(key);
        void confirmPickup(find, key, confirmationsRef.current, setNotifications);
        return;
      }

      // Skip all notifications if silent flag is set
      // Silent flag is true during:
      // - Initial startup parsing: prevents spam for existing items
      // - Force re-scan: prevents re-notification of already found items
      // Items are still saved to database, only UI notifications are suppressed
      if (itemEvent.silent) {
        return;
      }
      enqueue(find);
    };

    const handlePickup = ({ grailItem, ethereal }: D2RLoaderPickupPayload) => {
      const find: Find = { grailItem, ethereal, provisional: true };
      const key = getFindKey(find);
      // A new pickup of this version is not confirmed yet
      confirmationsRef.current.delete(key);
      pendingPickupsRef.current.set(key, Date.now());
      enqueue(find);
    };

    const unsubscribe = combineUnsubscribers([
      onMainEvent('item-detection-event', handleItemDetection),
      onMainEvent('d2rLoader:item-picked-up', handlePickup),
    ]);

    return () => {
      unsubscribe();
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once on mount (notificationQueue accessed via closure)

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

  const bellLabel =
    unseenCount > 0
      ? t(translations.grail.notifications.notificationsLabelWithUnread, { count: unseenCount })
      : t(translations.grail.notifications.notificationsLabel);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        aria-label={bellLabel}
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'relative')}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unseenCount > 0 && (
          <Badge
            variant="destructive"
            aria-hidden="true"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs"
          >
            {unseenCount}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="max-h-[min(32rem,var(--available-height))] w-80 gap-0 p-0"
      >
        <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-3">
          <PopoverTitle className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4" aria-hidden="true" />
            {t(translations.grail.notifications.recentNotifications)}
          </PopoverTitle>
          {activeNotifications.length > 0 && (
            <Button
              onClick={clearAllNotifications}
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
            >
              {t(translations.grail.notifications.clearAll)}
            </Button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {activeNotifications.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground">
              <Trophy className="mx-auto mb-2 h-8 w-8 opacity-50" aria-hidden="true" />
              <p className="text-sm">{t(translations.grail.notifications.noRecentDetections)}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {activeNotifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`relative ${!notification.seen ? 'rounded-lg ring-2 ring-primary/40' : ''}`}
                >
                  <ItemCard
                    item={notification.grailItem}
                    normalProgress={notification.normalProgress}
                    etherealProgress={notification.etherealProgress}
                    characters={characters}
                    viewMode="list"
                    withoutStatusIndicators
                  />
                  {notification.provisional && (
                    <p className="px-3 pt-1 text-muted-foreground text-xs">
                      {t(translations.grail.notifications.pickedUpPending)}
                    </p>
                  )}
                  <Button
                    onClick={() => dismissNotification(notification.id)}
                    variant="ghost"
                    size="sm"
                    aria-label={t(translations.grail.notifications.dismissNotification, {
                      itemName: notification.grailItem.name,
                    })}
                    className="absolute top-2 right-2 z-10 h-6 w-6 rounded-full bg-background p-0 shadow-sm hover:bg-accent"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
