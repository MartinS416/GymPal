/**
 * Migration 9 — the session's performed work total.
 *
 * The workout screen only needs the time spent on the current set, which resets
 * with every set. The completion summary needs everything the user actually
 * worked, so the elapsed work is banked here as each phase is left.
 */
export const up = `
ALTER TABLE workout_sessions ADD COLUMN work_total_seconds INTEGER NOT NULL DEFAULT 0;
`;
