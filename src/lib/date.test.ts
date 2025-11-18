import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatDate,
  formatDuration,
  formatLongDate,
  formatShortDate,
  formatTime,
  formatTimeAgo,
  formatTimestamp,
  isRecentFind,
} from './date';

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
});

describe('formatTimeAgo', () => {
  beforeEach(() => {
    // Mock dayjs to return a fixed time
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "Never" for undefined input', () => {
    expect(formatTimeAgo(undefined)).toBe('Never');
  });

  it('should format relative time correctly', () => {
    const date = new Date('2024-01-15T11:00:00Z'); // 1 hour ago
    const result = formatTimeAgo(date);
    expect(result).toContain('hour');
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
