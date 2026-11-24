import type { WorkoutActivityFactory } from '@/workouts/workout-activity';

/**
 * The web build has no Live Activities — ActivityKit is iOS-only — so the
 * widget module resolves here instead of the SwiftUI one.
 */
const factory: WorkoutActivityFactory = {
  start: () => {
    throw new Error('Live Activities are unavailable on this platform.');
  },
  getInstances: () => [],
};

export default factory;
