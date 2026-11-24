/**
 * Migration 2 — workouts inside a plan, and the state of an active session.
 *
 * Stage 2 modelled a plan as a single workout. A split such as upper/lower or
 * push/pull/legs is several workouts in a week, so the plan now owns workouts,
 * each workout owns its exercises, and each training day points at one
 * workout.
 *
 * A session also needs to remember where the user got to, so that an
 * interrupted workout can be picked up again.
 */
export const up = `
-- 1. The workouts that make up a plan -------------------------------------
CREATE TABLE workouts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id     INTEGER NOT NULL REFERENCES workout_plans (id) ON DELETE CASCADE,
  name        TEXT    NOT NULL CHECK (length(trim(name)) > 0),
  position    INTEGER NOT NULL CHECK (position >= 0),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (plan_id, position)
);

CREATE INDEX idx_workouts_plan ON workouts (plan_id);

-- Give every existing plan one workout, so nothing is lost.
INSERT INTO workouts (plan_id, name, position, created_at, updated_at)
SELECT p.id, p.name, 0, p.created_at, p.updated_at
  FROM workout_plans p;

-- 2. The exercises of a workout ---------------------------------------------
CREATE TABLE workout_exercises (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id      INTEGER NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
  exercise_id     INTEGER NOT NULL REFERENCES exercises (id) ON DELETE RESTRICT,
  position        INTEGER NOT NULL CHECK (position >= 0),
  target_sets     INTEGER NOT NULL CHECK (target_sets BETWEEN 1 AND 20),
  rep_range_min   INTEGER NOT NULL CHECK (rep_range_min BETWEEN 0 AND 100),
  rep_range_max   INTEGER NOT NULL CHECK (rep_range_max BETWEEN 0 AND 100),
  rest_seconds    INTEGER NOT NULL CHECK (rest_seconds BETWEEN 0 AND 1800),
  UNIQUE (workout_id, position),
  CHECK (rep_range_max >= rep_range_min)
);

CREATE INDEX idx_workout_exercises_workout ON workout_exercises (workout_id);
CREATE INDEX idx_workout_exercises_exercise ON workout_exercises (exercise_id);

-- Move the planned exercises onto their workout.
INSERT INTO workout_exercises
  (workout_id, exercise_id, position, target_sets, rep_range_min, rep_range_max, rest_seconds)
SELECT w.id, pe.exercise_id, pe.position, pe.target_sets, pe.rep_range_min, pe.rep_range_max, pe.rest_seconds
  FROM planned_exercises pe
  JOIN workouts w ON w.plan_id = pe.plan_id AND w.position = 0;

DROP TABLE planned_exercises;

-- 3. The schedule points at a workout ---------------------------------------
CREATE TABLE plan_schedule_migrated (
  plan_id      INTEGER NOT NULL REFERENCES workout_plans (id) ON DELETE CASCADE,
  workout_id   INTEGER NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  position     INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  PRIMARY KEY (plan_id, day_of_week)
);

INSERT INTO plan_schedule_migrated (plan_id, workout_id, day_of_week, position)
SELECT ps.plan_id, w.id, ps.day_of_week, ps.position
  FROM plan_schedule ps
  JOIN workouts w ON w.plan_id = ps.plan_id AND w.position = 0;

DROP TABLE plan_schedule;
ALTER TABLE plan_schedule_migrated RENAME TO plan_schedule;

CREATE INDEX idx_plan_schedule_plan ON plan_schedule (plan_id);
CREATE INDEX idx_plan_schedule_workout ON plan_schedule (workout_id);

-- 4. Where the user got to in a session ------------------------------------
CREATE TABLE session_exercises (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id          INTEGER NOT NULL REFERENCES workout_sessions (id) ON DELETE CASCADE,
  exercise_id         INTEGER NOT NULL REFERENCES exercises (id) ON DELETE CASCADE,
  workout_exercise_id INTEGER REFERENCES workout_exercises (id) ON DELETE SET NULL,
  position            INTEGER NOT NULL CHECK (position >= 0),
  status              TEXT    NOT NULL CHECK (status IN ('pending', 'completed', 'skipped')),
  UNIQUE (session_id, position)
);

CREATE INDEX idx_session_exercises_session ON session_exercises (session_id);
CREATE INDEX idx_session_exercises_exercise ON session_exercises (exercise_id);

-- 5. The session keeps the workout it came from, the exercise in focus and
--    the rest timer. The rest timer is a timestamp, not a countdown, so it
--    survives the app being backgrounded.
ALTER TABLE workout_sessions ADD COLUMN workout_id INTEGER REFERENCES workouts (id) ON DELETE SET NULL;
ALTER TABLE workout_sessions ADD COLUMN rest_ends_at INTEGER;
ALTER TABLE workout_sessions ADD COLUMN current_exercise_id INTEGER REFERENCES exercises (id) ON DELETE SET NULL;

CREATE INDEX idx_sessions_workout ON workout_sessions (workout_id);

-- 6. The session summary carries the new columns ---------------------------
DROP VIEW session_summary;

CREATE VIEW session_summary AS
SELECT
  s.id                AS session_id,
  s.plan_id           AS plan_id,
  s.workout_id        AS workout_id,
  s.title             AS title,
  s.started_at        AS started_at,
  s.ended_at          AS ended_at,
  s.duration_seconds  AS duration_seconds,
  s.status            AS status,
  COUNT(ls.id)                          AS sets_logged,
  COALESCE(SUM(ls.weight_kg * ls.reps), 0) AS total_volume_kg
FROM workout_sessions s
LEFT JOIN logged_sets ls ON ls.session_id = s.id
GROUP BY s.id;
`;
