/**
 * Migration 1 — the initial schema.
 *
 * Every statement here runs inside a single transaction, so the database is
 * either fully created or not created at all.
 */
export const up = `
-- 1. User profile -------------------------------------------------------
-- A single row: the app supports exactly one local profile.
CREATE TABLE profile (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  name                TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 40),
  height_cm           REAL    NOT NULL CHECK (height_cm BETWEEN 100 AND 250),
  weight_kg           REAL    NOT NULL CHECK (weight_kg BETWEEN 25 AND 300),
  measurement_system  TEXT    NOT NULL CHECK (measurement_system IN ('metric', 'imperial')),
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);

-- 2. Exercises ----------------------------------------------------------
CREATE TABLE exercises (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  muscle_group  TEXT    NOT NULL CHECK (length(trim(muscle_group)) > 0),
  equipment     TEXT    NOT NULL CHECK (length(trim(equipment)) > 0),
  instructions  TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX idx_exercises_muscle_group ON exercises (muscle_group);
CREATE INDEX idx_exercises_equipment ON exercises (equipment);

-- 3. Workout plans ------------------------------------------------------
CREATE TABLE workout_plans (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL CHECK (length(trim(name)) > 0),
  split_type        TEXT    NOT NULL CHECK (split_type IN ('full_body', 'upper_lower', 'push_pull_legs', 'bro_split', 'custom')),
  weekly_frequency  INTEGER NOT NULL CHECK (weekly_frequency BETWEEN 1 AND 7),
  notes             TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);

-- The weekly schedule: which days the plan is trained and in what order.
CREATE TABLE plan_schedule (
  plan_id      INTEGER NOT NULL REFERENCES workout_plans (id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  position     INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  PRIMARY KEY (plan_id, day_of_week)
);

CREATE INDEX idx_plan_schedule_plan ON plan_schedule (plan_id);

-- 4. Planned exercises --------------------------------------------------
CREATE TABLE planned_exercises (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id           INTEGER NOT NULL REFERENCES workout_plans (id) ON DELETE CASCADE,
  exercise_id       INTEGER NOT NULL REFERENCES exercises (id) ON DELETE RESTRICT,
  position          INTEGER NOT NULL CHECK (position >= 0),
  target_sets       INTEGER NOT NULL CHECK (target_sets BETWEEN 1 AND 20),
  rep_range_min     INTEGER NOT NULL CHECK (rep_range_min BETWEEN 0 AND 100),
  rep_range_max     INTEGER NOT NULL CHECK (rep_range_max BETWEEN 0 AND 100),
  rest_seconds      INTEGER NOT NULL CHECK (rest_seconds BETWEEN 0 AND 1800),
  UNIQUE (plan_id, position),
  CHECK (rep_range_max >= rep_range_min)
);

CREATE INDEX idx_planned_exercises_plan ON planned_exercises (plan_id);
CREATE INDEX idx_planned_exercises_exercise ON planned_exercises (exercise_id);

-- 5. Workout sessions ---------------------------------------------------
CREATE TABLE workout_sessions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id           INTEGER REFERENCES workout_plans (id) ON DELETE SET NULL,
  title             TEXT,
  started_at        INTEGER NOT NULL,
  ended_at          INTEGER,
  duration_seconds  INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  status            TEXT    NOT NULL CHECK (status IN ('planned', 'in_progress', 'completed', 'abandoned')),
  notes             TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX idx_sessions_started_at ON workout_sessions (started_at DESC);
CREATE INDEX idx_sessions_status ON workout_sessions (status);
CREATE INDEX idx_sessions_plan ON workout_sessions (plan_id);

-- 6. Logged sets --------------------------------------------------------
CREATE TABLE logged_sets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL REFERENCES workout_sessions (id) ON DELETE CASCADE,
  exercise_id   INTEGER NOT NULL REFERENCES exercises (id) ON DELETE RESTRICT,
  set_number    INTEGER NOT NULL CHECK (set_number > 0),
  weight_kg     REAL CHECK (weight_kg IS NULL OR weight_kg >= 0),
  reps          INTEGER CHECK (reps IS NULL OR reps >= 0),
  rpe           REAL CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  is_completed  INTEGER NOT NULL DEFAULT 1 CHECK (is_completed IN (0, 1)),
  completed_at  INTEGER NOT NULL,
  UNIQUE (session_id, exercise_id, set_number)
);

CREATE INDEX idx_logged_sets_session ON logged_sets (session_id);
CREATE INDEX idx_logged_sets_exercise ON logged_sets (exercise_id);
CREATE INDEX idx_logged_sets_completed_at ON logged_sets (completed_at DESC);

-- 7. Personal records ---------------------------------------------------
-- Derived from completed sessions and refreshed whenever one is completed.
CREATE TABLE personal_records (
  exercise_id  INTEGER NOT NULL REFERENCES exercises (id) ON DELETE CASCADE,
  record_type  TEXT    NOT NULL CHECK (record_type IN ('max_weight', 'max_reps', 'best_estimated_1rm')),
  value        REAL    NOT NULL CHECK (value >= 0),
  achieved_at  INTEGER NOT NULL,
  session_id   INTEGER REFERENCES workout_sessions (id) ON DELETE SET NULL,
  PRIMARY KEY (exercise_id, record_type)
);

CREATE INDEX idx_personal_records_exercise ON personal_records (exercise_id);

-- Derived views ---------------------------------------------------------

-- Per exercise progress, computed from the logged sets.
CREATE VIEW exercise_progress AS
SELECT
  exercise_id,
  COUNT(DISTINCT session_id)   AS sessions_logged,
  MAX(weight_kg)               AS max_weight_kg,
  MAX(reps)                    AS max_reps,
  COALESCE(SUM(weight_kg * reps), 0) AS total_volume_kg,
  MAX(completed_at)            AS last_logged_at
FROM logged_sets
GROUP BY exercise_id;

-- Per session summary, used by the history list.
CREATE VIEW session_summary AS
SELECT
  s.id                AS session_id,
  s.plan_id           AS plan_id,
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
