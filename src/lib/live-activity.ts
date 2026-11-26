import type { WorkoutActivityProps } from '@/workouts/workout-activity';

/** Non-iOS fallback. Metro resolves `live-activity.ios.ts` on iPhone. */

/** Live Activities are an iOS-only system feature. */
export function syncWorkoutActivity(_props: WorkoutActivityProps, _sessionId: number): void {}

/** Takes the activity down when the workout ends, is abandoned or is left. */
export function endWorkoutActivity(): void {}
