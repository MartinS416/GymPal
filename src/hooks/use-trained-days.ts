import { useCallback } from 'react';

import { useDatabase } from '@/db/database-provider';
import { useAsyncData } from '@/hooks/use-async-data';

/** How many days of training history the home screen tracker looks back over. */
export const TRAINED_DAYS_LOOKBACK_DAYS = 92;

/**
 * The days the user trained, as start-of-day timestamps.
 *
 * The home screen mirrors them as dots; the rest of the app reads them back
 * through the repositories when it needs to.
 */
export function useTrainedDays(limit: number = TRAINED_DAYS_LOOKBACK_DAYS) {
  const database = useDatabase();
  const loader = useCallback(() => database.getTrainedDays(limit), [database, limit]);
  const { data, loading } = useAsyncData(loader);
  return { days: data ?? [], loading };
}
