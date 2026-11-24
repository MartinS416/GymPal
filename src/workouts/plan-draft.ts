import type { NewPlan, SplitType } from '@/db/repositories/plans';
import type { Exercise } from '@/db/repositories/exercises';
import type { ExerciseSetConfiguration } from '@/workouts/set-types';
import { normalizeSetConfiguration } from '@/workouts/set-types';
import {
  daysForFrequency,
  defaultPlanName,
  splitWorkoutNames,
  templateWorkoutFor,
} from '@/workouts/templates';

/**
 * The plan draft.
 *
 * The builder works on a plain object that lives in memory until it is saved.
 * Every operation is a pure function over that object, so the behaviour can be
 * tested without a database or a renderer.
 */

export type ExerciseDraft = {
  /** Stable within a workout; derived from the exercise so it survives reorders. */
  key: string;
  exerciseId: number;
  name: string;
  muscleGroup: string;
  equipment: string;
  targetSets: number;
  repRangeMin: number;
  repRangeMax: number;
  restSeconds: number;
  setConfig: ExerciseSetConfiguration;
  supersetGroup: string | null;
};

export type WorkoutDraft = {
  key: string;
  /** The database id, once the plan has been saved. */
  id?: number;
  name: string;
  exercises: ExerciseDraft[];
};

export type PlanDraft = {
  name: string;
  splitType: SplitType;
  weeklyFrequency: number;
  workouts: WorkoutDraft[];
  /** Which workout is trained on which day. */
  schedule: { dayOfWeek: number; workoutKey: string }[];
};

export function createEmptyPlanDraft(): PlanDraft {
  return {
    name: 'My plan',
    splitType: 'full_body',
    weeklyFrequency: 3,
    workouts: [],
    schedule: [],
  };
}

export function exerciseKey(exerciseId: number): string {
  return `e${exerciseId}`;
}

export function workoutKey(index: number): string {
  return `w${index}`;
}

/** Builds a draft from a plan that is already in the database. */
export function draftFromPlan(
  plan: {
    name: string;
    splitType: SplitType;
    weeklyFrequency: number;
  },
  workouts: {
    id: number;
    name: string;
    exercises: {
      id: number;
      exerciseId: number;
      name: string;
      muscleGroup: string;
      equipment: string;
      targetSets: number;
      repRangeMin: number;
      repRangeMax: number;
      restSeconds: number;
      setConfig?: ExerciseSetConfiguration;
      supersetGroup?: string | null;
    }[];
  }[],
  schedule: { dayOfWeek: number; workoutId: number }[]
): PlanDraft {
  const keyByWorkoutId = new Map<number, string>();
  const draftWorkouts: WorkoutDraft[] = workouts.map((workout, index) => {
    const key = workoutKey(index);
    keyByWorkoutId.set(workout.id, key);
    return {
      key,
      id: workout.id,
      name: workout.name,
      exercises: workout.exercises.map((exercise) => ({
        key: exerciseKey(exercise.exerciseId),
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        equipment: exercise.equipment,
        targetSets: exercise.targetSets,
        repRangeMin: exercise.repRangeMin,
        repRangeMax: exercise.repRangeMax,
        restSeconds: exercise.restSeconds,
        setConfig: normalizeSetConfiguration(exercise.setConfig, exercise.targetSets),
        supersetGroup: exercise.supersetGroup ?? null,
      })),
    };
  });

  return {
    name: plan.name,
    splitType: plan.splitType,
    weeklyFrequency: plan.weeklyFrequency,
    workouts: draftWorkouts,
    schedule: schedule
      .map((entry) => ({
        dayOfWeek: entry.dayOfWeek,
        workoutKey: keyByWorkoutId.get(entry.workoutId) ?? '',
      }))
      .filter((entry) => entry.workoutKey !== ''),
  };
}

/**
 * Creates the draft for a split.
 *
 * A split is built one workout at a time, so the draft starts with the
 * workouts of the split, named and empty.
 */
export function createDraftForSplit(
  splitType: SplitType,
  library: Map<string, Exercise>
): PlanDraft {
  const names = splitWorkoutNames(splitType);
  const workouts: WorkoutDraft[] = names.map((name, index) => ({
    key: workoutKey(index),
    name,
    exercises: [],
  }));

  const draft: PlanDraft = {
    name: defaultPlanName(splitType),
    splitType,
    weeklyFrequency: workouts.length,
    workouts,
    schedule: [],
  };

  return { ...draft, schedule: buildSchedule(draft) };
}

/**
 * Fills one workout with the exercises the split suggests.
 *
 * The result is a starting point: every set, rep range and rest duration is
 * still the user's to change.
 */
export function generateWorkoutExercises(
  workout: WorkoutDraft,
  splitType: SplitType,
  index: number,
  library: Map<string, Exercise>
): WorkoutDraft {
  const template = templateWorkoutFor(splitType, index);
  if (!template) {
    return workout;
  }

  const exercises = template.exercises
    .map((exercise): ExerciseDraft | null => {
      const found = library.get(exercise.name);
      if (!found) {
        return null;
      }
      return {
        key: exerciseKey(found.id),
        exerciseId: found.id,
        name: found.name,
        muscleGroup: found.muscleGroup,
        equipment: found.equipment,
        targetSets: exercise.targetSets,
        repRangeMin: exercise.repRangeMin,
        repRangeMax: exercise.repRangeMax,
        restSeconds: exercise.restSeconds,
        setConfig: normalizeSetConfiguration(undefined, exercise.targetSets),
        supersetGroup: null,
      };
    })
    .filter((exercise): exercise is ExerciseDraft => exercise !== null);

  return { ...workout, exercises };
}

/**
 * Spreads the workouts over the training days.
 *
 * The workouts are placed on the first days of the week, starting on Monday,
 * and the rest of the week is left free.
 */
export function buildSchedule(draft: PlanDraft): PlanDraft['schedule'] {
  if (draft.workouts.length === 0) {
    return [];
  }
  const days = daysForFrequency(draft.workouts.length);
  return days.map((dayOfWeek, index) => ({
    dayOfWeek,
    workoutKey: draft.workouts[index % draft.workouts.length].key,
  }));
}

export function setFrequency(draft: PlanDraft, frequency: number): PlanDraft {
  const next = { ...draft, weeklyFrequency: frequency };
  return { ...next, schedule: buildSchedule(next) };
}

/** Assigns a workout to a day. */
export function assignWorkoutToDay(
  draft: PlanDraft,
  dayOfWeek: number,
  workoutKey: string
): PlanDraft {
  const withoutDay = draft.schedule.filter((entry) => entry.dayOfWeek !== dayOfWeek);
  const sorted = [...withoutDay, { dayOfWeek, workoutKey }].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek
  );
  return { ...draft, schedule: sorted };
}

/** Removes a day from the schedule. */
export function removeDayFromSchedule(draft: PlanDraft, dayOfWeek: number): PlanDraft {
  return {
    ...draft,
    schedule: draft.schedule.filter((entry) => entry.dayOfWeek !== dayOfWeek),
  };
}

export function addExercise(
  workout: WorkoutDraft,
  exercise: Exercise,
  targets?: Partial<
    Pick<ExerciseDraft, 'targetSets' | 'repRangeMin' | 'repRangeMax' | 'restSeconds'>
  >
): WorkoutDraft {
  if (workout.exercises.some((item) => item.exerciseId === exercise.id)) {
    return workout;
  }
  return {
    ...workout,
    exercises: [
      ...workout.exercises,
      {
        key: exerciseKey(exercise.id),
        exerciseId: exercise.id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        equipment: exercise.equipment,
        targetSets: targets?.targetSets ?? 3,
        repRangeMin: targets?.repRangeMin ?? 8,
        repRangeMax: targets?.repRangeMax ?? 12,
        restSeconds: targets?.restSeconds ?? 90,
        setConfig: normalizeSetConfiguration(undefined, targets?.targetSets ?? 3),
        supersetGroup: null,
      },
    ],
  };
}

export function removeExercise(workout: WorkoutDraft, key: string): WorkoutDraft {
  return {
    ...workout,
    exercises: workout.exercises.filter((exercise) => exercise.key !== key),
  };
}

/** Replaces one exercise with another, keeping its position and targets. */
export function replaceExercise(
  workout: WorkoutDraft,
  key: string,
  exercise: Exercise
): WorkoutDraft {
  return {
    ...workout,
    exercises: workout.exercises.map((item) =>
      item.key === key
        ? {
            ...item,
            key: exerciseKey(exercise.id),
            exerciseId: exercise.id,
            name: exercise.name,
            muscleGroup: exercise.muscleGroup,
            equipment: exercise.equipment,
            setConfig: item.setConfig,
            supersetGroup: item.supersetGroup,
          }
        : item
    ),
  };
}

/** Moves an exercise up or down. */
export function moveExercise(
  workout: WorkoutDraft,
  key: string,
  direction: -1 | 1
): WorkoutDraft {
  const index = workout.exercises.findIndex((exercise) => exercise.key === key);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= workout.exercises.length) {
    return workout;
  }
  const exercises = [...workout.exercises];
  const [moved] = exercises.splice(index, 1);
  exercises.splice(target, 0, moved);
  return { ...workout, exercises };
}

/** Changes the targets of an exercise. */
export function updateExercise(
  workout: WorkoutDraft,
  key: string,
  patch: Partial<
    Pick<ExerciseDraft, 'targetSets' | 'repRangeMin' | 'repRangeMax' | 'restSeconds'>
  >
): WorkoutDraft {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.key === key
        ? {
            ...exercise,
            ...patch,
            setConfig: normalizeSetConfiguration(
              exercise.setConfig,
              patch.targetSets ?? exercise.targetSets
            ),
          }
        : exercise
    ),
  };
}

/** Updates optional set prescriptions without changing exercise targets. */
export function updateSetConfiguration(
  workout: WorkoutDraft,
  key: string,
  setConfig: ExerciseSetConfiguration
): WorkoutDraft {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.key === key
        ? { ...exercise, setConfig: normalizeSetConfiguration(setConfig, exercise.targetSets) }
        : exercise
    ),
  };
}

/** Groups selected exercises while leaving the sequence of unselected items intact. */
export function groupExercises(
  workout: WorkoutDraft,
  keys: string[],
  matchRounds: boolean
): WorkoutDraft {
  const selectedKeys = expandSupersetSelection(workout, keys);
  const selected = workout.exercises.filter((exercise) => selectedKeys.includes(exercise.key));
  if (selected.length < 2) {
    return workout;
  }
  const rounds = Math.max(...selected.map((exercise) => exercise.targetSets));
  const group = `superset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const selectedKeySet = new Set(selectedKeys);
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      selectedKeySet.has(exercise.key)
        ? {
            ...exercise,
            targetSets: matchRounds ? rounds : exercise.targetSets,
            setConfig: normalizeSetConfiguration(exercise.setConfig, matchRounds ? rounds : exercise.targetSets),
            supersetGroup: group,
          }
        : exercise
    ),
  };
}

/** Selecting any member of an existing superset selects that whole group. */
export function expandSupersetSelection(workout: WorkoutDraft, keys: string[]): string[] {
  const groups = new Set(
    workout.exercises
      .filter((exercise) => keys.includes(exercise.key) && exercise.supersetGroup)
      .map((exercise) => exercise.supersetGroup as string)
  );
  return [...new Set([
    ...keys,
    ...workout.exercises
      .filter((exercise) => exercise.supersetGroup && groups.has(exercise.supersetGroup))
      .map((exercise) => exercise.key),
  ])];
}

export function removeSupersetMember(workout: WorkoutDraft, key: string): WorkoutDraft {
  const group = workout.exercises.find((exercise) => exercise.key === key)?.supersetGroup;
  if (!group) return workout;
  const remaining = workout.exercises.filter((exercise) => exercise.supersetGroup === group && exercise.key !== key);
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.key === key || (remaining.length < 2 && exercise.supersetGroup === group)
        ? { ...exercise, supersetGroup: null }
        : exercise
    ),
  };
}

export function ungroupExercise(workout: WorkoutDraft, key: string): WorkoutDraft {
  const group = workout.exercises.find((exercise) => exercise.key === key)?.supersetGroup;
  if (!group) {
    return workout;
  }
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.supersetGroup === group ? { ...exercise, supersetGroup: null } : exercise
    ),
  };
}

export function renameWorkout(workout: WorkoutDraft, name: string): WorkoutDraft {
  return { ...workout, name };
}

export function updateWorkout(
  draft: PlanDraft,
  key: string,
  patch: Partial<Pick<WorkoutDraft, 'name'>>
): PlanDraft {
  return {
    ...draft,
    workouts: draft.workouts.map((workout) =>
      workout.key === key ? { ...workout, ...patch } : workout
    ),
  };
}

/** Converts the draft into the shape the data access layer expects. */
export function toNewPlan(draft: PlanDraft): NewPlan {
  const workoutIndexByKey = new Map<string, number>();
  draft.workouts.forEach((workout, index) => workoutIndexByKey.set(workout.key, index));

  const schedule: NewPlan['schedule'] = [];
  for (const entry of draft.schedule) {
    const workoutIndex = workoutIndexByKey.get(entry.workoutKey);
    if (workoutIndex === undefined) {
      continue;
    }
    schedule.push({ dayOfWeek: entry.dayOfWeek, workoutIndex });
  }

  return {
    name: draft.name.trim().length > 0 ? draft.name.trim() : 'Untitled plan',
    splitType: draft.splitType,
    weeklyFrequency: draft.weeklyFrequency,
    workouts: draft.workouts.map((workout) => ({
      name: workout.name.trim().length > 0 ? workout.name.trim() : 'Workout',
      exercises: workout.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        targetSets: exercise.targetSets,
        repRangeMin: exercise.repRangeMin,
        repRangeMax: exercise.repRangeMax,
        restSeconds: exercise.restSeconds,
        setConfig: normalizeSetConfiguration(exercise.setConfig, exercise.targetSets),
        supersetGroup: exercise.supersetGroup,
      })),
    })),
    schedule,
  };
}

/** The problems that stop a plan from being saved. */
export type PlanDraftErrors = {
  name?: string;
  workouts?: string;
  exercises?: string;
};

export function validatePlanDraft(draft: PlanDraft): PlanDraftErrors {
  const errors: PlanDraftErrors = {};

  if (draft.name.trim().length === 0) {
    errors.name = 'Give the plan a name';
  }

  if (draft.workouts.length === 0) {
    errors.workouts = 'Add at least one workout';
  } else if (draft.workouts.every((workout) => workout.exercises.length === 0)) {
    errors.exercises = 'Add at least one exercise to a workout';
  }

  return errors;
}
