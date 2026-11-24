import type { SQLiteDatabase } from 'expo-sqlite';

import { runInTransaction } from '@/db/transaction';
import type { ManualEntry, SessionAggregate, MetricPreference } from '@/workouts/progress';

export type ProgressKind = 'body_weight' | 'exercise';

/** An entry the user recorded by hand. */
export type ProgressEntry = {
  id: number;
  kind: ProgressKind;
  exerciseId: number | null;
  exerciseName: string | null;
  muscleGroup: string | null;
  valueKg: number;
  recordedAt: number;
  note: string | null;
  createdAt: number;
  updatedAt: number;
};

export type NewProgressEntry = {
  kind: ProgressKind;
  exerciseId?: number | null;
  valueKg: number;
  /** Defaults to now. */
  recordedAt?: number;
  note?: string | null;
};

export type ProgressEntryChanges = {
  valueKg?: number;
  recordedAt?: number;
  note?: string | null;
};

type ProgressEntryRow = {
  id: number;
  kind: ProgressKind;
  exercise_id: number | null;
  exercise_name: string | null;
  muscle_group: string | null;
  value_kg: number;
  recorded_at: number;
  note: string | null;
  created_at: number;
  updated_at: number;
};

type SessionAggregateRow = {
  exercise_id: number;
  exercise_name: string;
  muscle_group: string | null;
  session_id: number;
  started_at: number;
  max_weight_kg: number | null;
  max_reps: number | null;
  set_count: number;
  volume_kg: number;
  one_rep_max_kg: number | null;
};

type MetricPreferenceRow = {
  key: string;
  pinned: number;
  position: number;
};

const MAX_NOTE_LENGTH = 280;

function toProgressEntry(row: ProgressEntryRow): ProgressEntry {
  return {
    id: row.id,
    kind: row.kind,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    muscleGroup: row.muscle_group,
    valueKg: row.value_kg,
    recordedAt: row.recorded_at,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeNote(note: string | null | undefined): string | null {
  if (note === undefined || note === null) {
    return null;
  }
  const trimmed = note.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, MAX_NOTE_LENGTH);
}

function assertValue(valueKg: number): void {
  if (!Number.isFinite(valueKg) || valueKg <= 0 || valueKg >= 1000) {
    throw new Error('A progress value must be between 0 and 1000 kg.');
  }
}

/** Every hand-recorded entry, oldest first. */
export async function listProgressEntries(db: SQLiteDatabase): Promise<ProgressEntry[]> {
  const rows = await db.getAllAsync<ProgressEntryRow>(
    `SELECT pe.*, e.name AS exercise_name, e.muscle_group
       FROM progress_entries pe
       LEFT JOIN exercises e ON e.id = pe.exercise_id
      ORDER BY pe.recorded_at ASC, pe.id ASC`
  );
  return rows.map(toProgressEntry);
}

export async function getProgressEntry(
  db: SQLiteDatabase,
  id: number
): Promise<ProgressEntry | null> {
  const row = await db.getFirstAsync<ProgressEntryRow>(
    `SELECT pe.*, e.name AS exercise_name, e.muscle_group
       FROM progress_entries pe
       LEFT JOIN exercises e ON e.id = pe.exercise_id
      WHERE pe.id = ?`,
    id
  );
  return row ? toProgressEntry(row) : null;
}

export async function addProgressEntry(
  db: SQLiteDatabase,
  input: NewProgressEntry
): Promise<ProgressEntry> {
  assertValue(input.valueKg);

  if (input.kind === 'exercise' && (input.exerciseId === undefined || input.exerciseId === null)) {
    throw new Error('An exercise entry needs an exercise.');
  }

  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO progress_entries (kind, exercise_id, value_kg, recorded_at, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.kind,
    input.kind === 'exercise' ? (input.exerciseId as number) : null,
    input.valueKg,
    input.recordedAt ?? now,
    normalizeNote(input.note),
    now,
    now
  );

  const entry = await getProgressEntry(db, result.lastInsertRowId);
  if (!entry) {
    throw new Error('The entry could not be read back after saving.');
  }
  return entry;
}

export async function updateProgressEntry(
  db: SQLiteDatabase,
  id: number,
  changes: ProgressEntryChanges
): Promise<ProgressEntry | null> {
  const existing = await getProgressEntry(db, id);
  if (!existing) {
    return null;
  }

  const valueKg = changes.valueKg ?? existing.valueKg;
  assertValue(valueKg);

  await db.runAsync(
    `UPDATE progress_entries
        SET value_kg = ?, recorded_at = ?, note = ?, updated_at = ?
      WHERE id = ?`,
    valueKg,
    changes.recordedAt ?? existing.recordedAt,
    changes.note === undefined ? existing.note : normalizeNote(changes.note),
    Date.now(),
    id
  );

  return getProgressEntry(db, id);
}

export async function deleteProgressEntry(db: SQLiteDatabase, id: number): Promise<boolean> {
  const result = await db.runAsync('DELETE FROM progress_entries WHERE id = ?', id);
  return result.changes > 0;
}

/**
 * One row per exercise per completed session.
 *
 * This is the only place workout history is reshaped for the charts, so the
 * dashboard, the detail charts and the tests all read the same numbers. Only
 * completed sets count: a set the user skipped never happened.
 */
export async function listSessionAggregates(db: SQLiteDatabase): Promise<SessionAggregate[]> {
  const rows = await db.getAllAsync<SessionAggregateRow>(
    `SELECT ls.exercise_id            AS exercise_id,
            e.name                    AS exercise_name,
            e.muscle_group            AS muscle_group,
            s.id                      AS session_id,
            s.started_at              AS started_at,
            MAX(ls.weight_kg)         AS max_weight_kg,
            MAX(ls.reps)              AS max_reps,
            COUNT(*)                  AS set_count,
            COALESCE(SUM(COALESCE(ls.weight_kg, 0) * COALESCE(ls.reps, 0)), 0) AS volume_kg,
            MAX(CASE
                  WHEN ls.weight_kg > 0 AND ls.reps BETWEEN 1 AND 12
                  THEN ls.weight_kg * (1 + ls.reps / 30.0)
                END)                  AS one_rep_max_kg
       FROM logged_sets ls
       JOIN workout_sessions s ON s.id = ls.session_id
       JOIN exercises e ON e.id = ls.exercise_id
      WHERE s.status = 'completed' AND ls.is_completed = 1
      GROUP BY ls.exercise_id, s.id
      ORDER BY s.started_at ASC`
  );

  return rows.map((row) => ({
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    muscleGroup: row.muscle_group,
    sessionId: row.session_id,
    at: row.started_at,
    maxWeightKg: row.max_weight_kg,
    maxReps: row.max_reps,
    sets: row.set_count,
    volumeKg: row.volume_kg,
    oneRepMaxKg: row.one_rep_max_kg,
  }));
}

/** The manual entries, in the shape the progress model expects. */
export function toManualEntry(entry: ProgressEntry): ManualEntry {
  return {
    id: entry.id,
    kind: entry.kind,
    exerciseId: entry.exerciseId,
    exerciseName: entry.exerciseName,
    muscleGroup: entry.muscleGroup,
    valueKg: entry.valueKg,
    recordedAt: entry.recordedAt,
    note: entry.note,
  };
}

// Pinned metrics -----------------------------------------------------------

export async function listMetricPreferences(db: SQLiteDatabase): Promise<MetricPreference[]> {
  const rows = await db.getAllAsync<MetricPreferenceRow>(
    'SELECT key, pinned, position FROM metric_preferences ORDER BY position ASC'
  );
  return rows.map((row) => ({
    key: row.key,
    pinned: row.pinned === 1,
    position: row.position,
  }));
}

/**
 * Stores the pinned list.
 *
 * Every key that is not in the list is kept but marked unpinned, so the app can
 * tell "the user unpinned everything" from "the user has never chosen". One
 * statement per key, inside a transaction: the order is never half written.
 */
export async function savePinnedMetrics(
  db: SQLiteDatabase,
  keys: string[]
): Promise<void> {
  const now = Date.now();

  await runInTransaction(db, async (txn) => {
    await txn.runAsync('UPDATE metric_preferences SET pinned = 0, updated_at = ?', now);

    for (let index = 0; index < keys.length; index += 1) {
      await txn.runAsync(
        `INSERT INTO metric_preferences (key, pinned, position, updated_at)
         VALUES (?, 1, ?, ?)
         ON CONFLICT (key) DO UPDATE
           SET pinned = 1, position = excluded.position, updated_at = excluded.updated_at`,
        keys[index],
        index,
        now
      );
    }
  });
}
