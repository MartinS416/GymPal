import type { GymPalDatabase } from '@/db/database';
import {
  endRestTimer,
  extendRestTimer,
  startRestTimer,
  switchSessionPhase,
} from '@/db/repositories/sessions';
import type { LoggedSet } from '@/db/repositories/sets';
import type { SessionExercise } from '@/db/repositories/sessions';
import { normalizeSetConfiguration } from '@/workouts/set-types';
import type { SetStyle, WorkSetPrescription } from '@/workouts/set-types';

/**
 * The active workout.
 *
 * The state lives in the database, not in the component: the session row says
 * when it started and which exercise is in focus, and the logged sets say how
 * far the user has got. That is what makes an interrupted workout resumable.
 */

export type SetInput = {
  weightKg?: number | null;
  reps?: number | null;
  rpe?: number | null;
};

export type SetValidationErrors = {
  weight?: string;
  reps?: string;
  rpe?: string;
};

/** The limits a logged set has to respect. */
export const SET_LIMITS = {
  maxWeightKg: 500,
  maxReps: 500,
  minRpe: 1,
  maxRpe: 10,
};

export function validateSet(input: SetInput): SetValidationErrors {
  const errors: SetValidationErrors = {};

  if (input.weightKg !== undefined && input.weightKg !== null) {
    if (!Number.isFinite(input.weightKg) || input.weightKg < 0) {
      errors.weight = 'Weight cannot be negative';
    } else if (input.weightKg > SET_LIMITS.maxWeightKg) {
      errors.weight = 'That weight looks too high';
    }
  }

  if (input.reps !== undefined && input.reps !== null) {
    if (!Number.isInteger(input.reps) || input.reps < 0) {
      errors.reps = 'Reps must be a whole number';
    } else if (input.reps > SET_LIMITS.maxReps) {
      errors.reps = 'That many reps looks wrong';
    }
  }

  if (input.rpe !== undefined && input.rpe !== null) {
    if (!Number.isFinite(input.rpe) || input.rpe < SET_LIMITS.minRpe || input.rpe > SET_LIMITS.maxRpe) {
      errors.rpe = 'RPE is between 1 and 10';
    }
  }

  return errors;
}

export function hasSetErrors(errors: SetValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The set the user is on for an exercise: the ones already logged, plus one. */
export function currentSetNumber(sets: LoggedSet[], exerciseId: number): number {
  return sets.filter((set) => set.exerciseId === exerciseId && set.isCompleted).length + 1;
}

/** The exercise that is in focus. */
export function currentExercise(
  exercises: SessionExercise[],
  currentExerciseId: number | null
): SessionExercise | null {
  if (exercises.length === 0) {
    return null;
  }
  if (currentExerciseId === null) {
    return exercises[0];
  }
  return exercises.find((exercise) => exercise.exerciseId === currentExerciseId) ?? exercises[0];
}

/**
 * The next exercise that has not been finished or skipped.
 *
 * The search does not wrap around: the end of the workout is the end.
 */
export function nextPendingExercise(
  exercises: SessionExercise[],
  currentExerciseId: number | null
): SessionExercise | null {
  const index = exercises.findIndex((exercise) => exercise.exerciseId === currentExerciseId);
  const start = index === -1 ? 0 : index + 1;
  for (let offset = start; offset < exercises.length; offset += 1) {
    const candidate = exercises[offset];
    if (candidate && candidate.status === 'pending') {
      return candidate;
    }
  }
  return null;
}

/** The exercise before the current one, for going back. */
export function previousExercise(
  exercises: SessionExercise[],
  currentExerciseId: number | null
): SessionExercise | null {
  const index = exercises.findIndex((exercise) => exercise.exerciseId === currentExerciseId);
  if (index <= 0) {
    return null;
  }
  return exercises[index - 1];
}

/** How far through the workout the user is, as a percentage. */
export function workoutProgress(
  exercises: SessionExercise[],
  sets: LoggedSet[]
): { completed: number; total: number; percent: number } {
  const total = exercises.reduce((sum, exercise) => {
    const config = normalizeSetConfiguration(exercise.setConfig, exercise.targetSets);
    return sum + exercise.targetSets + config.warmups.length + config.workSets.reduce(
      (dropCount, set) => dropCount + set.dropSteps.length,
      0
    );
  }, 0);
  const completed = Math.min(
    total,
    sets.filter((set) => set.isCompleted).length
  );
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

/**
 * Logs a set at a specific set number.
 *
 * Logging the same set number twice updates it, so a set can be corrected
 * without leaving a duplicate behind.
 */
export async function logSetAt(
  database: GymPalDatabase,
  sessionId: number,
  exerciseId: number,
  setNumber: number,
  input: SetInput,
  metadata: {
    setKind?: 'straight' | 'warmup' | 'drop' | 'amrap';
    plannedSetNumber?: number | null;
    segmentNumber?: number;
    supersetRound?: number | null;
  } = {}
): Promise<LoggedSet> {
  const errors = validateSet(input);
  if (hasSetErrors(errors)) {
    throw new Error('The set could not be saved.');
  }

  const completedAt = Date.now();

  return database.logSet({
    sessionId,
    exerciseId,
    setNumber,
    weightKg: input.weightKg ?? null,
    reps: input.reps ?? null,
    rpe: input.rpe ?? null,
    completedAt,
    setKind: metadata.setKind,
    plannedSetNumber: metadata.plannedSetNumber,
    segmentNumber: metadata.segmentNumber,
    supersetRound: metadata.supersetRound,
  });
}

/**
 * Logs a set and starts the rest timer.
 *
 * The set is written before the timer starts, so an interruption between the
 * two never loses what the user did.
 */
export async function logSetForExercise(
  database: GymPalDatabase,
  sessionId: number,
  exerciseId: number,
  input: SetInput
): Promise<LoggedSet> {
  const setNumber = currentSetNumber(await database.getSetsForSession(sessionId), exerciseId);
  return logSetAt(database, sessionId, exerciseId, setNumber, input);
}

/**
 * Starts the rest timer for an exercise.
 *
 * The timer is stored as the moment it ends, so it keeps running while the
 * app is in the background. The work clock is paused and banked, so the two
 * clocks never overlap.
 */
export async function startRest(
  database: GymPalDatabase,
  sessionId: number,
  seconds: number
): Promise<number> {
  return startRestTimer(database.raw, sessionId, seconds);
}

/** Ends the rest timer early and starts the work clock again. */
export async function endRest(
  database: GymPalDatabase,
  sessionId: number
): Promise<void> {
  await endRestTimer(database.raw, sessionId);
}

/** Adds time to the rest timer. */
export async function extendRest(
  database: GymPalDatabase,
  sessionId: number,
  seconds: number
): Promise<number> {
  return extendRestTimer(database.raw, sessionId, seconds);
}

/**
 * A phase of a workout.
 *
 * A workout is a timeline: work on a set, rest, work on the next set, and so
 * on. The user moves along it with a swipe.
 */
export type WorkoutWorkPhase = {
  kind: 'work';
  exercise: SessionExercise;
  /** Unique persisted ordinal for this session exercise. */
  setNumber: number;
  /** User-facing work set number, null for warm-ups. */
  plannedSetNumber: number | null;
  segmentNumber: number;
  setKind: 'straight' | 'warmup' | 'drop' | 'amrap';
  supersetRound: number | null;
  prescribedWeightKg: number | null;
  prescribedReps: number | null;
  repRangeMin: number | null;
  repRangeMax: number | null;
};

export type WorkoutRestPhase = {
  kind: 'rest';
  exercise: SessionExercise;
  afterSet: number;
  durationSeconds: number;
  afterPhase: WorkoutWorkPhase;
};

export type WorkoutPhase = WorkoutWorkPhase | WorkoutRestPhase;

/**
 * Builds the timeline of a session.
 *
 * Every planned set is a phase, and every set is followed by a rest, except
 * the last one.
 */
export function buildPhases(exercises: SessionExercise[]): WorkoutPhase[] {
  type Unit = { exercise: SessionExercise; parts: Omit<WorkoutWorkPhase, 'setNumber'>[] };
  type Bundle = { units: Unit[]; restSeconds: number; round: number | null };

  const bundles: Bundle[] = [];
  const consumedGroups = new Set<string>();

  const makeUnit = (
    exercise: SessionExercise,
    setKind: WorkoutWorkPhase['setKind'],
    plannedSetNumber: number | null,
    segmentNumber: number,
    prescribedWeightKg: number | null,
    prescribedReps: number | null,
    repRangeMin: number | null,
    repRangeMax: number | null,
    supersetRound: number | null
  ): Unit => ({
    exercise,
    parts: [{
      kind: 'work', exercise, plannedSetNumber, segmentNumber, setKind,
      supersetRound, prescribedWeightKg, prescribedReps, repRangeMin, repRangeMax,
    }],
  });

  const warmupBundles = (exercise: SessionExercise): Bundle[] => {
    const config = normalizeSetConfiguration(exercise.setConfig, exercise.targetSets);
    return config.warmups.map((warmup, index) => ({
      units: [makeUnit(exercise, 'warmup', null, index + 1, warmup.weightKg, warmup.reps, null, null, null)],
      restSeconds: exercise.restSeconds,
      round: null,
    }));
  };

  const workUnit = (
    exercise: SessionExercise,
    setNumber: number,
    supersetRound: number | null
  ): Unit => {
    const config = normalizeSetConfiguration(exercise.setConfig, exercise.targetSets);
    const prescription: WorkSetPrescription = config.workSets[setNumber - 1] ?? {
      style: 'straight', minReps: null, dropSteps: [],
    };
    const style: SetStyle = prescription.style;
    const kind = style === 'straight' ? 'straight' : style;
    const parts: Unit['parts'] = [{
      kind: 'work', exercise, plannedSetNumber: setNumber, segmentNumber: 1,
      setKind: kind, supersetRound, prescribedWeightKg: null,
      prescribedReps: style === 'amrap' ? null : null,
      repRangeMin: style === 'amrap' ? prescription.minReps : exercise.repRangeMin,
      repRangeMax: style === 'amrap' ? null : exercise.repRangeMax,
    }];
    if (style === 'drop') {
      for (const [index, drop] of prescription.dropSteps.entries()) {
        parts.push({
          kind: 'work', exercise, plannedSetNumber: setNumber,
          segmentNumber: index + 2, setKind: 'drop', supersetRound,
          prescribedWeightKg: drop.weightKg, prescribedReps: drop.reps,
          repRangeMin: null, repRangeMax: null,
        });
      }
    }
    return { exercise, parts };
  };

  const appendRegular = (exercise: SessionExercise, fromSet = 1) => {
    for (let setNumber = fromSet; setNumber <= exercise.targetSets; setNumber += 1) {
      bundles.push({ units: [workUnit(exercise, setNumber, null)], restSeconds: exercise.restSeconds, round: null });
    }
  };

  for (const exercise of exercises) {
    if (exercise.status === 'skipped') continue;
    if (!exercise.supersetGroup) {
      bundles.push(...warmupBundles(exercise));
      appendRegular(exercise);
      continue;
    }
    if (consumedGroups.has(exercise.supersetGroup)) continue;
    consumedGroups.add(exercise.supersetGroup);
    const members = exercises.filter(
      (candidate) => candidate.supersetGroup === exercise.supersetGroup && candidate.status !== 'skipped'
    );
    for (const member of members) bundles.push(...warmupBundles(member));
    const rounds = Math.min(...members.map((member) => member.targetSets));
    for (let round = 1; round <= rounds; round += 1) {
      bundles.push({
        units: members.map((member) => workUnit(member, round, round)),
        restSeconds: Math.max(...members.map((member) => member.restSeconds)),
        round,
      });
    }
    for (const member of members) appendRegular(member, rounds + 1);
  }

  const nextOrdinal = new Map<number, number>();
  const phases: WorkoutPhase[] = [];
  bundles.forEach((bundle, bundleIndex) => {
    let lastPhase: WorkoutWorkPhase | null = null;
    for (const unit of bundle.units) {
      for (const part of unit.parts) {
        const ordinal = (nextOrdinal.get(unit.exercise.exerciseId) ?? 0) + 1;
        nextOrdinal.set(unit.exercise.exerciseId, ordinal);
        const phase: WorkoutWorkPhase = { ...part, setNumber: ordinal };
        phases.push(phase);
        lastPhase = phase;
      }
    }
    if (lastPhase && bundleIndex < bundles.length - 1) {
      phases.push({
        kind: 'rest', exercise: lastPhase.exercise, afterSet: lastPhase.setNumber,
        durationSeconds: bundle.restSeconds, afterPhase: lastPhase,
      });
    }
  });
  return phases;
}

/**
 * Moves the session on to the next phase.
 *
 * Leaving a work phase logs the set and starts the rest; leaving a rest
 * phase starts the next set. The set is written before the rest begins, so
 * an interruption between the two never loses what the user did.
 *
 * Leaving a rest phase writes the set that was just done again, so a weight or
 * a rep count can still be corrected while the user rests.
 */
export async function advancePhase(
  database: GymPalDatabase,
  sessionId: number,
  phases: WorkoutPhase[],
  currentIndex: number,
  input: SetInput = {}
): Promise<number> {
  const phase = phases[currentIndex];
  if (!phase) {
    return currentIndex;
  }

  if (phase.kind === 'work') {
    await logSetAt(
      database,
      sessionId,
      phase.exercise.exerciseId,
      phase.setNumber,
      input,
      phase
    );
    const next = phases[currentIndex + 1];
    await switchSessionPhase(database.raw, sessionId, {
      kind: next?.kind ?? 'work',
      restSeconds: phase.exercise.restSeconds,
      phaseIndex: currentIndex + 1,
      exerciseId: next?.exercise.exerciseId ?? phase.exercise.exerciseId,
    });
    return currentIndex + 1;
  }

  // The rest is over: the last completed segment can still be corrected.
  // This matters when the user skipped the remaining drops: skipped rows are
  // persisted for history, but must not turn into performed sets here.
  const existingSets = await database.getSetsForSession(sessionId);
  const correctable = existingSets
    .filter((set) =>
      set.isCompleted && set.exerciseId === phase.exercise.exerciseId &&
      set.plannedSetNumber === phase.afterPhase.plannedSetNumber &&
      set.setNumber <= phase.afterSet
    )
    .sort((a, b) => b.setNumber - a.setNumber)[0];
  if (correctable) {
    const correctablePhase = phases
      .slice(0, currentIndex)
      .find((candidate) => candidate.kind === 'work' && candidate.setNumber === correctable.setNumber);
    await logSetAt(
      database,
      sessionId,
      phase.exercise.exerciseId,
      correctable.setNumber,
      input,
      correctablePhase?.kind === 'work'
        ? correctablePhase
        : {
            setKind: correctable.setKind ?? 'straight',
            plannedSetNumber: correctable.plannedSetNumber,
            segmentNumber: correctable.segmentNumber,
            supersetRound: correctable.supersetRound,
          }
    );
  }

  await switchSessionPhase(database.raw, sessionId, {
    kind: 'work',
    restSeconds: phase.durationSeconds,
    phaseIndex: currentIndex + 1,
    exerciseId: phases[currentIndex + 1]?.exercise.exerciseId ?? phase.exercise.exerciseId,
  });
  return currentIndex + 1;
}

/**
 * Moves the session back to the previous phase.
 *
 * The phase being left keeps whatever was already written, so going back is
 * safe: the set is only rewritten when the user moves forward again.
 */
export async function goBackPhase(
  database: GymPalDatabase,
  sessionId: number,
  phases: WorkoutPhase[],
  currentIndex: number
): Promise<number> {
  const previousIndex = Math.max(0, currentIndex - 1);
  const phase = phases[previousIndex];

  await switchSessionPhase(database.raw, sessionId, {
    kind: phase?.kind ?? 'work',
    restSeconds: phase?.kind === 'rest' ? phase.durationSeconds : 0,
    phaseIndex: previousIndex,
    exerciseId: phase?.exercise.exerciseId,
  });

  return previousIndex;
}

/**
 * The two clocks of a session.
 *
 * Both are derived from timestamps, so they are correct after the app has
 * been in the background. Which one is running is decided by the phase.
 */
export type SessionClocks = {
  /** Seconds spent working on the current set, resting excluded. */
  exerciseSeconds: number;
  /** Seconds spent resting so far. */
  restSeconds: number;
  /** Milliseconds left on the rest timer. Negative once the rest is over. */
  restRemainingMs: number;
  /** True when the rest has run out. */
  restOverdue: boolean;
  /** How much of the rest has been taken, 0 to 1. */
  restProgress: number;
  /** How far through the planned sets of the current exercise, 0 to 1. */
  setProgress: number;
};

export function sessionClocks(
  session: {
    exerciseElapsedSeconds: number;
    exerciseStartedAt: number | null;
    restTotalSeconds: number;
    restStartedAt: number | null;
    restEndsAt: number | null;
  } | null,
  now: number,
  current: SessionExercise | null,
  setsLogged: number
): SessionClocks {
  const exerciseSeconds =
    (session?.exerciseElapsedSeconds ?? 0) +
    (session?.exerciseStartedAt
      ? Math.max(0, Math.floor((now - session.exerciseStartedAt) / 1000))
      : 0);

  const restSeconds =
    (session?.restTotalSeconds ?? 0) +
    (session?.restStartedAt
      ? Math.max(0, Math.floor((now - session.restStartedAt) / 1000))
      : 0);

  const restRemainingMs = session?.restEndsAt ? session.restEndsAt - now : 0;

  const restLength = session?.restEndsAt && session?.restStartedAt
    ? Math.max(1, Math.round((session.restEndsAt - session.restStartedAt) / 1000))
    : 0;
  const restElapsed = session?.restStartedAt
    ? Math.max(0, Math.floor((now - session.restStartedAt) / 1000))
    : 0;

  const targetSets = current?.targetSets ?? 0;

  return {
    exerciseSeconds,
    restSeconds,
    restRemainingMs,
    restOverdue: restRemainingMs < 0,
    restProgress: restLength === 0 ? 0 : Math.min(1, Math.max(0, restElapsed / restLength)),
    setProgress:
      targetSets === 0 ? 0 : Math.min(1, Math.max(0, setsLogged / targetSets)),
  };
}

/** Moves the focus to another exercise and records it on the session. */
export async function focusExercise(
  database: GymPalDatabase,
  sessionId: number,
  exerciseId: number | null
): Promise<void> {
  await database.setCurrentExercise(sessionId, exerciseId);
}

/** Marks an exercise as skipped and moves on. */
export async function skipExercise(
  database: GymPalDatabase,
  sessionId: number,
  exercise: SessionExercise
): Promise<void> {
  await database.setSessionExerciseStatus(sessionId, exercise.position, 'skipped');
}

/** Marks an exercise as finished. */
export async function completeExercise(
  database: GymPalDatabase,
  sessionId: number,
  exercise: SessionExercise
): Promise<void> {
  await database.setSessionExerciseStatus(sessionId, exercise.position, 'completed');
}

/**
 * Finishes the session.
 *
 * The end time and the duration are stored, the personal records are
 * recalculated from what was actually logged, and the session is marked as
 * completed.
 */
export async function finishSession(
  database: GymPalDatabase,
  sessionId: number,
  options: { endedAt?: number; notes?: string | null } = {}
): Promise<void> {
  await database.completeSession(sessionId, options);
  await database.recalculateRecordsForSession(sessionId);
}

/**
 * Abandons the session.
 *
 * The sets that were logged are kept. The session is marked as abandoned so
 * it stops appearing as something to resume, and the user can still look at
 * what they did.
 */
export async function abandonSession(
  database: GymPalDatabase,
  sessionId: number
): Promise<void> {
  await database.abandonSession(sessionId);
}

/** Convenience re-exports from the data layer. */
export { addSet, removeSet } from '@/db/repositories/sets';
export {
  addSessionExercise,
  removeSessionExercise,
  swapSessionExercise,
  swapSessionExercisePositions,
  setSessionPhaseIndex,
} from '@/db/repositories/sessions';
