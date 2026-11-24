/**
 * The content of the workout Live Activity.
 *
 * A Live Activity is a snapshot plus a clock: iOS renders the card from these
 * props and ticks the timer itself, so nothing here is sent again every second.
 * The props change only when the phase does — a new set, a rest, a correction.
 *
 * This module is pure: it turns a phase into the props the widget renders, and
 * `src/lib/live-activity.ts` hands them to ActivityKit.
 */

/**
 * How far the exercise clock can run before the native timer stops.
 *
 * The in-app clock counts up for as long as a set takes; the widget needs an
 * upper bound to draw a count-up timer, and a workout is never twelve hours
 * long.
 */
export const WORK_ACTIVITY_TIMER_CEILING_MS = 12 * 60 * 60 * 1000;

/** Everything the widget needs to draw itself. Kept JSON-safe for ActivityKit. */
export type WorkoutActivityProps = {
  /** 'work' while a set is being done, 'rest' while the countdown runs. */
  phase: 'work' | 'rest';
  /** The workout name, e.g. "Push Day". */
  workout: string;
  /** The exercise in focus, e.g. "Bench Press". */
  exercise: string;
  /** "Set 2 of 4", or "Set 2" when the plan has no target. */
  setLabel: string;
  /** Start of the timer, in epoch milliseconds. */
  timerLower: number;
  /** End of the timer, in epoch milliseconds. */
  timerUpper: number;
  /** True for the rest countdown, false for the exercise clock. */
  countsDown: boolean;
  /** How far through the planned sets of the exercise, 0 to 1. */
  progress: number;
};

export type WorkoutActivityInput = {
  /** The name of the workout, e.g. "Push Day". */
  workoutTitle: string | null;
  phase: 'work' | 'rest';
  exerciseName: string;
  /** The set being worked, or the set just finished while resting. */
  setNumber: number;
  targetSets: number;
  /** Sets already logged for the exercise in focus. */
  setsLogged: number;
  /** When the exercise clock was last started, in epoch milliseconds. */
  exerciseStartedAt: number | null;
  /** Seconds banked on the exercise clock before the current stretch. */
  exerciseElapsedSeconds: number;
  /** When the rest ends, in epoch milliseconds; null while working. */
  restEndsAt: number | null;
};

/** The slice of ActivityKit the app talks to. */
export type WorkoutActivityInstance = {
  update: (props: WorkoutActivityProps) => Promise<void>;
  end: (dismissalPolicy?: unknown) => Promise<void>;
};

/** Starts, reads and ends the Live Activities of a kind. */
export type WorkoutActivityFactory = {
  start: (props: WorkoutActivityProps, url?: string) => WorkoutActivityInstance;
  getInstances: () => WorkoutActivityInstance[];
};

function workoutLabel(workoutTitle: string | null): string {
  const title = workoutTitle?.trim();
  return title ? title : 'Workout';
}

function setLabel(setNumber: number, targetSets: number): string {
  return targetSets > 0 ? `Set ${setNumber} of ${targetSets}` : `Set ${setNumber}`;
}

/**
 * Builds the props for a phase.
 *
 * Working shows the exercise clock — the same clock as the ring on screen — and
 * resting shows the countdown. Both carry the exercise, the set and the workout
 * so a glance at the Lock Screen says exactly where the session is.
 */
export function buildWorkoutActivityProps(
  input: WorkoutActivityInput,
  now: number
): WorkoutActivityProps {
  const progress =
    input.targetSets > 0
      ? Math.min(1, Math.max(0, input.setsLogged / input.targetSets))
      : 0;

  const common = {
    workout: workoutLabel(input.workoutTitle),
    exercise: input.exerciseName,
    setLabel: setLabel(input.setNumber, input.targetSets),
    progress,
  };

  if (input.phase === 'work') {
    const startedAt =
      input.exerciseStartedAt ??
      now - Math.max(0, input.exerciseElapsedSeconds) * 1000;

    return {
      ...common,
      phase: 'work',
      timerLower: startedAt,
      timerUpper: startedAt + WORK_ACTIVITY_TIMER_CEILING_MS,
      countsDown: false,
    };
  }

  const endsAt = input.restEndsAt ?? now;
  // A rest that has already run out has nothing left to count; pin the range so
  // the native timer rests on zero instead of handing it a window that has
  // already passed.
  const counting = endsAt > now;
  const lower = counting ? now : now - 1000;
  const upper = counting ? endsAt : now;

  return {
    ...common,
    phase: 'rest',
    timerLower: lower,
    timerUpper: upper,
    countsDown: true,
  };
}
