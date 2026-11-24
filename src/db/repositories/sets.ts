import type { SQLiteDatabase } from 'expo-sqlite';

export type LoggedSet = {
  id: number;
  sessionId: number;
  exerciseId: number;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  isCompleted: boolean;
  completedAt: number;
  setKind?: 'straight' | 'warmup' | 'drop' | 'amrap';
  plannedSetNumber?: number | null;
  segmentNumber?: number;
  supersetRound?: number | null;
};

export type NewLoggedSet = {
  sessionId: number;
  exerciseId: number;
  setNumber: number;
  weightKg?: number | null;
  reps?: number | null;
  rpe?: number | null;
  isCompleted?: boolean;
  completedAt?: number;
  setKind?: LoggedSet['setKind'];
  plannedSetNumber?: number | null;
  segmentNumber?: number;
  supersetRound?: number | null;
};

type LoggedSetRow = {
  id: number;
  session_id: number;
  exercise_id: number;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  is_completed: number;
  completed_at: number;
  set_kind: LoggedSet['setKind'];
  planned_set_number: number | null;
  segment_number: number;
  superset_round: number | null;
};

function toLoggedSet(row: LoggedSetRow): LoggedSet {
  return {
    id: row.id,
    sessionId: row.session_id,
    exerciseId: row.exercise_id,
    setNumber: row.set_number,
    weightKg: row.weight_kg,
    reps: row.reps,
    rpe: row.rpe,
    isCompleted: row.is_completed === 1,
    completedAt: row.completed_at,
    setKind: row.set_kind ?? 'straight',
    plannedSetNumber: row.planned_set_number ?? null,
    segmentNumber: row.segment_number ?? 1,
    supersetRound: row.superset_round ?? null,
  };
}

/**
 * Records a set.
 *
 * The set number is unique per session and exercise, so logging the same set
 * twice replaces the earlier entry instead of duplicating it.
 */
export async function logSet(
  db: SQLiteDatabase,
  input: NewLoggedSet
): Promise<LoggedSet> {
  const completedAt = input.completedAt ?? Date.now();

  await db.runAsync(
    `INSERT INTO logged_sets
       (session_id, exercise_id, set_number, weight_kg, reps, rpe, is_completed, completed_at,
        set_kind, planned_set_number, segment_number, superset_round)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_id, exercise_id, set_number) DO UPDATE SET
       weight_kg = excluded.weight_kg,
       reps = excluded.reps,
       rpe = excluded.rpe,
       is_completed = excluded.is_completed,
       completed_at = excluded.completed_at,
       set_kind = excluded.set_kind,
       planned_set_number = excluded.planned_set_number,
       segment_number = excluded.segment_number,
       superset_round = excluded.superset_round`,
    input.sessionId,
    input.exerciseId,
    input.setNumber,
    input.weightKg ?? null,
    input.reps ?? null,
    input.rpe ?? null,
    (input.isCompleted ?? true) ? 1 : 0,
    completedAt,
    input.setKind ?? 'straight',
    input.plannedSetNumber ?? input.setNumber,
    input.segmentNumber ?? 1,
    input.supersetRound ?? null
  );

  const row = await db.getFirstAsync<LoggedSetRow>(
    'SELECT * FROM logged_sets WHERE session_id = ? AND exercise_id = ? AND set_number = ?',
    input.sessionId,
    input.exerciseId,
    input.setNumber
  );
  if (!row) {
    throw new Error('Logged set could not be read back after insert.');
  }
  return toLoggedSet(row);
}

export async function getSetsForSession(
  db: SQLiteDatabase,
  sessionId: number
): Promise<LoggedSet[]> {
  const rows = await db.getAllAsync<LoggedSetRow>(
    'SELECT * FROM logged_sets WHERE session_id = ? ORDER BY exercise_id ASC, set_number ASC',
    sessionId
  );
  return rows.map(toLoggedSet);
}

/** How many sets have been logged for one exercise in a session. */
export async function countSetsForExerciseInSession(
  db: SQLiteDatabase,
  sessionId: number,
  exerciseId: number
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT count(*) AS count FROM logged_sets WHERE session_id = ? AND exercise_id = ? AND is_completed = 1',
    sessionId,
    exerciseId
  );
  return row?.count ?? 0;
}

export async function getSetsForExercise(
  db: SQLiteDatabase,
  exerciseId: number,
  limit = 100
): Promise<LoggedSet[]> {
  const rows = await db.getAllAsync<LoggedSetRow>(
    'SELECT * FROM logged_sets WHERE exercise_id = ? AND is_completed = 1 ORDER BY completed_at DESC LIMIT ?',
    exerciseId,
    limit
  );
  return rows.map(toLoggedSet);
}

export async function deleteSet(db: SQLiteDatabase, id: number): Promise<boolean> {
  const result = await db.runAsync('DELETE FROM logged_sets WHERE id = ?', id);
  return result.changes > 0;
}

/** Adds a new logged set for the given session and exercise. */
export async function addSet(
  db: SQLiteDatabase,
  input: { sessionId: number; exerciseId: number; setNumber: number; weightKg?: number | null; reps?: number | null; rpe?: number | null; setKind?: LoggedSet['setKind']; plannedSetNumber?: number | null; segmentNumber?: number; supersetRound?: number | null }
): Promise<LoggedSet> {
  const completedAt = Date.now();
  await db.runAsync(
    `INSERT INTO logged_sets
       (session_id, exercise_id, set_number, weight_kg, reps, rpe, is_completed, completed_at,
        set_kind, planned_set_number, segment_number, superset_round)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    input.sessionId,
    input.exerciseId,
    input.setNumber,
    input.weightKg ?? null,
    input.reps ?? null,
    input.rpe ?? null,
    completedAt,
    input.setKind ?? 'straight',
    input.plannedSetNumber ?? input.setNumber,
    input.segmentNumber ?? 1,
    input.supersetRound ?? null
  );
  const row = await db.getFirstAsync<LoggedSetRow>(
    'SELECT * FROM logged_sets WHERE session_id = ? AND exercise_id = ? AND set_number = ?',
    input.sessionId,
    input.exerciseId,
    input.setNumber
  );
  if (!row) {
    throw new Error('Logged set could not be read back after insert.');
  }
  return toLoggedSet(row);
}

/** Removes a logged set by its ID. */
export async function removeSet(
  db: SQLiteDatabase,
  setId: number
): Promise<boolean> {
  const result = await db.runAsync('DELETE FROM logged_sets WHERE id = ?', setId);
  return result.changes > 0;
}
