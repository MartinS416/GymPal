import { render } from '@testing-library/react-native';
import { describe, expect, it } from '@jest/globals';

import { addMonths, daysInMonth } from '@/lib/calendar';
import {
  MonthlyActivity,
  trainedDaysInMonth,
  DOT_ACTIVE,
  DOT_INACTIVE,
} from '@/components/widgets/monthly-activity';

type DotStyle = { backgroundColor?: string };

function backgroundOf(style: unknown): string | undefined {
  const list = Array.isArray(style) ? (style as unknown[]) : [style];
  let last: string | undefined;
  for (const entry of list) {
    if (entry && typeof entry === 'object') {
      const candidate = entry as DotStyle;
      if (candidate.backgroundColor !== undefined) {
        last = candidate.backgroundColor;
      }
    }
  }
  return last;
}

function dayStart(monthStart: number, day: number): number {
  const date = new Date(monthStart);
  date.setDate(day);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function dotTestId(monthStart: number, day: number): string {
  return `monthly-activity-dot-${monthStart}-${day}`;
}

function lastThreeMonthStarts(now: number): number[] {
  return [0, 1, 2].map((offset) => addMonths(now, -offset));
}

describe('the monthly activity tracker', () => {
  it('reads the trained days of a single month', () => {
    const monthStart = new Date(2026, 8, 1).getTime();
    const trainedDays = new Set<number>([dayStart(monthStart, 2), dayStart(monthStart, 17)]);

    expect(trainedDaysInMonth(trainedDays, monthStart)).toEqual(new Set([2, 17]));

    const otherMonth = new Date(2026, 7, 1).getTime();
    expect(trainedDaysInMonth(trainedDays, otherMonth)).toEqual(new Set<number>());
  });

  it('lights a trained day and dims the rest of the month', async () => {
    const now = Date.now();
    const monthStarts = lastThreeMonthStarts(now);
    const trainedDays = new Set<number>([dayStart(monthStarts[0], 2)]);

    const { getByTestId } = await render(
      <MonthlyActivity trainedDays={trainedDays} now={now} months={3} />
    );

    const trainedDot = getByTestId(dotTestId(monthStarts[0], 2));
    expect(backgroundOf(trainedDot.props.style)).toBe(DOT_ACTIVE);

    const untrainedDot = getByTestId(dotTestId(monthStarts[0], 3));
    expect(backgroundOf(untrainedDot.props.style)).toBe(DOT_INACTIVE);
  });

  it('renders a dot for every day of each of the last three months', async () => {
    const now = Date.now();
    const monthStarts = lastThreeMonthStarts(now);
    const { getByTestId } = await render(
      <MonthlyActivity trainedDays={new Set<number>()} now={now} months={3} />
    );

    for (const monthStart of monthStarts) {
      expect(getByTestId(dotTestId(monthStart, daysInMonth(monthStart)))).toBeTruthy();
    }
  });
});
