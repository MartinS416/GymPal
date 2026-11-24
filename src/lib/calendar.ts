/**
 * Calendar helpers.
 *
 * Everything here works in the device's local time, because "the 12th" means
 * the 12th where the user was standing, not in UTC.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTHS_SHORT = MONTHS.map((month) => month.slice(0, 3));

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Midnight at the start of the day the timestamp falls in. */
export function startOfDay(at: number): number {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Midnight on the first day of the month the timestamp falls in. */
export function startOfMonth(at: number): number {
  const date = new Date(at);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Moves a month start by a number of months, staying on the first day. */
export function addMonths(at: number, months: number): number {
  const date = new Date(startOfMonth(at));
  date.setMonth(date.getMonth() + months);
  return date.getTime();
}

/** Adds days across month and daylight-saving boundaries. */
export function addDays(at: number, days: number): number {
  const date = new Date(at);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** Days in the month that contains `at`. */
export function daysInMonth(at: number): number {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * The cells of a month, Monday first.
 *
 * Leading and trailing cells are `null` so the grid keeps its weekday
 * alignment. Weeks start on Monday, the way most of the world writes a date.
 */
export function monthGrid(at: number): (number | null)[] {
  const monthStart = startOfMonth(at);
  const total = daysInMonth(at);
  const firstWeekday = (new Date(monthStart).getDay() + 6) % 7;

  const cells: (number | null)[] = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= total; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

/** The timestamp of a day in a month. */
export function dayOfMonth(monthAt: number, day: number): number {
  const date = new Date(startOfMonth(monthAt));
  date.setDate(day);
  return date.getTime();
}

/** "October 2026" */
export function formatMonth(at: number): string {
  const date = new Date(at);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "12 Oct" */
export function formatShortDate(at: number): string {
  const date = new Date(at);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "Mon, 12 Oct" */
export function formatLongDate(at: number): string {
  const date = new Date(at);
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "Mon, 12 Oct 2026", for entries from another year. */
export function formatFullDate(at: number): string {
  const date = new Date(at);
  return `${formatLongDate(at)} ${date.getFullYear()}`;
}

/** "Today", "Yesterday", "4 days ago", then a date. */
export function formatRelativeDate(at: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY_MS);

  if (days === 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Yesterday';
  }
  if (days > 1 && days < 7) {
    return `${days} days ago`;
  }
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  return sameYear ? formatShortDate(at) : formatFullDate(at);
}

/** Weekday initials, Monday first, for the top of a calendar. */
export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
