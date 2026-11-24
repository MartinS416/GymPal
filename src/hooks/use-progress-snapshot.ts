import { useCallback } from 'react';

import { useDatabase } from '@/db/database-provider';
import { toManualEntry } from '@/db/repositories/progress';
import { useAsyncData } from '@/hooks/use-async-data';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useProfile } from '@/state/profile-context';
import {
  buildMetrics,
  type MetricData,
  type MetricPreference,
} from '@/workouts/progress';

export type ProgressSnapshot = {
  metrics: MetricData[];
  preferences: MetricPreference[];
  /** The moment the snapshot was built, used for relative dates. */
  now: number;
};

/**
 * Everything the progress screens read.
 *
 * The dashboard and the detail screen show the same numbers from the same
 * query, so a weight logged on one is on the other the moment it is saved. It
 * reloads whenever the screen is focused: a workout finished elsewhere is
 * already part of the history by the time the tab is opened.
 */
export function useProgressSnapshot(): {
  data: ProgressSnapshot | null;
  loading: boolean;
  reload: () => void;
} {
  const database = useDatabase();
  const { profile } = useProfile();

  const load = useCallback(async (): Promise<ProgressSnapshot> => {
    const [aggregates, entries, preferences] = await Promise.all([
      database.listSessionAggregates(),
      database.listProgressEntries(),
      database.listMetricPreferences(),
    ]);

    const metrics = buildMetrics(aggregates, entries.map(toManualEntry), {
      profileWeightKg: profile?.weightKg ?? null,
      now: Date.now(),
    });

    return { metrics, preferences, now: Date.now() };
  }, [database, profile?.weightKg]);

  const { data, loading, reload } = useAsyncData(load);
  useRefreshOnFocus(reload);

  return { data, loading, reload };
}
