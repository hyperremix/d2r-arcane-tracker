import { describe, expect, it } from 'vitest';
import { formatCountdown } from './formatCountdown';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

describe('When a terror zone countdown is formatted', () => {
  it('If less than a minute is left, Then the seconds are shown', () => {
    // Arrange
    const durationMs = 45 * SECOND_MS + 600;

    // Act
    const text = formatCountdown(durationMs, 'en');

    // Assert
    expect(text).toBe('45 sec');
  });

  it('If less than an hour is left, Then the whole minutes are shown', () => {
    // Arrange
    const durationMs = 12 * MINUTE_MS + 30 * SECOND_MS;

    // Act
    const text = formatCountdown(durationMs, 'en');

    // Assert
    expect(text).toBe('12 min');
  });

  it('If more than an hour is left, Then hours and minutes are shown', () => {
    // Arrange
    const durationMs = 80 * MINUTE_MS + 59 * SECOND_MS;

    // Act
    const text = formatCountdown(durationMs, 'en');

    // Assert
    expect(text).toBe('1 hr 20 min');
  });

  it('If a whole number of hours is left, Then only the hours are shown', () => {
    // Arrange
    const durationMs = 120 * MINUTE_MS;

    // Act
    const text = formatCountdown(durationMs, 'en');

    // Assert
    expect(text).toBe('2 hr');
  });

  it('If the time has passed, Then zero seconds are shown', () => {
    // Arrange
    const durationMs = -5 * SECOND_MS;

    // Act
    const text = formatCountdown(durationMs, 'en');

    // Assert
    expect(text).toBe('0 sec');
  });

  it('If the locale is invalid, Then the default locale is used', () => {
    // Arrange
    const durationMs = 3 * MINUTE_MS;

    // Act
    const text = formatCountdown(durationMs, 'not a locale!');

    // Assert
    expect(text).toMatch(/3/);
  });
});
