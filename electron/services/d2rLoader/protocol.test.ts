import { describe, expect, it } from 'vitest';
import { IpcValidationError } from '../../ipc/validation';
import {
  MAX_EVENTS_PER_REQUEST,
  parseEventsRequest,
  parseHelloRequest,
  toStateField,
} from './protocol';

describe('When parseHelloRequest parses a hello', () => {
  it('Then it keeps the protocol and plugin version', () => {
    // Arrange
    const body = { protocol: 1, pluginVersion: '1.0.0', extra: true };

    // Act
    const hello = parseHelloRequest(body);

    // Assert
    expect(hello).toEqual({ protocol: 1, pluginVersion: '1.0.0' });
  });

  it.each([
    ['no object', 'hello'],
    ['a fractional protocol', { protocol: 1.5, pluginVersion: '1.0.0' }],
    ['an empty version', { protocol: 1, pluginVersion: '' }],
    ['a version with a line break', { protocol: 1, pluginVersion: '1.0\n' }],
    ['a version that is too long', { protocol: 1, pluginVersion: '1'.repeat(64) }],
  ])('If it gets %s, then it throws', (_, body) => {
    // Act
    const parse = () => parseHelloRequest(body);

    // Assert
    expect(parse).toThrow(IpcValidationError);
  });
});

describe('When parseEventsRequest parses events', () => {
  it('Then it returns every documented event with only its documented fields', () => {
    // Arrange
    const body = {
      events: [
        { type: 'game-joined', extra: 1 },
        { type: 'level-changed', levelId: 8, previousLevelId: -1 },
        {
          type: 'item-picked-up',
          item: { kind: 'unique', recordId: 123, code: 'UAP', ethereal: false },
        },
        {
          type: 'item-picked-up',
          item: { kind: 'rune', recordId: -1, code: 'r08', ethereal: false },
        },
        { type: 'command', action: 'toggle-session' },
        { type: 'game-left' },
      ],
    };

    // Act
    const events = parseEventsRequest(body);

    // Assert
    expect(events).toEqual([
      { type: 'game-joined' },
      { type: 'level-changed', levelId: 8, previousLevelId: -1 },
      {
        type: 'item-picked-up',
        item: { kind: 'unique', recordId: 123, code: 'uap', ethereal: false },
      },
      {
        type: 'item-picked-up',
        item: { kind: 'rune', recordId: -1, code: 'r08', ethereal: false },
      },
      { type: 'command', action: 'toggle-session' },
      { type: 'game-left' },
    ]);
  });

  it.each([
    ['an unknown event type', { type: 'item-dropped' }],
    ['a negative level', { type: 'level-changed', levelId: -1, previousLevelId: -1 }],
    [
      'a runeword',
      {
        type: 'item-picked-up',
        item: { kind: 'runeword', recordId: 1, code: 'x', ethereal: false },
      },
    ],
    [
      'a unique without row',
      {
        type: 'item-picked-up',
        item: { kind: 'unique', recordId: -1, code: 'uap', ethereal: false },
      },
    ],
    [
      'a rune with a row',
      { type: 'item-picked-up', item: { kind: 'rune', recordId: 3, code: 'r08', ethereal: false } },
    ],
    [
      'an item code with a tab',
      { type: 'item-picked-up', item: { kind: 'set', recordId: 1, code: 'a\tb', ethereal: false } },
    ],
    [
      'a string ethereal flag',
      { type: 'item-picked-up', item: { kind: 'set', recordId: 1, code: 'xsk', ethereal: 'no' } },
    ],
    ['an unknown command', { type: 'command', action: 'quit-game' }],
  ])('If an event is %s, then it throws', (_, event) => {
    // Act
    const parse = () => parseEventsRequest({ events: [event] });

    // Assert
    expect(parse).toThrow(IpcValidationError);
  });

  it(`If there are more than ${MAX_EVENTS_PER_REQUEST} events, then it throws`, () => {
    // Arrange
    const events = Array.from({ length: MAX_EVENTS_PER_REQUEST + 1 }, () => ({
      type: 'game-left',
    }));

    // Act
    const parse = () => parseEventsRequest({ events });

    // Assert
    expect(parse).toThrow(IpcValidationError);
  });
});

describe('When toStateField prepares a text for the state response', () => {
  it('Then tabs and line breaks become spaces', () => {
    // Act
    const field = toStateField('Run 1\tof\r\n2');

    // Assert
    expect(field).toBe('Run 1 of 2');
  });
});
