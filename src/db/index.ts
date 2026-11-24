/**
 * The local data layer.
 *
 * Everything the app knows about storage lives behind this module:
 *
 * - `client.ts`     opening, unlocking and deleting the encrypted database
 * - `key.ts`        generation and keychain handling of the encryption key
 * - `migrations/`   versioned schema upgrades
 * - `database.ts`   the data access layer used by the UI
 * - `repositories/` the queries, grouped by entity
 */

import {
  DatabaseCorruptError,
  DatabaseError,
  DatabaseKeyMissingError,
  DatabaseMigrationError,
  DatabaseOpenError,
  DatabaseUnlockError,
  EncryptionUnavailableError,
  KeychainError,
  isDatabaseError,
} from '@/db/errors';
import type { DatabaseErrorCode } from '@/db/errors';

export {
  DATABASE_NAME,
  deleteDatabaseFiles,
  deleteLocalData,
  openEncryptedDatabase,
  safeClose,
  splitDatabasePath,
} from '@/db/client';
export type { OpenDatabaseOptions, OpenDatabaseResult } from '@/db/client';
export { GymPalDatabase } from '@/db/database';
export {
  EXPECTED_VERSION,
  getUserVersion,
  LATEST_VERSION,
  MIGRATIONS,
  migrateDatabase,
} from '@/db/migrations';
export {
  deleteDatabaseKey,
  generateDatabaseKey,
  isDatabaseKey,
  loadOrCreateDatabaseKey,
  readDatabaseKey,
  writeDatabaseKey,
} from '@/db/key';
export {
  isUnencryptedDevBuild,
  isWebPreview,
  supportsEncryption,
} from '@/db/platform';
export { runInTransaction } from '@/db/transaction';
export type { Exercise, NewExercise } from '@/db/repositories/exercises';
export type { LoggedSet, NewLoggedSet } from '@/db/repositories/sets';
export type {
  NewPlan,
  Plan,
  PlanWithDetails,
  SplitType,
} from '@/db/repositories/plans';
export type { StoredProfile } from '@/db/repositories/profile';
export type {
  ExerciseProgress,
  PersonalRecord,
  RecordType,
} from '@/db/repositories/records';
export type {
  ListSessionsOptions,
  SessionStatus,
  SessionSummary,
  WorkoutSession,
} from '@/db/repositories/sessions';
export type {
  SessionExercise,
  SessionDetail,
  SessionExerciseStatus,
  PreviousPerformance,
} from '@/db/repositories/sessions';
export type { Workout, WorkoutWithExercises, NewWorkout } from '@/db/repositories/workouts';

export {
  DatabaseCorruptError,
  DatabaseError,
  DatabaseKeyMissingError,
  DatabaseMigrationError,
  DatabaseOpenError,
  DatabaseUnlockError,
  EncryptionUnavailableError,
  KeychainError,
  isDatabaseError,
};
export type { DatabaseErrorCode };
