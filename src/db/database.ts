import type { SQLiteDatabase } from 'expo-sqlite';

import { startOfDay } from '@/lib/calendar';
import {
  clearProfile,
  getProfile,
  saveProfile,
  type StoredProfile,
} from '@/db/repositories/profile';
import {
  createExercise,
  deleteExercise,
  findExerciseByName,
  getExercise,
  listExercises,
  searchExercises,
  updateExercise,
  type Exercise,
  type NewExercise,
} from '@/db/repositories/exercises';
import {
  deletePlan,
  duplicatePlan,
  getPlan,
  listPlans,
  savePlan,
  type NewPlan,
  type Plan,
  type PlanWithDetails,
  type SplitType,
} from '@/db/repositories/plans';
import {
  getWorkout,
  getWorkoutForDay,
  getWorkoutForToday,
  getWorkoutSchedule,
  listWorkouts,
  listWorkoutsForPlan,
  type Workout,
  type WorkoutSummary,
  type WorkoutWithExercises,
} from '@/db/repositories/workouts';
import {
  abandonSession,
  completeSession,
  countCompletedSessions,
  countCompletedSessionsSince,
  getActiveSession,
  getPreviousPerformance,
  getSession,
  getSessionDetail,
  getSessionExercises,
  getTrainedDays,
  listSessions,
  setCurrentExercise,
  setSessionExerciseStatus,
  startSession,
  swapSessionExercise,
  setSessionPhaseIndex,
  type ListSessionsOptions,
  type PreviousPerformance,
  type SessionDetail,
  type SessionExercise,
  type SessionExerciseStatus,
  type SessionSummary,
  type WorkoutSession,
} from '@/db/repositories/sessions';
import {
  deleteSet,
  getSetsForExercise,
  getSetsForSession,
  logSet,
  type LoggedSet,
  type NewLoggedSet,
} from '@/db/repositories/sets';
import {
  getExerciseProgress,
  getPersonalRecord,
  getPersonalRecords,
  recalculatePersonalRecords,
  recalculateRecordsForSession,
  type ExerciseProgress,
  type PersonalRecord,
  type RecordType,
} from '@/db/repositories/records';
import {
  addProgressEntry,
  deleteProgressEntry,
  listMetricPreferences,
  listProgressEntries,
  listSessionAggregates,
  savePinnedMetrics,
  updateProgressEntry,
  type NewProgressEntry,
  type ProgressEntry,
  type ProgressEntryChanges,
} from '@/db/repositories/progress';
import type { MetricPreference, SessionAggregate } from '@/workouts/progress';

/**
 * The data access layer.
 *
 * The UI never touches SQL: it works with this facade, which owns the
 * connection and delegates to the repositories. Swapping the storage engine,
 * adding a cache or tightening the access rules only happens here.
 */
export class GymPalDatabase {
  private readonly database: SQLiteDatabase;

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  /** The underlying connection. Only the data layer should use this. */
  get raw(): SQLiteDatabase {
    return this.database;
  }

  /** Absolute path of the database file. */
  get path(): string {
    return this.database.databasePath;
  }

  /** Closes the connection. The instance must not be used afterwards. */
  async close(): Promise<void> {
    await this.database.closeAsync();
  }

  // Profile ---------------------------------------------------------------

  async getProfile(): Promise<StoredProfile | null> {
    return getProfile(this.database);
  }

  async saveProfile(profile: StoredProfile): Promise<StoredProfile> {
    const existing = await this.getProfile();
    const saved = await saveProfile(this.database, profile);

    // The weight someone types during onboarding is the first point on the
    // body weight chart. Later edits to the profile are not measurements. It is
    // dated to the start of today so a measurement logged today replaces it.
    if (!existing) {
      await addProgressEntry(this.database, {
        kind: 'body_weight',
        valueKg: profile.weightKg,
        recordedAt: startOfDay(Date.now()),
      });
    }

    return saved;
  }

  async clearProfile(): Promise<void> {
    await clearProfile(this.database);
  }

  // Exercise library ------------------------------------------------------

  listExercises(): Promise<Exercise[]> {
    return listExercises(this.database);
  }

  searchExercises(query: string): Promise<Exercise[]> {
    return searchExercises(this.database, query);
  }

  getExercise(id: number): Promise<Exercise | null> {
    return getExercise(this.database, id);
  }

  findExerciseByName(name: string): Promise<Exercise | null> {
    return findExerciseByName(this.database, name);
  }

  createExercise(input: NewExercise): Promise<Exercise> {
    return createExercise(this.database, input);
  }

  updateExercise(id: number, input: NewExercise): Promise<Exercise | null> {
    return updateExercise(this.database, id, input);
  }

  deleteExercise(id: number): Promise<boolean> {
    return deleteExercise(this.database, id);
  }

  // Plans -----------------------------------------------------------------

  listPlans(): Promise<Plan[]> {
    return listPlans(this.database);
  }

  getPlan(id: number): Promise<PlanWithDetails | null> {
    return getPlan(this.database, id);
  }

  createPlan(input: NewPlan): Promise<PlanWithDetails> {
    return savePlan(this.database, input);
  }

  updatePlan(id: number, input: NewPlan): Promise<PlanWithDetails | null> {
    return savePlan(this.database, input, id);
  }

  duplicatePlan(id: number): Promise<PlanWithDetails | null> {
    return duplicatePlan(this.database, id);
  }

  deletePlan(id: number): Promise<boolean> {
    return deletePlan(this.database, id);
  }

  // Workouts --------------------------------------------------------------

  listWorkoutsForPlan(planId: number): Promise<Workout[]> {
    return listWorkoutsForPlan(this.database, planId);
  }

  /** Every workout the user has built, across all plans. */
  listWorkouts(): Promise<WorkoutSummary[]> {
    return listWorkouts(this.database);
  }

  getWorkout(id: number): Promise<WorkoutWithExercises | null> {
    return getWorkout(this.database, id);
  }

  getWorkoutSchedule(workoutId: number): Promise<number[]> {
    return getWorkoutSchedule(this.database, workoutId);
  }

  getWorkoutForDay(dayOfWeek: number): Promise<WorkoutWithExercises | null> {
    return getWorkoutForDay(this.database, dayOfWeek);
  }

  getWorkoutForToday(): Promise<WorkoutWithExercises | null> {
    return getWorkoutForToday(this.database);
  }

  // Sessions --------------------------------------------------------------

  startSession(input: {
    workoutId?: number | null;
    planId?: number | null;
    title?: string | null;
    startedAt?: number;
  }): Promise<WorkoutSession> {
    return startSession(this.database, input);
  }

  getSession(id: number): Promise<WorkoutSession | null> {
    return getSession(this.database, id);
  }

  getActiveSession(): Promise<WorkoutSession | null> {
    return getActiveSession(this.database);
  }

  getSessionDetail(id: number): Promise<SessionDetail | null> {
    return getSessionDetail(this.database, id);
  }

  getSessionExercises(sessionId: number): Promise<SessionExercise[]> {
    return getSessionExercises(this.database, sessionId);
  }

  setCurrentExercise(sessionId: number, exerciseId: number | null): Promise<void> {
    return setCurrentExercise(this.database, sessionId, exerciseId);
  }

  setSessionExerciseStatus(
    sessionId: number,
    position: number,
    status: SessionExerciseStatus
  ): Promise<void> {
    return setSessionExerciseStatus(this.database, sessionId, position, status);
  }

  async swapSessionExercise(sessionId: number, position: number, exerciseId: number): Promise<void> {
    return swapSessionExercise(this.database, sessionId, position, exerciseId);
  }

  async setSessionPhaseIndex(sessionId: number, phaseIndex: number): Promise<void> {
    return setSessionPhaseIndex(this.database, sessionId, phaseIndex);
  }

  completeSession(
    id: number,
    input: { endedAt?: number; notes?: string | null }
  ): Promise<WorkoutSession | null> {
    return completeSession(this.database, id, input);
  }

  abandonSession(id: number): Promise<WorkoutSession | null> {
    return abandonSession(this.database, id);
  }

  listSessions(options?: ListSessionsOptions): Promise<SessionSummary[]> {
    return listSessions(this.database, options);
  }

  countCompletedSessions(): Promise<number> {
    return countCompletedSessions(this.database);
  }

  countCompletedSessionsSince(since: number): Promise<number> {
    return countCompletedSessionsSince(this.database, since);
  }

  getTrainedDays(limit?: number): Promise<number[]> {
    return getTrainedDays(this.database, limit);
  }

  getPreviousPerformance(
    exerciseId: number,
    options?: { excludeSessionId?: number; limit?: number }
  ): Promise<PreviousPerformance | null> {
    return getPreviousPerformance(this.database, exerciseId, options);
  }

  // Logged sets -----------------------------------------------------------

  logSet(input: NewLoggedSet): Promise<LoggedSet> {
    return logSet(this.database, input);
  }

  getSetsForSession(sessionId: number): Promise<LoggedSet[]> {
    return getSetsForSession(this.database, sessionId);
  }

  getSetsForExercise(exerciseId: number, limit?: number): Promise<LoggedSet[]> {
    return getSetsForExercise(this.database, exerciseId, limit);
  }

  deleteSet(id: number): Promise<boolean> {
    return deleteSet(this.database, id);
  }

  // Records and progress --------------------------------------------------

  getPersonalRecords(): Promise<PersonalRecord[]> {
    return getPersonalRecords(this.database);
  }

  getPersonalRecord(
    exerciseId: number,
    recordType: RecordType
  ): Promise<PersonalRecord | null> {
    return getPersonalRecord(this.database, exerciseId, recordType);
  }

  getExerciseProgress(): Promise<ExerciseProgress[]> {
    return getExerciseProgress(this.database);
  }

  recalculatePersonalRecords(exerciseId: number): Promise<PersonalRecord[]> {
    return recalculatePersonalRecords(this.database, exerciseId);
  }

  recalculateRecordsForSession(sessionId: number): Promise<void> {
    return recalculateRecordsForSession(this.database, sessionId);
  }

  // Progress --------------------------------------------------------------

  listProgressEntries(): Promise<ProgressEntry[]> {
    return listProgressEntries(this.database);
  }

  addProgressEntry(input: NewProgressEntry): Promise<ProgressEntry> {
    return addProgressEntry(this.database, input);
  }

  updateProgressEntry(
    id: number,
    changes: ProgressEntryChanges
  ): Promise<ProgressEntry | null> {
    return updateProgressEntry(this.database, id, changes);
  }

  deleteProgressEntry(id: number): Promise<boolean> {
    return deleteProgressEntry(this.database, id);
  }

  /** Every exercise, reduced to one row per completed session. */
  listSessionAggregates(): Promise<SessionAggregate[]> {
    return listSessionAggregates(this.database);
  }

  listMetricPreferences(): Promise<MetricPreference[]> {
    return listMetricPreferences(this.database);
  }

  savePinnedMetrics(keys: string[]): Promise<void> {
    return savePinnedMetrics(this.database, keys);
  }
}

export type { SplitType };
