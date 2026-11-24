/**
 * A stand-in for the Live Activity factory and its instances.
 *
 * The native module does not exist under Jest, so the factory records what the
 * app asked the system to show. Tests can then assert on the lifecycle: a phase
 * starts the activity, a phase change replaces it and leaving the workout ends
 * it.
 */

export type RecordedWorkoutActivity = {
  props: Record<string, unknown>;
  url: string | null;
  update: jest.Mock;
  end: jest.Mock;
  getId: () => string;
};

export type WorkoutActivityFactory = {
  start: (props: Record<string, unknown>, url?: string) => RecordedWorkoutActivity;
  getInstances: () => RecordedWorkoutActivity[];
};

let activities: RecordedWorkoutActivity[] = [];
let counter = 0;

/** Puts the mock back to an empty state. */
export function resetWorkoutActivityMock(): void {
  activities = [];
  counter = 0;
}

/** Every activity the app has started, in order. */
export function workoutActivities(): RecordedWorkoutActivity[] {
  return activities;
}

function createInstance(props: Record<string, unknown>, url: string | null): RecordedWorkoutActivity {
  counter += 1;
  const id = `mock-workout-activity-${counter}`;
  let instance: RecordedWorkoutActivity = {
    props,
    url,
    update: jest.fn(async (next: Record<string, unknown>) => {
      instance.props = next;
    }),
    end: jest.fn(async () => {
      activities = activities.filter((other) => other !== instance);
    }),
    getId: () => id,
  };
  activities = [instance];
  return instance;
}

export const WorkoutActivity: WorkoutActivityFactory = {
  start: (props, url) => createInstance(props, url ?? null),
  getInstances: () => activities,
};

export default WorkoutActivity;
