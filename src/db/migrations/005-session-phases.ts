/**
 * Migration 5 — the phase of an active session.
 *
 * A workout is a timeline of phases: work on a set, rest, work on a set, and
 * so on. The session remembers which phase it is on, so a workout can be closed
 * and picked up again in the same place.
 */
export const up = `
ALTER TABLE workout_sessions ADD COLUMN phase_index INTEGER NOT NULL DEFAULT 0;
`;
