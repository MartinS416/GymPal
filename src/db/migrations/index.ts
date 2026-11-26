import type { SQLiteDatabase } from 'expo-sqlite';

import { DatabaseMigrationError } from '@/db/errors';
import { runInTransaction } from '@/db/transaction';
import { up as initialSchema } from './001-initial';
import { up as workoutSchema } from './002-workouts';
import { up as exerciseLibrary } from './003-exercise-library';
import { up as sessionTimers } from './004-session-timers';
import { up as sessionPhases } from './005-session-phases';
import { up as progressSchema } from './006-progress';
import { up as sessionExerciseFields } from './007-session-exercise-fields';
import { up as flexibleSetStyles } from './008-flexible-set-styles';
import { up as sessionWorkTotal } from './009-session-work-total';

export type Migration = {
  version: number;
  name: string;
  /** SQL applied inside the migration transaction. */
  up: string;
};

/**
 * The ordered list of migrations.
 *
 * `user_version` on the database holds the version the schema is currently at,
 * so migrations can be applied one at a time and re-run safely.
 */
export const MIGRATIONS: Migration[] = [
  { version: 1, name: 'initial-schema', up: initialSchema },
  { version: 2, name: 'workouts-and-sessions', up: workoutSchema },
  { version: 3, name: 'exercise-library', up: exerciseLibrary },
  { version: 4, name: 'session-timers', up: sessionTimers },
  { version: 5, name: 'session-phases', up: sessionPhases },
  { version: 6, name: 'progress', up: progressSchema },
  { version: 7, name: 'session-exercise-fields', up: sessionExerciseFields },
  { version: 8, name: 'flexible-set-styles', up: flexibleSetStyles },
  { version: 9, name: 'session-work-total', up: sessionWorkTotal },
];

export const LATEST_VERSION = MIGRATIONS.reduce(
  (highest, migration) => Math.max(highest, migration.version),
  0
);

/** The version the schema is expected to be at after all migrations ran. */
export const EXPECTED_VERSION = LATEST_VERSION;

/** Reads the schema version stored in the database. */
export async function getUserVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Applies every migration the database has not seen yet.
 *
 * Each migration runs in its own transaction: a failure rolls that migration
 * back and leaves the database on the last good version, so a broken upgrade
 * can never leave a half migrated schema behind.
 */
export async function migrateDatabase(db: SQLiteDatabase): Promise<number> {
  const currentVersion = await getUserVersion(db);

  if (currentVersion > LATEST_VERSION) {
    // The database was written by a newer version of the app. Refuse to touch
    // it rather than risk downgrading a schema we do not understand.
    throw new DatabaseMigrationError();
  }

  if (currentVersion === LATEST_VERSION) {
    return currentVersion;
  }

  const pending = MIGRATIONS.filter(
    (migration) => migration.version > currentVersion
  ).sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    try {
      await runInTransaction(db, async (txn) => {
        await txn.execAsync(migration.up);
        await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
      });
    } catch (error) {
      throw new DatabaseMigrationError({ cause: error });
    }
  }

  return getUserVersion(db);
}
