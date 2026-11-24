/**
 * Migration 7 — the fields a session keeps per exercise.
 *
 * An exercise that is added to a session while the workout is running carries
 * its own prescription (sets, rep range, rest), and the columns the data layer
 * reads back live on the session row itself. They are added here so a movement
 * can be appended to an in-progress workout and still resolve its targets.
 */
export const up = `
ALTER TABLE session_exercises ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE session_exercises ADD COLUMN muscle_group TEXT NOT NULL DEFAULT 'Other';
ALTER TABLE session_exercises ADD COLUMN equipment TEXT NOT NULL DEFAULT 'Other';
ALTER TABLE session_exercises ADD COLUMN target_sets INTEGER NOT NULL DEFAULT 3;
ALTER TABLE session_exercises ADD COLUMN rep_range_min INTEGER NOT NULL DEFAULT 5;
ALTER TABLE session_exercises ADD COLUMN rep_range_max INTEGER NOT NULL DEFAULT 10;
ALTER TABLE session_exercises ADD COLUMN rest_seconds INTEGER NOT NULL DEFAULT 60;
`;
