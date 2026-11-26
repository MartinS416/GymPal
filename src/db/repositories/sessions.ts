import type { SQLiteDatabase } from 'expo-sqlite';

import { runInTransaction } from '@/db/transaction';
import { getWorkout } from '@/db/repositories/workouts';
import { getExercise } from '@/db/repositories/exercises';
import { startOfDay } from '@/lib/calendar';
import type { ExerciseSetConfiguration } from '@/workouts/set-types';
import { normalizeSetConfiguration } from '@/workouts/set-types';

export type SessionStatus = 'planned' | 'in_progress' | 'completed' | 'abandoned';

export type SessionExerciseStatus = 'pending' | 'completed' | 'skipped';

export type WorkoutSession = {
  id: number;
  planId: number | null;
  workoutId: number | null;
  title: string | null;
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number | null;
  status: SessionStatus;
  notes: string | null;
  /** The exercise the user is on, used to resume a session. */
  currentExerciseId: number | null;
  /** When the rest timer runs out. A timestamp, so it survives backgrounding. */
  restEndsAt: number | null;
  /** When the current run of rest started. */
  restStartedAt: number | null;
  /** Rest time banked so far, in seconds. */
  restTotalSeconds: number;
  /** Work time performed across the whole session, in seconds. */
  workTotalSeconds: number;
  /** When the current run of work started. Null while resting. */
  exerciseStartedAt: number | null;
  /** Work time banked for the current set, in seconds. */
  exerciseElapsedSeconds: number;
  /** Which phase of the workout the session is on. */
  phaseIndex: number;
  createdAt: number;
  updatedAt: number;
};

export type SessionSummary = WorkoutSession & {
  setsLogged: number;
  totalVolumeKg: number;
};

export type SessionExercise = {
  id: number;
  sessionId: number;
  exerciseId: number;
  workoutExerciseId: number | null;
  name: string;
  muscleGroup: string;
  equipment: string;
  position: number;
  status: SessionExerciseStatus;
  targetSets: number;
  repRangeMin: number;
  repRangeMax: number;
  restSeconds: number;
  setConfig?: ExerciseSetConfiguration;
  supersetGroup?: string | null;
};

export type LoggedSetSummary = {
  id: number;
  exerciseId: number;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  completedAt: number;
  setKind: 'straight' | 'warmup' | 'drop' | 'amrap';
  plannedSetNumber: number | null;
  segmentNumber: number;
  supersetRound: number | null;
  isCompleted: boolean;
};

export type SessionDetail = WorkoutSession & {
  exercises: SessionExercise[];
  sets: LoggedSetSummary[];
  setsLogged: number;
  totalVolumeKg: number;
};

export type PreviousPerformance = {
  sessionId: number;
  startedAt: number;
  sets: {
    setNumber: number;
    weightKg: number | null;
    reps: number | null;
    rpe: number | null;
  }[];
};

type SessionRow = {
  id?: number;
  session_id?: number;
  plan_id: number | null;
  workout_id: number | null;
  title: string | null;
  started_at: number;
  ended_at: number | null;
  duration_seconds: number | null;
  status: SessionStatus;
  notes: string | null;
  current_exercise_id: number | null;
  rest_ends_at: number | null;
  rest_started_at: number | null;
  rest_total_seconds: number;
  work_total_seconds: number;
  exercise_started_at: number | null;
  exercise_elapsed_seconds: number;
  phase_index: number;
  created_at: number;
  updated_at: number;
};

type SummaryRow = SessionRow & {
  sets_logged: number;
  total_volume_kg: number;
};

type SessionExerciseRow = {
  id: number;
  session_id: number;
  exercise_id: number;
  workout_exercise_id: number | null;
  name: string;
  muscle_group: string;
  equipment: string;
  position: number;
  status: SessionExerciseStatus;
  target_sets: number;
  rep_range_min: number;
  rep_range_max: number;
  rest_seconds: number;
  set_config_json: string;
  superset_group: string | null;
};

function toSession(row: SessionRow): WorkoutSession {
  return {
    id: (row.id ?? row.session_id) as number,
    planId: row.plan_id,
    workoutId: row.workout_id,
    title: row.title,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    status: row.status,
    notes: row.notes,
    currentExerciseId: row.current_exercise_id,
    restEndsAt: row.rest_ends_at,
    restStartedAt: row.rest_started_at ?? null,
    restTotalSeconds: row.rest_total_seconds ?? 0,
    workTotalSeconds: row.work_total_seconds ?? 0,
    exerciseStartedAt: row.exercise_started_at ?? null,
    exerciseElapsedSeconds: row.exercise_elapsed_seconds ?? 0,
    phaseIndex: row.phase_index ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSessionExercise(row: SessionExerciseRow): SessionExercise {
  return {
    id: row.id,
    sessionId: row.session_id,
    exerciseId: row.exercise_id,
    workoutExerciseId: row.workout_exercise_id,
    name: row.name,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
    position: row.position,
    status: row.status,
    targetSets: row.target_sets,
    repRangeMin: row.rep_range_min,
    repRangeMax: row.rep_range_max,
    restSeconds: row.rest_seconds,
    setConfig: normalizeSetConfiguration(row.set_config_json, row.target_sets),
    supersetGroup: row.superset_group,
  };
}

/**
 * Starts a session.
 *
 * The start timestamp is written immediately, and the exercises of the workout
 * are copied into the session so the workout keeps its own history even if the
 * plan changes later.
 */
export async function startSession(
  db: SQLiteDatabase,
  input: { workoutId?: number | null; planId?: number | null; title?: string | null; startedAt?: number }
): Promise<WorkoutSession> {
  const now = Date.now();
  const startedAt = input.startedAt ?? now;

  const sessionId = await runInTransaction(db, async (txn) => {
    const workout = input.workoutId ? await getWorkout(txn, input.workoutId) : null;

    const result = await txn.runAsync(
      `INSERT INTO workout_sessions
         (plan_id, workout_id, title, started_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'in_progress', ?, ?)`,
      input.planId ?? workout?.planId ?? null,
      input.workoutId ?? null,
      input.title ?? workout?.name ?? null,
      startedAt,
      now,
      now
    );
    const newSessionId = result.lastInsertRowId;

    if (workout) {
      for (const [index, exercise] of workout.exercises.entries()) {
        await txn.runAsync(
          `INSERT INTO session_exercises
             (session_id, exercise_id, workout_exercise_id, position, status,
              name, muscle_group, equipment, target_sets, rep_range_min, rep_range_max,
              rest_seconds, set_config_json, superset_group)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newSessionId,
          exercise.exerciseId,
          exercise.id,
          index,
          exercise.name,
          exercise.muscleGroup,
          exercise.equipment,
          exercise.targetSets,
          exercise.repRangeMin,
          exercise.repRangeMax,
          exercise.restSeconds,
          JSON.stringify(exercise.setConfig),
          exercise.supersetGroup
        );
      }
      const first = workout.exercises[0];
      if (first) {
        await txn.runAsync(
          `UPDATE workout_sessions
              SET current_exercise_id = ?, exercise_started_at = ?, exercise_elapsed_seconds = 0
            WHERE id = ?`,
          first.exerciseId,
          startedAt,
          newSessionId
        );
      }
    }

    return newSessionId;
  });

  const session = await getSession(db, sessionId);
  if (!session) {
    throw new Error('Session could not be read back after starting.');
  }
  return session;
}

export async function getSession(
  db: SQLiteDatabase,
  id: number
): Promise<WorkoutSession | null> {
  const row = await db.getFirstAsync<SessionRow>(
    'SELECT * FROM workout_sessions WHERE id = ?',
    id
  );
  return row ? toSession(row) : null;
}

/** The session that is still running, if there is one. */
export async function getActiveSession(db: SQLiteDatabase): Promise<WorkoutSession | null> {
  const row = await db.getFirstAsync<SessionRow>(
    "SELECT * FROM workout_sessions WHERE status = 'in_progress' ORDER BY started_at DESC LIMIT 1"
  );
  return row ? toSession(row) : null;
}

export async function getSessionExercises(
  db: SQLiteDatabase,
  sessionId: number
): Promise<SessionExercise[]> {
  const rows = await db.getAllAsync<SessionExerciseRow>(
    `SELECT se.*, COALESCE(NULLIF(se.name, ''), e.name) AS name,
            COALESCE(NULLIF(se.muscle_group, ''), e.muscle_group) AS muscle_group,
            COALESCE(NULLIF(se.equipment, ''), e.equipment) AS equipment,
            se.target_sets AS target_sets,
            se.rep_range_min AS rep_range_min,
            se.rep_range_max AS rep_range_max,
            se.rest_seconds AS rest_seconds
       FROM session_exercises se
       JOIN exercises e ON e.id = se.exercise_id
      WHERE se.session_id = ?
      ORDER BY se.position ASC`,
    sessionId
  );
  return rows.map(toSessionExercise);
}

export async function getSessionSets(
  db: SQLiteDatabase,
  sessionId: number
): Promise<LoggedSetSummary[]> {
  const rows = await db.getAllAsync<Omit<LoggedSetSummary, 'isCompleted'> & { isCompleted: number }>(
    `SELECT id,
            exercise_id  AS exerciseId,
            set_number   AS setNumber,
            weight_kg    AS weightKg,
            reps,
            rpe,
            completed_at AS completedAt,
            set_kind AS setKind,
            planned_set_number AS plannedSetNumber,
            segment_number AS segmentNumber,
            superset_round AS supersetRound,
            is_completed AS isCompleted
       FROM logged_sets
      WHERE session_id = ?
      ORDER BY exercise_id ASC, set_number ASC`,
    sessionId
  );
  return rows.map((row) => ({ ...row, isCompleted: row.isCompleted === 1 }));
}

/** The full picture of a session: the exercises, the sets and the totals. */
export async function getSessionDetail(
  db: SQLiteDatabase,
  id: number
): Promise<SessionDetail | null> {
  const session = await getSession(db, id);
  if (!session) {
    return null;
  }
  const exercises = await getSessionExercises(db, id);
  const sets = await getSessionSets(db, id);
  const totalVolumeKg = sets.reduce(
    (total, set) => total + (set.isCompleted ? (set.weightKg ?? 0) * (set.reps ?? 0) : 0),
    0
  );
  return {
    ...session,
    exercises,
    sets,
    setsLogged: sets.filter((set) => set.isCompleted).length,
    totalVolumeKg,
  };
}

/**
 * Moves the session to a new phase.
 *
 * The clock of the phase being left is banked, and the clock of the phase
 * being entered starts. The rest timer is a moment in time, so it keeps
 * counting — and keeps counting past the end — while the app is in the
 * background.
 *
 * A phase of kind "work" is the start of a set, so it starts the work clock
 * over: the clock then measures the set in progress, not the sets before it.
 */
export async function switchSessionPhase(
  db: SQLiteDatabase,
  sessionId: number,
  next: {
    kind: 'work' | 'rest';
    restSeconds: number;
    phaseIndex: number;
    exerciseId?: number;
    /** True when the timeline is finished and the clock should stop. */
    stop?: boolean;
  }
): Promise<void> {
  const now = Date.now();
  const session = await getSession(db, sessionId);
  const isWork = next.kind === 'work' && !next.stop;
  const isRest = next.kind === 'rest' && !next.stop;

  // Bank whatever run of work and rest is ending before the next one starts.
  const workSeconds = session?.exerciseStartedAt
    ? Math.max(0, Math.floor((now - session.exerciseStartedAt) / 1000))
    : 0;
  const restSeconds = session?.restStartedAt
    ? Math.max(0, Math.floor((now - session.restStartedAt) / 1000))
    : 0;
  const exerciseElapsedSeconds = isWork || next.stop
    ? 0
    : (session?.exerciseElapsedSeconds ?? 0) + workSeconds;

  await db.runAsync(
    `UPDATE workout_sessions
        SET work_total_seconds = work_total_seconds + ?,
            rest_total_seconds = rest_total_seconds + ?,
            exercise_elapsed_seconds = ?,
            exercise_started_at = ?,
            rest_started_at = ?,
            rest_ends_at = ?,
            phase_index = ?,
            current_exercise_id = COALESCE(?, current_exercise_id),
            updated_at = ?
      WHERE id = ?`,
    workSeconds,
    restSeconds,
    exerciseElapsedSeconds,
    isWork ? now : null,
    isRest ? now : null,
    isRest ? now + Math.max(0, next.restSeconds) * 1000 : null,
    next.phaseIndex,
    next.exerciseId ?? null,
    now,
    sessionId
  );
}

/**
 * Records where the user is, so a session can be picked up again.
 *
 * Moving to an exercise starts its clock over: the work time belongs to the
 * exercise, not to the session.
 */
export async function setCurrentExercise(
  db: SQLiteDatabase,
  sessionId: number,
  exerciseId: number | null
): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `UPDATE workout_sessions
        SET current_exercise_id = ?,
            exercise_elapsed_seconds = 0,
            exercise_started_at = ?,
            updated_at = ?
      WHERE id = ?`,
    exerciseId,
    now,
    now,
    sessionId
  );
}

/**
 * Starts the rest timer.
 *
 * The work clock is paused and banked, so the two clocks never overlap.
 */
export async function startRestTimer(
  db: SQLiteDatabase,
  sessionId: number,
  seconds: number
): Promise<number> {
  const now = Date.now();
  const restEndsAt = now + Math.max(0, seconds) * 1000;

  await db.runAsync(
    `UPDATE workout_sessions
        SET exercise_elapsed_seconds = exercise_elapsed_seconds + MAX(0, (? - exercise_started_at)) / 1000,
            exercise_started_at = NULL,
            rest_started_at = ?,
            rest_ends_at = ?,
            updated_at = ?
      WHERE id = ?`,
    now,
    now,
    restEndsAt,
    now,
    sessionId
  );

  return restEndsAt;
}

/**
 * Ends the rest.
 *
 * The rest that was taken is banked and the work clock starts again — over,
 * for the set that comes next.
 */
export async function endRestTimer(db: SQLiteDatabase, sessionId: number): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `UPDATE workout_sessions
        SET rest_total_seconds = rest_total_seconds + MAX(0, (? - rest_started_at)) / 1000,
            rest_started_at = NULL,
            rest_ends_at = NULL,
            exercise_elapsed_seconds = 0,
            exercise_started_at = ?,
            updated_at = ?
      WHERE id = ?`,
    now,
    now,
    now,
    sessionId
  );
}

/**
 * Adds time to the rest timer.
 *
 * The rest that was taken is still banked when the timer is extended, so the
 * total rest time stays honest.
 */
export async function extendRestTimer(
  db: SQLiteDatabase,
  sessionId: number,
  seconds: number
): Promise<number> {
  const session = await getSession(db, sessionId);
  const base = session?.restEndsAt ?? Date.now();
  const restEndsAt = base + Math.max(0, seconds) * 1000;

  await db.runAsync(
    'UPDATE workout_sessions SET rest_ends_at = ?, updated_at = ? WHERE id = ?',
    restEndsAt,
    Date.now(),
    sessionId
  );

  return restEndsAt;
}

/** Marks an exercise as done or skipped. */
export async function setSessionExerciseStatus(
  db: SQLiteDatabase,
  sessionId: number,
  position: number,
  status: SessionExerciseStatus
): Promise<void> {
  await db.runAsync(
    'UPDATE session_exercises SET status = ? WHERE session_id = ? AND position = ?',
    status,
    sessionId,
    position
  );
}

/** Adds a new exercise to the session at the given position. */
export async function addSessionExercise(
  db: SQLiteDatabase,
  input: { sessionId: number; exerciseId: number; position: number; name: string; muscleGroup: string; equipment: string; targetSets: number; repRangeMin: number; repRangeMax: number; restSeconds: number; setConfig?: ExerciseSetConfiguration; supersetGroup?: string | null }
): Promise<void> {
  await db.runAsync(
    `INSERT INTO session_exercises
       (session_id, exercise_id, workout_exercise_id, position, status, name, muscle_group, equipment, target_sets, rep_range_min, rep_range_max, rest_seconds, set_config_json, superset_group)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.sessionId,
    input.exerciseId,
    null,
    input.position,
    input.name,
    input.muscleGroup,
    input.equipment,
    input.targetSets,
    input.repRangeMin,
    input.repRangeMax,
    input.restSeconds,
    JSON.stringify(input.setConfig ?? normalizeSetConfiguration(undefined, input.targetSets)),
    input.supersetGroup ?? null
  );
}

/** Removes an exercise from the session by position. */
export async function removeSessionExercise(
  db: SQLiteDatabase,
  sessionId: number,
  position: number
): Promise<void> {
  await db.runAsync(
    'DELETE FROM session_exercises WHERE session_id = ? AND position = ?',
    sessionId,
    position
  );
}

/** Swaps two exercises' positions in the session. */
export async function swapSessionExercisePositions(
  db: SQLiteDatabase,
  sessionId: number,
  fromPosition: number,
  toPosition: number
): Promise<void> {
  if (fromPosition === toPosition) {
    return;
  }

  // The position has a UNIQUE(session_id, position) constraint. A CASE update
  // can still visit rows one at a time and collide with the other row's old
  // position, so move one row out of the way before assigning either slot.
  await runInTransaction(db, async (txn) => {
    const temporaryPosition = await txn.getFirstAsync<{ position: number }>(
      'SELECT COALESCE(MAX(position), -1) + 1 AS position FROM session_exercises WHERE session_id = ?',
      sessionId
    );
    const temporary = temporaryPosition?.position ?? 0;

    await txn.runAsync(
      'UPDATE session_exercises SET position = ? WHERE session_id = ? AND position = ?',
      temporary,
      sessionId,
      fromPosition
    );
    await txn.runAsync(
      'UPDATE session_exercises SET position = ? WHERE session_id = ? AND position = ?',
      fromPosition,
      sessionId,
      toPosition
    );
    await txn.runAsync(
      'UPDATE session_exercises SET position = ? WHERE session_id = ? AND position = ?',
      toPosition,
      sessionId,
      temporary
    );
  });
}

/**
 * Swaps the exercise a session exercise row points at, keeping its position.
 *
 * The prescription the user started with (sets, rep range, rest) stays; only
 * the movement itself changes.
 */
export async function swapSessionExercise(
  db: SQLiteDatabase,
  sessionId: number,
  position: number,
  exerciseId: number
): Promise<void> {
  const exercise = await getExercise(db, exerciseId);
  if (!exercise) {
    throw new Error('Exercise not found.');
  }
  await db.runAsync(
    `UPDATE session_exercises
        SET exercise_id = ?, name = ?, muscle_group = ?, equipment = ?,
            target_sets = target_sets, rep_range_min = rep_range_min,
            rep_range_max = rep_range_max, rest_seconds = rest_seconds
      WHERE session_id = ? AND position = ?`,
    exerciseId,
    exercise.name,
    exercise.muscleGroup,
    exercise.equipment,
    sessionId,
    position
  );
}

/**
 * Points the session at a phase index directly.
 *
 * Used after the exercise list of a session has been reordered, so the phase
 * clock lands on the same exercise even though the indices shifted.
 */
export async function setSessionPhaseIndex(
  db: SQLiteDatabase,
  sessionId: number,
  phaseIndex: number
): Promise<void> {
  await db.runAsync(
    'UPDATE workout_sessions SET phase_index = ?, updated_at = ? WHERE id = ?',
    phaseIndex,
    Date.now(),
    sessionId
  );
}

/**
 * Closes a session.
 *
 * The duration is derived from the start and end times so it can never
 * disagree with them.
 */
export async function completeSession(
  db: SQLiteDatabase,
  id: number,
  input: { endedAt?: number; notes?: string | null }
): Promise<WorkoutSession | null> {
  const session = await getSession(db, id);
  if (!session) {
    return null;
  }

  const endedAt = input.endedAt ?? Date.now();
  const durationSeconds = Math.max(0, Math.round((endedAt - session.startedAt) / 1000));

  await db.runAsync(
    `UPDATE workout_sessions
        SET status = 'completed', ended_at = ?, duration_seconds = ?, notes = ?, rest_ends_at = NULL, updated_at = ?
      WHERE id = ?`,
    endedAt,
    durationSeconds,
    input.notes ?? session.notes,
    Date.now(),
    id
  );

  return getSession(db, id);
}

/**
 * Marks a session as abandoned.
 *
 * The sets that were logged are kept: an abandoned session still happened, and
 * the data is only removed if the user explicitly discards it.
 */
export async function abandonSession(
  db: SQLiteDatabase,
  id: number
): Promise<WorkoutSession | null> {
  const session = await getSession(db, id);
  if (!session) {
    return null;
  }
  const endedAt = Date.now();
  await db.runAsync(
    `UPDATE workout_sessions
        SET status = 'abandoned', ended_at = ?, duration_seconds = ?, rest_ends_at = NULL, updated_at = ?
      WHERE id = ?`,
    endedAt,
    Math.max(0, Math.round((endedAt - session.startedAt) / 1000)),
    Date.now(),
    id
  );
  return getSession(db, id);
}

export type ListSessionsOptions = {
  limit?: number;
  offset?: number;
  status?: SessionStatus;
};

export async function listSessions(
  db: SQLiteDatabase,
  options: ListSessionsOptions = {}
): Promise<SessionSummary[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 500));
  const offset = Math.max(0, options.offset ?? 0);

  const rows = options.status
    ? await db.getAllAsync<SummaryRow>(
        'SELECT * FROM session_summary WHERE status = ? ORDER BY started_at DESC LIMIT ? OFFSET ?',
        options.status,
        limit,
        offset
      )
    : await db.getAllAsync<SummaryRow>(
        'SELECT * FROM session_summary ORDER BY started_at DESC LIMIT ? OFFSET ?',
        limit,
        offset
      );

  return rows.map((row) => ({
    ...toSession(row),
    setsLogged: row.sets_logged,
    totalVolumeKg: row.total_volume_kg,
  }));
}

export async function countCompletedSessions(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT count(*) AS count FROM workout_sessions WHERE status = 'completed'"
  );
  return row?.count ?? 0;
}

/**
 * Completed sessions started on or after `since`. Used by the home screen
 * widget to show how many workouts landed in a given period.
 */
export async function countCompletedSessionsSince(
  db: SQLiteDatabase,
  since: number
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT count(*) AS count FROM workout_sessions WHERE status = 'completed' AND started_at >= ?",
    since
  );
  return row?.count ?? 0;
}

/**
 * The days the user trained, as start-of-day timestamps, most recent first.
 *
 * A day counts as trained when a workout was actually logged in it — a session
 * with at least one logged set is a day that went to the gym.
 */
export async function getTrainedDays(
  db: SQLiteDatabase,
  limit = 92
): Promise<number[]> {
  const rows = await db.getAllAsync<{ started_at: number }>(
    `SELECT DISTINCT s.started_at AS started_at
       FROM workout_sessions s
      WHERE EXISTS (
        SELECT 1 FROM logged_sets ls WHERE ls.session_id = s.id AND ls.is_completed = 1
      )
      ORDER BY s.started_at DESC
      LIMIT ?`,
    Math.max(1, Math.min(limit, 400))
  );

  const days = new Set<number>();
  for (const row of rows) {
    days.add(startOfDay(row.started_at));
  }

  return [...days].sort((a, b) => b - a);
}

/**
 * The last time an exercise was performed, so the user can see their previous
 * numbers while logging a new set.
 */
export async function getPreviousPerformance(
  db: SQLiteDatabase,
  exerciseId: number,
  options: { excludeSessionId?: number; limit?: number } = {}
): Promise<PreviousPerformance | null> {
  const limit = Math.max(1, Math.min(options.limit ?? 5, 50));

  const rows = await db.getAllAsync<{
    session_id: number;
    started_at: number;
    set_number: number;
    weight_kg: number | null;
    reps: number | null;
    rpe: number | null;
  }>(
    `SELECT ls.session_id, s.started_at, ls.set_number, ls.weight_kg, ls.reps, ls.rpe
       FROM logged_sets ls
       JOIN workout_sessions s ON s.id = ls.session_id
      WHERE ls.exercise_id = ?
        AND s.status = 'completed'
        AND ls.is_completed = 1
        AND (? IS NULL OR s.id != ?)
      ORDER BY s.started_at DESC, ls.set_number ASC
      LIMIT ?`,
    exerciseId,
    options.excludeSessionId ?? null,
    options.excludeSessionId ?? null,
    limit
  );

  if (rows.length === 0) {
    return null;
  }

  const sessionId = rows[0].session_id;
  return {
    sessionId,
    startedAt: rows[0].started_at,
    sets: rows
      .filter((row) => row.session_id === sessionId)
      .map((row) => ({
        setNumber: row.set_number,
        weightKg: row.weight_kg,
        reps: row.reps,
        rpe: row.rpe,
      })),
  };
}
