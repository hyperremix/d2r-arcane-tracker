import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ItemDetectionEvent } from 'electron/types/grail';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMainEventsMock } from '@/test/mainEventsMock';
import { NotificationButton } from './NotificationButton';

vi.mock('@/stores/grailStore', () => ({
  useGrailStore: () => ({
    settings: {
      enableSounds: false,
      notificationVolume: 0,
      inAppNotifications: true,
      nativeNotifications: false,
    },
  }),
}));

vi.mock('@/components/grail/ItemCard', () => ({
  ItemCard: ({ item }: { item: { name: string } }) => <div>{item.name}</div>,
}));

const mainEvents = createMainEventsMock();
const windowGlobals = window as unknown as { electronAPI: unknown };
const originalElectronAPI = windowGlobals.electronAPI;

function createDetectionEvent(id: string, name: string): ItemDetectionEvent {
  return {
    type: 'item-found',
    item: { id, name, characterName: 'Sorc' },
    grailItem: { id, name },
  } as unknown as ItemDetectionEvent;
}

async function renderNotificationButton() {
  // Flush the mount-time IPC requests (characters, icon path) inside act
  return await act(async () => render(<NotificationButton />));
}

async function emitDetections(events: ItemDetectionEvent[]) {
  await act(async () => {
    for (const event of events) {
      mainEvents.emit('item-detection-event', event);
    }
  });
}

describe('When NotificationButton is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainEvents.reset();
    // Assign rather than redefine: other suites may already have defined a writable,
    // non-configurable `window.electronAPI` in the shared test environment.
    windowGlobals.electronAPI = {
      on: mainEvents.on,
      getIconPath: vi.fn(async () => undefined),
      grail: {
        getCharacters: vi.fn(async () => []),
        getProgressByItem: vi.fn(async () => []),
      },
    };
  });

  afterAll(() => {
    windowGlobals.electronAPI = originalElectronAPI;
  });

  it('When it unmounts, Then the item detection listener is removed', async () => {
    // Arrange
    const { unmount } = await renderNotificationButton();
    expect(mainEvents.listenerCount('item-detection-event')).toBe(1);

    // Act
    unmount();

    // Assert
    expect(mainEvents.listenerCount('item-detection-event')).toBe(0);
  });

  it('When it is mounted again, Then exactly one item detection listener is active', async () => {
    // Arrange
    const { unmount } = await renderNotificationButton();
    unmount();

    // Act
    await renderNotificationButton();

    // Assert
    expect(mainEvents.listenerCount('item-detection-event')).toBe(1);
  });

  it('Then the bell button has an accessible name', async () => {
    // Arrange & Act
    await renderNotificationButton();

    // Assert
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('If there are unseen notifications, then the bell accessible name includes the count', async () => {
    // Arrange
    await renderNotificationButton();

    // Act
    await emitDetections([
      createDetectionEvent('1', 'Shako'),
      createDetectionEvent('2', 'Arachnid Mesh'),
    ]);

    // Assert
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('If the bell is activated, then the popover opens and Escape closes it', async () => {
    // Arrange
    await renderNotificationButton();
    const bell = screen.getByRole('button', { name: 'Notifications' });

    // Act - open
    fireEvent.click(bell);

    // Assert - open
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Recent Notifications');
    expect(dialog).toHaveTextContent('No recent item detections');
    expect(bell).toHaveAttribute('aria-expanded', 'true');

    // Act - close via keyboard
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    // Assert - closed
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(bell).toHaveAttribute('aria-expanded', 'false');
  });

  it('If notifications are listed, then each dismiss button has a translated label and removes its item', async () => {
    // Arrange
    await renderNotificationButton();
    await emitDetections([createDetectionEvent('1', 'Shako')]);
    const bell = await screen.findByRole(
      'button',
      { name: 'Notifications, 1 unread' },
      { timeout: 2000 },
    );
    fireEvent.click(bell);
    const dismissButton = await screen.findByRole('button', {
      name: 'Dismiss notification for Shako',
    });

    // Act
    fireEvent.click(dismissButton);

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveTextContent('No recent item detections');
    });
    expect(
      screen.queryByRole('button', { name: 'Dismiss notification for Shako' }),
    ).not.toBeInTheDocument();
  });

  it('If the popover opens, then focus moves into it and returns to the bell when it closes', async () => {
    // Arrange
    await renderNotificationButton();
    const bell = screen.getByRole('button', { name: 'Notifications' });
    bell.focus();

    // Act - open
    fireEvent.click(bell);

    // Assert - focus is inside the popup
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    });

    // Act - close via keyboard
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    // Assert - focus returns to the bell
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(bell).toHaveFocus();
    });
  });
});
