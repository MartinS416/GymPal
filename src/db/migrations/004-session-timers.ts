/**
 * Migration 4 — work time and rest time.
 *
 * The active workout shows two clocks: the time spent working on the current
 * exercise, and the time spent resting. Both are stored so the session can be
 * closed and picked up again without losing either.
 *
 * The work clock is paused while the user rests, so it is kept in two parts:
 * the seconds already banked (`exercise_elapsed_seconds`) and the moment the
 * current run of work started (`exercise_started_at`, null while resting).
 */
export const up = `
ALTER TABLE workout_sessions ADD COLUMN exercise_started_at INTEGER;
ALTER TABLE workout_sessions ADD COLUMN exercise_elapsed_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workout_sessions ADD COLUMN rest_started_at INTEGER;
ALTER TABLE workout_sessions ADD COLUMN rest_total_seconds INTEGER NOT NULL DEFAULT 0;
`;
