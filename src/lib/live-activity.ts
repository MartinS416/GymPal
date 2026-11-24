import type { WorkoutActivityProps } from '@/workouts/workout-activity';

/**
 * Local Live Activities for the active workout.
 *
 * Temporarily disabled: the Live Activity native module is not present in the
 * binary the app is currently running (Expo Go cannot carry one, and a build made
 * before the `expo-widgets` module was added cannot see it either), so this module
 * does not import the widget factory at all and simply does nothing. Re-enable by
 * restoring the implementation in this file and shipping a development build that
 * contains the Live Activity extension.
 */

/** Mirrors the current phase into the Live Activity. Disabled for now. */
export function syncWorkoutActivity(_props: WorkoutActivityProps, _sessionId: number): void {}

/** Takes the activity down when the workout ends, is abandoned or is left. */
export function endWorkoutActivity(): void {}
