import type { SQLiteDatabase } from 'expo-sqlite';

export type Exercise = {
  id: number;
  name: string;
  muscleGroup: string;
  equipment: string;
  instructions: string | null;
  createdAt: number;
  updatedAt: number;
};

export type NewExercise = {
  name: string;
  muscleGroup: string;
  equipment: string;
  instructions?: string | null;
};

type ExerciseRow = {
  id: number;
  name: string;
  muscle_group: string;
  equipment: string;
  instructions: string | null;
  created_at: number;
  updated_at: number;
};

function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
    instructions: row.instructions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listExercises(db: SQLiteDatabase): Promise<Exercise[]> {
  const rows = await db.getAllAsync<ExerciseRow>(
    'SELECT * FROM exercises ORDER BY name COLLATE NOCASE ASC'
  );
  return rows.map(toExercise);
}

/**
 * Searches the library.
 *
 * The search covers the name, the muscle group and the equipment, so
 * "barbell" or "chest" both find something useful.
 */
export async function searchExercises(
  db: SQLiteDatabase,
  query: string
): Promise<Exercise[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return listExercises(db);
  }
  const pattern = `%${trimmed.toLowerCase()}%`;
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT * FROM exercises
      WHERE lower(name) LIKE ?
         OR lower(muscle_group) LIKE ?
         OR lower(equipment) LIKE ?
      ORDER BY
        CASE WHEN lower(name) LIKE ? THEN 0 ELSE 1 END,
        name COLLATE NOCASE ASC`,
    pattern,
    pattern,
    pattern,
    `${trimmed.toLowerCase()}%`
  );
  return rows.map(toExercise);
}

export async function getExercise(
  db: SQLiteDatabase,
  id: number
): Promise<Exercise | null> {
  const row = await db.getFirstAsync<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', id);
  return row ? toExercise(row) : null;
}

export async function createExercise(
  db: SQLiteDatabase,
  input: NewExercise
): Promise<Exercise> {
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO exercises (name, muscle_group, equipment, instructions, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    input.name,
    input.muscleGroup,
    input.equipment,
    input.instructions ?? null,
    now,
    now
  );
  const created = await getExercise(db, result.lastInsertRowId);
  if (!created) {
    throw new Error('Exercise could not be read back after insert.');
  }
  return created;
}

export async function updateExercise(
  db: SQLiteDatabase,
  id: number,
  input: NewExercise
): Promise<Exercise | null> {
  await db.runAsync(
    `UPDATE exercises
        SET name = ?, muscle_group = ?, equipment = ?, instructions = ?, updated_at = ?
      WHERE id = ?`,
    input.name,
    input.muscleGroup,
    input.equipment,
    input.instructions ?? null,
    Date.now(),
    id
  );
  return getExercise(db, id);
}

/**
 * Deletes an exercise.
 *
 * Exercises that are referenced by a plan or by logged sets are protected by a
 * foreign key with `ON DELETE RESTRICT`; the statement throws in that case.
 */
export async function deleteExercise(db: SQLiteDatabase, id: number): Promise<boolean> {
  const result = await db.runAsync('DELETE FROM exercises WHERE id = ?', id);
  return result.changes > 0;
}

/** Finds an exercise by its exact name, or `null`. */
export async function findExerciseByName(
  db: SQLiteDatabase,
  name: string
): Promise<Exercise | null> {
  const row = await db.getFirstAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE name = ? COLLATE NOCASE',
    name
  );
  return row ? toExercise(row) : null;
}
