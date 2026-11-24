import { beforeEach, describe, expect, it } from '@jest/globals';

import { GymPalDatabase, migrateDatabase } from '@/db';
import { openEncryptedDatabase } from '@/db/client';
import { resetCryptoMock } from '../test-support/crypto-mock';
import { resetSecureStoreMock } from '../test-support/secure-store-mock';
import { resetSqliteMock } from '../test-support/sqlite-mock';

const DAY = 24 * 60 * 60 * 1000;

async function openDatabase(): Promise<GymPalDatabase> {
  const { db } = await openEncryptedDatabase();
  await migrateDatabase(db);
  return new GymPalDatabase(db);
}

const profile = {
  name: 'Alex Carter',
  heightCm: 180,
  weightKg: 80,
  system: 'metric' as const,
};

describe('progress repository', () => {
  let database: GymPalDatabase;

  beforeEach(async () => {
    resetSqliteMock();
    resetSecureStoreMock();
    resetCryptoMock();
    database = await openDatabase();
  });

  it('starts with no entries and no pins', async () => {
    expect(await database.listProgressEntries()).toEqual([]);
    expect(await database.listMetricPreferences()).toEqual([]);
  });

  it('logs an entry and reads it back with its exercise', async () => {
    const bench = await database.findExerciseByName('Bench Press');
    const entry = await database.addProgressEntry({
      kind: 'exercise',
      exerciseId: bench?.id,
      valueKg: 72.5,
      note: '  felt strong  ',
    });

    expect(entry.kind).toBe('exercise');
    expect(entry.exerciseId).toBe(bench?.id);
    expect(entry.exerciseName).toBe('Bench Press');
    expect(entry.muscleGroup).toBe('Chest');
    expect(entry.note).toBe('felt strong');

    const listed = await database.listProgressEntries();
    expect(listed.map((row) => row.id)).toEqual([entry.id]);
  });

  it('edits the value, the date and the note', async () => {
    const entry = await database.addProgressEntry({
      kind: 'body_weight',
      valueKg: 80.4,
      note: 'Morning',
    });

    const updated = await database.updateProgressEntry(entry.id, {
      valueKg: 79.8,
      recordedAt: entry.recordedAt - DAY,
      note: '',
    });

    expect(updated?.valueKg).toBe(79.8);
    expect(updated?.recordedAt).toBe(entry.recordedAt - DAY);
    expect(updated?.note).toBeNull();
    expect(updated?.createdAt).toBe(entry.createdAt);
  });

  it('removes an entry once', async () => {
    const entry = await database.addProgressEntry({ kind: 'body_weight', valueKg: 80 });

    expect(await database.deleteProgressEntry(entry.id)).toBe(true);
    expect(await database.deleteProgressEntry(entry.id)).toBe(false);
    expect(await database.listProgressEntries()).toEqual([]);
    expect(await database.updateProgressEntry(entry.id, { valueKg: 81 })).toBeNull();
  });

  it('refuses a value that is not a weight', async () => {
    await expect(
      database.addProgressEntry({ kind: 'body_weight', valueKg: 0 })
    ).rejects.toThrow(/progress value/);
    await expect(
      database.addProgressEntry({ kind: 'body_weight', valueKg: -4 })
    ).rejects.toThrow(/progress value/);
  });

  it('refuses an exercise entry without an exercise', async () => {
    await expect(
      database.addProgressEntry({ kind: 'exercise', valueKg: 60 })
    ).rejects.toThrow(/needs an exercise/);
  });

  it('enforces the kind constraint in the schema', async () => {
    await expect(
      database.raw.runAsync(
        `INSERT INTO progress_entries (kind, exercise_id, value_kg, recorded_at, created_at, updated_at)
         VALUES ('body_weight', 1, 80, 0, 0, 0)`
      )
    ).rejects.toThrow();
  });

  it('removes the entries of an exercise that is deleted', async () => {
    const squat = await database.findExerciseByName('Leg Press');
    await database.addProgressEntry({
      kind: 'exercise',
      exerciseId: squat?.id,
      valueKg: 140,
    });

    expect(await database.deleteExercise(squat?.id ?? 0)).toBe(true);
    expect(await database.listProgressEntries()).toEqual([]);
  });

  it('starts the body weight history with the onboarding weight, once', async () => {
    await database.saveProfile(profile);
    await database.saveProfile({ ...profile, weightKg: 78 });

    const entries = await database.listProgressEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('body_weight');
    expect(entries[0].valueKg).toBe(80);
  });

  it('derives one row per exercise per completed session', async () => {
    const bench = await database.findExerciseByName('Bench Press');
    const squat = await database.findExerciseByName('Back Squat');
    const startedAt = Date.now() - DAY;

    const session = await database.startSession({ title: 'Push', startedAt });
    await database.logSet({
      sessionId: session.id,
      exerciseId: bench?.id ?? 0,
      setNumber: 1,
      weightKg: 60,
      reps: 10,
    });
    await database.logSet({
      sessionId: session.id,
      exerciseId: bench?.id ?? 0,
      setNumber: 2,
      weightKg: 70,
      reps: 8,
    });
    // A set that was started but never completed is not part of the history.
    await database.logSet({
      sessionId: session.id,
      exerciseId: bench?.id ?? 0,
      setNumber: 3,
      weightKg: 100,
      reps: 1,
      isCompleted: false,
    });
    await database.logSet({
      sessionId: session.id,
      exerciseId: squat?.id ?? 0,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
    });
    await database.completeSession(session.id, { endedAt: startedAt + 3_600_000 });

    // A session that is still running is not history either.
    const running = await database.startSession({ title: 'Open' });
    await database.logSet({
      sessionId: running.id,
      exerciseId: squat?.id ?? 0,
      setNumber: 1,
      weightKg: 200,
      reps: 1,
    });

    const aggregates = await database.listSessionAggregates();
    expect(aggregates).toHaveLength(2);

    const benchRow = aggregates.find((row) => row.exerciseId === bench?.id);
    expect(benchRow?.sessionId).toBe(session.id);
    expect(benchRow?.at).toBe(startedAt);
    expect(benchRow?.exerciseName).toBe('Bench Press');
    expect(benchRow?.maxWeightKg).toBe(70);
    expect(benchRow?.maxReps).toBe(10);
    expect(benchRow?.sets).toBe(2);
    expect(benchRow?.volumeKg).toBe(60 * 10 + 70 * 8);
    expect(benchRow?.oneRepMaxKg).toBeCloseTo(70 * (1 + 8 / 30));

    const squatRow = aggregates.find((row) => row.exerciseId === squat?.id);
    expect(squatRow?.maxWeightKg).toBe(100);
    expect(squatRow?.sets).toBe(1);
  });

  it('stores the pinned metrics in order', async () => {
    await database.savePinnedMetrics(['exercise:2', 'body_weight']);

    let preferences = await database.listMetricPreferences();
    expect(preferences.map((row) => [row.key, row.pinned, row.position])).toEqual([
      ['exercise:2', true, 0],
      ['body_weight', true, 1],
    ]);

    await database.savePinnedMetrics(['body_weight', 'exercise:2']);
    preferences = await database.listMetricPreferences();
    expect(preferences.map((row) => row.key)).toEqual(['body_weight', 'exercise:2']);

    // Unpinning everything keeps the rows, so the defaults never come back.
    await database.savePinnedMetrics([]);
    preferences = await database.listMetricPreferences();
    expect(preferences).toHaveLength(2);
    expect(preferences.every((row) => !row.pinned)).toBe(true);
  });
});
