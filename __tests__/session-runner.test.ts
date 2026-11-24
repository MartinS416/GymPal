import { beforeEach, describe, expect, it } from '@jest/globals';

import { GymPalDatabase, migrateDatabase } from '@/db';
import { openEncryptedDatabase } from '@/db/client';
import type { Exercise } from '@/db/repositories/exercises';
import type { SessionExercise } from '@/db/repositories/sessions';
import {
  advancePhase,
  buildPhases,
  currentSetNumber,
  endRest,
  extendRest,
  focusExercise,
  goBackPhase,
  logSetForExercise,
  nextPendingExercise,
  previousExercise,
  sessionClocks,
  skipExercise,
  startRest,
  validateSet,
  workoutProgress,
} from '@/workouts/session-runner';
import { resetCryptoMock } from '../test-support/crypto-mock';
import { resetSecureStoreMock } from '../test-support/secure-store-mock';
import { resetSqliteMock } from '../test-support/sqlite-mock';

async function openDatabase(): Promise<GymPalDatabase> {
  const { db } = await openEncryptedDatabase();
  await migrateDatabase(db);
  return new GymPalDatabase(db);
}

/** A database with one exercise and a session that is ready to be worked. */
async function seedSession() {
  const database = await openDatabase();
  const exercise = await database.createExercise({
    name: 'Test Press',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
  });
  const plan = await database.createPlan({
    name: 'Test plan',
    splitType: 'full_body',
    weeklyFrequency: 1,
    workouts: [
      {
        name: 'Full Body',
        exercises: [
          {
            exerciseId: exercise.id,
            targetSets: 2,
            repRangeMin: 8,
            repRangeMax: 10,
            restSeconds: 90,
          },
        ],
      },
    ],
    schedule: [{ dayOfWeek: 1, workoutIndex: 0 }],
  });
  const workouts = await database.listWorkoutsForPlan(plan.id);
  const workout = await database.getWorkout(workouts[0].id);
  const session = await database.startSession({ workoutId: workout?.id });

  return { database, exerciseId: exercise.id, sessionId: session.id };
}

async function seedWorkout(database: GymPalDatabase) {
  const exercise: Exercise = await database.createExercise({
    name: 'Test Press',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
  });
  const plan = await database.createPlan({
    name: 'Test plan',
    splitType: 'full_body',
    weeklyFrequency: 1,
    workouts: [
      {
        name: 'Full Body',
        exercises: [
          {
            exerciseId: exercise.id,
            targetSets: 2,
            repRangeMin: 8,
            repRangeMax: 10,
            restSeconds: 90,
          },
        ],
      },
    ],
    schedule: [{ dayOfWeek: 1, workoutIndex: 0 }],
  });
  const workouts = await database.listWorkoutsForPlan(plan.id);
  const workout = await database.getWorkout(workouts[0].id);
  return { exercise, plan, workout };
}

describe('set validation', () => {
  it('rejects impossible values', () => {
    expect(validateSet({ weightKg: -1 }).weight).toBeDefined();
    expect(validateSet({ weightKg: 10_000 }).weight).toBeDefined();
    expect(validateSet({ reps: 1.5 }).reps).toBeDefined();
    expect(validateSet({ reps: 1000 }).reps).toBeDefined();
    expect(validateSet({ rpe: 15 }).rpe).toBeDefined();
    expect(validateSet({ rpe: 0 }).rpe).toBeDefined();
  });

  it('accepts sensible values', () => {
    expect(validateSet({ weightKg: 60, reps: 8, rpe: 8 })).toEqual({});
    expect(validateSet({ weightKg: null, reps: null })).toEqual({});
  });
});

describe('an active session', () => {
  let database: GymPalDatabase;

  beforeEach(async () => {
    resetSqliteMock();
    resetSecureStoreMock();
    resetCryptoMock();
    database = await openDatabase();
  });

  it('copies the workout into the session when it starts', async () => {
    const { exercise, workout } = await seedWorkout(database);

    const session = await database.startSession({ workoutId: workout?.id });
    expect(session.status).toBe('in_progress');
    expect(session.startedAt).toBeGreaterThan(0);

    const exercises = await database.getSessionExercises(session.id);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].exerciseId).toBe(exercise.id);
    expect(exercises[0].status).toBe('pending');
    expect(exercises[0].targetSets).toBe(2);
    expect(session.currentExerciseId).toBe(exercise.id);
  });

  it('saves a set straight away and starts the rest timer', async () => {
    const { exercise, workout } = await seedWorkout(database);
    const session = await database.startSession({ workoutId: workout?.id });

    const set = await logSetForExercise(database, session.id, exercise.id, {
      weightKg: 60,
      reps: 8,
    });

    expect(set.weightKg).toBe(60);
    expect(set.reps).toBe(8);
    expect(set.setNumber).toBe(1);

    // The set is in the database immediately.
    const sets = await database.getSetsForSession(session.id);
    expect(sets).toHaveLength(1);

    // The rest timer is a timestamp, not a countdown.
    const restEndsAt = await startRest(database, session.id, 90);
    expect(restEndsAt).toBeGreaterThan(Date.now());
    const reloaded = await database.getSession(session.id);
    expect(reloaded?.restEndsAt).toBe(restEndsAt);

    // It can be ended early.
    await endRest(database, session.id);
    expect((await database.getSession(session.id))?.restEndsAt).toBeNull();

    // And extended.
    const extended = await extendRest(database, session.id, 30);
    expect(extended).toBeGreaterThan(Date.now());
  });

  it('keeps the session in progress so it can be resumed', async () => {
    const { workout } = await seedWorkout(database);
    const session = await database.startSession({ workoutId: workout?.id });

    const active = await database.getActiveSession();
    expect(active?.id).toBe(session.id);
  });

  it('moves through the exercises and records what was skipped', async () => {
    const { exercise, workout } = await seedWorkout(database);
    const session = await database.startSession({ workoutId: workout?.id });

    const exercises = await database.getSessionExercises(session.id);
    await skipExercise(database, session.id, exercises[0]);
    await focusExercise(database, session.id, null);

    const updated = await database.getSessionExercises(session.id);
    expect(updated[0].status).toBe('skipped');
  });

  it('finishes the session and keeps every set', async () => {
    const { exercise, workout } = await seedWorkout(database);
    const session = await database.startSession({ workoutId: workout?.id });

    await logSetForExercise(database, session.id, exercise.id, { weightKg: 60, reps: 8 });
    await logSetForExercise(database, session.id, exercise.id, { weightKg: 65, reps: 6 });

    const completed = await database.completeSession(session.id, {});
    expect(completed?.status).toBe('completed');
    expect(completed?.endedAt).toBeGreaterThan(0);
    expect(completed?.durationSeconds).toBeGreaterThanOrEqual(0);

    const detail = await database.getSessionDetail(session.id);
    expect(detail?.setsLogged).toBe(2);
    expect(detail?.totalVolumeKg).toBe(60 * 8 + 65 * 6);
  });

  it('abandons a session without throwing away the sets', async () => {
    const { exercise, workout } = await seedWorkout(database);
    const session = await database.startSession({ workoutId: workout?.id });
    await logSetForExercise(database, session.id, exercise.id, { weightKg: 60, reps: 8 });

    const abandoned = await database.abandonSession(session.id);
    expect(abandoned?.status).toBe('abandoned');

    // The data is still there.
    const detail = await database.getSessionDetail(session.id);
    expect(detail?.setsLogged).toBe(1);

    // And it is no longer offered as something to resume.
    expect(await database.getActiveSession()).toBeNull();
  });

  it('finds the previous performance of an exercise', async () => {
    const { exercise, workout } = await seedWorkout(database);
    const first = await database.startSession({ workoutId: workout?.id });
    await logSetForExercise(database, first.id, exercise.id, { weightKg: 60, reps: 8 });
    await database.completeSession(first.id, {});

    const second = await database.startSession({ workoutId: workout?.id });
    const previous = await database.getPreviousPerformance(exercise.id, {
      excludeSessionId: second.id,
    });

    expect(previous?.sessionId).toBe(first.id);
    expect(previous?.sets[0].weightKg).toBe(60);
    expect(previous?.sets[0].reps).toBe(8);
  });
});

describe('the phases of a workout', () => {
  function exercise(targetSets: number, restSeconds = 90): SessionExercise {
    return {
      id: 1,
      sessionId: 1,
      exerciseId: 7,
      workoutExerciseId: null,
      name: 'Bench Press',
      muscleGroup: 'Chest',
      equipment: 'Barbell',
      position: 0,
      status: 'pending',
      targetSets,
      repRangeMin: 8,
      repRangeMax: 10,
      restSeconds,
    };
  }

  it('makes a work phase and a rest phase for every set', () => {
    const phases = buildPhases([exercise(2)]);
    expect(phases.map((phase) => phase.kind)).toEqual(['work', 'rest', 'work']);
  });

  it('does not rest after the last set of the last exercise', () => {
    const phases = buildPhases([exercise(1)]);
    expect(phases).toHaveLength(1);
    expect(phases[0].kind).toBe('work');
  });

  it('rests between exercises too', () => {
    const phases = buildPhases([exercise(1), { ...exercise(1), id: 2, exerciseId: 8 }]);
    expect(phases.map((phase) => phase.kind)).toEqual(['work', 'rest', 'work']);
  });

  it('knows which set a work phase is on', () => {
    const phases = buildPhases([exercise(3)]);
    const work = phases.filter((phase) => phase.kind === 'work');
    expect(work.map((phase) => (phase.kind === 'work' ? phase.setNumber : 0))).toEqual([1, 2, 3]);
  });
});

describe('moving through the phases', () => {
  beforeEach(() => {
    resetSqliteMock();
    resetSecureStoreMock();
    resetCryptoMock();
  });

  it('logs the set and starts the rest when a work phase is left', async () => {
    const { database, exerciseId, sessionId } = await seedSession();
    const phases = buildPhases(await database.getSessionExercises(sessionId));

    await advancePhase(database, sessionId, phases, 0, { weightKg: 60, reps: 8 });

    const sets = await database.getSetsForSession(sessionId);
    expect(sets).toHaveLength(1);
    expect(sets[0].weightKg).toBe(60);
    expect(sets[0].setNumber).toBe(1);

    const session = await database.getSession(sessionId);
    expect(session?.phaseIndex).toBe(1);
    expect(session?.restEndsAt).not.toBeNull();
    expect(session?.exerciseStartedAt).toBeNull();
    expect(exerciseId).toBeGreaterThan(0);
  });

  it('starts the next set when the rest is left', async () => {
    const { database, sessionId } = await seedSession();
    const phases = buildPhases(await database.getSessionExercises(sessionId));

    await advancePhase(database, sessionId, phases, 0, { weightKg: 60, reps: 8 });
    await advancePhase(database, sessionId, phases, 1, {});

    const session = await database.getSession(sessionId);
    expect(session?.phaseIndex).toBe(2);
    expect(session?.restEndsAt).toBeNull();
    expect(session?.exerciseStartedAt).not.toBeNull();
    // The rest that was taken is banked.
    expect(session?.restTotalSeconds).toBeGreaterThanOrEqual(0);
  });

  it('starts every set with a fresh work clock', async () => {
    const { database, sessionId } = await seedSession();
    const phases = buildPhases(await database.getSessionExercises(sessionId));

    // Work set 1, then the rest, then the start of set 2.
    await advancePhase(database, sessionId, phases, 0, { weightKg: 60, reps: 8 });
    await advancePhase(database, sessionId, phases, 1, {});

    const session = await database.getSession(sessionId);
    // The second set starts its own clock, not the first set's.
    expect(session?.phaseIndex).toBe(2);
    expect(session?.exerciseElapsedSeconds).toBe(0);
    expect(session?.exerciseStartedAt).not.toBeNull();
  });

  it('corrects the set that was just logged when the rest is left', async () => {
    const { database, sessionId } = await seedSession();
    const phases = buildPhases(await database.getSessionExercises(sessionId));

    await advancePhase(database, sessionId, phases, 0, { weightKg: 60, reps: 8 });
    // The user realises the weight was wrong while they are resting.
    await advancePhase(database, sessionId, phases, 1, { weightKg: 62.5, reps: 8 });

    const sets = await database.getSetsForSession(sessionId);
    expect(sets).toHaveLength(1);
    expect(sets[0].weightKg).toBe(62.5);
    expect(sets[0].setNumber).toBe(1);
  });

  it('goes back to the previous phase', async () => {
    const { database, sessionId } = await seedSession();
    const phases = buildPhases(await database.getSessionExercises(sessionId));

    await advancePhase(database, sessionId, phases, 0, { weightKg: 60, reps: 8 });
    const back = await goBackPhase(database, sessionId, phases, 1);

    expect(back).toBe(0);
    const session = await database.getSession(sessionId);
    expect(session?.phaseIndex).toBe(0);
    // The set that was logged is kept.
    expect(await database.getSetsForSession(sessionId)).toHaveLength(1);
  });

  it('never goes back past the first phase', async () => {
    const { database, sessionId } = await seedSession();
    const phases = buildPhases(await database.getSessionExercises(sessionId));
    expect(await goBackPhase(database, sessionId, phases, 0)).toBe(0);
  });
});

describe('the two clocks', () => {
  const exercise = {
    id: 1,
    sessionId: 1,
    exerciseId: 7,
    workoutExerciseId: null,
    name: 'Bench Press',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    position: 0,
    status: 'pending' as const,
    targetSets: 3,
    repRangeMin: 8,
    repRangeMax: 10,
    restSeconds: 90,
  };

  it('counts the work up while the user works', () => {
    const clocks = sessionClocks(
      {
        exerciseElapsedSeconds: 0,
        exerciseStartedAt: 1_000_000,
        restTotalSeconds: 0,
        restStartedAt: null,
        restEndsAt: null,
      },
      1_045_000,
      exercise,
      1
    );

    expect(clocks.exerciseSeconds).toBe(45);
    expect(clocks.restSeconds).toBe(0);
    expect(clocks.restOverdue).toBe(false);
    expect(clocks.setProgress).toBeCloseTo(1 / 3);
  });

  it('pauses the work clock while the user rests', () => {
    const clocks = sessionClocks(
      {
        exerciseElapsedSeconds: 30,
        exerciseStartedAt: null,
        restTotalSeconds: 10,
        restStartedAt: 1_000_000,
        restEndsAt: 1_090_000,
      },
      1_030_000,
      exercise,
      1
    );

    // The work clock is frozen while resting.
    expect(clocks.exerciseSeconds).toBe(30);
    expect(clocks.restSeconds).toBe(40);
    expect(clocks.restOverdue).toBe(false);
    expect(clocks.restRemainingMs).toBe(60_000);
    expect(clocks.restProgress).toBeCloseTo(30 / 90);
  });

  it('keeps the rest after it has been skipped', () => {
    const clocks = sessionClocks(
      {
        exerciseElapsedSeconds: 30,
        exerciseStartedAt: 1_100_000,
        restTotalSeconds: 90,
        restStartedAt: null,
        restEndsAt: null,
      },
      1_110_000,
      exercise,
      1
    );

    expect(clocks.restSeconds).toBe(90);
    expect(clocks.restOverdue).toBe(false);
    expect(clocks.exerciseSeconds).toBe(40);
  });

  it('copes with a session that has not started yet', () => {
    const clocks = sessionClocks(null, 1_000_000, null, 0);
    expect(clocks.exerciseSeconds).toBe(0);
    expect(clocks.restSeconds).toBe(0);
    expect(clocks.restOverdue).toBe(false);
    expect(clocks.setProgress).toBe(0);
  });
});

describe('session helpers', () => {
  it('counts the sets that are already logged', () => {
    const sets = [
      { id: 1, sessionId: 1, exerciseId: 7, setNumber: 1, weightKg: 60, reps: 8, rpe: null, isCompleted: true, completedAt: 0 },
      { id: 2, sessionId: 1, exerciseId: 7, setNumber: 2, weightKg: 60, reps: 8, rpe: null, isCompleted: true, completedAt: 0 },
    ];
    expect(currentSetNumber(sets, 7)).toBe(3);
    expect(currentSetNumber(sets, 8)).toBe(1);
  });

  it('measures progress through the workout', () => {
    const exercises = [
      {
        id: 1,
        sessionId: 1,
        exerciseId: 7,
        workoutExerciseId: null,
        name: 'Bench Press',
        muscleGroup: 'Chest',
        equipment: 'Barbell',
        position: 0,
        status: 'pending' as const,
        targetSets: 3,
        repRangeMin: 8,
        repRangeMax: 10,
        restSeconds: 90,
      },
      {
        id: 2,
        sessionId: 1,
        exerciseId: 8,
        workoutExerciseId: null,
        name: 'Row',
        muscleGroup: 'Back',
        equipment: 'Barbell',
        position: 1,
        status: 'pending' as const,
        targetSets: 2,
        repRangeMin: 8,
        repRangeMax: 10,
        restSeconds: 90,
      },
    ];
    const sets = [
      { id: 1, sessionId: 1, exerciseId: 7, setNumber: 1, weightKg: 60, reps: 8, rpe: null, isCompleted: true, completedAt: 0 },
    ];

    const progress = workoutProgress(exercises, sets);
    expect(progress.total).toBe(5);
    expect(progress.completed).toBe(1);
    expect(progress.percent).toBe(20);
  });

  it('finds the next exercise that is still pending', () => {
    const exercises = [
      {
        id: 1,
        sessionId: 1,
        exerciseId: 7,
        workoutExerciseId: null,
        name: 'Bench Press',
        muscleGroup: 'Chest',
        equipment: 'Barbell',
        position: 0,
        status: 'completed' as const,
        targetSets: 3,
        repRangeMin: 8,
        repRangeMax: 10,
        restSeconds: 90,
      },
      {
        id: 2,
        sessionId: 1,
        exerciseId: 8,
        workoutExerciseId: null,
        name: 'Row',
        muscleGroup: 'Back',
        equipment: 'Barbell',
        position: 1,
        status: 'pending' as const,
        targetSets: 2,
        repRangeMin: 8,
        repRangeMax: 10,
        restSeconds: 90,
      },
    ];

    expect(nextPendingExercise(exercises, 7)?.exerciseId).toBe(8);
    expect(nextPendingExercise(exercises, 8)).toBeNull();
  });
});
