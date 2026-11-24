import type { SplitType } from '@/db/repositories/plans';

/**
 * Split templates.
 *
 * These are starting points, not prescriptions. The builder labels everything
 * it generates as a suggestion and every value can be changed.
 */

export type TemplateExercise = {
  /** Matches the name of an exercise in the local library. */
  name: string;
  targetSets: number;
  repRangeMin: number;
  repRangeMax: number;
  restSeconds: number;
};

export type TemplateWorkout = {
  name: string;
  exercises: TemplateExercise[];
};

export type SplitTemplate = {
  splitType: SplitType;
  label: string;
  summary: string;
  workouts: TemplateWorkout[];
};

const FULL_BODY: TemplateWorkout = {
  name: 'Full Body',
  exercises: [
    { name: 'Back Squat', targetSets: 3, repRangeMin: 6, repRangeMax: 8, restSeconds: 150 },
    { name: 'Bench Press', targetSets: 3, repRangeMin: 6, repRangeMax: 8, restSeconds: 150 },
    { name: 'Barbell Row', targetSets: 3, repRangeMin: 8, repRangeMax: 10, restSeconds: 120 },
    { name: 'Overhead Press', targetSets: 3, repRangeMin: 6, repRangeMax: 10, restSeconds: 120 },
    { name: 'Lat Pulldown', targetSets: 3, repRangeMin: 8, repRangeMax: 12, restSeconds: 90 },
    { name: 'Plank', targetSets: 3, repRangeMin: 30, repRangeMax: 60, restSeconds: 60 },
  ],
};

const UPPER: TemplateWorkout = {
  name: 'Upper',
  exercises: [
    { name: 'Bench Press', targetSets: 4, repRangeMin: 6, repRangeMax: 8, restSeconds: 150 },
    { name: 'Barbell Row', targetSets: 4, repRangeMin: 8, repRangeMax: 10, restSeconds: 120 },
    { name: 'Overhead Press', targetSets: 3, repRangeMin: 6, repRangeMax: 10, restSeconds: 120 },
    { name: 'Lat Pulldown', targetSets: 3, repRangeMin: 8, repRangeMax: 12, restSeconds: 90 },
    { name: 'Dumbbell Hammer Curl', targetSets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 60 },
    { name: 'Triceps Pushdown', targetSets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 60 },
  ],
};

const LOWER: TemplateWorkout = {
  name: 'Lower',
  exercises: [
    { name: 'Back Squat', targetSets: 4, repRangeMin: 6, repRangeMax: 8, restSeconds: 180 },
    { name: 'Romanian Deadlift', targetSets: 3, repRangeMin: 8, repRangeMax: 10, restSeconds: 150 },
    { name: 'Leg Press', targetSets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 120 },
    { name: 'Lying Leg Curl', targetSets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 90 },
    { name: 'Leg Press Calf Raise', targetSets: 4, repRangeMin: 12, repRangeMax: 15, restSeconds: 60 },
    { name: 'Hip Thrust', targetSets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 90 },
  ],
};

const PUSH: TemplateWorkout = {
  name: 'Push',
  exercises: [
    { name: 'Bench Press', targetSets: 4, repRangeMin: 6, repRangeMax: 8, restSeconds: 150 },
    { name: 'Overhead Press', targetSets: 3, repRangeMin: 6, repRangeMax: 10, restSeconds: 120 },
    { name: 'Incline Bench Press', targetSets: 3, repRangeMin: 8, repRangeMax: 12, restSeconds: 120 },
    { name: 'Lateral Raise', targetSets: 3, repRangeMin: 12, repRangeMax: 15, restSeconds: 60 },
    { name: 'Cable Fly', targetSets: 3, repRangeMin: 12, repRangeMax: 15, restSeconds: 60 },
    { name: 'Triceps Pushdown', targetSets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 60 },
  ],
};

const PULL: TemplateWorkout = {
  name: 'Pull',
  exercises: [
    { name: 'Deadlift', targetSets: 3, repRangeMin: 3, repRangeMax: 5, restSeconds: 180 },
    { name: 'Barbell Row', targetSets: 4, repRangeMin: 6, repRangeMax: 8, restSeconds: 120 },
    { name: 'Lat Pulldown', targetSets: 3, repRangeMin: 8, repRangeMax: 12, restSeconds: 90 },
    { name: 'Face Pull', targetSets: 3, repRangeMin: 12, repRangeMax: 15, restSeconds: 60 },
    { name: 'Barbell Curl', targetSets: 3, repRangeMin: 8, repRangeMax: 12, restSeconds: 60 },
    { name: 'Straight-Arm Pulldown', targetSets: 3, repRangeMin: 12, repRangeMax: 15, restSeconds: 60 },
  ],
};

const LEGS: TemplateWorkout = {
  name: 'Legs',
  exercises: [
    { name: 'Back Squat', targetSets: 4, repRangeMin: 6, repRangeMax: 8, restSeconds: 180 },
    { name: 'Romanian Deadlift', targetSets: 3, repRangeMin: 8, repRangeMax: 10, restSeconds: 150 },
    { name: 'Leg Press', targetSets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 120 },
    { name: 'Walking Lunge', targetSets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 90 },
    { name: 'Lying Leg Curl', targetSets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 90 },
    { name: 'Leg Press Calf Raise', targetSets: 4, repRangeMin: 12, repRangeMax: 15, restSeconds: 60 },
  ],
};

const CHEST: TemplateWorkout = {
  name: 'Chest & Triceps',
  exercises: [
    { name: 'Bench Press', targetSets: 4, repRangeMin: 6, repRangeMax: 8, restSeconds: 150 },
    { name: 'Incline Bench Press', targetSets: 3, repRangeMin: 8, repRangeMax: 12, restSeconds: 120 },
    { name: 'Dumbbell Bench Press', targetSets: 3, repRangeMin: 8, repRangeMax: 12, restSeconds: 120 },
    { name: 'Cable Fly', targetSets: 3, repRangeMin: 12, repRangeMax: 15, restSeconds: 60 },
    { name: 'Close-Grip Bench Press', targetSets: 3, repRangeMin: 8, repRangeMax: 10, restSeconds: 120 },
    { name: 'Triceps Pushdown', targetSets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 60 },
  ],
};

const BACK: TemplateWorkout = {
  name: 'Back & Biceps',
  exercises: [
    { name: 'Deadlift', targetSets: 3, repRangeMin: 3, repRangeMax: 5, restSeconds: 180 },
    { name: 'Barbell Row', targetSets: 4, repRangeMin: 6, repRangeMax: 8, restSeconds: 120 },
    { name: 'Pull-Up', targetSets: 3, repRangeMin: 6, repRangeMax: 10, restSeconds: 120 },
    { name: 'Seated Cable Row', targetSets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 90 },
    { name: 'Barbell Curl', targetSets: 3, repRangeMin: 8, repRangeMax: 12, restSeconds: 60 },
    { name: 'Hammer Curl', targetSets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 60 },
  ],
};

const SHOULDERS: TemplateWorkout = {
  name: 'Shoulders & Traps',
  exercises: [
    { name: 'Overhead Press', targetSets: 4, repRangeMin: 6, repRangeMax: 10, restSeconds: 150 },
    { name: 'Seated Dumbbell Press', targetSets: 3, repRangeMin: 8, repRangeMax: 12, restSeconds: 120 },
    { name: 'Lateral Raise', targetSets: 4, repRangeMin: 12, repRangeMax: 15, restSeconds: 60 },
    { name: 'Face Pull', targetSets: 3, repRangeMin: 12, repRangeMax: 15, restSeconds: 60 },
    { name: 'Upright Row', targetSets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 60 },
    { name: 'Dumbbell Shrug', targetSets: 3, repRangeMin: 10, repRangeMax: 15, restSeconds: 60 },
  ],
};

export const SPLIT_TEMPLATES: SplitTemplate[] = [
  {
    splitType: 'full_body',
    label: 'Full body',
    summary: 'One workout that hits everything.',
    workouts: [FULL_BODY],
  },
  {
    splitType: 'upper_lower',
    label: 'Upper / lower',
    summary: 'Two workouts, alternating.',
    workouts: [UPPER, LOWER],
  },
  {
    splitType: 'push_pull_legs',
    label: 'Push / pull / legs',
    summary: 'The classic three day split.',
    workouts: [PUSH, PULL, LEGS],
  },
  {
    splitType: 'bro_split',
    label: 'Bro split',
    summary: 'Four workouts, one body part each.',
    workouts: [CHEST, BACK, SHOULDERS, LEGS],
  },
];

/** The days of the week, Monday first. */
export const WEEKDAYS = [
  { value: 1, label: 'Mon', long: 'Monday' },
  { value: 2, label: 'Tue', long: 'Tuesday' },
  { value: 3, label: 'Wed', long: 'Wednesday' },
  { value: 4, label: 'Thu', long: 'Thursday' },
  { value: 5, label: 'Fri', long: 'Friday' },
  { value: 6, label: 'Sat', long: 'Saturday' },
  { value: 0, label: 'Sun', long: 'Sunday' },
];

/** The days used when a frequency is chosen, starting on Monday. */
export function daysForFrequency(frequency: number): number[] {
  return WEEKDAYS.slice(0, Math.max(1, Math.min(7, frequency))).map((day) => day.value);
}

/** The template behind a split, if there is one. */
export function templateFor(splitType: SplitType): SplitTemplate | undefined {
  return SPLIT_TEMPLATES.find((template) => template.splitType === splitType);
}

/**
 * The template for one workout of a split.
 *
 * A split is built one workout at a time, so the generator needs to know which
 * workout of the split it is filling in.
 */
export function templateWorkoutFor(
  splitType: SplitType,
  index: number
): TemplateWorkout | undefined {
  return templateFor(splitType)?.workouts[index];
}

/** The names of the workouts a split is made of. */
export function splitWorkoutNames(splitType: SplitType): string[] {
  const template = templateFor(splitType);
  if (template) {
    return template.workouts.map((workout) => workout.name);
  }
  return ['Workout'];
}

/** A sensible name for a plan of this split. */
export function defaultPlanName(splitType: SplitType): string {
  switch (splitType) {
    case 'full_body':
      return 'Full body';
    case 'upper_lower':
      return 'Upper / lower';
    case 'push_pull_legs':
      return 'Push / pull / legs';
    case 'bro_split':
      return 'Bro split';
    case 'custom':
      return 'My plan';
  }
}