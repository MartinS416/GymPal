import { describe, expect, it } from '@jest/globals';

import {
  elapsedSeconds,
  formatDuration,
  formatRestCountdown,
  formatRestDuration,
  formatRestTime,
  formatSessionDate,
  formatTimeOfDay,
  isResting,
  restRemainingMs,
} from '@/workouts/timer';

describe('timing', () => {
  it('measures the elapsed time from timestamps', () => {
    const start = 1_000_000;
    expect(elapsedSeconds(start, start)).toBe(0);
    expect(elapsedSeconds(start + 5_000, start)).toBe(5);
    expect(elapsedSeconds(start + 90_000, start)).toBe(90);
    // A clock that jumped backwards never goes negative.
    expect(elapsedSeconds(start - 5_000, start)).toBe(0);
  });

  it('keeps counting while the app is in the background', () => {
    // The rest timer is a moment in time, so a gap of any length is counted.
    const end = 10_000;
    expect(restRemainingMs(4_000, end)).toBe(6_000);
    expect(restRemainingMs(4_000, end)).toBe(6_000);
    // Time that has passed is never negative.
    expect(restRemainingMs(12_000, end)).toBe(0);
  });

  it('knows when the rest is over', () => {
    expect(isResting(1_000, 2_000)).toBe(true);
    expect(isResting(3_000, 2_000)).toBe(false);
    expect(isResting(1_000, null)).toBe(false);
  });

  it('formats the elapsed time like a stopwatch', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3_599)).toBe('59:59');
    expect(formatDuration(3_600)).toBe('1:00:00');
    expect(formatDuration(3_725)).toBe('1:02:05');
  });

  it('formats a rest countdown with seconds', () => {
    expect(formatRestTime(0)).toBe('0:00');
    expect(formatRestTime(1_000)).toBe('0:01');
    expect(formatRestTime(65_000)).toBe('1:05');
    expect(formatRestTime(150_000)).toBe('2:30');
  });

  it('lets the rest countdown run past zero', () => {
    expect(formatRestCountdown(65_000)).toBe('1:05');
    expect(formatRestCountdown(0)).toBe('0:00');
    // The rest is not cut short: the countdown keeps going.
    expect(formatRestCountdown(-5_000)).toBe('-0:05');
    expect(formatRestCountdown(-65_000)).toBe('-1:05');
  });

  it('formats a rest duration for the plan', () => {
    expect(formatRestDuration(0)).toBe('0:00');
    expect(formatRestDuration(90)).toBe('1:30');
    expect(formatRestDuration(150)).toBe('2:30');
  });

  it('formats the date and the time of a session', () => {
    // 2024-05-14T18:24:00 local time.
    const timestamp = new Date(2024, 4, 14, 18, 24).getTime();
    expect(formatSessionDate(timestamp)).toBe('Tue 14 May');
    expect(formatTimeOfDay(timestamp)).toBe('18:24');
  });
});
