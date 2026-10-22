/**
 * Request parsing of the plugin protocol (see `plugin/PROTOCOL.md`). Everything the plugin sends
 * is untrusted: these parsers accept only the documented shapes and copy the fields they keep.
 */
import { ensure, isPlainObject } from '../../ipc/validation';
import {
  D2RLOADER_COMMANDS,
  D2RLOADER_ITEM_KINDS,
  type D2RLoaderEvent,
  type D2RLoaderItem,
} from '../../types/d2rLoader';

/** Protocol version the app speaks. */
export const PROTOCOL_VERSION = 1;

/** Most events the plugin may send in one request. */
export const MAX_EVENTS_PER_REQUEST = 50;

/** Plugin versions are printable ASCII (SemVer recommended), at most 63 characters. */
const PLUGIN_VERSION_PATTERN = /^[ -~]{1,63}$/;

/** Item codes are one to four characters from the game's item tables. */
const ITEM_CODE_PATTERN = /^[a-z0-9]{1,4}$/i;

/** Highest unique or set row accepted; the game data has far fewer rows. */
const MAX_RECORD_ID = 4095;

/** Highest level id accepted; Levels.txt has a few hundred rows. */
const MAX_LEVEL_ID = 4095;

/** Body of `POST /v1/hello`. */
export interface HelloRequest {
  protocol: number;
  pluginVersion: string;
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

/**
 * Parses the body of `POST /v1/hello`.
 * @param body - The parsed JSON body
 * @throws IpcValidationError when the body doesn't match the protocol
 */
export function parseHelloRequest(body: unknown): HelloRequest {
  ensure(isPlainObject(body), 'Invalid hello: expected an object');
  ensure(isInteger(body.protocol, 1, Number.MAX_SAFE_INTEGER), 'Invalid hello protocol');
  ensure(
    typeof body.pluginVersion === 'string' && PLUGIN_VERSION_PATTERN.test(body.pluginVersion),
    'Invalid hello plugin version',
  );
  return { protocol: body.protocol, pluginVersion: body.pluginVersion };
}

function parseItem(value: unknown): D2RLoaderItem {
  ensure(isPlainObject(value), 'Invalid item: expected an object');
  const kind = D2RLOADER_ITEM_KINDS.find((candidate) => candidate === value.kind);
  ensure(kind !== undefined, 'Invalid item kind');
  ensure(
    kind === 'rune' ? value.recordId === -1 : isInteger(value.recordId, 0, MAX_RECORD_ID),
    'Invalid item record id',
  );
  ensure(typeof value.code === 'string' && ITEM_CODE_PATTERN.test(value.code), 'Invalid item code');
  ensure(typeof value.ethereal === 'boolean', 'Invalid item ethereal flag');
  return {
    kind,
    recordId: value.recordId as number,
    code: (value.code as string).toLowerCase(),
    ethereal: value.ethereal,
  };
}

function parseEvent(value: unknown): D2RLoaderEvent {
  ensure(isPlainObject(value), 'Invalid event: expected an object');
  switch (value.type) {
    case 'game-joined':
    case 'game-left':
      return { type: value.type };
    case 'level-changed':
      ensure(
        isInteger(value.levelId, 0, MAX_LEVEL_ID) &&
          isInteger(value.previousLevelId, -1, MAX_LEVEL_ID),
        'Invalid level change',
      );
      return {
        type: 'level-changed',
        levelId: value.levelId,
        previousLevelId: value.previousLevelId,
      };
    case 'item-picked-up':
      return { type: 'item-picked-up', item: parseItem(value.item) };
    case 'command': {
      const action = D2RLOADER_COMMANDS.find((command) => command === value.action);
      ensure(action !== undefined, 'Invalid command');
      return { type: 'command', action };
    }
    default:
      ensure(false, 'Invalid event type');
  }
}

/**
 * Parses the body of `POST /v1/events`.
 * @param body - The parsed JSON body
 * @returns The events, oldest first
 * @throws IpcValidationError when the body or any event doesn't match the protocol
 */
export function parseEventsRequest(body: unknown): D2RLoaderEvent[] {
  ensure(isPlainObject(body), 'Invalid events: expected an object');
  ensure(
    Array.isArray(body.events) && body.events.length <= MAX_EVENTS_PER_REQUEST,
    `Invalid events: expected an array of at most ${MAX_EVENTS_PER_REQUEST} events`,
  );
  return body.events.map(parseEvent);
}

/**
 * Makes a text safe for a field of the line-based state response, which can't hold tabs or line
 * breaks.
 * @param text - Text from the app, e.g. a translated label or an item name
 */
export function toStateField(text: string): string {
  return text.replace(/[\t\r\n]+/g, ' ');
}
