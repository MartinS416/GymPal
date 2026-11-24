import { beforeEach, describe, expect, it } from '@jest/globals';

import { GymPalDatabase, LATEST_VERSION, migrateDatabase } from '@/db';
import { openEncryptedDatabase } from '@/db/client';
import { resetSqliteMock } from '../test-support/sqlite-mock';
import { resetSecureStoreMock } from '../test-support/secure-store-mock';
import { resetCryptoMock } from '../test-support/crypto-mock';

async function openDatabase(): Promise<GymPalDatabase> {
  const { db } = await openEncryptedDatabase();
  await migrateDatabase(db);
  return new GymPalDatabase(db);
}

describe('schema and migrations', () => {
  beforeEach(() => {
    resetSqliteMock();
    resetSecureStoreMock();
    resetCryptoMock();
  });

  it('creates every table the app needs', async () => {
    const database = await openDatabase();

    const tables = await database.raw.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const names = tables.map((table) => table.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'profile',
        'exercises',
        'workout_plans',
        'plan_schedule',
        'workouts',
        'workout_exercises',
        'workout_sessions',
        'session_exercises',
        'logged_sets',
        'personal_records',
        'progress_entries',
        'metric_preferences',
      ])
    );

    await database.close();
  });

  it('creates the derived views', async () => {
    const database = await openDatabase();

    const views = await database.raw.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'view' ORDER BY name"
    );
    const names = views.map((view) => view.name);

    expect(names).toEqual(expect.arrayContaining(['exercise_progress', 'session_summary']));

    await database.close();
  });

  it('creates the indexes the app relies on', async () => {
    const database = await openDatabase();

    const indexes = await database.raw.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const names = indexes.map((index) => index.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'idx_sessions_started_at',
        'idx_sessions_status',
        'idx_logged_sets_session',
        'idx_logged_sets_exercise',
        'idx_workouts_plan',
        'idx_workout_exercises_workout',
        'idx_plan_schedule_workout',
        'idx_session_exercises_session',
        'idx_exercises_muscle_group',
        'idx_personal_records_exercise',
        'idx_progress_entries_exercise',
        'idx_progress_entries_recorded',
        'idx_metric_preferences_pinned',
      ])
    );

    await database.close();
  });

  it('records the schema version', async () => {
    const database = await openDatabase();

    const row = await database.raw.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version'
    );
    expect(row?.user_version).toBe(LATEST_VERSION);

    await database.close();
  });

  it('is idempotent: running the migrations again changes nothing', async () => {
    const database = await openDatabase();

    const before = await database.raw.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    await migrateDatabase(database.raw);
    await migrateDatabase(database.raw);

    const after = await database.raw.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    expect(after).toEqual(before);

    await database.close();
  });

  it('refuses to touch a database written by a newer version of the app', async () => {
    const database = await openDatabase();

    await database.raw.execAsync(`PRAGMA user_version = ${LATEST_VERSION + 5}`);

    await expect(migrateDatabase(database.raw)).rejects.toThrow(/MIGRATION_FAILED/);

    await database.close();
  });

  it('enforces foreign keys', async () => {
    const database = await openDatabase();

    const enabled = await database.raw.getFirstAsync<{ foreign_keys: number }>(
      'PRAGMA foreign_keys'
    );
    expect(enabled?.foreign_keys).toBe(1);

    await expect(
      database.raw.runAsync(
        `INSERT INTO planned_exercises
           (plan_id, exercise_id, position, target_sets, rep_range_min, rep_range_max, rest_seconds)
         VALUES (999, 999, 0, 3, 8, 12, 60)`
      )
    ).rejects.toThrow();

    await database.close();
  });
});
