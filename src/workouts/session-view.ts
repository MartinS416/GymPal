import type { PreviousPerformance, SessionExercise } from '@/db/repositories/sessions';
import type { LoggedSet } from '@/db/repositories/sets';
import { kgToLb } from '@/lib/units';
import {
  sessionClocks,
  type WorkoutPhase,
  type WorkoutWorkPhase,
} from '@/workouts/session-runner';
import { normalizeSetConfiguration } from '@/workouts/set-types';
import { formatDuration, formatRestCountdown } from '@/workouts/timer';

/** The session fields the clocks are derived from. */
export type SessionClockSource = {
  startedAt: number;
  exerciseElapsedSeconds: number;
  exerciseStartedAt: number | null;
  restTotalSeconds: number;
  workTotalSeconds: number;
  restStartedAt: number | null;
  restEndsAt: number | null;
};

/** The recap shown once every set is done. */
export type SessionPhaseSummary = {
  volume: string;
  activeTime: string;
  restTime: string;
  totalTime: string;
};

export type SessionPhaseView = {
  phase: WorkoutPhase | null;
  exercise: SessionExercise | null;
  isRest: boolean;
  /** The exercise name, or the title of the empty state. */
  title: string;
  /** "Resting", the set label, or the empty state. */
  subtitle: string;
  setLabel: string;
  instruction: string | null;
  nextHint: string | null;
  subjectSetKind: WorkoutWorkPhase['setKind'] | null;
  /** Identifies the set the fields belong to, so typed values can carry over. */
  inputKey: string;
  exerciseClock: string;
  restClock: string;
  ringValue: string;
  ringLabel: string;
  ringProgress: number;
  restOverdue: boolean;
  weightUnit: string;
  weightValue: string;
  repsValue: string;
  isAmrap: boolean;
  minReps: number | null;
  showSkipSuperset: boolean;
  showSkipWarmup: boolean;
  hasRemainingDropSteps: boolean;
  canAddSet: boolean;
  canRemoveSet: boolean;
  /** The end-of-workout recap; null until every phase is done. */
  summary: SessionPhaseSummary | null;
};

export type SessionPhaseViewArgs = {
  phases: WorkoutPhase[];
  phaseIndex: number;
  exercises: SessionExercise[];
  sets: LoggedSet[];
  session: SessionClockSource | null;
  now: number;
  system: 'metric' | 'imperial';
  previous: PreviousPerformance | null;
  input: { key: string; weight: string; reps: string } | null;
  /**
   * True for a page that is only being previewed during a swipe: its clocks
   * have not started yet, so they show the start of the phase.
   */
  preview?: boolean;
};

/**
 * Everything the phase page shows, for one point on the timeline.
 *
 * The screen renders two of these while a swipe is in flight — the phase being
 * left and the phase arriving — so the neighbouring phase can be built without
 * touching the database.
 */
export function buildSessionPhaseView({
  phases,
  phaseIndex,
  exercises,
  sets,
  session,
  now,
  system,
  previous,
  input,
  preview = false,
}: SessionPhaseViewArgs): SessionPhaseView {
  const phase: WorkoutPhase | null = phases[phaseIndex] ?? null;
  const isRest = phase?.kind === 'rest';
  const exercise = phase?.exercise ?? null;
  const weightUnit = system === 'imperial' ? 'lb' : 'kg';

  const setsForCurrent = exercise
    ? sets.filter((set) => set.exerciseId === exercise.exerciseId && set.isCompleted)
    : [];

  /**
   * The set the fields belong to.
   *
   * While working it is the set being done; while resting it is the set that
   * was just finished, so the user can still correct it.
   */
  let subject: WorkoutWorkPhase | null = null;
  if (phase?.kind === 'work') {
    subject = phase;
  } else if (phase) {
    const correctable = sets
      .filter((set) =>
        set.isCompleted && set.exerciseId === phase.exercise.exerciseId &&
        set.plannedSetNumber === phase.afterPhase.plannedSetNumber &&
        set.setNumber <= phase.afterSet
      )
      .sort((a, b) => b.setNumber - a.setNumber)[0];
    subject = correctable
      ? phases
          .slice(0, phaseIndex)
          .find(
            (candidate): candidate is WorkoutWorkPhase =>
              candidate.kind === 'work' && candidate.setNumber === correctable.setNumber
          ) ?? phase.afterPhase
      : phase.afterPhase;
  }

  const clocks = sessionClocks(session, now, exercise, setsForCurrent.length);

  // The fill of the work ring counts the sets completed before the one in
  // progress, so adding or removing sets never moves the clock.
  let setProgress = 0;
  if (phase?.kind === 'work') {
    const setsBeforeCurrent = phase.setNumber - 1;
    const loggedBefore = setsForCurrent.filter((set) => set.setNumber < phase.setNumber).length;
    const done = Math.min(setsBeforeCurrent, loggedBefore);
    const total = Math.max(1, phase.setNumber);
    const progress = total > 0 ? done / total : 0;
    setProgress = progress > 1 ? 1 : progress;
  }

  const subjectRef = subject;
  const subjectSet = subjectRef
    ? sets.find(
        (set) =>
          set.exerciseId === subjectRef.exercise.exerciseId &&
          set.setNumber === subjectRef.setNumber && set.isCompleted
      )
    : undefined;
  const lastSet = setsForCurrent[setsForCurrent.length - 1];
  const lastPerformance = previous?.sets[previous.sets.length - 1];
  const targetReps = subject?.exercise.repRangeMin ?? 0;

  const isOptionalLoadPhase = subject?.setKind === 'warmup' || subject?.setKind === 'drop';
  const suggestedWeightKg = subjectSet?.weightKg ?? (
    isOptionalLoadPhase
      ? subject?.prescribedWeightKg ?? null
      : lastSet?.weightKg ?? lastPerformance?.weightKg ?? null
  );
  const suggestedReps = subjectSet?.reps ?? (
    subject?.setKind === 'warmup' || subject?.setKind === 'drop'
      ? subject.prescribedReps
      : subject?.setKind === 'amrap'
        ? null
        : lastSet?.reps ?? lastPerformance?.reps ?? (targetReps > 0 ? targetReps : null)
  );
  const suggestedWeight = suggestedWeightKg === null
    ? null
    : system === 'imperial'
      ? Number(kgToLb(suggestedWeightKg).toFixed(1))
      : suggestedWeightKg;

  // The key follows the set, not the phase, so the values carry over from the
  // set into the rest.
  const inputKey = subject ? `${subject.exercise.exerciseId}:${subject.setNumber}` : 'none';
  const typed = input && input.key === inputKey ? input : null;
  const weightValue = typed
    ? typed.weight
    : suggestedWeight !== null
      ? String(suggestedWeight)
      : '';
  const repsValue = typed
    ? typed.reps
    : suggestedReps !== null
      ? String(suggestedReps)
      : '';

  const supersetRoundCount = phase?.kind === 'work' && phase.exercise.supersetGroup
    ? Math.min(
        ...exercises
          .filter((item) => item.supersetGroup === phase.exercise.supersetGroup)
          .map((item) => item.targetSets)
      )
    : 0;
  const phaseConfig = phase?.kind === 'work'
    ? normalizeSetConfiguration(phase.exercise.setConfig, phase.exercise.targetSets)
    : null;
  const dropCount = phase?.kind === 'work' && phase.plannedSetNumber !== null
    ? (phaseConfig?.workSets[phase.plannedSetNumber - 1]?.dropSteps.length ?? 0)
    : 0;
  const hasRemainingDropSteps = phase?.kind === 'work' && phase.setKind === 'drop' &&
    phases.slice(phaseIndex + 1).some((candidate) =>
      candidate.kind === 'work' && candidate.exercise.id === phase.exercise.id &&
      candidate.plannedSetNumber === phase.plannedSetNumber && candidate.setKind === 'drop'
    );
  const setLabel = !phase
    ? phases.length > 0 ? 'All sets complete' : 'No exercises yet'
    : phase.kind !== 'work'
      ? ''
      : phase.setKind === 'warmup'
        ? `Warm-up ${phase.segmentNumber} of ${phaseConfig?.warmups.length ?? phase.segmentNumber}`
        : phase.setKind === 'drop'
          ? phase.segmentNumber === 1
            ? `Drop set · Main effort · Set ${phase.plannedSetNumber}`
            : `Drop ${phase.segmentNumber - 1} of ${dropCount} · Set ${phase.plannedSetNumber}`
          : phase.setKind === 'amrap'
            ? `AMRAP · Set ${phase.plannedSetNumber} of ${phase.exercise.targetSets}`
            : phase.supersetRound !== null
              ? `Superset ${getSupersetLetter(exercises, phase.exercise.supersetGroup)} · Round ${phase.supersetRound} of ${supersetRoundCount} · Set ${phase.plannedSetNumber}`
              : `Set ${phase.plannedSetNumber} of ${phase.exercise.targetSets}`;

  const instruction = phase?.kind !== 'work'
    ? null
    : phase.setKind === 'amrap'
      ? phase.repRangeMin === null
        ? 'As many reps as you choose'
        : `As many reps as you choose · minimum guidance ${phase.repRangeMin}`
      : phase.setKind === 'warmup' || phase.segmentNumber > 1
        ? [
            phase.prescribedWeightKg === null ? null : `${formatSessionWeight(phase.prescribedWeightKg, system)} planned`,
            phase.prescribedReps === null ? null : `${phase.prescribedReps} reps planned`,
          ].filter(Boolean).join(' · ') || 'Enter the load and reps you choose'
        : null;

  const nextWorkPhase = phase?.kind === 'work'
    ? phases
        .slice(phaseIndex + 1)
        .find((candidate): candidate is WorkoutWorkPhase => candidate.kind === 'work')
    : undefined;
  const nextSupersetExercise = phase?.kind === 'work' && phase.supersetRound !== null
    ? phases
        .slice(phaseIndex + 1)
        .find((candidate): candidate is WorkoutWorkPhase =>
          candidate.kind === 'work' && candidate.supersetRound === phase.supersetRound &&
          candidate.exercise.id !== phase.exercise.id
        )
    : undefined;
  const nextHint = phase?.kind !== 'work'
    ? null
    : nextWorkPhase?.exercise.id === phase.exercise.id &&
        nextWorkPhase.plannedSetNumber === phase.plannedSetNumber &&
        nextWorkPhase.segmentNumber !== phase.segmentNumber
      ? `Next drop ${nextWorkPhase.segmentNumber - 1}${nextSupersetExercise ? ` · then ${nextSupersetExercise.exercise.name}` : ''}`
      : nextSupersetExercise
        ? `Next: ${nextSupersetExercise.exercise.name}`
        : null;

  const exerciseSeconds = preview ? 0 : clocks.exerciseSeconds;
  const restSeconds = preview ? 0 : clocks.restSeconds;
  const restRemainingMs = preview && phase?.kind === 'rest'
    ? phase.durationSeconds * 1000
    : clocks.restRemainingMs;
  const restProgress = preview ? 0 : clocks.restProgress;

  const totalVolumeKg = sets.reduce(
    (total, set) => total + (set.isCompleted ? (set.weightKg ?? 0) * (set.reps ?? 0) : 0),
    0
  );
  const displayedVolume = system === 'imperial' ? kgToLb(totalVolumeKg) : totalVolumeKg;
  // On the page that arrives with the final swipe the clocks are stopped just
  // after the preview is drawn, so include the run that is still in progress.
  const liveWorkSeconds = session?.exerciseStartedAt
    ? Math.max(0, Math.floor((now - session.exerciseStartedAt) / 1000))
    : 0;
  const liveRestSeconds = session?.restStartedAt
    ? Math.max(0, Math.floor((now - session.restStartedAt) / 1000))
    : 0;
  const summary: SessionPhaseSummary | null = phase
    ? null
    : {
        volume: `${formatWhole(displayedVolume)} ${weightUnit}`,
        activeTime: formatDuration((session?.workTotalSeconds ?? 0) + liveWorkSeconds),
        restTime: formatDuration((session?.restTotalSeconds ?? 0) + liveRestSeconds),
        totalTime: formatDuration(
          session ? Math.max(0, Math.floor((now - session.startedAt) / 1000)) : 0
        ),
      };

  return {
    phase,
    exercise,
    isRest,
    title: exercise?.name ?? 'Workout',
    subtitle: isRest ? 'Resting' : setLabel,
    setLabel,
    instruction,
    nextHint,
    subjectSetKind: subject?.setKind ?? null,
    inputKey,
    exerciseClock: formatDuration(exerciseSeconds),
    restClock: formatDuration(restSeconds),
    ringValue: isRest
      ? formatRestCountdown(restRemainingMs)
      : formatDuration(exerciseSeconds),
    ringLabel: isRest ? 'REST' : 'EXERCISE TIME',
    ringProgress: isRest ? restProgress : setProgress,
    restOverdue: isRest && restRemainingMs < 0,
    weightUnit,
    weightValue,
    repsValue,
    isAmrap: phase?.kind === 'work' && phase.setKind === 'amrap',
    minReps: phase?.kind === 'work' && phase.setKind === 'amrap' ? phase.repRangeMin : null,
    showSkipSuperset: phase?.kind === 'work' && Boolean(phase.exercise.supersetGroup),
    showSkipWarmup: phase?.kind === 'work' && phase.setKind === 'warmup',
    hasRemainingDropSteps,
    canAddSet: Boolean(exercise),
    canRemoveSet: (exercise?.targetSets ?? 0) > 0,
    summary,
  };
}

function getSupersetLetter(
  exercises: { supersetGroup?: string | null }[],
  group?: string | null
): string {
  const groups = [
    ...new Set(
      exercises
        .map((exercise) => exercise.supersetGroup)
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const index = group ? groups.indexOf(group) : -1;
  return index >= 0 ? String.fromCharCode(65 + (index % 26)) : 'A';
}

function formatSessionWeight(weightKg: number, system: 'metric' | 'imperial'): string {
  return system === 'imperial'
    ? `${Number(kgToLb(weightKg).toFixed(1))} lb`
    : `${Number(weightKg.toFixed(1))} kg`;
}

function formatWhole(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
