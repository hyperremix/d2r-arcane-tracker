import { randomBytes } from 'node:crypto';
import { translations } from '../../../src/i18n/translations';
import type { GrailDatabase } from '../../database/database';
import { translate } from '../../i18n/translate';
import type { BroadcastToRenderers } from '../../ipc/broadcast';
import {
  type D2RLoaderEvent,
  type D2RLoaderItem,
  type D2RLoaderStatus,
  DEFAULT_D2RLOADER_PORT,
} from '../../types/d2rLoader';
import type { Settings } from '../../types/grail';
import { formatClockDuration, getRunElapsedMs } from '../../utils/runClock';
import { createServiceLogger } from '../../utils/serviceLogger';
import type { EventBus } from '../EventBus';
import type { RunTrackerService } from '../runTracker';
import type { SettingsService } from '../settingsService';
import { type BridgeResponse, BridgeServer, PortInUseError } from './bridgeServer';
import {
  buildGrailStatusTable,
  type GrailStatusTable,
  getReportedItemKey,
  getStatusOfCopy,
  VersionStatus,
} from './grailStatus';
import { PROTOCOL_VERSION, parseEventsRequest, parseHelloRequest, toStateField } from './protocol';

const log = createServiceLogger('D2RLoaderBridge');

/** Levels.txt rows of the five towns. A run starts when the player first leaves one of them. */
const TOWN_LEVEL_IDS: ReadonlySet<number> = new Set([1, 40, 75, 103, 109]);

/** The plugin counts as disconnected after this long without a request; it polls every second. */
export const CONNECTION_TIMEOUT_MS = 5_000;

/** How often the connection is checked for the timeout. */
const CONNECTION_CHECK_INTERVAL_MS = 1_000;

/** The grail status is read from the database again at most this often. */
const GRAIL_STATUS_MAX_AGE_MS = 3_000;

/** Settings that start, stop or move the server. */
const SERVER_SETTING_KEYS: readonly (keyof Settings)[] = ['d2rLoaderBridge', 'd2rLoaderPort'];

/** Dependencies of the {@link D2RLoaderBridge}. */
export interface D2RLoaderBridgeDependencies {
  eventBus: EventBus;
  settings: Pick<SettingsService, 'getAll' | 'set' | 'onUpdated'>;
  database: Pick<GrailDatabase, 'getFilteredItems' | 'getAllProgress'>;
  runTracker: Pick<
    RunTrackerService,
    'getActiveSession' | 'getActiveRun' | 'startSession' | 'endSession'
  >;
  broadcastToRenderers: BroadcastToRenderers;
  /** Current time in milliseconds; tests replace it. */
  now?: () => number;
}

/** What the bridge knows about the game the player is in. */
interface GameState {
  /** Whether the player left town in this game, which started its run. */
  runStarted: boolean;
  /** Grail item versions reported as picked up in this game, as `<item id>:<ethereal>`. */
  reportedFinds: Set<string>;
  /** Name of the last grail item picked up in this game, shown in the overlay. */
  lastFind?: string;
}

/** The grail status with the plugin's records of it, rebuilt from the database when it gets old. */
interface GrailState {
  table: GrailStatusTable;
  /** The `text` and `item` records of the state response. */
  records: string[];
  revision: string;
  builtAt: number;
}

/** The state of a game in which nothing has happened yet. */
function newGame(): GameState {
  return { runStarted: false, reportedFinds: new Set() };
}

/** 32-bit FNV-1a hash of a text, as eight hex digits. */
function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Connects the app with the Arcane Tracker plugin of D2RLoader (see `plugin/PROTOCOL.md` and
 * docs/D2RLOADER.md). While the user has the connection turned on, a loopback server receives the
 * plugin's events and serves it the grail status and the overlay text:
 * - Leaving town starts the game's run and leaving the game ends it (`game-entered` and
 *   `game-exited` with the plugin as source, which the run tracker prefers to memory reading).
 * - Picking up a grail item version that isn't found yet is announced to the renderers at once;
 *   the save file detection records it once the game saves.
 * - The plugin's keybind starts or ends a session.
 */
export class D2RLoaderBridge {
  private readonly server: BridgeServer;
  private readonly now: () => number;
  private status: D2RLoaderStatus;
  private lastSeenAt = 0;
  private game: GameState | undefined;
  private grail: GrailState | undefined;
  private connectionTimer: NodeJS.Timeout | undefined;
  private unsubscribeSettings: (() => void) | undefined;
  /** The latest server (re)start, so settings changes are applied one after another. */
  private applying: Promise<void> = Promise.resolve();

  constructor(private readonly deps: D2RLoaderBridgeDependencies) {
    this.now = deps.now ?? Date.now;
    this.server = new BridgeServer({
      hello: (body) => this.handleHello(body),
      events: (body) => this.handleEvents(body),
      state: (revision) => this.handleState(revision),
    });
    this.status = {
      enabled: false,
      listening: false,
      port: DEFAULT_D2RLOADER_PORT,
      connected: false,
    };
  }

  /**
   * Starts listening if the user turned the connection on, and follows later settings changes.
   * @returns Promise that resolves when the server was started or failed to start
   */
  start(): Promise<void> {
    this.unsubscribeSettings = this.deps.settings.onUpdated((changes) => {
      // The grail settings and the language change the grail status and its text
      this.grail = undefined;
      if (SERVER_SETTING_KEYS.some((key) => key in changes)) {
        void this.applySettings();
      }
    });
    this.connectionTimer = setInterval(() => this.checkConnection(), CONNECTION_CHECK_INTERVAL_MS);
    this.connectionTimer.unref?.();
    return this.applySettings();
  }

  /** Returns the connection state. */
  getStatus(): D2RLoaderStatus {
    return { ...this.status };
  }

  /** Port and token the plugin needs in its config file; creates the token when there is none. */
  getConnectionSettings(): { port: number; token: string } {
    const settings = this.deps.settings.getAll();
    return {
      port: settings.d2rLoaderPort ?? DEFAULT_D2RLOADER_PORT,
      token: this.ensureToken(settings),
    };
  }

  /** Stops the server and ends the game the plugin reported. */
  async dispose(): Promise<void> {
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = undefined;
    if (this.connectionTimer) {
      clearInterval(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    await this.applying;
    this.setConnected(false);
    await this.server.stop();
  }

  private ensureToken(settings: Settings): string {
    if (settings.d2rLoaderToken) {
      return settings.d2rLoaderToken;
    }
    const token = randomBytes(32).toString('hex');
    this.deps.settings.set('d2rLoaderToken', token);
    return token;
  }

  /** Starts, restarts or stops the server to match the settings. */
  private applySettings(): Promise<void> {
    this.applying = this.applying.then(async () => {
      const settings = this.deps.settings.getAll();
      const enabled = settings.d2rLoaderBridge === true;
      const port = settings.d2rLoaderPort ?? DEFAULT_D2RLOADER_PORT;

      this.setConnected(false);
      await this.server.stop();
      this.updateStatus({
        enabled,
        listening: false,
        port,
        error: undefined,
        pluginVersion: undefined,
      });
      if (!enabled) {
        return;
      }

      try {
        await this.server.start(port, this.ensureToken(settings));
        this.updateStatus({ listening: true });
        log.info('applySettings', `Listening for the D2RLoader plugin on port ${port}`);
      } catch (error) {
        log.error('applySettings', error, { port });
        this.updateStatus({
          error: error instanceof PortInUseError ? 'portInUse' : 'listenFailed',
        });
      }
    });
    return this.applying;
  }

  private updateStatus(changes: Partial<D2RLoaderStatus>): void {
    const next = { ...this.status, ...changes };
    if (JSON.stringify(next) === JSON.stringify(this.status)) {
      return;
    }
    this.status = next;
    this.deps.broadcastToRenderers('d2rLoader:status', this.getStatus());
  }

  /**
   * Records the connection state. A lost connection ends the game the plugin reported, so the run
   * of a game that crashed doesn't stay open.
   */
  private setConnected(connected: boolean): void {
    if (connected === this.status.connected) {
      return;
    }
    if (!connected) {
      this.endGame();
    }
    // The run tracker learns about the connection before the renderers, which ask it about auto
    // tracking when the status changes
    this.deps.eventBus.emit('d2rloader-connection-changed', { connected });
    this.updateStatus({ connected });
  }

  /** Marks the plugin as connected; called for every authenticated request. */
  private markSeen(): void {
    this.lastSeenAt = this.now();
    this.setConnected(true);
  }

  private checkConnection(): void {
    if (this.status.connected && this.now() - this.lastSeenAt > CONNECTION_TIMEOUT_MS) {
      log.info('checkConnection', 'The D2RLoader plugin stopped responding');
      this.setConnected(false);
    }
  }

  private handleHello(body: unknown): BridgeResponse {
    const hello = parseHelloRequest(body);
    if (hello.protocol !== PROTOCOL_VERSION) {
      return { status: 409, json: { protocol: PROTOCOL_VERSION } };
    }
    this.markSeen();
    this.updateStatus({ pluginVersion: hello.pluginVersion });
    return { status: 200, json: { protocol: PROTOCOL_VERSION } };
  }

  private handleEvents(body: unknown): BridgeResponse {
    const events = parseEventsRequest(body);
    this.markSeen();
    for (const event of events) {
      this.handleEvent(event);
    }
    return { status: 204 };
  }

  private handleEvent(event: D2RLoaderEvent): void {
    switch (event.type) {
      case 'game-joined':
        this.endGame();
        this.game = newGame();
        return;
      case 'game-left':
        this.endGame();
        return;
      case 'level-changed':
        this.handleLevelChanged(event.levelId);
        return;
      case 'item-picked-up':
        this.handlePickup(event.item);
        return;
      case 'command':
        this.toggleSession();
        return;
    }
  }

  private handleLevelChanged(levelId: number): void {
    // A game the plugin joined before the app listened has no game-joined event
    this.game ??= newGame();
    if (!this.game.runStarted && !TOWN_LEVEL_IDS.has(levelId)) {
      this.game.runStarted = true;
      this.deps.eventBus.emit('game-entered', { source: 'd2rloader' });
    }
  }

  /** Ends the game the plugin reported, and its run if the player left town in it. */
  private endGame(): void {
    const game = this.game;
    this.game = undefined;
    if (game?.runStarted) {
      this.deps.eventBus.emit('game-exited', { source: 'd2rloader' });
    }
  }

  /**
   * Announces a picked-up grail item version that isn't found yet. Each version is announced once
   * per game. Nothing is recorded: the save file detection does that once the game saves.
   */
  private handlePickup(item: D2RLoaderItem): void {
    const status = this.getGrail().table.byKey.get(getReportedItemKey(item));
    if (!status || getStatusOfCopy(status, item.ethereal) !== VersionStatus.Missing) {
      return;
    }
    this.game ??= newGame();
    const findKey = `${status.item.id}:${item.ethereal}`;
    if (this.game.reportedFinds.has(findKey)) {
      return;
    }
    this.game.reportedFinds.add(findKey);
    this.game.lastFind = status.item.name;
    this.deps.broadcastToRenderers('d2rLoader:item-picked-up', {
      grailItem: status.item,
      ethereal: item.ethereal,
    });
  }

  private toggleSession(): void {
    const { runTracker } = this.deps;
    try {
      if (runTracker.getActiveSession()) {
        runTracker.endSession();
      } else {
        runTracker.startSession();
      }
    } catch (error) {
      log.error('toggleSession', error);
    }
  }

  /** Returns the grail status, rebuilt from the database when it's older than a few seconds. */
  private getGrail(): GrailState {
    const now = this.now();
    if (this.grail && now - this.grail.builtAt <= GRAIL_STATUS_MAX_AGE_MS) {
      return this.grail;
    }

    const settings = this.deps.settings.getAll();
    const table = buildGrailStatusTable(
      this.deps.database.getFilteredItems(settings),
      this.deps.database.getAllProgress(),
      settings,
    );
    const text = (key: string) => toStateField(translate(key, settings.lang));
    const labels = translations.d2rLoader.inGame;
    const records = [
      `text\tmissing\t${text(labels.tooltipMissing)}`,
      `text\tfound\t${text(labels.tooltipFound)}`,
      `text\tmissing-ethereal\t${text(labels.tooltipMissingEthereal)}`,
      `text\tfound-ethereal\t${text(labels.tooltipFoundEthereal)}`,
      ...[...table.byKey].map(
        ([key, status]) => `item\t${key}\t${status.normal}\t${status.ethereal}`,
      ),
    ];
    this.grail = { table, records, revision: hashText(records.join('\n')), builtAt: now };
    return this.grail;
  }

  private handleState(revision: string | undefined): BridgeResponse {
    this.markSeen();
    const grail = this.getGrail();
    const lines = [`revision\t${grail.revision}`];
    if (revision !== grail.revision) {
      lines.push(...grail.records);
    }
    lines.push(
      ...this.getOverlayLines(grail.table).map((line) => `overlay\t${toStateField(line)}`),
    );
    return { status: 200, text: `${lines.join('\n')}\n` };
  }

  /** The overlay: the run clock (or the session's run count between runs), the grail progress and the last grail item picked up in this game. */
  private getOverlayLines(table: GrailStatusTable): string[] {
    const language = this.deps.settings.getAll().lang;
    const labels = translations.d2rLoader.inGame;
    const lines: string[] = [];

    const session = this.deps.runTracker.getActiveSession();
    const run = this.deps.runTracker.getActiveRun();
    if (session && run) {
      lines.push(
        translate(labels.overlayRun, language, {
          number: run.runNumber,
          time: formatClockDuration(getRunElapsedMs(run, this.now())),
        }),
      );
    } else if (session) {
      lines.push(translate(labels.overlaySession, language, { count: session.runCount }));
    }

    if (table.total > 0) {
      lines.push(
        translate(labels.overlayGrail, language, {
          found: table.found,
          total: table.total,
          percentage: ((table.found / table.total) * 100).toFixed(1),
        }),
      );
    }

    if (this.game?.lastFind) {
      lines.push(translate(labels.overlayLastFind, language, { name: this.game.lastFind }));
    }
    return lines;
  }
}
