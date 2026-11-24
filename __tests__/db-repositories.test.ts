import { beforeEach, describe, expect, it } from '@jest/globals';

import { GymPalDatabase, migrateDatabase } from '@/db';
import { openEncryptedDatabase } from '@/db/client';
import { startOfDay } from '@/lib/calendar';
import { resetSqliteMock } from '../test-support/sqlite-mock';
import { resetSecureStoreMock } from '../test-support/secure-store-mock';
import { resetCryptoMock } from '../test-support/crypto-mock';

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

describe('profile repository', () => {
  let database: GymPalDatabase;

  beforeEach(async () => {
    resetSqliteMock();
    resetSecureStoreMock();
    resetCryptoMock();
    database = await openDatabase();
  });

  it('returns null when there is no profile', async () => {
    expect(await database.getProfile()).toBeNull();
  });

  it('saves and reads the profile', async () => {
    await database.saveProfile(profile);

    const stored = await database.getProfile();
    expect(stored).toEqual(profile);
  });

  it('updates the profile instead of adding a second row', async () => {
    await database.saveProfile(profile);
    await database.saveProfile({ ...profile, name: 'Sam Rivera', weightKg: 74.5 });

    const stored = await database.getProfile();
    expect(stored?.name).toBe('Sam Rivera');
    expect(stored?.weightKg).toBe(74.5);

    const count = await database.raw.getFirstAsync<{ count: number }>(
      'SELECT count(*) AS count FROM profile'
    );
    expect(count?.count).toBe(1);
  });

  it('keeps the measurement preference', async () => {
    await database.saveProfile({ ...profile, system: 'imperial' });

    const stored = await database.getProfile();
    expect(stored?.system).toBe('imperial');
  });

  it('rejects a profile outside the allowed ranges', async () => {
    await expect(
      database.saveProfile({ ...profile, heightCm: 10 })
    ).rejects.toThrow();
    await expect(
      database.saveProfile({ ...profile, name: '' })
    ).rejects.toThrow();
  });

  it('clears the profile', async () => {
    await database.saveProfile(profile);
    await database.clearProfile();

    expect(await database.getProfile()).toBeNull();
  });
});

describe('exercise repository', () => {
  let database: GymPalDatabase;

  beforeEach(async () => {
    resetSqliteMock();
    resetSecureStoreMock();
    resetCryptoMock();
    database = await openDatabase();
  });

  it('creates and reads exercises', async () => {
    const created = await database.createExercise({
      name: 'Test Bench Press',
      muscleGroup: 'Chest',
      equipment: 'Barbell',
      instructions: 'Keep the shoulders back.',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.muscleGroup).toBe('Chest');

    const all = await database.listExercises();
    // The library is seeded, so the new exercise is added to it.
    expect(all.map((exercise) => exercise.name)).toContain('Test Bench Press');
  });

  it('searches the library by name, muscle group and equipment', async () => {
    const byName = await database.searchExercises('squat');
    expect(byName.map((exercise) => exercise.name)).toContain('Back Squat');

    const byMuscle = await database.searchExercises('calves');
    expect(byMuscle.length).toBeGreaterThan(0);

    const byEquipment = await database.searchExercises('cable');
    expect(byEquipment.length).toBeGreaterThan(0);

    const nothing = await database.searchExercises('zzzz');
    expect(nothing).toHaveLength(0);
  });

  it('refuses two exercises with the same name', async () => {
    await database.createExercise({
      name: 'Squat',
      muscleGroup: 'Legs',
      equipment: 'Barbell',
    });

    await expect(
      database.createExercise({
        name: 'Squat',
        muscleGroup: 'Legs',
        equipment: 'Barbell',
      })
    ).rejects.toThrow();
  });

  it('protects an exercise that is used in a plan', async () => {
    const exercise = await database.createExercise({
      name: 'Test Deadlift',
      muscleGroup: 'Back',
      equipment: 'Barbell',
    });
    await database.createPlan({
      name: 'Strength',
      splitType: 'full_body',
      weeklyFrequency: 3,
      workouts: [
        {
          name: 'Full Body',
          exercises: [
            {
              exerciseId: exercise.id,
              targetSets: 3,
              repRangeMin: 3,
              repRangeMax: 5,
              restSeconds: 180,
            },
          ],
        },
      ],
      schedule: [
        { dayOfWeek: 1, workoutIndex: 0 },
        { dayOfWeek: 3, workoutIndex: 0 },
        { dayOfWeek: 5, workoutIndex: 0 },
      ],
    });

    await expect(database.deleteExercise(exercise.id)).rejects.toThrow();
  });
});

describe('plan repository', () => {
  let database: GymPalDatabase;
  let exerciseId: number;

  beforeEach(async () => {
    resetSqliteMock();
    resetSecureStoreMock();
    resetCryptoMock();
    database = await openDatabase();
    const exercise = await database.createExercise({
      name: 'Test Overhead Press',
      muscleGroup: 'Shoulders',
      equipment: 'Barbell',
    });
    exerciseId = exercise.id;
  });

  const planInput = () => ({
    name: 'Push Pull',
    splitType: 'push_pull_legs' as const,
    weeklyFrequency: 4,
    workouts: [
      {
        name: 'Push',
        exercises: [
          {
            exerciseId,
            targetSets: 4,
            repRangeMin: 6,
            repRangeMax: 10,
            restSeconds: 120,
          },
        ],
      },
      {
        name: 'Pull',
        exercises: [
          {
            exerciseId,
            targetSets: 3,
            repRangeMin: 8,
            repRangeMax: 12,
            restSeconds: 90,
          },
        ],
      },
    ],
    schedule: [
      { dayOfWeek: 1, workoutIndex: 0 },
      { dayOfWeek: 2, workoutIndex: 1 },
      { dayOfWeek: 3, workoutIndex: 0 },
      { dayOfWeek: 4, workoutIndex: 1 },
    ],
  });

  it('creates a plan with its workouts, exercises and schedule', async () => {
    const plan = await database.createPlan(planInput());

    expect(plan.name).toBe('Push Pull');
    expect(plan.schedule).toHaveLength(4);
    expect(plan.schedule[0].dayOfWeek).toBe(1);

    const workouts = await database.listWorkoutsForPlan(plan.id);
    expect(workouts.map((workout) => workout.name)).toEqual(['Push', 'Pull']);

    const first = await database.getWorkout(workouts[0].id);
    expect(first?.exercises).toHaveLength(1);
    expect(first?.exercises[0].targetSets).toBe(4);
    expect(first?.exercises[0].restSeconds).toBe(120);
  });

  it('lists every workout across plans with what it holds', async () => {
    await database.createPlan(planInput());
    await database.createPlan({ ...planInput(), name: 'Push Pull 2' });

    const workouts = await database.listWorkouts();

    // In plan order, then workout order, so the list is stable.
    expect(workouts.map((workout) => workout.name)).toEqual(['Push', 'Pull', 'Push', 'Pull']);
    expect(workouts[0].planName).toBe('Push Pull');
    expect(workouts[2].planName).toBe('Push Pull 2');

    // The counts are what the picker shows.
    expect(workouts[0].exerciseCount).toBe(1);
    expect(workouts[0].setCount).toBe(4);
    expect(workouts[1].setCount).toBe(3);
  });

  it('rejects a rep range that is inverted', async () => {
    const input = planInput();
    await expect(
      database.createPlan({
        ...input,
        workouts: [
          {
            name: 'Push',
            exercises: [{ ...input.workouts[0].exercises[0], repRangeMin: 12, repRangeMax: 6 }],
          },
        ],
      })
    ).rejects.toThrow();
  });

  it('rejects a plan with more than seven days a week', async () => {
    await expect(
      database.createPlan({ ...planInput(), weeklyFrequency: 8 })
    ).rejects.toThrow();
  });

  it('removes the schedule and workouts with the plan', async () => {
    const plan = await database.createPlan(planInput());
    await database.deletePlan(plan.id);

    const schedules = await database.raw.getAllAsync<{ count: number }>(
      'SELECT count(*) AS count FROM plan_schedule WHERE plan_id = ?',
      plan.id
    );
    const workouts = await database.raw.getAllAsync<{ count: number }>(
      'SELECT count(*) AS count FROM workouts WHERE plan_id = ?',
      plan.id
    );

    expect(schedules[0].count).toBe(0);
    expect(workouts[0].count).toBe(0);
  });

  it('keeps past sessions when the plan is deleted', async () => {
    const plan = await database.createPlan(planInput());
    const workout = await database.getWorkout((await database.listWorkoutsForPlan(plan.id))[0].id);
    const session = await database.startSession({ workoutId: workout?.id, planId: plan.id });
    await database.completeSession(session.id, {});

    await database.deletePlan(plan.id);

    const stored = await database.getSession(session.id);
    expect(stored).not.toBeNull();
    expect(stored?.planId).toBeNull();
  });

  it('duplicates a plan with its workouts and schedule', async () => {
    const plan = await database.createPlan(planInput());
    const copy = await database.duplicatePlan(plan.id);

    expect(copy).not.toBeNull();
    expect(copy?.name).toBe('Push Pull (copy)');
    expect(copy?.schedule).toHaveLength(4);

    const copyWorkouts = await database.listWorkoutsForPlan(copy!.id);
    expect(copyWorkouts).toHaveLength(2);

    const copyWorkout = await database.getWorkout(copyWorkouts[0].id);
    expect(copyWorkout?.exercises).toHaveLength(1);
  });
});

describe('sessions, sets and records', () => {
  let database: GymPalDatabase;
  let exerciseId: number;

  beforeEach(async () => {
    resetSqliteMock();
    resetSecureStoreMock();
    resetCryptoMock();
    database = await openDatabase();
    const exercise = await database.createExercise({
      name: 'Test Back Squat',
      muscleGroup: 'Legs',
      equipment: 'Barbell',
    });
    exerciseId = exercise.id;
  });

  it('starts, completes and lists a session', async () => {
    const session = await database.startSession({ title: 'Legs' });
    expect(session.status).toBe('in_progress');

    await database.logSet({
      sessionId: session.id,
      exerciseId,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
      rpe: 8,
    });

    const completed = await database.completeSession(session.id, { notes: 'Felt strong' });
    expect(completed?.status).toBe('completed');
    expect(completed?.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(completed?.endedAt).toBeGreaterThanOrEqual(completed!.startedAt);

    const sessions = await database.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].setsLogged).toBe(1);
    expect(sessions[0].totalVolumeKg).toBe(500);
  });

  it('lists the days the user trained', async () => {
    const trained = await database.startSession({
      title: 'Legs',
      startedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    });
    await database.logSet({
      sessionId: trained.id,
      exerciseId,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
    });

    const unlogged = await database.startSession({ title: 'Push' });
    expect(unlogged.status).toBe('in_progress');

    const trainedYesterday = await database.startSession({
      title: 'Pull',
      startedAt: Date.now() - 24 * 60 * 60 * 1000,
    });
    await database.logSet({
      sessionId: trainedYesterday.id,
      exerciseId,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
    });

    const days = await database.getTrainedDays();
    expect(days).toHaveLength(2);
    expect(days[0]).toBe(startOfDay(Date.now() - 24 * 60 * 60 * 1000));
    expect(days[1]).toBe(startOfDay(Date.now() - 3 * 24 * 60 * 60 * 1000));
  });

  it('counts completed workouts since a given day', async () => {
    const old = await database.startSession({
      title: 'Old',
      startedAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
    });
    await database.logSet({ sessionId: old.id, exerciseId, setNumber: 1, weightKg: 100, reps: 5 });
    await database.completeSession(old.id, {});

    const recent = await database.startSession({ title: 'Recent' });
    await database.logSet({ sessionId: recent.id, exerciseId, setNumber: 1, weightKg: 100, reps: 5 });
    await database.completeSession(recent.id, {});

    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    expect(await database.countCompletedSessionsSince(since)).toBe(1);
  });

  it('replaces a set logged twice instead of duplicating it', async () => {
    const session = await database.startSession({});
    await database.logSet({
      sessionId: session.id,
      exerciseId,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
    });
    await database.logSet({
      sessionId: session.id,
      exerciseId,
      setNumber: 1,
      weightKg: 105,
      reps: 5,
    });

    const sets = await database.getSetsForSession(session.id);
    expect(sets).toHaveLength(1);
    expect(sets[0].weightKg).toBe(105);
  });

  it('rejects a set with an impossible RPE', async () => {
    const session = await database.startSession({});
    await expect(
      database.logSet({
        sessionId: session.id,
        exerciseId,
        setNumber: 1,
        weightKg: 60,
        reps: 8,
        rpe: 15,
      })
    ).rejects.toThrow();
  });

  it('derives personal records from completed sessions', async () => {
    const session = await database.startSession({});
    await database.logSet({
      sessionId: session.id,
      exerciseId,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
    });
    await database.completeSession(session.id, {});
    await database.recalculateRecordsForSession(session.id);

    const records = await database.getPersonalRecords();
    const maxWeight = records.find((record) => record.recordType === 'max_weight');
    const maxReps = records.find((record) => record.recordType === 'max_reps');
    const oneRepMax = records.find(
      (record) => record.recordType === 'best_estimated_1rm'
    );

    expect(maxWeight?.value).toBe(100);
    expect(maxReps?.value).toBe(5);
    expect(oneRepMax?.value).toBeCloseTo(116.67, 1);
  });

  it('does not derive records from sessions that were never completed', async () => {
    const session = await database.startSession({});
    await database.logSet({
      sessionId: session.id,
      exerciseId,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
    });
    await database.recalculateRecordsForSession(session.id);

    expect(await database.getPersonalRecords()).toHaveLength(0);
  });

  it('summarises progress per exercise', async () => {
    const session = await database.startSession({});
    await database.logSet({
      sessionId: session.id,
      exerciseId,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
    });
    await database.logSet({
      sessionId: session.id,
      exerciseId,
      setNumber: 2,
      weightKg: 100,
      reps: 5,
    });
    await database.completeSession(session.id, {});

    const progress = await database.getExerciseProgress();
    expect(progress).toHaveLength(1);
    expect(progress[0].sessionsLogged).toBe(1);
    expect(progress[0].totalVolumeKg).toBe(1000);
    expect(progress[0].maxWeightKg).toBe(100);
  });

  it('removes the sets of a session when the session is deleted', async () => {
    const session = await database.startSession({});
    await database.logSet({
      sessionId: session.id,
      exerciseId,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
    });

    await database.raw.runAsync('DELETE FROM workout_sessions WHERE id = ?', session.id);

    const sets = await database.getSetsForSession(session.id);
    expect(sets).toHaveLength(0);
  });
});
