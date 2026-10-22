import { createServer, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { constants as constants105 } from '@dschu012/d2s/lib/data/versions/105_constant_data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runes } from '../../items/runes';
import { uniques } from '../../items/uniques';
import type { GrailProgress, Item, Run, Session, Settings } from '../../types/grail';
import { EventBus } from '../EventBus';
import {
  CONNECTION_TIMEOUT_MS,
  D2RLoaderBridge,
  type D2RLoaderBridgeDependencies,
} from './d2rLoaderBridge';

const shako = uniques.find((item) => item.id === 'harlequincrest') as Item;
const shakoRow = constants105.unq_items.findIndex(
  (row: { n?: string } | undefined) => row?.n === 'Harlequin Crest',
);
const ber = runes.find((item) => item.id === 'ber') as Item;

/** Finds a free loopback port by listening on port 0 and closing again. */
async function findFreePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

interface TestResponse {
  status: number;
  body: string;
}

/** Sends a plugin request with the given token. */
function send(
  port: number,
  token: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          text += chunk;
        });
        response.on('end', () => resolve({ status: response.statusCode ?? 0, body: text }));
      },
    );
    request.on('error', reject);
    request.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

describe('When the D2RLoader bridge runs', () => {
  let port: number;
  let now: number;
  let stored: Partial<Settings>;
  let progress: GrailProgress[];
  let session: Session | null;
  let run: Run | null;
  let eventBus: EventBus;
  let broadcastToRenderers: ReturnType<typeof vi.fn>;
  let runTracker: {
    [K in keyof D2RLoaderBridgeDependencies['runTracker']]: ReturnType<typeof vi.fn>;
  };
  let bridge: D2RLoaderBridge;

  const token = () => stored.d2rLoaderToken ?? '';
  const post = (path: string, body: unknown) => send(port, token(), 'POST', path, body);
  const getState = (revision = '') =>
    send(port, token(), 'GET', `/v1/state?revision=${encodeURIComponent(revision)}`);
  const sendEvents = (...events: unknown[]) => post('/v1/events', { events });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    port = await findFreePort();
    now = Date.parse('2026-10-22T12:00:00Z');
    stored = {
      d2rLoaderBridge: true,
      d2rLoaderPort: port,
      lang: 'en',
      grailNormal: true,
      grailEthereal: true,
    };
    progress = [];
    session = null;
    run = null;
    eventBus = new EventBus();
    broadcastToRenderers = vi.fn();
    runTracker = {
      getActiveSession: vi.fn(() => session),
      getActiveRun: vi.fn(() => run),
      startSession: vi.fn(),
      endSession: vi.fn(),
    };
    bridge = new D2RLoaderBridge({
      eventBus,
      settings: {
        getAll: () => stored as Settings,
        set: vi.fn((key, value) => {
          stored = { ...stored, [key]: value };
          eventBus.emit('settings-updated', { [key]: value });
        }),
        onUpdated: (listener) => eventBus.on('settings-updated', listener),
      },
      database: {
        getFilteredItems: vi.fn(() => [shako, ber]),
        getAllProgress: vi.fn(() => progress),
      },
      runTracker: runTracker as unknown as D2RLoaderBridgeDependencies['runTracker'],
      broadcastToRenderers:
        broadcastToRenderers as unknown as D2RLoaderBridgeDependencies['broadcastToRenderers'],
      now: () => now,
    });
    await bridge.start();
  });

  afterEach(async () => {
    await bridge.dispose();
    vi.useRealTimers();
  });

  it('Then it listens with a new token and reports that it waits for the plugin', () => {
    // Assert
    expect(token()).toMatch(/^[0-9a-f]{64}$/);
    expect(bridge.getStatus()).toEqual({
      enabled: true,
      listening: true,
      port,
      connected: false,
      error: undefined,
      pluginVersion: undefined,
    });
  });

  it('If the plugin says hello, Then it counts as connected with its version', async () => {
    // Arrange
    const connectionChanged = vi.fn();
    eventBus.on('d2rloader-connection-changed', connectionChanged);

    // Act
    const response = await post('/v1/hello', { protocol: 1, pluginVersion: '1.0.0' });

    // Assert
    expect(response).toEqual({ status: 200, body: '{"protocol":1}' });
    expect(bridge.getStatus()).toMatchObject({ connected: true, pluginVersion: '1.0.0' });
    expect(connectionChanged).toHaveBeenCalledWith({ connected: true });
    expect(broadcastToRenderers).toHaveBeenCalledWith(
      'd2rLoader:status',
      expect.objectContaining({ connected: true }),
    );
  });

  it('If the plugin speaks another protocol version, Then hello answers 409', async () => {
    // Act
    const response = await post('/v1/hello', { protocol: 2, pluginVersion: '2.0.0' });

    // Assert
    expect(response.status).toBe(409);
    expect(bridge.isConnected()).toBe(false);
  });

  it('If the player leaves town, Then the game is entered once, and leaving the game exits it', async () => {
    // Arrange
    const entered = vi.fn();
    const exited = vi.fn();
    eventBus.on('game-entered', entered);
    eventBus.on('game-exited', exited);

    // Act
    await sendEvents(
      { type: 'game-joined' },
      { type: 'level-changed', levelId: 1, previousLevelId: -1 },
    );
    const enteredInTown = entered.mock.calls.length;
    await sendEvents(
      { type: 'level-changed', levelId: 2, previousLevelId: 1 },
      { type: 'level-changed', levelId: 1, previousLevelId: 2 },
      { type: 'level-changed', levelId: 3, previousLevelId: 1 },
      { type: 'game-left' },
    );

    // Assert
    expect(enteredInTown).toBe(0);
    expect(entered).toHaveBeenCalledTimes(1);
    expect(entered).toHaveBeenCalledWith({ source: 'd2rloader' });
    expect(exited).toHaveBeenCalledTimes(1);
    expect(exited).toHaveBeenCalledWith({ source: 'd2rloader' });
  });

  it('If the player leaves a game without leaving town, Then no game is exited', async () => {
    // Arrange
    const exited = vi.fn();
    eventBus.on('game-exited', exited);

    // Act
    await sendEvents(
      { type: 'game-joined' },
      { type: 'level-changed', levelId: 40, previousLevelId: -1 },
      { type: 'game-left' },
    );

    // Assert
    expect(exited).not.toHaveBeenCalled();
  });

  it('If a missing grail item is picked up, Then the renderers hear about it once per game', async () => {
    // Arrange
    const pickup = {
      type: 'item-picked-up',
      item: { kind: 'unique', recordId: shakoRow, code: 'uap', ethereal: false },
    };

    // Act
    await sendEvents({ type: 'game-joined' }, pickup, pickup);
    await sendEvents({ type: 'game-left' }, { type: 'game-joined' }, pickup);

    // Assert
    const pickups = broadcastToRenderers.mock.calls.filter(
      ([channel]) => channel === 'd2rLoader:item-picked-up',
    );
    expect(pickups).toEqual([
      ['d2rLoader:item-picked-up', { grailItem: shako, ethereal: false }],
      ['d2rLoader:item-picked-up', { grailItem: shako, ethereal: false }],
    ]);
  });

  it('If the picked-up version is already found, Then the renderers hear nothing', async () => {
    // Arrange
    progress = [
      {
        id: 'p1',
        characterId: 'c1',
        itemId: ber.id,
        foundDate: new Date(now),
        manuallyAdded: false,
        isEthereal: false,
      },
    ];

    // Act
    await sendEvents({
      type: 'item-picked-up',
      item: { kind: 'rune', recordId: -1, code: 'r30', ethereal: false },
    });

    // Assert
    expect(broadcastToRenderers).not.toHaveBeenCalledWith(
      'd2rLoader:item-picked-up',
      expect.anything(),
    );
  });

  it('Then the state has the grail status until the plugin has its revision, and the overlay every time', async () => {
    // Arrange
    session = { id: 's1', runCount: 3 } as Session;
    run = { id: 'r1', runNumber: 3, startTime: new Date(now - 65_000) } as Run;

    // Act
    const first = await getState();
    const revision = first.body.split('\n')[0].split('\t')[1];
    const second = await getState(revision);

    // Assert
    expect(first.status).toBe(200);
    expect(first.body).toContain('text\tmissing\tHoly Grail: not found yet\n');
    expect(first.body).toContain(`item\tu:${shakoRow}:uap\t1\t1\n`);
    expect(first.body).toContain('item\tr:r30\t1\t0\n');
    expect(second.body).toBe(
      `revision\t${revision}\noverlay\tRun 3 · 1:05\noverlay\tGrail 0/3 (0.0%)\n`,
    );
  });

  it('If the player presses the session keybind, Then the session is started or ended', async () => {
    // Act
    await sendEvents({ type: 'command', action: 'toggle-session' });
    session = { id: 's1' } as Session;
    await sendEvents({ type: 'command', action: 'toggle-session' });

    // Assert
    expect(runTracker.startSession).toHaveBeenCalledTimes(1);
    expect(runTracker.endSession).toHaveBeenCalledTimes(1);
  });

  it('If the plugin stops responding in a game it left town in, Then the game is exited', async () => {
    // Arrange
    const exited = vi.fn();
    eventBus.on('game-exited', exited);
    await sendEvents({ type: 'level-changed', levelId: 2, previousLevelId: -1 });

    // Act
    now += CONNECTION_TIMEOUT_MS + 1;
    vi.advanceTimersByTime(1_000);

    // Assert
    expect(bridge.isConnected()).toBe(false);
    expect(exited).toHaveBeenCalledWith({ source: 'd2rloader' });
  });

  it('If the user turns the connection off, Then it stops listening', async () => {
    // Act
    stored = { ...stored, d2rLoaderBridge: false };
    eventBus.emit('settings-updated', { d2rLoaderBridge: false });
    await vi.waitFor(() => expect(bridge.getStatus().listening).toBe(false));

    // Assert
    await expect(getState()).rejects.toThrow();
  });
});

describe('When the D2RLoader bridge port is used by another program', () => {
  it('Then the status reports the port as in use', async () => {
    // Arrange
    const blocker = createServer();
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const { port } = blocker.address() as AddressInfo;
    const eventBus = new EventBus();
    const bridge = new D2RLoaderBridge({
      eventBus,
      settings: {
        getAll: () =>
          ({ d2rLoaderBridge: true, d2rLoaderPort: port, d2rLoaderToken: 'token' }) as Settings,
        set: vi.fn(),
        onUpdated: (listener) => eventBus.on('settings-updated', listener),
      },
      database: { getFilteredItems: vi.fn(() => []), getAllProgress: vi.fn(() => []) },
      runTracker: {} as D2RLoaderBridgeDependencies['runTracker'],
      broadcastToRenderers: vi.fn(),
    });

    try {
      // Act
      await bridge.start();

      // Assert
      expect(bridge.getStatus()).toMatchObject({ listening: false, error: 'portInUse', port });
    } finally {
      await bridge.dispose();
      await new Promise((resolve) => blocker.close(resolve));
    }
  });
});
