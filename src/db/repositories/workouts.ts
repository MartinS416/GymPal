import type { SQLiteDatabase } from 'expo-sqlite';
import type { ExerciseSetConfiguration } from '@/workouts/set-types';
import { normalizeSetConfiguration } from '@/workouts/set-types';

export type WorkoutExercise = {
  id: number;
  exerciseId: number;
  name: string;
  muscleGroup: string;
  equipment: string;
  position: number;
  targetSets: number;
  repRangeMin: number;
  repRangeMax: number;
  restSeconds: number;
  setConfig: ExerciseSetConfiguration;
  supersetGroup: string | null;
};

export type Workout = {
  id: number;
  planId: number;
  name: string;
  position: number;
};

export type WorkoutWithExercises = Workout & {
  exercises: WorkoutExercise[];
};

/** A workout as it appears in a list: enough to choose between them. */
export type WorkoutSummary = Workout & {
  /** The plan the workout was built in. */
  planName: string;
  exerciseCount: number;
  /** The sets planned across every exercise. */
  setCount: number;
};

export type NewWorkoutExercise = {
  exerciseId: number;
  targetSets: number;
  repRangeMin: number;
  repRangeMax: number;
  restSeconds: number;
  setConfig?: ExerciseSetConfiguration;
  supersetGroup?: string | null;
};

export type NewWorkout = {
  name: string;
  exercises: NewWorkoutExercise[];
};

type WorkoutRow = {
  id: number;
  plan_id: number;
  name: string;
  position: number;
};

type WorkoutExerciseRow = {
  id: number;
  workout_id: number;
  exercise_id: number;
  name: string;
  muscle_group: string;
  equipment: string;
  position: number;
  target_sets: number;
  rep_range_min: number;
  rep_range_max: number;
  rest_seconds: number;
  set_config_json: string;
  superset_group: string | null;
};

function toWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    planId: row.plan_id,
    name: row.name,
    position: row.position,
  };
}

function toWorkoutExercise(row: WorkoutExerciseRow): WorkoutExercise {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    name: row.name,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
    position: row.position,
    targetSets: row.target_sets,
    repRangeMin: row.rep_range_min,
    repRangeMax: row.rep_range_max,
    restSeconds: row.rest_seconds,
    setConfig: normalizeSetConfiguration(row.set_config_json, row.target_sets),
    supersetGroup: row.superset_group,
  };
}

const EXERCISE_SELECT = `
  SELECT we.*, e.name, e.muscle_group, e.equipment
    FROM workout_exercises we
    JOIN exercises e ON e.id = we.exercise_id`;

export async function listWorkoutsForPlan(
  db: SQLiteDatabase,
  planId: number
): Promise<Workout[]> {
  const rows = await db.getAllAsync<WorkoutRow>(
    'SELECT * FROM workouts WHERE plan_id = ? ORDER BY position ASC',
    planId
  );
  return rows.map(toWorkout);
}

export async function getWorkout(
  db: SQLiteDatabase,
  id: number
): Promise<WorkoutWithExercises | null> {
  const row = await db.getFirstAsync<WorkoutRow>('SELECT * FROM workouts WHERE id = ?', id);
  if (!row) {
    return null;
  }
  const exercises = await db.getAllAsync<WorkoutExerciseRow>(
    `${EXERCISE_SELECT} WHERE we.workout_id = ? ORDER BY we.position ASC`,
    id
  );
  return { ...toWorkout(row), exercises: exercises.map(toWorkoutExercise) };
}

/** The days of the week a workout is scheduled on. */
export async function getWorkoutSchedule(
  db: SQLiteDatabase,
  workoutId: number
): Promise<number[]> {
  const rows = await db.getAllAsync<{ day_of_week: number }>(
    'SELECT day_of_week FROM plan_schedule WHERE workout_id = ? ORDER BY position ASC, day_of_week ASC',
    workoutId
  );
  return rows.map((row) => row.day_of_week);
}

/**
 * Every workout the user has built, across all plans.
 *
 * This is what the start screen picks from: the workouts themselves, in the
 * order they were created, rather than the plans that hold them.
 */
export async function listWorkouts(db: SQLiteDatabase): Promise<WorkoutSummary[]> {
  const rows = await db.getAllAsync<WorkoutRow & {
    plan_name: string;
    exercise_count: number;
    set_count: number;
  }>(
    `SELECT w.*, p.name AS plan_name,
            COUNT(we.id) AS exercise_count,
            COALESCE(SUM(we.target_sets), 0) AS set_count
       FROM workouts w
       JOIN workout_plans p ON p.id = w.plan_id
       LEFT JOIN workout_exercises we ON we.workout_id = w.id
      GROUP BY w.id
      ORDER BY w.plan_id ASC, w.position ASC`
  );

  const configurations = await db.getAllAsync<{
    workout_id: number;
    target_sets: number;
    set_config_json: string;
  }>(
    `SELECT workout_id, target_sets, set_config_json FROM workout_exercises
      WHERE workout_id IN (SELECT id FROM workouts)`
  );
  const setCountByWorkout = new Map<number, number>();
  for (const row of configurations) {
    const config = normalizeSetConfiguration(row.set_config_json, row.target_sets);
    const count = row.target_sets + config.warmups.length + config.workSets.reduce(
      (drops, set) => drops + set.dropSteps.length,
      0
    );
    setCountByWorkout.set(row.workout_id, (setCountByWorkout.get(row.workout_id) ?? 0) + count);
  }

  return rows.map((row) => ({
    ...toWorkout(row),
    planName: row.plan_name,
    exerciseCount: row.exercise_count,
    setCount: setCountByWorkout.get(row.id) ?? row.set_count,
  }));
}

/** The workout scheduled on a given day of the week, if any. */
export async function getWorkoutForDay(
  db: SQLiteDatabase,
  dayOfWeek: number
): Promise<WorkoutWithExercises | null> {
  const row = await db.getFirstAsync<WorkoutRow>(
    `SELECT w.* FROM workouts w
       JOIN plan_schedule ps ON ps.workout_id = w.id
      WHERE ps.day_of_week = ?
      ORDER BY w.plan_id ASC, w.position ASC
      LIMIT 1`,
    dayOfWeek
  );
  if (!row) {
    return null;
  }
  return getWorkout(db, row.id);
}

/** The workout scheduled for today, if any. */
export async function getWorkoutForToday(
  db: SQLiteDatabase
): Promise<WorkoutWithExercises | null> {
  return getWorkoutForDay(db, new Date().getDay());
}
