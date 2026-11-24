import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/button';
import { Chevron } from '@/components/chevron';
import { ExercisePicker } from '@/components/exercise-picker';
import { Field } from '@/components/text-input';
import { LoadingScreen } from '@/components/loading-screen';
import { Text } from '@/components/text';
import { TimerRing } from '@/components/timer-ring';
import { WorkoutEditSheet } from '@/components/workout-edit-sheet';
import { colors, radius, spacing } from '@/constants/theme';
import { useDatabase } from '@/db/database-provider';
import type { PreviousPerformance } from '@/db/repositories/sessions';
import type { Exercise } from '@/db/repositories/exercises';
import { useAsyncData } from '@/hooks/use-async-data';
import { useBlink } from '@/hooks/use-blink';
import { useHaptics } from '@/hooks/use-haptics';
import { useNow } from '@/hooks/use-now';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import { useWorkoutLiveActivity } from '@/hooks/use-workout-live-activity';
import { useProfile } from '@/state/profile-context';
import { switchSessionPhase } from '@/db/repositories/sessions';
import {
  advancePhase,
  buildPhases,
  finishSession,
  goBackPhase,
  logSetAt,
  sessionClocks,
  type WorkoutPhase,
  type WorkoutWorkPhase,
  swapSessionExercise,
  setSessionPhaseIndex,
  swapSessionExercisePositions,
} from '@/workouts/session-runner';
import { formatDuration, formatRestCountdown } from '@/workouts/timer';
import { kgToLb, lbToKg } from '@/lib/units';
import { normalizeSetConfiguration } from '@/workouts/set-types';

/**
 * The active workout.
 *
 * The screen is a timeline of phases. Swiping left moves on — logging the set
 * and starting the rest — and swiping right goes back. The clock is in the
 * middle, and the whole screen inverts while the user rests.
 *
 * While a set is in focus the exercise name opens the exercise library so the
 * user can swap movements, the + / − beside the clock add and remove sets, and
 * the "Edit Workout" button opens the full workout list with drag to reorder.
 */
export default function ActiveSessionScreen() {
  const router = useRouter();
  const database = useDatabase();
  const insets = useSafeAreaInsets();
  const { status, profile } = useProfile();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const haptics = useHaptics();
  const [saving, setSaving] = useState(false);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [menuProgress] = useState(() => new Animated.Value(0));
  const [workoutEditorOpen, setWorkoutEditorOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    Animated.timing(menuProgress, {
      toValue: menuOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [menuOpen, menuProgress]);

  const dotsRotate = menuProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });
  const menuTranslateX = menuProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  const now = useNow(500);

  const loader = useCallback(async () => {
    const id = Number(sessionId);
    const [found, sessionExercises, sessionSets] = await Promise.all([
      database.getSession(id),
      database.getSessionExercises(id),
      database.getSetsForSession(id),
    ]);
    return { session: found, exercises: sessionExercises, sets: sessionSets };
  }, [database, sessionId]);

  const { data, reload } = useAsyncData(loader);

  const session = data?.session ?? null;
  const exercises = useMemo(() => data?.exercises ?? [], [data?.exercises]);
  const sets = useMemo(() => data?.sets ?? [], [data?.sets]);

  const phases = useMemo(() => buildPhases(exercises), [exercises]);
  const phaseIndex = Math.max(0, session?.phaseIndex ?? 0);
  const phase: WorkoutPhase | null = phases[phaseIndex] ?? null;

  const isRest = phase?.kind === 'rest';
  const currentExercise = phase?.exercise ?? null;
  const setsForCurrent = useMemo(
    () =>
      currentExercise
        ? sets.filter((set) => set.exerciseId === currentExercise.exerciseId && set.isCompleted)
        : [],
    [currentExercise, sets]
  );

  /**
   * The set the fields belong to.
   *
   * While working it is the set being done; while resting it is the set that
   * was just finished, so the user can still correct it.
   */
  const subject = useMemo<WorkoutWorkPhase | null>(() => {
    if (!phase) {
      return null;
    }
    if (phase.kind === 'work') return phase;
    const correctable = sets
      .filter((set) =>
        set.isCompleted && set.exerciseId === phase.exercise.exerciseId &&
        set.plannedSetNumber === phase.afterPhase.plannedSetNumber &&
        set.setNumber <= phase.afterSet
      )
      .sort((a, b) => b.setNumber - a.setNumber)[0];
    if (!correctable) return phase.afterPhase;
    return phases
      .slice(0, phaseIndex)
      .find((candidate): candidate is WorkoutWorkPhase => candidate.kind === 'work' && candidate.setNumber === correctable.setNumber) ?? phase.afterPhase;
  }, [phase, phaseIndex, phases, sets]);

  const clocks = useMemo(
    () => sessionClocks(session, now, currentExercise, setsForCurrent.length),
    [currentExercise, now, session, setsForCurrent.length]
  );

  // The fill of the work ring counts the sets completed before the one in
  // progress, so adding or removing sets never moves the clock.
  const setProgress = useMemo(() => {
    if (!phase || phase.kind !== 'work') {
      return 0;
    }
    const setsBeforeCurrent = phase.setNumber - 1;
    const loggedBefore = setsForCurrent.filter((set) => set.setNumber < phase.setNumber).length;
    const done = Math.min(setsBeforeCurrent, loggedBefore);
    const total = Math.max(1, phase.setNumber);
    const progress = total > 0 ? done / total : 0;
    return progress > 1 ? 1 : progress;
  }, [phase, setsForCurrent]);

  // The phase, the timer and the workout, on the Lock Screen and in the Dynamic
  // Island as well. The activity ticks its own timer; this only pushes new props
  // when the phase actually changes.
  useWorkoutLiveActivity({
    sessionId: session?.id ?? null,
    workoutTitle: session?.title ?? null,
    phase: phase?.kind ?? null,
    exerciseName: phase?.exercise.name ?? null,
    setNumber: phase ? (phase.kind === 'work' ? phase.setNumber : phase.afterSet) : null,
    targetSets: phase?.exercise.targetSets ?? null,
    setsLogged: setsForCurrent.length,
    restEndsAt: session?.restEndsAt ?? null,
    exerciseStartedAt: session?.exerciseStartedAt ?? null,
    exerciseElapsedSeconds: session?.exerciseElapsedSeconds ?? 0,
  });

  // The rest is not cut short: once it is over the countdown goes negative and
  // blinks until the user moves on.
  const restOverdue = isRest && clocks.restOverdue;
  const blink = useBlink(restOverdue);

  // Previous performance for the exercise in focus.
  const previousLoader = useCallback(async () => {
    if (!currentExercise) {
      return null;
    }
    return database.getPreviousPerformance(currentExercise.exerciseId, {
      excludeSessionId: Number(sessionId),
    });
  }, [currentExercise, database, sessionId]);
  const { data: previous } = useAsyncData<PreviousPerformance | null>(previousLoader);

  // The inputs are prefilled, so a set can be logged without typing anything.
  const subjectSet = useMemo(
    () =>
      subject
        ? sets.find(
            (set) =>
              set.exerciseId === subject.exercise.exerciseId &&
              set.setNumber === subject.setNumber && set.isCompleted
          )
        : undefined,
    [sets, subject]
  );
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
  const system = profile?.system ?? 'metric';
  const weightUnit = system === 'imperial' ? 'lb' : 'kg';
  const suggestedWeight = suggestedWeightKg === null
    ? null
    : system === 'imperial'
      ? Number(kgToLb(suggestedWeightKg).toFixed(1))
      : suggestedWeightKg;

  // The key follows the set, not the phase, so the values carry over from the
  // set into the rest.
  const inputKey = subject
    ? `${subject.exercise.exerciseId}:${subject.setNumber}`
    : 'none';
  const [input, setInput] = useState<{ key: string; weight: string; reps: string; rpe: string } | null>(
    null
  );
  const isCurrentInput = input?.key === inputKey;
  const weightValue = isCurrentInput
    ? input.weight
    : suggestedWeight !== null
      ? String(suggestedWeight)
      : '';
  const repsValue = isCurrentInput
    ? input.reps
    : suggestedReps !== null
      ? String(suggestedReps)
      : '';
  const rpeValue = isCurrentInput ? input.rpe : subjectSet?.rpe == null ? '' : String(subjectSet.rpe);

  const handleWeightChange = (value: string) => {
    setInput({
      key: inputKey,
      weight: value,
      reps: isCurrentInput ? input.reps : repsValue,
      rpe: isCurrentInput ? input.rpe : rpeValue,
    });
  };

  const handleRepsChange = (value: string) => {
    setInput({
      key: inputKey,
      weight: isCurrentInput ? input.weight : weightValue,
      reps: value,
      rpe: isCurrentInput ? input.rpe : rpeValue,
    });
  };

  const handleRpeChange = (value: string) => {
    setInput({
      key: inputKey,
      weight: isCurrentInput ? input.weight : weightValue,
      reps: isCurrentInput ? input.reps : repsValue,
      rpe: value,
    });
  };

  const handleNext = useCallback(async () => {
    if (!session) {
      return;
    }
    setSaving(true);
      setInputError(null);
    try {
      const enteredWeight = weightValue.trim() === '' ? null : Number(weightValue.replace(',', '.'));
      const weightKg = enteredWeight === null ? null : system === 'imperial' ? lbToKg(enteredWeight) : enteredWeight;
      const repsNumber = repsValue.trim() === '' ? null : Number.parseInt(repsValue, 10);
      const rpeNumber = rpeValue.trim() === '' ? null : Number(rpeValue.replace(',', '.'));
      if (subject?.setKind === 'amrap' && repsNumber === null) {
        setInputError('Enter the reps you completed for this AMRAP set.');
        return;
      }
      await advancePhase(database, session.id, phases, phaseIndex, {
        weightKg,
        reps: repsNumber,
        rpe: rpeNumber,
      });
      reload();
    } finally {
      setSaving(false);
    }
  }, [database, phaseIndex, phases, reload, repsValue, rpeValue, session, subject?.setKind, system, weightValue]);

  const handleBack = useCallback(async () => {
    if (!session || phaseIndex === 0) {
      return;
    }
    setSaving(true);
    try {
      await goBackPhase(database, session.id, phases, phaseIndex);
      reload();
    } finally {
      setSaving(false);
    }
  }, [database, phaseIndex, phases, reload, session]);

  const handleSkipSupersetMember = useCallback(async () => {
    if (!session || !phase || !phase.exercise.supersetGroup) return;
    const currentId = phase.exercise.id;
    await database.setSessionExerciseStatus(session.id, phase.exercise.position, 'skipped');
    const remaining = exercises.map((exercise) =>
      exercise.id === currentId ? { ...exercise, status: 'skipped' as const } : exercise
    );
    const nextPhases = buildPhases(remaining);
    const nextOriginal = phases.slice(phaseIndex + 1).find(
      (candidate): candidate is WorkoutWorkPhase => candidate.kind === 'work' && candidate.exercise.id !== currentId
    );
    const nextIndex = nextOriginal
      ? nextPhases.findIndex(
          (candidate) => candidate.kind === 'work' &&
            candidate.exercise.id === nextOriginal.exercise.id &&
            candidate.plannedSetNumber === nextOriginal.plannedSetNumber &&
            candidate.segmentNumber === nextOriginal.segmentNumber
        )
      : -1;
    if (nextIndex >= 0 && nextOriginal) {
      await switchSessionPhase(database.raw, session.id, {
        kind: 'work',
        restSeconds: 0,
        phaseIndex: nextIndex,
      });
      await database.setCurrentExercise(session.id, nextOriginal.exercise.exerciseId);
    } else {
      await database.setSessionPhaseIndex(session.id, 0);
    }
    reload();
  }, [database, exercises, phase, phaseIndex, phases, reload, session]);

  const handleSkipWarmup = useCallback(async () => {
    if (!session || phase?.kind !== 'work' || phase.setKind !== 'warmup') return;
    const nextWork = phases.slice(phaseIndex + 1).find((candidate) => candidate.kind === 'work');
    const nextIndex = nextWork ? phases.indexOf(nextWork) : phases.length;
    if (nextWork) {
      await switchSessionPhase(database.raw, session.id, {
        kind: 'work',
        restSeconds: 0,
        phaseIndex: nextIndex,
      });
      await database.setCurrentExercise(session.id, nextWork.exercise.exerciseId);
    } else {
      await database.setSessionPhaseIndex(session.id, nextIndex);
    }
    reload();
  }, [database, phase, phaseIndex, phases, reload, session]);

  const handleSkipRemainingDrops = useCallback(async () => {
    if (!session || phase?.kind !== 'work' || phase.setKind !== 'drop') return;
    const remainingDrops = phases
      .slice(phaseIndex + 1)
      .filter((candidate): candidate is WorkoutWorkPhase =>
        candidate.kind === 'work' && candidate.exercise.id === phase.exercise.id &&
        candidate.plannedSetNumber === phase.plannedSetNumber && candidate.setKind === 'drop'
      );
    if (remainingDrops.length === 0) return;

    const enteredWeight = weightValue.trim() === '' ? null : Number(weightValue.replace(',', '.'));
    const weightKg = enteredWeight === null ? null : system === 'imperial' ? lbToKg(enteredWeight) : enteredWeight;
    const repsNumber = repsValue.trim() === '' ? null : Number.parseInt(repsValue, 10);
    const rpeNumber = rpeValue.trim() === '' ? null : Number(rpeValue.replace(',', '.'));
    setSaving(true);
    try {
      await logSetAt(database, session.id, phase.exercise.exerciseId, phase.setNumber, {
        weightKg, reps: repsNumber, rpe: rpeNumber,
      }, phase);
      for (const skipped of remainingDrops) {
        await database.logSet({
          sessionId: session.id,
          exerciseId: skipped.exercise.exerciseId,
          setNumber: skipped.setNumber,
          weightKg: null,
          reps: null,
          rpe: null,
          isCompleted: false,
          setKind: skipped.setKind,
          plannedSetNumber: skipped.plannedSetNumber,
          segmentNumber: skipped.segmentNumber,
          supersetRound: skipped.supersetRound,
        });
      }
      const lastSkipped = remainingDrops[remainingDrops.length - 1];
      const nextIndex = lastSkipped ? phases.indexOf(lastSkipped) + 1 : phaseIndex + 1;
      const next = phases[nextIndex];
      if (next) {
        await switchSessionPhase(database.raw, session.id, {
          kind: next.kind,
          restSeconds: next.kind === 'rest' ? next.durationSeconds : 0,
          phaseIndex: nextIndex,
          exerciseId: next.exercise.exerciseId,
        });
      } else {
        await database.setSessionPhaseIndex(session.id, phases.length);
      }
      reload();
    } catch {
      setInputError('The current set could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [database, phase, phaseIndex, phases, reload, repsValue, rpeValue, session, system, weightValue]);

  const swipe = useSwipeNavigation({
    onNext: () => {
      void handleNext();
    },
    onBack: () => {
      void handleBack();
    },
    enabled: !confirmingFinish && !workoutEditorOpen && !pickerOpen && !menuOpen,
  });

  const handleFinish = async () => {
    if (!session) {
      return;
    }
    setSaving(true);
    try {
      await finishSession(database, session.id);
      router.replace(`/sessions/${session.id}`);
    } finally {
      setSaving(false);
    }
  };

  // Adds one set to the plan of the exercise in focus. The phase timeline is
  // derived from the plan, so the new set simply becomes part of the workout
  // and the user walks through it as they normally would.
  const handleAddSet = useCallback(async () => {
    if (!session || !currentExercise) {
      return;
    }
    await database.raw.runAsync(
      `UPDATE session_exercises SET target_sets = target_sets + 1 WHERE session_id = ? AND position = ?`,
      session.id,
      currentExercise.position
    );
    await reload();
  }, [database, currentExercise, session, reload]);

  // Removes the last set of the exercise in focus and trims the plan back.
  const handleRemoveSet = useCallback(async () => {
    if (!session || !phase || !currentExercise) {
      return;
    }
    const newTargetSets = Math.max(0, (currentExercise.targetSets ?? 0) - 1);
    await database.raw.runAsync(
      `UPDATE session_exercises SET target_sets = ? WHERE session_id = ? AND position = ?`,
      newTargetSets,
      session.id,
      currentExercise.position
    );
    // Existing entries remain in history even when the remaining prescription
    // is shortened. A plan edit must never silently erase logged effort.
    // If the phase now points past the trimmed plan, move it back to the last set.
    const updatedExercises = await database.getSessionExercises(session.id);
    const updatedPhases = buildPhases(updatedExercises);
    const phaseStillValid = updatedPhases.some(
      (candidate) => candidate.exercise.id === currentExercise.id && (
        candidate.kind === 'work'
          ? candidate.setKind === 'warmup' || (candidate.plannedSetNumber ?? 0) <= newTargetSets
          : candidate.afterPhase.setKind === 'warmup' ||
            (candidate.afterPhase.plannedSetNumber ?? 0) <= newTargetSets
      )
    );
    if (!phaseStillValid) {
      let fallbackIndex = -1;
      for (let i = updatedPhases.length - 1; i >= 0; i -= 1) {
        const candidate: WorkoutPhase | undefined = updatedPhases[i];
        if (
          candidate &&
          candidate.kind === 'work' &&
          candidate.exercise.id === currentExercise.id
        ) {
          fallbackIndex = i;
          break;
        }
      }
      await setSessionPhaseIndex(database.raw, session.id, fallbackIndex === -1 ? 0 : fallbackIndex);
    }
    await reload();
  }, [database, phase, currentExercise, session, reload]);

  // Swaps the movement in focus for another from the library.
  const handleSwapExercise = useCallback(
    async (exercise: Exercise) => {
      if (!session || !phase) {
        return;
      }
      const position = phase.exercise.position;
      await swapSessionExercise(database.raw, session.id, position, exercise.id);
      const now = Date.now();
      await database.raw.runAsync(
        `UPDATE workout_sessions
            SET current_exercise_id = ?, exercise_elapsed_seconds = 0, exercise_started_at = ?, updated_at = ?
          WHERE id = ?`,
        exercise.id,
        now,
        now,
        session.id
      );
      reload();
    },
    [database, phase, session, reload]
  );

  // Adds a movement from the library to the end of the session.
  const handleAddExercise = useCallback(
    async (exercise: Exercise) => {
      if (!session) {
        return;
      }
      const position = exercises.length;
      const { addSessionExercise } = await import('@/db/repositories/sessions');
      await addSessionExercise(database.raw, {
        sessionId: session.id,
        exerciseId: exercise.id,
        position,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        equipment: exercise.equipment,
        targetSets: 3,
        repRangeMin: 5,
        repRangeMax: 10,
        restSeconds: 60,
      });
      reload();
    },
    [database, session, exercises, reload]
  );

  // Reorders the exercise list with adjacent swaps and keeps the session on
  // the exact same set/rest phase, even when another exercise crosses it.
  const handleReorder = useCallback(
    async (fromPosition: number, toPosition: number) => {
      if (!session) {
        return;
      }
      if (fromPosition === toPosition) {
        return;
      }

      const previousPhase = phases[phaseIndex];
      let idx = fromPosition;
      while (idx < toPosition) {
        await swapSessionExercisePositions(database.raw, session.id, idx, idx + 1);
        idx += 1;
      }
      while (idx > toPosition) {
        await swapSessionExercisePositions(database.raw, session.id, idx, idx - 1);
        idx -= 1;
      }

      const ordered = [...exercises];
      const item = ordered.splice(fromPosition, 1)[0];
      if (!item) {
        await reload();
        return;
      }
      ordered.splice(toPosition, 0, item);

      if (previousPhase) {
        const reorderedPhases = buildPhases(ordered);
        const samePhaseIndex = reorderedPhases.findIndex((candidate) => {
          if (candidate.exercise.id !== previousPhase.exercise.id || candidate.kind !== previousPhase.kind) {
            return false;
          }
          return candidate.kind === 'work'
            ? previousPhase.kind === 'work' && candidate.setNumber === previousPhase.setNumber
            : previousPhase.kind === 'rest' && candidate.afterSet === previousPhase.afterSet;
        });
        if (samePhaseIndex >= 0 && samePhaseIndex !== session.phaseIndex) {
          await setSessionPhaseIndex(database.raw, session.id, samePhaseIndex);
        }
      }
      await reload();
    },
    [database, exercises, phaseIndex, phases, reload, session]
  );

  if (status === 'loading') {
    return <LoadingScreen label="Loading your profile" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  if (!session) {
    return <LoadingScreen label="Opening the workout" />;
  }

  const supersetRoundCount = phase?.kind === 'work' && phase.exercise.supersetGroup
    ? Math.min(...exercises.filter((item) => item.supersetGroup === phase.exercise.supersetGroup).map((item) => item.targetSets))
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
  const phaseInstruction = phase?.kind !== 'work'
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
        : phase.repRangeMin === null
          ? null
          : `Target ${phase.repRangeMin}${phase.repRangeMax === phase.repRangeMin ? '' : `–${phase.repRangeMax}`} reps`;
  const nextWorkPhase = phase?.kind === 'work'
    ? phases.slice(phaseIndex + 1).find(
        (candidate): candidate is WorkoutWorkPhase => candidate.kind === 'work'
      )
    : undefined;
  const nextSupersetExercise = phase?.kind === 'work' && phase.supersetRound !== null
    ? phases.slice(phaseIndex + 1).find(
        (candidate): candidate is WorkoutWorkPhase =>
          candidate.kind === 'work' && candidate.supersetRound === phase.supersetRound &&
          candidate.exercise.id !== phase.exercise.id
      )
    : undefined;
  const nextWorkHint = phase?.kind !== 'work'
    ? null
    : nextWorkPhase?.exercise.id === phase.exercise.id &&
        nextWorkPhase.plannedSetNumber === phase.plannedSetNumber &&
        nextWorkPhase.segmentNumber !== phase.segmentNumber
      ? `Next drop ${nextWorkPhase.segmentNumber - 1}${nextSupersetExercise ? ` · then ${nextSupersetExercise.exercise.name}` : ''}`
      : nextSupersetExercise
        ? `Next: ${nextSupersetExercise.exercise.name}`
        : null;

  const canAddSet = Boolean(currentExercise);
  const canRemoveSet = (currentExercise?.targetSets ?? 0) > 0;

  return (
    <View
      style={[styles.container, isRest ? styles.containerInverted : null]}
      testID="session-screen"
      {...swipe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never">
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Swap exercise"
              onPress={() => setPickerOpen(true)}
              style={styles.namePress}>
              <Text
                variant="title"
                color={isRest ? colors.textOnInverted : colors.text}
                numberOfLines={2}
                style={styles.exerciseName}>
                {currentExercise?.name ?? 'Workout'}
              </Text>
            </Pressable>
            <View style={styles.headerMeta}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={menuOpen ? 'Close options' : 'More options'}
                accessibilityState={{ expanded: menuOpen }}
                onPress={() => {
                  haptics.press();
                  setMenuOpen((open) => !open);
                }}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.dotsTrigger,
                  pressed ? styles.dotsTriggerPressed : null,
                ]}
                testID="edit-workout">
                <Animated.View style={[styles.dots, { transform: [{ rotate: dotsRotate }] }]}>
                  <View style={[styles.dot, isRest ? styles.dotInverted : null]} />
                  <View style={[styles.dot, isRest ? styles.dotInverted : null]} />
                  <View style={[styles.dot, isRest ? styles.dotInverted : null]} />
                </Animated.View>
              </Pressable>
            </View>
          </View>
          <Text
            variant="caption"
            color={isRest ? 'rgba(255, 255, 255, 0.6)' : colors.textSecondary}
            style={styles.underName}>
            {isRest ? 'Resting' : setLabel}
          </Text>
          {nextWorkHint ? (
            <Text
              variant="caption"
              color={isRest ? 'rgba(255, 255, 255, 0.55)' : colors.textTertiary}
              style={styles.nextExercise}>
              {nextWorkHint}
            </Text>
          ) : null}
          {phaseInstruction ? (
            <Text
              variant="caption"
              color={isRest ? 'rgba(255, 255, 255, 0.55)' : colors.textSecondary}
              style={styles.phaseInstruction}>
              {phaseInstruction}
            </Text>
          ) : null}

          <View style={styles.ringRow}>
            <View style={styles.ringButtonGroup}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove set"
                onPress={() => void handleRemoveSet()}
                disabled={!canRemoveSet}
                style={[styles.ringButton, !canRemoveSet ? styles.ringButtonDisabled : null]}
                testID="remove-set">
                <Text style={styles.ringButtonText}>−</Text>
              </Pressable>
              <Text
                variant="caption"
                color={isRest ? 'rgba(255, 255, 255, 0.6)' : colors.textSecondary}
                style={styles.ringButtonLabel}>
                Remove set
              </Text>
            </View>
            <View style={styles.ring}>
              <TimerRing
                value={
                  isRest
                    ? formatRestCountdown(clocks.restRemainingMs)
                    : formatDuration(clocks.exerciseSeconds)
                }
                label={isRest ? 'REST' : 'EXERCISE TIME'}
                progress={isRest ? clocks.restProgress : setProgress}
                inverted={isRest}
                valueColor={restOverdue ? colors.dangerBright : undefined}
                valueOpacity={restOverdue ? blink : undefined}
              />
            </View>
            <View style={styles.ringButtonGroup}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add set"
                onPress={() => void handleAddSet()}
                disabled={!canAddSet}
                style={[styles.ringButton, !canAddSet ? styles.ringButtonDisabled : null]}
                testID="add-set">
                <Text style={styles.ringButtonText}>+</Text>
              </Pressable>
              <Text
                variant="caption"
                color={isRest ? 'rgba(255, 255, 255, 0.6)' : colors.textSecondary}
                style={styles.ringButtonLabel}>
                Add set
              </Text>
            </View>
          </View>

          <View style={styles.clocks}>
            <Clock
              label="Exercise"
              value={formatDuration(clocks.exerciseSeconds)}
              inverted={isRest}
            />
            <Clock
              label="Rest"
              value={formatDuration(clocks.restSeconds)}
              inverted={isRest}
            />
          </View>

          {/*
            The fields stay live through the rest, so the set that was just
            logged can still be corrected.
          */}
          {phase ? <View style={styles.inputs}>
            <Field
              label={`Weight (${weightUnit})`}
              value={weightValue}
              onChangeText={handleWeightChange}
              keyboardType="decimal-pad"
              placeholder="0"
              inverted={isRest}
              style={styles.input}
              testID="set-weight"
            />
            <Field
              label={phase?.kind === 'work' && phase.setKind === 'amrap' ? 'Actual reps' : 'Reps'}
              value={repsValue}
              onChangeText={handleRepsChange}
              keyboardType="number-pad"
              placeholder="0"
              inverted={isRest}
              style={styles.input}
              testID="set-reps"
            />
            <Field
              label="RPE (optional)"
              value={rpeValue}
              onChangeText={handleRpeChange}
              keyboardType="decimal-pad"
              placeholder="1–10"
              inverted={isRest}
              style={styles.input}
              testID="set-rpe"
            />
          </View> : null}

          {phase?.kind === 'work' && phase.setKind === 'amrap' && phase.repRangeMin !== null ? (
            <Text variant="caption" tone={isRest ? 'textOnInverted' : 'textSecondary'}>
              Minimum guidance: {phase.repRangeMin} reps
            </Text>
          ) : null}
          {inputError ? <Text variant="caption" tone="danger">{inputError}</Text> : null}
          {phase?.kind === 'work' && phase.exercise.supersetGroup ? (
            <Button
              label="Skip this exercise"
              variant="secondary"
              size="md"
              onPress={() => void handleSkipSupersetMember()}
              testID="skip-superset-member"
            />
          ) : null}
          {phase?.kind === 'work' && phase.setKind === 'warmup' ? (
            <Button
              label="Skip warm-up"
              variant="secondary"
              size="md"
              onPress={() => void handleSkipWarmup()}
              testID="skip-warmup"
            />
          ) : null}
          {hasRemainingDropSteps ? (
            <Button
              label="Skip remaining drops"
              variant="secondary"
              size="md"
              disabled={saving}
              onPress={() => void handleSkipRemainingDrops()}
              testID="skip-remaining-drops"
            />
          ) : null}

          <View style={styles.hint}>
            <Text
              variant="caption"
              color={isRest ? 'rgba(255, 255, 255, 0.45)' : colors.textTertiary}>
              Use Back to return
            </Text>
            <Text
              variant="caption"
              color={isRest ? 'rgba(255, 255, 255, 0.45)' : colors.textTertiary}>
              Use Log set to continue
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {confirmingFinish ? (
          <View style={styles.confirm}>
            <Text
              variant="subheading"
              color={isRest ? colors.textOnInverted : colors.text}>
              Finish workout?
            </Text>
            <View style={styles.confirmActions}>
              <Button
                label="Keep training"
                variant="secondary"
                size="md"
                onPress={() => setConfirmingFinish(false)}
                style={styles.confirmButton}
                testID="cancel-finish"
              />
              <Button
                label="Finish"
                size="md"
                onPress={handleFinish}
                loading={saving}
                style={styles.confirmButton}
                testID="confirm-finish"
              />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.phaseActions}>
              <Button
                label="Back"
                variant="secondary"
                size="md"
                disabled={phaseIndex === 0 || saving}
                onPress={() => void handleBack()}
                style={styles.phaseAction}
                testID="phase-back"
              />
              <Button
                label={isRest ? 'End rest and continue' : 'Log set and continue'}
                size="md"
                disabled={!phase || saving}
                loading={saving}
                onPress={() => void handleNext()}
                style={styles.phaseAction}
                testID="phase-next"
              />
            </View>
            <Button
              label="Finish Workout"
              variant="ghost"
              onPress={() => setConfirmingFinish(true)}
              testID="finish-workout"
            />
          </>
        )}
      </View>

      {menuOpen ? (
        <View style={styles.menuOverlay} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close options"
            onPress={() => setMenuOpen(false)}
            style={styles.menuBackdrop}
            testID="session-menu-backdrop"
          />
          <Animated.View
            style={[
              styles.menuPanel,
              {
                top: insets.top + spacing.xl + 32,
                opacity: menuProgress,
                transform: [{ translateX: menuTranslateX }],
              },
            ]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reorder workout"
              onPress={() => {
                haptics.press();
                setMenuOpen(false);
                setWorkoutEditorOpen(true);
              }}
              style={({ pressed }) => [
                styles.menuOption,
                pressed ? styles.menuOptionPressed : null,
              ]}
              testID="session-menu-reorder">
              <Text variant="body">Reorder workout</Text>
              <Chevron direction="right" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add exercise"
              onPress={() => {
                haptics.press();
                setMenuOpen(false);
                setPickerOpen(true);
              }}
              style={({ pressed }) => [
                styles.menuOption,
                styles.menuOptionDivided,
                pressed ? styles.menuOptionPressed : null,
              ]}
              testID="session-menu-add">
              <Text variant="body">Add exercise</Text>
              <Chevron direction="right" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Finish workout"
              onPress={() => {
                haptics.press();
                setMenuOpen(false);
                setConfirmingFinish(true);
              }}
              style={({ pressed }) => [
                styles.menuOption,
                styles.menuOptionDivided,
                pressed ? styles.menuOptionPressed : null,
              ]}
              testID="session-menu-finish">
              <Text variant="body">Finish workout</Text>
              <Chevron direction="right" />
            </Pressable>
          </Animated.View>
        </View>
      ) : null}

      <WorkoutEditSheet
        visible={workoutEditorOpen}
        onClose={() => setWorkoutEditorOpen(false)}
        exercises={exercises}
        currentPosition={phase?.exercise?.position ?? -1}
        workoutTitle={session?.title ?? null}
        onAddExercise={handleAddExercise}
        onReorder={handleReorder}
      />

      <ExercisePicker
        visible={pickerOpen}
        excludeIds={currentExercise ? [currentExercise.exerciseId] : []}
        onClose={() => setPickerOpen(false)}
        onSelect={(exercise) => void handleSwapExercise(exercise)}
      />
    </View>
  );
}

function Clock({
  label,
  value,
  inverted,
}: {
  label: string;
  value: string;
  inverted: boolean;
}) {
  return (
    <View style={styles.clock}>
      <Text
        variant="eyebrow"
        color={inverted ? 'rgba(255, 255, 255, 0.55)' : colors.textTertiary}>
        {label}
      </Text>
      <Text
        variant="metric"
        color={inverted ? colors.textOnInverted : colors.text}
        style={styles.clockValue}>
        {value}
      </Text>
    </View>
  );
}

function getSupersetLetter(exercises: { supersetGroup?: string | null }[], group?: string | null): string {
  const groups = [...new Set(exercises.map((exercise) => exercise.supersetGroup).filter((value): value is string => Boolean(value)))];
  const index = group ? groups.indexOf(group) : -1;
  return index >= 0 ? String.fromCharCode(65 + (index % 26)) : 'A';
}

function formatSessionWeight(weightKg: number, system: 'metric' | 'imperial'): string {
  return system === 'imperial'
    ? `${Number(kgToLb(weightKg).toFixed(1))} lb`
    : `${Number(weightKg.toFixed(1))} kg`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    // The screen is driven by swipes, so a drag must not select text.
    userSelect: 'none',
  },
  containerInverted: {
    backgroundColor: colors.inverted,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.base,
  },
  namePress: {
    flex: 1,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dotsTrigger: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.xs,
  },
  dotsTriggerPressed: {
    opacity: 0.5,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3.5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  dotInverted: {
    backgroundColor: colors.textOnInverted,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  menuPanel: {
    position: 'absolute',
    right: spacing.lg,
    minWidth: 208,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.14,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  menuOptionDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  menuOptionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  exerciseName: {
    letterSpacing: -0.4,
  },
  underName: {
    marginTop: spacing.xs,
  },
  nextExercise: {
    marginTop: spacing.xs,
  },
  phaseInstruction: {
    marginTop: spacing.xs,
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  ring: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  ringButtonGroup: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  ringButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringButtonDisabled: {
    opacity: 0.35,
  },
  ringButtonText: {
    fontSize: 26,
    lineHeight: 44,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.text,
  },
  ringButtonLabel: {
    fontSize: 11,
  },
  clocks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
    marginTop: spacing.md,
  },
  clock: {
    alignItems: 'center',
    gap: 2,
  },
  clockValue: {
    fontVariant: ['tabular-nums'],
  },
  inputs: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  input: {
    flex: 1,
  },
  hint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  phaseActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  phaseAction: {
    flex: 1,
  },
  confirm: {
    gap: spacing.md,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  confirmButton: {
    flex: 1,
  },
});
