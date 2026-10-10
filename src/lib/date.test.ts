import i18n from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatClockDuration,
  formatDate,
  formatDuration,
  formatLocalizedDate,
  formatRelativeTime,
  formatSessionDate,
  formatSessionDateRelative,
  formatShortDate,
  formatTime,
  formatTimeAgo,
  formatTimestamp,
  isRecentFind,
  parseLocalIsoDate,
  toLocalIsoDate,
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
  it('If there is no date, Then the translated "Never" is returned', () => {
    expect(formatDate(undefined)).toBe(i18n.t('common.never'));
  });

  it('If no locale is given, Then the date and time are formatted in the active UI language', () => {
    // Arrange
    const date = new Date(2024, 0, 15, 14, 30);

    // Act
    const result = formatDate(date);

    // Assert
    expect(result).toBe(
      new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
        date,
      ),
    );
    expect(result).toContain('Jan 15, 2024');
  });

  it('If a locale is given, Then the date and time are formatted for that locale', () => {
    // Arrange
    const date = new Date(2024, 0, 15, 14, 30);

    // Act
    const result = formatDate(date, 'de');

    // Assert
    expect(result).toBe('15.01.2024, 14:30');
  });
});

describe('formatShortDate', () => {
  it('If there is no date, Then the translated "Never" is returned', () => {
    expect(formatShortDate(undefined)).toBe(i18n.t('common.never'));
  });

  it('If a date is given, Then the short date is formatted in the active UI language', () => {
    const date = new Date(2024, 0, 15, 12);
    const result = formatShortDate(date);
    expect(result).toBe('Jan 15, 2024');
  });

  it('If a locale is given, Then the short date is formatted for that locale', () => {
    expect(formatShortDate(new Date(2024, 0, 15, 12), 'de')).toBe('15.01.2024');
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

describe('formatSessionDate', () => {
  it('If there is no date, Then the translated "Never" is returned', () => {
    expect(formatSessionDate(undefined)).toBe(i18n.t('common.never'));
  });

  it('If a date is given, Then the full date is formatted in the active UI language', () => {
    const result = formatSessionDate(new Date(2024, 0, 15, 12));
    expect(result).toBe('Monday, January 15, 2024');
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

  it('If a locale is given, Then the time is formatted for that locale', () => {
    expect(formatTime(new Date(2024, 0, 15, 14, 30), 'de')).toBe('14:30');
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

  it('If a locale is given, Then the timestamp is formatted for that locale', () => {
    expect(formatTimestamp(new Date(2024, 0, 15, 14, 30, 45), 'de')).toBe('14:30:45');
  });
});

describe('When isRecentFind function is called', () => {
  beforeEach(() => {
    // Fix the current time
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('If foundDate is undefined', () => {
    it('Then should return false', () => {
      // Arrange
      const foundDate = undefined;

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is null', () => {
    it('Then should return false', () => {
      // Arrange
      const foundDate = null as unknown as Date;

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is within default threshold (7 days)', () => {
    it('Then should return true', () => {
      // Arrange
      const foundDate = new Date('2024-01-10T12:00:00Z'); // 5 days ago

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If foundDate is exactly at default threshold (7 days)', () => {
    it('Then should return false', () => {
      // Arrange
      const foundDate = new Date('2024-01-08T12:00:00Z'); // Exactly 7 days ago

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is beyond default threshold (7 days)', () => {
    it('Then should return false', () => {
      // Arrange
      const foundDate = new Date('2024-01-07T12:00:00Z'); // 8 days ago

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is in the future', () => {
    it('Then should return true', () => {
      // Arrange
      const foundDate = new Date('2024-01-20T12:00:00Z'); // 5 days in the future

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If custom threshold is provided', () => {
    it('Then should use custom threshold instead of default', () => {
      // Arrange
      const foundDate = new Date('2024-01-05T12:00:00Z'); // 10 days ago
      const customThreshold = 15; // 15 days

      // Act
      const result = isRecentFind(foundDate, customThreshold);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If custom threshold is smaller than default', () => {
    it('Then should use custom threshold', () => {
      // Arrange
      const foundDate = new Date('2024-01-10T12:00:00Z'); // 5 days ago
      const customThreshold = 3; // 3 days

      // Act
      const result = isRecentFind(foundDate, customThreshold);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If custom threshold is zero', () => {
    it('Then should return false for any past date', () => {
      // Arrange
      const foundDate = new Date('2024-01-15T11:59:59Z'); // 1 second ago
      const customThreshold = 0;

      // Act
      const result = isRecentFind(foundDate, customThreshold);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If custom threshold is negative', () => {
    it('Then should return false for any past date', () => {
      // Arrange
      const foundDate = new Date('2024-01-15T11:59:59Z'); // 1 second ago
      const customThreshold = -1;

      // Act
      const result = isRecentFind(foundDate, customThreshold);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is exactly at custom threshold', () => {
    it('Then should return false', () => {
      // Arrange
      const foundDate = new Date('2024-01-10T12:00:00Z'); // 5 days ago
      const customThreshold = 5;

      // Act
      const result = isRecentFind(foundDate, customThreshold);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is just beyond custom threshold', () => {
    it('Then should return false', () => {
      // Arrange
      const foundDate = new Date('2024-01-09T12:00:00Z'); // 6 days ago
      const customThreshold = 5;

      // Act
      const result = isRecentFind(foundDate, customThreshold);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is very recent (within 1 day)', () => {
    it('Then should return true', () => {
      // Arrange
      const foundDate = new Date('2024-01-14T12:00:00Z'); // 1 day ago

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If foundDate is very old (months ago)', () => {
    it('Then should return false', () => {
      // Arrange
      const foundDate = new Date('2023-01-15T12:00:00Z'); // 1 year ago

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is at the exact current time', () => {
    it('Then should return true', () => {
      // Arrange
      const foundDate = new Date('2024-01-15T12:00:00Z'); // Exact current time

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(true);
    });
  });
});

describe('When local ISO dates are formatted and parsed', () => {
  it('If a date is formatted, Then its local calendar day is returned as YYYY-MM-DD', () => {
    expect(toLocalIsoDate(new Date(2024, 0, 5, 23, 59))).toBe('2024-01-05');
  });

  it('If a YYYY-MM-DD value is parsed, Then local midnight of that day is returned', () => {
    // Arrange & Act
    const result = parseLocalIsoDate('2024-06-15');

    // Assert
    expect(result).toEqual(new Date(2024, 5, 15));
    expect(toLocalIsoDate(result)).toBe('2024-06-15');
  });

  it('If the value is malformed, Then an invalid date is returned', () => {
    expect(Number.isNaN(parseLocalIsoDate('not a date').getTime())).toBe(true);
  });
});

describe('When day counts cross a daylight-saving transition', () => {
  // America/New_York in 2024: clocks jump forward on Mar 10 at 07:00 UTC and back on Nov 3 at 06:00 UTC.
  // The runner's own time zone is not switchable inside a vitest worker, so the zone's UTC offset is
  // simulated on top of absolute instants, which keeps these tests independent of the machine's zone.
  const SPRING_FORWARD_UTC = Date.UTC(2024, 2, 10, 7);
  const FALL_BACK_UTC = Date.UTC(2024, 10, 3, 6);

  // Captured before fake timers replace the global Date, so dates created in any phase share it.
  const nativeDatePrototype = Date.prototype;

  function simulateNewYorkOffset() {
    return vi.spyOn(nativeDatePrototype, 'getTimezoneOffset').mockImplementation(function (
      this: Date,
    ) {
      const time = this.getTime();
      const isDaylightTime = time >= SPRING_FORWARD_UTC && time < FALL_BACK_UTC;
      return isDaylightTime ? 240 : 300;
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    simulateNewYorkOffset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // Local noon, 7 calendar days apart, but only 167 hours of elapsed time (the day in between is 23h long).
  const foundBeforeSpringForward = new Date(Date.UTC(2024, 2, 5, 17)); // Mar 5 12:00 EST
  const nowAfterSpringForward = new Date(Date.UTC(2024, 2, 12, 16)); // Mar 12 12:00 EDT

  // Local 13:00 to local 12:00 a week later: 168 hours of elapsed time, but only 6 calendar days and 23 hours.
  const foundBeforeFallBack = new Date(Date.UTC(2024, 9, 29, 17)); // Oct 29 13:00 EDT
  const nowAfterFallBack = new Date(Date.UTC(2024, 10, 5, 17)); // Nov 5 12:00 EST

  it('If a find is 7 calendar days old across spring-forward, Then it is not recent (167 elapsed hours)', () => {
    // Arrange
    vi.setSystemTime(nowAfterSpringForward);

    // Act
    const result = isRecentFind(foundBeforeSpringForward);

    // Assert
    expect(result).toBe(false);
  });

  it('If a find is 6 calendar days old across spring-forward, Then it is still recent', () => {
    // Arrange
    vi.setSystemTime(nowAfterSpringForward);
    const found = new Date(Date.UTC(2024, 2, 6, 17)); // Mar 6 12:00 EST

    // Act
    const result = isRecentFind(found);

    // Assert
    expect(result).toBe(true);
  });

  it('If a find is under 7 calendar days old across fall-back (168 elapsed hours), Then it is recent', () => {
    // Arrange
    vi.setSystemTime(nowAfterFallBack);

    // Act
    const result = isRecentFind(foundBeforeFallBack);

    // Assert
    expect(result).toBe(true);
  });

  it('If a find is 7 calendar days old across fall-back, Then it is not recent', () => {
    // Arrange
    vi.setSystemTime(nowAfterFallBack);
    const found = new Date(Date.UTC(2024, 9, 29, 16)); // Oct 29 12:00 EDT

    // Act
    const result = isRecentFind(found);

    // Assert
    expect(result).toBe(false);
  });

  it('If a session is 7 calendar days old across spring-forward, Then the full date is shown instead of a relative time', () => {
    // Arrange
    vi.setSystemTime(nowAfterSpringForward);

    // Act
    const result = formatSessionDateRelative(foundBeforeSpringForward, i18n.t, 'en');

    // Assert
    expect(result).toBe(formatLocalizedDate(foundBeforeSpringForward, 'en', { dateStyle: 'full' }));
  });

  it('If a session is under 7 calendar days old across fall-back, Then a relative time is shown', () => {
    // Arrange
    vi.setSystemTime(nowAfterFallBack);

    // Act
    const result = formatSessionDateRelative(foundBeforeFallBack, i18n.t, 'en');

    // Assert
    expect(result).toBe(formatTimeAgo(foundBeforeFallBack, i18n.t, 'en'));
  });
});

describe('When a date-only (YYYY-MM-DD) string is formatted or compared', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('If it is formatted, Then it is read as local midnight rather than UTC midnight', () => {
    // Arrange
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    };

    // Act
    const result = formatLocalizedDate('2024-01-15', 'en', options);

    // Assert
    expect(result).toBe('00:00');
  });

  it('If it is today, Then the session is shown as "Today"', () => {
    // Arrange & Act
    const result = formatSessionDateRelative('2024-01-15', i18n.t, 'en');

    // Assert
    expect(result).toBe('Today');
  });

  it('If it is 7 days ago, Then the find is not recent', () => {
    expect(isRecentFind('2024-01-08')).toBe(false);
  });

  it('If it is 6 days ago, Then the find is recent', () => {
    expect(isRecentFind('2024-01-09')).toBe(true);
  });

  it('If it is a full timestamp, Then it is still parsed as an instant', () => {
    expect(formatLocalizedDate('2024-01-15T00:00:00Z', 'en', { timeStyle: 'short' })).toBe(
      formatLocalizedDate(new Date('2024-01-15T00:00:00Z'), 'en', { timeStyle: 'short' }),
    );
  });
});
