import type { SQLiteDatabase } from 'expo-sqlite';

import { runInTransaction } from '@/db/transaction';

export type RecordType = 'max_weight' | 'max_reps' | 'best_estimated_1rm';

export type PersonalRecord = {
  exerciseId: number;
  recordType: RecordType;
  value: number;
  achievedAt: number;
  sessionId: number | null;
};

export type ExerciseProgress = {
  exerciseId: number;
  sessionsLogged: number;
  maxWeightKg: number | null;
  maxReps: number | null;
  totalVolumeKg: number;
  lastLoggedAt: number | null;
};

type PersonalRecordRow = {
  exercise_id: number;
  record_type: RecordType;
  value: number;
  achieved_at: number;
  session_id: number | null;
};

type ProgressRow = {
  exercise_id: number;
  sessions_logged: number;
  max_weight_kg: number | null;
  max_reps: number | null;
  total_volume_kg: number;
  last_logged_at: number | null;
};

/**
 * Epley estimate of a one rep max.
 *
 * `weight * (1 + reps / 30)`, the standard formula, and only meaningful for
 * reps between 1 and 12.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0 || reps > 12) {
    return null;
  }
  return weightKg * (1 + reps / 30);
}

export async function getPersonalRecords(
  db: SQLiteDatabase
): Promise<PersonalRecord[]> {
  const rows = await db.getAllAsync<PersonalRecordRow>(
    'SELECT * FROM personal_records ORDER BY exercise_id ASC, record_type ASC'
  );
  return rows.map((row) => ({
    exerciseId: row.exercise_id,
    recordType: row.record_type,
    value: row.value,
    achievedAt: row.achieved_at,
    sessionId: row.session_id,
  }));
}

export async function getPersonalRecord(
  db: SQLiteDatabase,
  exerciseId: number,
  recordType: RecordType
): Promise<PersonalRecord | null> {
  const row = await db.getFirstAsync<PersonalRecordRow>(
    'SELECT * FROM personal_records WHERE exercise_id = ? AND record_type = ?',
    exerciseId,
    recordType
  );
  if (!row) {
    return null;
  }
  return {
    exerciseId: row.exercise_id,
    recordType: row.record_type,
    value: row.value,
    achievedAt: row.achieved_at,
    sessionId: row.session_id,
  };
}

export async function getExerciseProgress(
  db: SQLiteDatabase
): Promise<ExerciseProgress[]> {
  const rows = await db.getAllAsync<ProgressRow>(
    'SELECT * FROM exercise_progress ORDER BY last_logged_at DESC'
  );
  return rows.map((row) => ({
    exerciseId: row.exercise_id,
    sessionsLogged: row.sessions_logged,
    maxWeightKg: row.max_weight_kg,
    maxReps: row.max_reps,
    totalVolumeKg: row.total_volume_kg,
    lastLoggedAt: row.last_logged_at,
  }));
}

/**
 * Recalculates the personal records for one exercise from the logged sets.
 *
 * Personal records are derived data: they are recomputed from the sets of
 * completed sessions rather than being written by hand, so they can never
 * drift away from the history they came from.
 */
export async function recalculatePersonalRecords(
  db: SQLiteDatabase,
  exerciseId: number
): Promise<PersonalRecord[]> {
  const row = await db.getFirstAsync<{
    max_weight_kg: number | null;
    max_reps: number | null;
    best_estimated_1rm: number | null;
    best_1rm_at: number | null;
    best_weight_at: number | null;
    best_reps_at: number | null;
  }>(
    `SELECT
       MAX(ls.weight_kg)                                        AS max_weight_kg,
       MAX(ls.reps)                                             AS max_reps,
       MAX(ls.weight_kg * (1 + ls.reps / 30.0))                 AS best_estimated_1rm,
       MAX(CASE WHEN ls.weight_kg * (1 + ls.reps / 30.0) =
                     (SELECT MAX(ls2.weight_kg * (1 + ls2.reps / 30.0))
                        FROM logged_sets ls2
                       WHERE ls2.exercise_id = ls.exercise_id
                         AND ls2.weight_kg IS NOT NULL
                         AND ls2.reps BETWEEN 1 AND 12)
                   THEN ls.completed_at END)                    AS best_1rm_at,
       MAX(CASE WHEN ls.weight_kg = (SELECT MAX(ls3.weight_kg)
                                        FROM logged_sets ls3
                                       WHERE ls3.exercise_id = ls.exercise_id)
                   THEN ls.completed_at END)                    AS best_weight_at,
       MAX(CASE WHEN ls.reps = (SELECT MAX(ls4.reps)
                                   FROM logged_sets ls4
                                  WHERE ls4.exercise_id = ls.exercise_id)
                   THEN ls.completed_at END)                    AS best_reps_at
     FROM logged_sets ls
     JOIN workout_sessions s ON s.id = ls.session_id
    WHERE ls.exercise_id = ?
      AND s.status = 'completed'
      AND ls.is_completed = 1`,
    exerciseId
  );

  const candidates: { type: RecordType; value: number | null; at: number | null }[] = [
    { type: 'max_weight', value: row?.max_weight_kg ?? null, at: row?.best_weight_at ?? null },
    { type: 'max_reps', value: row?.max_reps ?? null, at: row?.best_reps_at ?? null },
    {
      type: 'best_estimated_1rm',
      value: row?.best_estimated_1rm ?? null,
      at: row?.best_1rm_at ?? null,
    },
  ];

  await runInTransaction(db, async (txn) => {
    for (const candidate of candidates) {
      if (candidate.value === null || candidate.at === null) {
        await txn.runAsync(
          'DELETE FROM personal_records WHERE exercise_id = ? AND record_type = ?',
          exerciseId,
          candidate.type
        );
        continue;
      }

      await txn.runAsync(
        `INSERT INTO personal_records (exercise_id, record_type, value, achieved_at, session_id)
         VALUES (?, ?, ?, ?, NULL)
         ON CONFLICT (exercise_id, record_type) DO UPDATE SET
           value = excluded.value,
           achieved_at = excluded.achieved_at`,
        exerciseId,
        candidate.type,
        candidate.value,
        candidate.at
      );
    }
  });

  return getPersonalRecords(db).then((records) =>
    records.filter((record) => record.exerciseId === exerciseId)
  );
}

/**
 * Recalculates the personal records of every exercise touched by a session.
 */
export async function recalculateRecordsForSession(
  db: SQLiteDatabase,
  sessionId: number
): Promise<void> {
  const rows = await db.getAllAsync<{ exercise_id: number }>(
    'SELECT DISTINCT exercise_id FROM logged_sets WHERE session_id = ?',
    sessionId
  );
  for (const row of rows) {
    await recalculatePersonalRecords(db, row.exercise_id);
  }
}
