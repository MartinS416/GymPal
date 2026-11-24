/**
 * Timing.
 *
 * Everything is derived from timestamps, never from a running counter. A
 * counter stops when the app is backgrounded, a timestamp does not.
 */

/** Seconds between the start of the session and now. */
export function elapsedSeconds(now: number, startedAt: number): number {
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** Milliseconds left on the rest timer, never negative. */
export function restRemainingMs(now: number, restEndsAt: number | null): number {
  if (restEndsAt === null) {
    return 0;
  }
  return Math.max(0, restEndsAt - now);
}

/** True while the rest timer is still running. */
export function isResting(now: number, restEndsAt: number | null): boolean {
  return restEndsAt !== null && restEndsAt > now;
}

/**
 * Formats a duration as a clock.
 *
 * `h:mm:ss` when there is an hour, `m:ss` when there is not — the same shape
 * a stopwatch uses, so it is easy to read at a glance.
 */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/** Formats a rest countdown, which always shows minutes and seconds. */
export function formatRestTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Formats a rest countdown that is allowed to run past zero.
 *
 * The rest is not cut short: the countdown keeps going and shows how far over
 * it is, so the user can decide when to move on.
 */
export function formatRestCountdown(milliseconds: number): string {
  const negative = milliseconds < 0;
  const totalSeconds = Math.ceil(Math.abs(milliseconds) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${negative ? '-' : ''}${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Formats a rest duration for the plan, as `1:30` or `2:00`. */
export function formatRestDuration(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const remainder = Math.max(0, seconds) % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/** A short, readable date, e.g. "Tue 14 May". */
export function formatSessionDate(timestamp: number): string {
  const date = new Date(timestamp);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  const month = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][date.getMonth()];
  return `${weekday} ${date.getDate()} ${month}`;
}

/** A short time of day, e.g. "18:24". */
export function formatTimeOfDay(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
