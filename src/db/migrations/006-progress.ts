/**
 * Migration 6 — progress.
 *
 * Two kinds of progress are stored here:
 *
 * - `progress_entries` holds what the user records by hand: a body weight, or
 *   a weight for an exercise. Workouts already contain the sets the user
 *   logged, so a manual entry never duplicates a session — it is an extra point
 *   on the same timeline.
 * - `metric_preferences` remembers which metrics are pinned to the top of the
 *   dashboard and in what order, including metrics the user has unpinned.
 *
 * `exercise_id` is null for body weight, and required for an exercise entry, so
 * a malformed row cannot exist.
 */
export const up = `
CREATE TABLE progress_entries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind         TEXT    NOT NULL CHECK (kind IN ('body_weight', 'exercise')),
  exercise_id  INTEGER REFERENCES exercises (id) ON DELETE CASCADE,
  value_kg     REAL    NOT NULL CHECK (value_kg > 0 AND value_kg < 1000),
  recorded_at  INTEGER NOT NULL,
  note         TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  CHECK (
    (kind = 'exercise' AND exercise_id IS NOT NULL) OR
    (kind = 'body_weight' AND exercise_id IS NULL)
  )
);

CREATE INDEX idx_progress_entries_recorded ON progress_entries (recorded_at);
CREATE INDEX idx_progress_entries_exercise ON progress_entries (exercise_id);

CREATE TABLE metric_preferences (
  key         TEXT    PRIMARY KEY NOT NULL,
  pinned      INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  position    INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  updated_at  INTEGER NOT NULL
);

CREATE INDEX idx_metric_preferences_pinned ON metric_preferences (pinned, position);
`;
