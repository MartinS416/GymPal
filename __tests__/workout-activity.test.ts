import { describe, expect, it } from '@jest/globals';

import {
  WORK_ACTIVITY_TIMER_CEILING_MS,
  buildWorkoutActivityProps,
  type WorkoutActivityInput,
} from '../src/workouts/workout-activity';

const NOW = 1_700_000_000_000;

function input(overrides: Partial<WorkoutActivityInput> = {}): WorkoutActivityInput {
  return {
    workoutTitle: 'Push Day',
    phase: 'work',
    exerciseName: 'Bench Press',
    setNumber: 2,
    targetSets: 4,
    setsLogged: 1,
    exerciseStartedAt: NOW,
    exerciseElapsedSeconds: 0,
    restEndsAt: null,
    ...overrides,
  };
}

describe('workout live activity', () => {
  it('mirrors a working set with the exercise clock running up', () => {
    const props = buildWorkoutActivityProps(input(), NOW);

    expect(props.phase).toBe('work');
    expect(props.workout).toBe('Push Day');
    expect(props.exercise).toBe('Bench Press');
    expect(props.setLabel).toBe('Set 2 of 4');
    expect(props.countsDown).toBe(false);
    expect(props.timerLower).toBe(NOW);
    expect(props.timerUpper).toBe(NOW + WORK_ACTIVITY_TIMER_CEILING_MS);
    expect(props.progress).toBe(0.25);
  });

  it('banks the exercise clock before the set it belongs to', () => {
    const props = buildWorkoutActivityProps(
      input({ exerciseStartedAt: null, exerciseElapsedSeconds: 83 }),
      NOW
    );

    expect(props.phase).toBe('work');
    expect(props.timerLower).toBe(NOW - 83_000);
    expect(props.timerUpper).toBe(NOW - 83_000 + WORK_ACTIVITY_TIMER_CEILING_MS);
    expect(props.progress).toBe(0.25);
  });

  it('mirrors a rest countdown that ends when the rest does', () => {
    const props = buildWorkoutActivityProps(
      input({ phase: 'rest', restEndsAt: NOW + 90_000, setsLogged: 1 }),
      NOW
    );

    expect(props.phase).toBe('rest');
    expect(props.countsDown).toBe(true);
    expect(props.timerLower).toBe(NOW);
    expect(props.timerUpper).toBe(NOW + 90_000);
    expect(props.progress).toBe(0.25);
  });

  it('pins an overdue rest to zero instead of handing the timer a past window', () => {
    const props = buildWorkoutActivityProps(
      input({ phase: 'rest', restEndsAt: NOW - 5_000, setsLogged: 1 }),
      NOW
    );

    expect(props.phase).toBe('rest');
    expect(props.countsDown).toBe(true);
    expect(props.timerLower).toBe(NOW - 1_000);
    expect(props.timerUpper).toBe(NOW);
  });

  it('keeps progress within bounds and leaves out a set count the plan lacks', () => {
    expect(
      buildWorkoutActivityProps(input({ setsLogged: 9, targetSets: 4 }), NOW).progress
    ).toBe(1);
    expect(
      buildWorkoutActivityProps(input({ setsLogged: 0, targetSets: 0 }), NOW)
    ).toEqual({
      phase: 'work',
      workout: 'Push Day',
      exercise: 'Bench Press',
      setLabel: 'Set 2',
      timerLower: NOW,
      timerUpper: NOW + WORK_ACTIVITY_TIMER_CEILING_MS,
      countsDown: false,
      progress: 0,
    });
  });

  it('falls back to a generic workout name', () => {
    expect(buildWorkoutActivityProps(input({ workoutTitle: null }), NOW).workout).toBe('Workout');
    expect(buildWorkoutActivityProps(input({ workoutTitle: '   ' }), NOW).workout).toBe('Workout');
  });
});
