import { describe, expect, it } from '@jest/globals';

import type { Exercise } from '@/db/repositories/exercises';
import {
  addExercise,
  assignWorkoutToDay,
  buildSchedule,
  createDraftForSplit,
  createEmptyPlanDraft,
  generateWorkoutExercises,
  moveExercise,
  removeExercise,
  replaceExercise,
  setFrequency,
  toNewPlan,
  updateExercise,
  validatePlanDraft,
  type PlanDraft,
} from '@/workouts/plan-draft';
import { defaultPlanName, daysForFrequency, splitWorkoutNames, templateFor } from '@/workouts/templates';

function exercise(id: number, name: string): Exercise {
  return {
    id,
    name,
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    instructions: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

function library(): Map<string, Exercise> {
  return new Map([
    ['Back Squat', exercise(1, 'Back Squat')],
    ['Bench Press', exercise(2, 'Bench Press')],
    ['Barbell Row', exercise(3, 'Barbell Row')],
    ['Overhead Press', exercise(4, 'Overhead Press')],
    ['Lat Pulldown', exercise(5, 'Lat Pulldown')],
    ['Plank', exercise(6, 'Plank')],
    ['Deadlift', exercise(7, 'Deadlift')],
    ['Romanian Deadlift', exercise(8, 'Romanian Deadlift')],
    ['Leg Press', exercise(9, 'Leg Press')],
    ['Lying Leg Curl', exercise(10, 'Lying Leg Curl')],
    ['Leg Press Calf Raise', exercise(11, 'Leg Press Calf Raise')],
    ['Hip Thrust', exercise(12, 'Hip Thrust')],
    ['Incline Bench Press', exercise(13, 'Incline Bench Press')],
    ['Lateral Raise', exercise(14, 'Lateral Raise')],
    ['Cable Fly', exercise(15, 'Cable Fly')],
    ['Triceps Pushdown', exercise(16, 'Triceps Pushdown')],
    ['Face Pull', exercise(17, 'Face Pull')],
    ['Upright Row', exercise(18, 'Upright Row')],
    ['Barbell Curl', exercise(19, 'Barbell Curl')],
    ['Straight-Arm Pulldown', exercise(20, 'Straight-Arm Pulldown')],
    ['Dumbbell Hammer Curl', exercise(21, 'Dumbbell Hammer Curl')],
    ['Walking Lunge', exercise(22, 'Walking Lunge')],
    ['Close-Grip Bench Press', exercise(23, 'Close-Grip Bench Press')],
    ['Dumbbell Shrug', exercise(24, 'Dumbbell Shrug')],
  ]);
}

describe('plan templates', () => {
  it('creates a draft with one workout per part of the split', () => {
    expect(splitWorkoutNames('full_body')).toEqual(['Full Body']);
    expect(splitWorkoutNames('upper_lower')).toEqual(['Upper', 'Lower']);
    expect(splitWorkoutNames('push_pull_legs')).toEqual(['Push', 'Pull', 'Legs']);
    expect(splitWorkoutNames('bro_split').length).toBe(4);
    expect(splitWorkoutNames('custom')).toEqual(['Workout']);

    const draft = createDraftForSplit('push_pull_legs', library());
    expect(draft.workouts).toHaveLength(3);
    expect(draft.workouts.map((workout) => workout.name)).toEqual(['Push', 'Pull', 'Legs']);
    expect(draft.workouts.every((workout) => workout.exercises.length === 0)).toBe(true);
    expect(draft.name).toBe(defaultPlanName('push_pull_legs'));
  });

  it('fills one workout of a split at a time', () => {
    const draft = createDraftForSplit('push_pull_legs', library());

    const push = generateWorkoutExercises(draft.workouts[0], 'push_pull_legs', 0, library());
    expect(push.exercises.length).toBeGreaterThan(0);
    expect(push.exercises[0].name).toBe('Bench Press');
    for (const exercise of push.exercises) {
      expect(exercise.exerciseId).toBeGreaterThan(0);
      expect(exercise.targetSets).toBeGreaterThan(0);
      expect(exercise.repRangeMax).toBeGreaterThanOrEqual(exercise.repRangeMin);
      expect(exercise.restSeconds).toBeGreaterThan(0);
    }

    // The other workouts are untouched.
    const pull = generateWorkoutExercises(draft.workouts[1], 'push_pull_legs', 1, library());
    expect(pull.exercises[0].name).toBe('Deadlift');
    expect(draft.workouts[0].exercises).toHaveLength(0);
  });

  it('has a suggestion for every split that has one', () => {
    for (const splitType of ['full_body', 'upper_lower', 'push_pull_legs', 'bro_split'] as const) {
      const template = templateFor(splitType);
      expect(template).toBeDefined();
      const draft = createDraftForSplit(splitType, library());
      for (const [index, workout] of draft.workouts.entries()) {
        const generated = generateWorkoutExercises(workout, splitType, index, library());
        expect(generated.exercises.length).toBeGreaterThan(0);
      }
    }
  });

  it('leaves a custom split empty', () => {
    const draft = createDraftForSplit('custom', library());
    expect(draft.workouts).toHaveLength(1);
    const generated = generateWorkoutExercises(draft.workouts[0], 'custom', 0, library());
    expect(generated.exercises).toHaveLength(0);
  });

  it('places the workouts on the first days of the week', () => {
    const draft = createDraftForSplit('push_pull_legs', library());
    expect(draft.schedule).toHaveLength(3);
    expect(draft.schedule.map((entry) => entry.dayOfWeek)).toEqual([1, 2, 3]);
    expect(daysForFrequency(5)).toHaveLength(5);
  });
});

describe('editing a plan', () => {
  const base = (): PlanDraft => {
    const draft = createDraftForSplit('upper_lower', library());
    return {
      ...draft,
      workouts: draft.workouts.map((workout, index) =>
        generateWorkoutExercises(workout, 'upper_lower', index, library())
      ),
    };
  };

  it('adds an exercise without duplicating it', () => {
    const draft = base();
    const workout = draft.workouts[0];
    const added = addExercise(workout, exercise(99, 'New Movement'));
    expect(added.exercises).toHaveLength(workout.exercises.length + 1);

    // The same exercise is not added twice.
    const again = addExercise(added, exercise(99, 'New Movement'));
    expect(again.exercises).toHaveLength(added.exercises.length);
  });

  it('removes an exercise', () => {
    const draft = base();
    const workout = draft.workouts[0];
    const removed = removeExercise(workout, workout.exercises[0].key);
    expect(removed.exercises).toHaveLength(workout.exercises.length - 1);
  });

  it('moves an exercise up and down', () => {
    const draft = base();
    const workout = draft.workouts[0];
    const first = workout.exercises[0].key;
    const second = workout.exercises[1].key;

    const down = moveExercise(workout, first, 1);
    expect(down.exercises[0].key).toBe(second);
    expect(down.exercises[1].key).toBe(first);

    const up = moveExercise(down, first, -1);
    expect(up.exercises[0].key).toBe(first);

    // Moving past the ends changes nothing.
    expect(moveExercise(workout, first, -1)).toBe(workout);
  });

  it('replaces an exercise and keeps its place', () => {
    const draft = base();
    const workout = draft.workouts[0];
    const replaced = replaceExercise(workout, workout.exercises[0].key, exercise(42, 'Swap'));
    expect(replaced.exercises[0].name).toBe('Swap');
    expect(replaced.exercises[0].exerciseId).toBe(42);
    expect(replaced.exercises).toHaveLength(workout.exercises.length);
    // The other exercises are untouched.
    expect(replaced.exercises[1].exerciseId).toBe(workout.exercises[1].exerciseId);
  });

  it('edits the targets', () => {
    const draft = base();
    const workout = draft.workouts[0];
    const updated = updateExercise(workout, workout.exercises[0].key, {
      targetSets: 5,
      repRangeMin: 3,
      repRangeMax: 6,
      restSeconds: 210,
    });
    expect(updated.exercises[0].targetSets).toBe(5);
    expect(updated.exercises[0].repRangeMin).toBe(3);
    expect(updated.exercises[0].restSeconds).toBe(210);
  });

  it('changes the frequency and rebuilds the schedule', () => {
    const draft = base();
    const changed = setFrequency(draft, 5);
    expect(changed.weeklyFrequency).toBe(5);
    // The schedule follows the workouts, not the frequency.
    expect(changed.schedule).toHaveLength(changed.workouts.length);
  });

  it('assigns a workout to a day', () => {
    const draft = base();
    const assigned = assignWorkoutToDay(draft, 1, draft.workouts[1].key);
    expect(assigned.schedule.find((entry) => entry.dayOfWeek === 1)?.workoutKey).toBe(
      draft.workouts[1].key
    );
  });

  it('converts the draft into the shape the database expects', () => {
    const draft = base();
    const plan = toNewPlan(draft);
    expect(plan.workouts).toHaveLength(2);
    expect(plan.schedule[0].workoutIndex).toBe(0);
    expect(plan.schedule.every((entry) => entry.workoutIndex < plan.workouts.length)).toBe(true);
  });

  it('refuses a plan that is not ready to be saved', () => {
    const empty = createEmptyPlanDraft();
    expect(validatePlanDraft(empty).name).toBeUndefined();
    expect(validatePlanDraft(empty).workouts).toBeDefined();

    const noExercises = { ...empty, workouts: [{ key: 'w0', name: 'Upper', exercises: [] }] };
    expect(validatePlanDraft(noExercises).exercises).toBeDefined();

    const unnamed = { ...empty, name: '   ' };
    expect(validatePlanDraft(unnamed).name).toBeDefined();
  });

  it('keeps the schedule in step with the workouts', () => {
    const draft = buildSchedule({
      ...createEmptyPlanDraft(),
      workouts: [{ key: 'w0', name: 'A', exercises: [] }],
    });
    expect(draft).toHaveLength(1);
    expect(draft.every((entry) => entry.workoutKey === 'w0')).toBe(true);
  });
});
