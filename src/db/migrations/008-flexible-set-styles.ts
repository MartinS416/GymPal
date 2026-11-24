/** Plan and session snapshots for optional set styles and superset groups. */
export const up = `
ALTER TABLE workout_exercises ADD COLUMN set_config_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE workout_exercises ADD COLUMN superset_group TEXT;
ALTER TABLE session_exercises ADD COLUMN set_config_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE session_exercises ADD COLUMN superset_group TEXT;
ALTER TABLE logged_sets ADD COLUMN set_kind TEXT NOT NULL DEFAULT 'straight';
ALTER TABLE logged_sets ADD COLUMN planned_set_number INTEGER;
ALTER TABLE logged_sets ADD COLUMN segment_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE logged_sets ADD COLUMN superset_round INTEGER;

DROP VIEW exercise_progress;
CREATE VIEW exercise_progress AS
SELECT exercise_id,
       COUNT(DISTINCT session_id) AS sessions_logged,
       MAX(weight_kg) AS max_weight_kg,
       MAX(reps) AS max_reps,
       COALESCE(SUM(weight_kg * reps), 0) AS total_volume_kg,
       MAX(completed_at) AS last_logged_at
  FROM logged_sets
 WHERE is_completed = 1
 GROUP BY exercise_id;

DROP VIEW session_summary;
CREATE VIEW session_summary AS
SELECT s.id AS session_id,
       s.plan_id AS plan_id,
       s.workout_id AS workout_id,
       s.title AS title,
       s.started_at AS started_at,
       s.ended_at AS ended_at,
       s.duration_seconds AS duration_seconds,
       s.status AS status,
       COUNT(CASE WHEN ls.is_completed = 1 THEN ls.id END) AS sets_logged,
       COALESCE(SUM(CASE WHEN ls.is_completed = 1 THEN ls.weight_kg * ls.reps ELSE 0 END), 0) AS total_volume_kg
  FROM workout_sessions s
  LEFT JOIN logged_sets ls ON ls.session_id = s.id
 GROUP BY s.id;

UPDATE session_exercises
   SET target_sets = COALESCE((SELECT target_sets FROM workout_exercises WHERE id = session_exercises.workout_exercise_id), target_sets),
       rep_range_min = COALESCE((SELECT rep_range_min FROM workout_exercises WHERE id = session_exercises.workout_exercise_id), rep_range_min),
       rep_range_max = COALESCE((SELECT rep_range_max FROM workout_exercises WHERE id = session_exercises.workout_exercise_id), rep_range_max),
       rest_seconds = COALESCE((SELECT rest_seconds FROM workout_exercises WHERE id = session_exercises.workout_exercise_id), rest_seconds),
       set_config_json = COALESCE((SELECT set_config_json FROM workout_exercises WHERE id = session_exercises.workout_exercise_id), set_config_json),
       superset_group = (SELECT superset_group FROM workout_exercises WHERE id = session_exercises.workout_exercise_id)
 WHERE workout_exercise_id IS NOT NULL;
`;
