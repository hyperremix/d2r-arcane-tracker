import { describe, expect, it, vi } from 'vitest';
import { type BroadcastTarget, createRendererBroadcaster, sendToRenderer } from './broadcast';

function createTarget(type: string, destroyed = false) {
  return {
    isDestroyed: vi.fn(() => destroyed),
    getType: vi.fn(() => type),
    send: vi.fn(),
  };
}

function asTargets(targets: ReturnType<typeof createTarget>[]): BroadcastTarget[] {
  return targets as unknown as BroadcastTarget[];
}

describe('When an event is broadcast to renderers', () => {
  it('Then only live window web contents receive it', () => {
    // Arrange
    const mainWindow = createTarget('window');
    const widgetWindow = createTarget('window');
    const devTools = createTarget('remote');
    const closedWindow = createTarget('window', true);
    const broadcastToRenderers = createRendererBroadcaster(() =>
      asTargets([mainWindow, widgetWindow, devTools, closedWindow]),
    );
    const payload = { session: { id: 'session-1' } };

    // Act
    broadcastToRenderers('run-tracker:session-started', payload as never);

    // Assert
    expect(mainWindow.send).toHaveBeenCalledWith('run-tracker:session-started', payload);
    expect(widgetWindow.send).toHaveBeenCalledWith('run-tracker:session-started', payload);
    expect(devTools.send).not.toHaveBeenCalled();
    expect(closedWindow.send).not.toHaveBeenCalled();
  });

  it('If the event has no payload, Then it is sent with the channel only', () => {
    // Arrange
    const mainWindow = createTarget('window');
    const broadcastToRenderers = createRendererBroadcaster(() => asTargets([mainWindow]));

    // Act
    broadcastToRenderers('grail-progress-updated');

    // Assert
    expect(mainWindow.send).toHaveBeenCalledWith('grail-progress-updated');
    expect(mainWindow.send.mock.calls[0]).toHaveLength(1);
  });

  it('If no web contents are available, Then nothing is sent and nothing throws', () => {
    // Arrange
    const broadcastToRenderers = createRendererBroadcaster(
      () => undefined as unknown as BroadcastTarget[],
    );

    // Act
    const broadcast = () => broadcastToRenderers('grail-progress-updated');

    // Assert
    expect(broadcast).not.toThrow();
  });
});

describe('When an event is sent to one renderer', () => {
  it('Then it is delivered unless the web contents were destroyed', () => {
    // Arrange
    const liveWindow = createTarget('window');
    const closedWindow = createTarget('window', true);
    const status = { checking: false, available: true, downloading: false, downloaded: false };

    // Act
    sendToRenderer(liveWindow, 'update:status', status);
    sendToRenderer(closedWindow, 'update:status', status);

    // Assert
    expect(liveWindow.send).toHaveBeenCalledWith('update:status', status);
    expect(closedWindow.send).not.toHaveBeenCalled();
  });
});
