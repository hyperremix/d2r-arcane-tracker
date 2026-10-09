import { describe, expect, it } from 'vitest';
import {
  formatServiceErrorDetails,
  getServiceErrorAction,
  getServiceErrorCopy,
  getServiceErrorToastId,
  parseServiceErrorPayload,
} from './serviceErrors';

const validPayload = {
  service: 'IconService',
  operation: 'convertAllSprites',
  severity: 'error',
  code: 'spriteConversionFailed',
  detail: 'Unexpected end of buffer',
  timestamp: 1_700_000_000_000,
};

describe('When parseServiceErrorPayload is called', () => {
  it('If the payload is valid, Then returns it unchanged', () => {
    // Act
    const result = parseServiceErrorPayload(validPayload);

    // Assert
    expect(result).toEqual(validPayload);
  });

  it('If params contain non-primitive values, Then drops them', () => {
    // Arrange
    const payload = { ...validPayload, params: { fileName: { x: 1 } } };

    // Act
    const result = parseServiceErrorPayload(payload);

    // Assert
    expect(result).not.toHaveProperty('params');
  });

  it('If params contain names the copy does not use, Then drops them', () => {
    // Arrange
    const payload = {
      ...validPayload,
      params: { fileName: 'a.d2s', count: 2, context: 'x', defaultValue: 'y', lng: 'sv' },
    };

    // Act
    const result = parseServiceErrorPayload(payload);

    // Assert
    expect(result?.params).toEqual({ fileName: 'a.d2s' });
  });

  it('If text fields are very long, Then truncates them', () => {
    // Arrange
    const long = 'x'.repeat(10_000);
    const payload = {
      ...validPayload,
      service: long,
      operation: long,
      code: long,
      detail: long,
      params: { fileName: long },
    };

    // Act
    const result = parseServiceErrorPayload(payload);

    // Assert
    expect(result?.service).toHaveLength(100);
    expect(result?.operation).toHaveLength(100);
    expect(result?.code).toHaveLength(100);
    expect(result?.detail).toHaveLength(4000);
    expect(String(result?.params?.fileName)).toHaveLength(512);
  });

  it('If detail and params are not usable, Then omits them', () => {
    // Arrange
    const payload = { ...validPayload, params: 'nope', detail: 42 };

    // Act
    const result = parseServiceErrorPayload(payload);

    // Assert
    expect(result).not.toHaveProperty('params');
    expect(result).not.toHaveProperty('detail');
  });

  it.each([
    ['null', null],
    ['an array', [validPayload]],
    ['a missing code', { ...validPayload, code: undefined }],
    ['an empty service', { ...validPayload, service: ' ' }],
    ['an unknown severity', { ...validPayload, severity: 'fatal' }],
    ['a warn severity', { ...validPayload, severity: 'warn' }],
    ['a non-numeric timestamp', { ...validPayload, timestamp: 'now' }],
  ])('If the payload has %s, Then returns undefined', (_label, payload) => {
    // Act
    const result = parseServiceErrorPayload(payload);

    // Assert
    expect(result).toBeUndefined();
  });
});

describe('When resolving copy and actions for a code', () => {
  it('If the code is known, Then returns its translation keys and action', () => {
    // Act
    const copy = getServiceErrorCopy('databaseWriteFailed');
    const action = getServiceErrorAction('databaseWriteFailed');

    // Assert
    expect(copy).toEqual({
      titleKey: 'serviceErrors.databaseWriteFailed.title',
      descriptionKey: 'serviceErrors.databaseWriteFailed.description',
    });
    expect(action).toBe('copyDetails');
  });

  it('If the code points to a settings problem, Then offers to open the settings', () => {
    // Act & Assert
    expect(getServiceErrorAction('spriteConversionFailed')).toBe('openSettings');
  });

  it('If the code is unknown, Then falls back to generic copy and copying details', () => {
    // Act
    const copy = getServiceErrorCopy('brandNewCode');
    const action = getServiceErrorAction('brandNewCode');

    // Assert
    expect(copy.titleKey).toBe('serviceErrors.unknown.title');
    expect(action).toBe('copyDetails');
  });
});

describe('When building toast id and details', () => {
  it('If a payload is given, Then the toast id combines service and operation', () => {
    // Arrange
    const payload = parseServiceErrorPayload(validPayload);

    // Act
    const id = payload && getServiceErrorToastId(payload);

    // Assert
    expect(id).toBe('IconService.convertAllSprites');
  });

  it('If a payload has params and detail, Then the details include them', () => {
    // Arrange
    const payload = parseServiceErrorPayload({ ...validPayload, params: { fileName: 'a.d2s' } });

    // Act
    const details = payload && formatServiceErrorDetails(payload);

    // Assert
    expect(details).toBe(
      [
        '[IconService.convertAllSprites] spriteConversionFailed (error)',
        'Time: 2023-11-14T22:13:20.000Z',
        'Params: {"fileName":"a.d2s"}',
        'Detail: Unexpected end of buffer',
      ].join('\n'),
    );
  });

  it('If the timestamp is out of the date range, Then the raw value is used', () => {
    // Arrange
    const payload = parseServiceErrorPayload({ ...validPayload, timestamp: 1e20 });

    // Act
    const details = payload && formatServiceErrorDetails(payload);

    // Assert
    expect(details).toContain('Time: 100000000000000000000');
  });
});
