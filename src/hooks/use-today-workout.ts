import { useEffect, useState } from 'react';

import { useDatabase } from '@/db/database-provider';
import type { WorkoutWithExercises } from '@/db/repositories/workouts';

/**
 * The state of a section that has to be read before it can be shown.
 */
export type Loadable<T> = {
  status: 'loading' | 'ready';
  data: T | null;
};

export type TodayWorkout = {
  workout: WorkoutWithExercises;
  /** The planned exercises, in the order they should be performed. */
  exercises: WorkoutWithExercises['exercises'];
};

/**
 * Reads the workout scheduled for today.
 *
 * A workout is scheduled for today when the plan puts it on this day of the
 * week. Stage 3 replaces this with the session the user actually started.
 */
export function useTodayWorkout(): Loadable<TodayWorkout | null> {
  const database = useDatabase();
  const [state, setState] = useState<Loadable<TodayWorkout | null>>({
    status: 'loading',
    data: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const workout = await database.getWorkoutForDay(new Date().getDay());
      if (!cancelled) {
        setState({
          status: 'ready',
          data: workout ? { workout, exercises: workout.exercises } : null,
        });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [database]);

  return state;
}
