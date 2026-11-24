import { beforeEach, describe, expect, it } from '@jest/globals';
import { existsSync } from 'node:fs';

import { GymPalDatabase, openEncryptedDatabase, readDatabaseKey } from '@/db';
import { resetCryptoMock } from '../test-support/crypto-mock';
import { resetSecureStoreMock } from '../test-support/secure-store-mock';
import { resetSqliteMock } from '../test-support/sqlite-mock';

const profile = {
  name: 'Alex Carter',
  heightCm: 180,
  weightKg: 80,
  system: 'metric' as const,
};

describe('persistence across restarts', () => {
  beforeEach(() => {
    resetSqliteMock();
    resetSecureStoreMock();
    resetCryptoMock();
  });

  it('keeps the profile when the app is closed and opened again', async () => {
    const first = await openEncryptedDatabase();
    const database = new GymPalDatabase(first.db);
    await database.saveProfile(profile);
    const key = await readDatabaseKey();
    const path = first.db.databasePath;

    // The app is closed: the connection is released.
    await database.close();

    // The app is opened again.
    const second = await openEncryptedDatabase();
    const reopened = new GymPalDatabase(second.db);

    expect(await readDatabaseKey()).toBe(key);
    expect(await reopened.getProfile()).toEqual(profile);

    await reopened.close();
  });

  it('keeps workout history across restarts', async () => {
    const first = await openEncryptedDatabase();
    const database = new GymPalDatabase(first.db);

    const exercise = await database.createExercise({
      name: 'Test Bench Press',
      muscleGroup: 'Chest',
      equipment: 'Barbell',
    });
    const session = await database.startSession({ title: 'Push' });
    await database.logSet({
      sessionId: session.id,
      exerciseId: exercise.id,
      setNumber: 1,
      weightKg: 80,
      reps: 8,
      rpe: 8,
    });
    await database.completeSession(session.id, {});

    await database.close();

    const second = await openEncryptedDatabase();
    const reopened = new GymPalDatabase(second.db);

    const sessions = await reopened.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].setsLogged).toBe(1);
    expect(sessions[0].status).toBe('completed');

    const exercises = await reopened.listExercises();
    expect(exercises.map((item) => item.name)).toContain('Test Bench Press');

    await reopened.close();
  });

  it('reuses the same key instead of generating a new one', async () => {
    const first = await openEncryptedDatabase();
    const key = await readDatabaseKey();
    await first.db.closeAsync();

    const second = await openEncryptedDatabase();
    expect(second.keyCreated).toBe(false);
    expect(await readDatabaseKey()).toBe(key);

    await second.db.closeAsync();
  });

  it('does not replace an existing database when the key is lost', async () => {
    const first = await openEncryptedDatabase();
    const database = new GymPalDatabase(first.db);
    await database.saveProfile(profile);
    const path = first.db.databasePath;
    await database.close();

    // The keychain entry is lost, but the database file is still there.
    resetSecureStoreMock();

    await expect(openEncryptedDatabase()).rejects.toThrow(/KEY_MISSING/);

    // The file was not deleted and not replaced.
    expect(existsSync(path)).toBe(true);
  });
});
