import WorkoutLiveActivity from '@/widgets/workout-live-activity';
import type { WorkoutActivityProps } from '@/workouts/workout-activity';

let pendingOperation: Promise<void> = Promise.resolve();

function enqueue(operation: () => Promise<void>): void {
  pendingOperation = pendingOperation
    .then(operation)
    .catch((error: unknown) => {
      // Live Activities can be disabled by the user or unavailable on an older
      // iPhone. A workout must continue normally when ActivityKit declines.
      console.warn('Unable to update the workout Live Activity.', error);
    });
}

/** Starts the activity once, then mirrors each meaningful phase change into it. */
export function syncWorkoutActivity(props: WorkoutActivityProps, sessionId: number): void {
  enqueue(async () => {
    const instances = WorkoutLiveActivity.getInstances();

    if (instances.length === 0) {
      WorkoutLiveActivity.start(props, `gympal://session/${sessionId}`);
      return;
    }

    await instances[0].update(props);

    // There should only be one active workout. Clean up duplicates that can be
    // left behind by a development reload or an interrupted app process.
    await Promise.all(instances.slice(1).map((instance) => instance.end('immediate')));
  });
}

/** Removes every recovered instance when the workout ends or is abandoned. */
export function endWorkoutActivity(): void {
  enqueue(async () => {
    const instances = WorkoutLiveActivity.getInstances();
    await Promise.all(instances.map((instance) => instance.end('immediate')));
  });
}
