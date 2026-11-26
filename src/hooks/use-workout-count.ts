import { useCallback, useState } from 'react';

import { useDatabase } from '@/db/database-provider';
import { useAsyncData } from '@/hooks/use-async-data';

export type WorkoutCountPeriod = 'week' | 'month' | 'year' | 'lifetime';

const PERIOD_LABELS: Record<WorkoutCountPeriod, string> = {
  week: 'this week',
  month: 'this month',
  year: 'this year',
  lifetime: 'lifetime',
};

const PERIOD_ORDER: WorkoutCountPeriod[] = ['week', 'month', 'year', 'lifetime'];

/** Midnight at the start of the period that contains `now`. */
export function startOfPeriod(period: WorkoutCountPeriod, now: number): number {
  if (period === 'lifetime') {
    return 0;
  }
  const date = new Date(now);
  if (period === 'week') {
    const mondayOffset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - mondayOffset);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }
  if (period === 'month') {
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }
  date.setMonth(0, 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Counts completed workouts for the selected period. Tapping cycles the
 * period through week -> month -> year -> lifetime.
 */
export function useWorkoutCount(initialPeriod: WorkoutCountPeriod = 'week') {
  const [period, setPeriod] = useState<WorkoutCountPeriod>(initialPeriod);
  const [now] = useState(() => Date.now());
  const database = useDatabase();
  const since = startOfPeriod(period, now);
  const loader = useCallback(
    () => database.countCompletedSessionsSince(since),
    [database, since]
  );
  const { data, loading } = useAsyncData(loader);

  const cycle = useCallback(() => {
    setPeriod((current) => {
      const index = PERIOD_ORDER.indexOf(current);
      return PERIOD_ORDER[(index + 1) % PERIOD_ORDER.length];
    });
  }, []);

  return {
    count: data ?? 0,
    loading,
    period,
    label: PERIOD_LABELS[period],
    cycle,
  };
}
