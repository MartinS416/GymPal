import type { SQLiteDatabase } from 'expo-sqlite';

import { runInTransaction } from '@/db/transaction';
import type { NewWorkout, NewWorkoutExercise } from '@/db/repositories/workouts';

export type SplitType =
  | 'full_body'
  | 'upper_lower'
  | 'push_pull_legs'
  | 'bro_split'
  | 'custom';

export const SPLIT_TYPES: SplitType[] = [
  'full_body',
  'upper_lower',
  'push_pull_legs',
  'bro_split',
  'custom',
];

export type Plan = {
  id: number;
  name: string;
  splitType: SplitType;
  weeklyFrequency: number;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ScheduleEntry = {
  dayOfWeek: number;
  workoutId: number;
};

export type PlanWithDetails = Plan & {
  schedule: ScheduleEntry[];
};

export type NewPlan = {
  name: string;
  splitType: SplitType;
  weeklyFrequency: number;
  notes?: string | null;
  /** The workouts of the plan, in order. */
  workouts: NewWorkout[];
  /** Which workout is trained on which day. */
  schedule: { dayOfWeek: number; workoutIndex: number }[];
};

type PlanRow = {
  id: number;
  name: string;
  split_type: SplitType;
  weekly_frequency: number;
  notes: string | null;
  created_at: number;
  updated_at: number;
};

function toPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    splitType: row.split_type,
    weeklyFrequency: row.weekly_frequency,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPlans(db: SQLiteDatabase): Promise<Plan[]> {
  const rows = await db.getAllAsync<PlanRow>(
    'SELECT * FROM workout_plans ORDER BY created_at ASC'
  );
  return rows.map(toPlan);
}

export async function getPlan(
  db: SQLiteDatabase,
  id: number
): Promise<PlanWithDetails | null> {
  const row = await db.getFirstAsync<PlanRow>('SELECT * FROM workout_plans WHERE id = ?', id);
  if (!row) {
    return null;
  }

  const scheduleRows = await db.getAllAsync<{ day_of_week: number; workout_id: number }>(
    'SELECT day_of_week, workout_id FROM plan_schedule WHERE plan_id = ? ORDER BY position ASC, day_of_week ASC',
    id
  );

  return {
    ...toPlan(row),
    schedule: scheduleRows.map((scheduleRow) => ({
      dayOfWeek: scheduleRow.day_of_week,
      workoutId: scheduleRow.workout_id,
    })),
  };
}

/**
 * Writes a plan, its workouts, their exercises and the weekly schedule.
 *
 * The whole plan is one transaction, so a plan can never exist with a half
 * written schedule or a missing workout.
 */
export async function savePlan(
  db: SQLiteDatabase,
  input: NewPlan,
  planId?: number
): Promise<PlanWithDetails> {
  const now = Date.now();

  const savedPlanId = await runInTransaction(db, async (txn) => {
    let targetId = planId;

    if (targetId) {
      await txn.runAsync(
        `UPDATE workout_plans
            SET name = ?, split_type = ?, weekly_frequency = ?, notes = ?, updated_at = ?
          WHERE id = ?`,
        input.name,
        input.splitType,
        input.weeklyFrequency,
        input.notes ?? null,
        now,
        targetId
      );
      // The workouts and the schedule are rewritten from scratch.
      await txn.runAsync('DELETE FROM plan_schedule WHERE plan_id = ?', targetId);
      await txn.runAsync('DELETE FROM workouts WHERE plan_id = ?', targetId);
    } else {
      const result = await txn.runAsync(
        `INSERT INTO workout_plans (name, split_type, weekly_frequency, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        input.name,
        input.splitType,
        input.weeklyFrequency,
        input.notes ?? null,
        now,
        now
      );
      targetId = result.lastInsertRowId;
    }

    const workoutIds: number[] = [];

    for (const [index, workout] of input.workouts.entries()) {
      const workoutResult = await txn.runAsync(
        'INSERT INTO workouts (plan_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        targetId,
        workout.name,
        index,
        now,
        now
      );
      const workoutId = workoutResult.lastInsertRowId;
      workoutIds.push(workoutId);

      for (const [exerciseIndex, exercise] of workout.exercises.entries()) {
        await insertWorkoutExercise(txn, workoutId, exercise, exerciseIndex);
      }
    }

    for (const [index, entry] of input.schedule.entries()) {
      const workoutId = workoutIds[entry.workoutIndex];
      if (workoutId === undefined) {
        throw new Error('The schedule points at a workout that does not exist.');
      }
      await txn.runAsync(
        'INSERT INTO plan_schedule (plan_id, workout_id, day_of_week, position) VALUES (?, ?, ?, ?)',
        targetId,
        workoutId,
        entry.dayOfWeek,
        index
      );
    }

    return targetId;
  });

  const plan = await getPlan(db, savedPlanId);
  if (!plan) {
    throw new Error('Plan could not be read back after saving.');
  }
  return plan;
}

async function insertWorkoutExercise(
  txn: SQLiteDatabase,
  workoutId: number,
  exercise: NewWorkoutExercise,
  position: number
): Promise<void> {
  await txn.runAsync(
    `INSERT INTO workout_exercises
       (workout_id, exercise_id, position, target_sets, rep_range_min, rep_range_max, rest_seconds, set_config_json, superset_group)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    workoutId,
    exercise.exerciseId,
    position,
    exercise.targetSets,
    exercise.repRangeMin,
    exercise.repRangeMax,
    exercise.restSeconds,
    JSON.stringify(exercise.setConfig ?? { warmups: [], workSets: [] }),
    exercise.supersetGroup ?? null
  );
}

/**
 * Copies a plan, including its workouts, exercises and schedule.
 *
 * The copy is independent: changing it never touches the original.
 */
export async function duplicatePlan(
  db: SQLiteDatabase,
  planId: number
): Promise<PlanWithDetails | null> {
  const original = await getPlan(db, planId);
  if (!original) {
    return null;
  }

  const workoutRows = await db.getAllAsync<{
    id: number;
    name: string;
    position: number;
  }>('SELECT id, name, position FROM workouts WHERE plan_id = ? ORDER BY position ASC', planId);

  const exerciseRows = await db.getAllAsync<{
    workout_id: number;
    exercise_id: number;
    position: number;
    target_sets: number;
    rep_range_min: number;
    rep_range_max: number;
    rest_seconds: number;
    set_config_json: string;
    superset_group: string | null;
  }>(
    `SELECT workout_id, exercise_id, position, target_sets, rep_range_min, rep_range_max, rest_seconds, set_config_json, superset_group
       FROM workout_exercises
      WHERE workout_id IN (SELECT id FROM workouts WHERE plan_id = ?)
      ORDER BY workout_id ASC, position ASC`,
    planId
  );

  const oldToNewWorkoutId = new Map<number, number>();

  const copy = await runInTransaction(db, async (txn) => {
    const now = Date.now();
    const result = await txn.runAsync(
      `INSERT INTO workout_plans (name, split_type, weekly_frequency, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      `${original.name} (copy)`,
      original.splitType,
      original.weeklyFrequency,
      original.notes,
      now,
      now
    );
    const newPlanId = result.lastInsertRowId;

    for (const [index, workout] of workoutRows.entries()) {
      const workoutResult = await txn.runAsync(
        'INSERT INTO workouts (plan_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        newPlanId,
        workout.name,
        index,
        now,
        now
      );
      const newWorkoutId = workoutResult.lastInsertRowId;
      oldToNewWorkoutId.set(workout.id, newWorkoutId);

      for (const exercise of exerciseRows.filter((row) => row.workout_id === workout.id)) {
        await insertWorkoutExercise(
          txn,
          newWorkoutId,
          {
            exerciseId: exercise.exercise_id,
            targetSets: exercise.target_sets,
            repRangeMin: exercise.rep_range_min,
            repRangeMax: exercise.rep_range_max,
            restSeconds: exercise.rest_seconds,
            setConfig: JSON.parse(exercise.set_config_json || '{}'),
            supersetGroup: exercise.superset_group,
          },
          exercise.position
        );
      }
    }

    for (const [index, entry] of original.schedule.entries()) {
      const newWorkoutId = oldToNewWorkoutId.get(entry.workoutId);
      if (newWorkoutId === undefined) {
        continue;
      }
      await txn.runAsync(
        'INSERT INTO plan_schedule (plan_id, workout_id, day_of_week, position) VALUES (?, ?, ?, ?)',
        newPlanId,
        newWorkoutId,
        entry.dayOfWeek,
        index
      );
    }

    return newPlanId;
  });

  return getPlan(db, copy);
}

/**
 * Deletes a plan.
 *
 * The workouts and the schedule go with it. Past sessions keep their history
 * because `workout_sessions.plan_id` is `ON DELETE SET NULL`.
 */
export async function deletePlan(db: SQLiteDatabase, id: number): Promise<boolean> {
  const result = await db.runAsync('DELETE FROM workout_plans WHERE id = ?', id);
  return result.changes > 0;
}
