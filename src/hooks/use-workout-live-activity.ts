import { useEffect } from 'react';

import { endWorkoutActivity, syncWorkoutActivity } from '@/lib/live-activity';
import {
  buildWorkoutActivityProps,
  type WorkoutActivityProps,
} from '@/workouts/workout-activity';

/**
 * Mirrors the active workout into a Live Activity.
 *
 * The screen re-renders every half second for the clocks, so the effect is
 * deliberately keyed on things that only change when the phase does: the set, the
 * rest deadline and the moment the exercise clock started. The remaining time is
 * read from `Date.now()` inside the effect, never from the render, and handed to
 * the widget as a timer range that ActivityKit ticks on its own.
 */
export type WorkoutLiveActivityOptions = {
  sessionId: number | null;
  workoutTitle: string | null;
  /** 'work' or 'rest'; null before the session has loaded. */
  phase: 'work' | 'rest' | null;
  exerciseName: string | null;
  /** The set being worked, or the set just finished while resting. */
  setNumber: number | null;
  targetSets: number | null;
  /** Sets already logged for the exercise in focus. */
  setsLogged: number;
  restEndsAt: number | null;
  exerciseStartedAt: number | null;
  /** Seconds on the exercise clock before this phase, resting excluded. */
  exerciseElapsedSeconds: number;
};

export function useWorkoutLiveActivity(options: WorkoutLiveActivityOptions): void {
  const {
    sessionId,
    workoutTitle,
    phase,
    exerciseName,
    setNumber,
    targetSets,
    setsLogged,
    restEndsAt,
    exerciseStartedAt,
    exerciseElapsedSeconds,
  } = options;

  useEffect(() => {
    if (
      sessionId === null ||
      phase === null ||
      exerciseName === null ||
      setNumber === null ||
      targetSets === null
    ) {
      return;
    }

    const props: WorkoutActivityProps = buildWorkoutActivityProps(
      {
        workoutTitle,
        phase,
        exerciseName,
        setNumber,
        targetSets,
        setsLogged,
        exerciseStartedAt,
        exerciseElapsedSeconds,
        restEndsAt,
      },
      Date.now()
    );

    syncWorkoutActivity(props, sessionId);
  }, [
    sessionId,
    workoutTitle,
    phase,
    exerciseName,
    setNumber,
    targetSets,
    setsLogged,
    restEndsAt,
    exerciseStartedAt,
    exerciseElapsedSeconds,
  ]);

  // Leaving the workout — finishing it, abandoning it or backing out — takes
  // the Live Activity down with it.
  useEffect(() => {
    if (sessionId === null) {
      return;
    }
    return () => {
      endWorkoutActivity();
    };
  }, [sessionId]);
}
