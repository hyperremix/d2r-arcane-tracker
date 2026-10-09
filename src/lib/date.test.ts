import i18n from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatClockDuration,
  formatDate,
  formatDuration,
  formatLocalizedDate,
  formatLongDate,
  formatRelativeTime,
  formatSessionDateRelative,
  formatShortDate,
  formatTime,
  formatTimeAgo,
  formatTimestamp,
  isRecentFind,
} from './date';

describe('formatClockDuration', () => {
  it('If the duration is missing or negative, Then it shows zero time', () => {
    // Arrange & Act & Assert
    expect(formatClockDuration(undefined)).toBe('0:00');
    expect(formatClockDuration(-500)).toBe('0:00');
  });

  it('When the duration is under an hour, Then it shows minutes and zero-padded seconds', () => {
    // Arrange & Act & Assert
    expect(formatClockDuration(5_000)).toBe('0:05');
    expect(formatClockDuration(754_999)).toBe('12:34');
  });

  it('When the duration is an hour or longer, Then it shows hours with padded minutes and seconds', () => {
    // Arrange & Act & Assert
    expect(formatClockDuration(3_723_000)).toBe('1:02:03');
    expect(formatClockDuration(26 * 3_600_000)).toBe('26:00:00');
  });
});

describe('formatDuration', () => {
  it('should return "0s" for undefined input', () => {
    expect(formatDuration(undefined)).toBe('0s');
  });

  it('should return "0s" for null input', () => {
    expect(formatDuration(null as unknown as number)).toBe('0s');
  });

  it('should return "0s" for negative input', () => {
    expect(formatDuration(-100)).toBe('0s');
  });

  it('should format seconds correctly', () => {
    expect(formatDuration(5000)).toBe('5s');
  });

  it('should format minutes and seconds correctly', () => {
    expect(formatDuration(125000)).toBe('2m 5s');
  });

  it('should format hours, minutes, and seconds correctly', () => {
    expect(formatDuration(3665000)).toBe('1h 1m 5s');
  });

  it('should format hours and seconds correctly (no minutes)', () => {
    expect(formatDuration(3605000)).toBe('1h 5s');
  });

  it('When the duration is exactly 24 hours, then it shows total hours instead of wrapping to 0s', () => {
    // Arrange
    const durationMs = 24 * 60 * 60 * 1000;

    // Act
    const result = formatDuration(durationMs);

    // Assert
    expect(result).toBe('24h');
  });

  it('When the duration is longer than a day, then it keeps the days as part of the hours', () => {
    // Arrange
    const durationMs = (25 * 3600 + 2 * 60 + 3) * 1000;

    // Act
    const result = formatDuration(durationMs);

    // Assert
    expect(result).toBe('25h 2m 3s');
  });

  it('When the duration is longer than a month, then it still shows total hours', () => {
    // Arrange
    const durationMs = (31 * 24 + 1) * 60 * 60 * 1000;

    // Act
    const result = formatDuration(durationMs);

    // Assert
    expect(result).toBe('745h');
  });
});

describe('When formatTimeAgo is called', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('If there is no date, Then the translated "Never" is returned', () => {
    // Arrange & Act
    const result = formatTimeAgo(undefined, i18n.t);

    // Assert
    expect(result).toBe('Never');
  });

  it('If the date was an hour ago, Then the relative time is formatted in the locale', () => {
    // Arrange
    const date = new Date('2024-01-15T11:00:00Z');

    // Act
    const english = formatTimeAgo(date, i18n.t, 'en');
    const german = formatTimeAgo(date, i18n.t, 'de');

    // Assert
    expect(english).toBe('1 hour ago');
    expect(german).toBe('vor 1 Stunde');
  });
});

describe('When formatRelativeTime is called', () => {
  const now = new Date('2024-01-15T12:00:00Z').getTime();

  it.each([
    [new Date('2024-01-15T11:59:30Z'), '30 seconds ago'],
    [new Date('2024-01-15T11:55:00Z'), '5 minutes ago'],
    [new Date('2024-01-14T12:00:00Z'), 'yesterday'],
    [new Date('2024-01-10T12:00:00Z'), '5 days ago'],
    [new Date('2023-11-15T12:00:00Z'), '2 months ago'],
    [new Date('2022-01-15T12:00:00Z'), '2 years ago'],
    [new Date('2024-01-15T15:00:00Z'), 'in 3 hours'],
  ])('If the date is %s, Then the largest fitting unit is used: %s', (date, expected) => {
    // Arrange & Act
    const result = formatRelativeTime(date, 'en', now);

    // Assert
    expect(result).toBe(expected);
  });

  it('If the locale is invalid, Then the default locale is used instead of throwing', () => {
    // Arrange & Act
    const format = () => formatRelativeTime(new Date(now - 60_000), 'not a locale!', now);

    // Assert
    expect(format).not.toThrow();
  });
});

describe('When formatSessionDateRelative is called', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('If the session started today, Then the translated "Today" is returned', () => {
    // Arrange & Act
    const result = formatSessionDateRelative(new Date(2024, 0, 15, 8), i18n.t, 'en');

    // Assert
    expect(result).toBe('Today');
  });

  it('If the session started yesterday, Then the translated "Yesterday" is returned', () => {
    // Arrange & Act
    const result = formatSessionDateRelative(new Date(2024, 0, 14, 20), i18n.t, 'en');

    // Assert
    expect(result).toBe('Yesterday');
  });

  it('If the session started within the last week, Then the relative time is returned', () => {
    // Arrange & Act
    const result = formatSessionDateRelative(new Date(2024, 0, 12, 12), i18n.t, 'en');

    // Assert
    expect(result).toBe('3 days ago');
  });

  it('If the session is older than a week, Then the full localized date is returned', () => {
    // Arrange & Act
    const result = formatSessionDateRelative(new Date(2024, 0, 1, 12), i18n.t, 'en');

    // Assert
    expect(result).toBe('Monday, January 1, 2024');
  });
});

describe('formatDate', () => {
  it('should return "Never" for undefined input', () => {
    expect(formatDate(undefined)).toBe('Never');
  });

  it('should format date with default format', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const result = formatDate(date);
    expect(result).toContain('Jan');
    expect(result).toContain('2024');
  });

  it('should format date with custom format', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const result = formatDate(date, 'YYYY-MM-DD');
    expect(result).toBe('2024-01-15');
  });
});

describe('formatShortDate', () => {
  it('should return "Never" for undefined input', () => {
    expect(formatShortDate(undefined)).toBe('Never');
  });

  it('should format short date correctly', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const result = formatShortDate(date);
    expect(result).toBe('Jan 15, 2024');
  });
});

describe('formatLocalizedDate', () => {
  it('When the date is undefined, Then it returns a dash', () => {
    expect(formatLocalizedDate(undefined, 'en')).toBe('-');
  });

  it('When the date is invalid, Then it returns a dash', () => {
    expect(formatLocalizedDate('not a date', 'en')).toBe('-');
  });

  it('When a locale is given, Then the date is formatted for that locale', () => {
    // Arrange
    const date = new Date('2024-01-15T12:00:00Z');

    // Act
    const english = formatLocalizedDate(date, 'en', { dateStyle: 'medium', timeZone: 'UTC' });
    const german = formatLocalizedDate(date, 'de', { dateStyle: 'medium', timeZone: 'UTC' });

    // Assert
    expect(english).toBe('Jan 15, 2024');
    expect(german).toBe('15.01.2024');
  });

  it('If the locale is not a valid language tag, Then it falls back to the default locale', () => {
    // Arrange
    const date = new Date('2024-01-15T12:00:00Z');
    const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeZone: 'UTC' };

    // Act
    const result = formatLocalizedDate(date, 'not_a_locale!', options);

    // Assert
    expect(result).toBe(new Intl.DateTimeFormat(undefined, options).format(date));
  });
});

describe('formatLongDate', () => {
  it('should return "Never" for undefined input', () => {
    expect(formatLongDate(undefined)).toBe('Never');
  });

  it('should format long date correctly', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const result = formatLongDate(date);
    expect(result).toContain('Monday');
    expect(result).toContain('January');
    expect(result).toContain('2024');
  });
});

describe('formatTime', () => {
  it('should return "-" for undefined input', () => {
    expect(formatTime(undefined)).toBe('-');
  });

  it('should format time correctly', () => {
    const date = new Date('2024-01-15T14:30:00Z');
    const result = formatTime(date);
    // Result depends on timezone, but should contain time format
    expect(result).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
  });
});

describe('formatTimestamp', () => {
  it('should return "-" for undefined input', () => {
    expect(formatTimestamp(undefined)).toBe('-');
  });

  it('should format timestamp correctly', () => {
    const date = new Date('2024-01-15T14:30:45Z');
    const result = formatTimestamp(date);
    // Result depends on timezone, but should contain time format with seconds
    expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}\s(AM|PM)/);
  });
});

describe('isRecentFind', () => {
  beforeEach(() => {
    // Mock dayjs to return a fixed time
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return false for undefined input', () => {
    expect(isRecentFind(undefined)).toBe(false);
  });

  it('should return true for date within default threshold (7 days)', () => {
    const foundDate = new Date('2024-01-10T12:00:00Z'); // 5 days ago
    expect(isRecentFind(foundDate)).toBe(true);
  });

  it('should return false for date exactly at default threshold (7 days)', () => {
    const foundDate = new Date('2024-01-08T12:00:00Z'); // Exactly 7 days ago
    expect(isRecentFind(foundDate)).toBe(false);
  });

  it('should return false for date beyond default threshold (7 days)', () => {
    const foundDate = new Date('2024-01-07T12:00:00Z'); // 8 days ago
    expect(isRecentFind(foundDate)).toBe(false);
  });

  it('should return true for date in the future', () => {
    const foundDate = new Date('2024-01-20T12:00:00Z'); // 5 days in the future
    expect(isRecentFind(foundDate)).toBe(true);
  });

  it('should use custom threshold when provided', () => {
    const foundDate = new Date('2024-01-05T12:00:00Z'); // 10 days ago
    expect(isRecentFind(foundDate, 15)).toBe(true);
  });

  it('should return false when date is beyond custom threshold', () => {
    const foundDate = new Date('2024-01-10T12:00:00Z'); // 5 days ago
    expect(isRecentFind(foundDate, 3)).toBe(false);
  });

  it('should return false for zero threshold', () => {
    const foundDate = new Date('2024-01-15T11:59:59Z'); // 1 second ago
    expect(isRecentFind(foundDate, 0)).toBe(false);
  });

  it('should return false for negative threshold', () => {
    const foundDate = new Date('2024-01-15T11:59:59Z'); // 1 second ago
    expect(isRecentFind(foundDate, -1)).toBe(false);
  });

  it('should return false for date exactly at custom threshold', () => {
    const foundDate = new Date('2024-01-10T12:00:00Z'); // 5 days ago
    expect(isRecentFind(foundDate, 5)).toBe(false);
  });

  it('should return true for very recent date (within 1 day)', () => {
    const foundDate = new Date('2024-01-14T12:00:00Z'); // 1 day ago
    expect(isRecentFind(foundDate)).toBe(true);
  });

  it('should return false for very old date (months ago)', () => {
    const foundDate = new Date('2023-01-15T12:00:00Z'); // 1 year ago
    expect(isRecentFind(foundDate)).toBe(false);
  });

  it('should return true for date at exact current time', () => {
    const foundDate = new Date('2024-01-15T12:00:00Z'); // Exact current time
    expect(isRecentFind(foundDate)).toBe(true);
  });
});
