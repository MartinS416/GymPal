import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { Chevron } from '@/components/chevron';
import { ExercisePicker } from '@/components/exercise-picker';
import { LoadingScreen } from '@/components/loading-screen';
import { NewExerciseGlow } from '@/components/new-exercise-glow';
import { SessionPhasePage } from '@/components/session-phase-page';
import { Text } from '@/components/text';
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
  type WorkoutWorkPhase,
  swapSessionExercise,
  setSessionPhaseIndex,
  swapSessionExercisePositions,
} from '@/workouts/session-runner';
import { buildSessionPhaseView } from '@/workouts/session-view';
import { lbToKg } from '@/lib/units';

const noop = () => {};

/**
 * The active workout.
 *
 * The screen is a timeline of phases. Swiping left moves on — logging the set
 * and starting the rest — and swiping right goes back. The neighbouring phase
 * is drawn beside the current one, so the screen slides directly from one phase
 * to the next instead of leaving a blank gap that fills in after loading. The
 * platform back gesture is disabled on this route so the swipe belongs to the
 * workout.
 *
 * The clock is in the middle, and the whole screen inverts while the user
 * rests. While a set is in focus the exercise name opens the exercise library
 * so the user can swap movements, the + / − beside the clock add and remove
 * sets, and the options button opens the full workout list with drag to
 * reorder.
 */
export default function ActiveSessionScreen() {
  const router = useRouter();
  const database = useDatabase();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
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
  const [peekDirection, setPeekDirection] = useState<'next' | 'back' | null>(null);
  const [input, setInput] = useState<{ key: string; weight: string; reps: string } | null>(null);

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
  const currentExercise = phases[phaseIndex]?.exercise ?? null;
  const system: 'metric' | 'imperial' = profile?.system ?? 'metric';

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

  // The phase being dragged in. Its own performance is loaded as soon as the
  // drag starts, so the previewed page opens with the right numbers.
  // Clamped to the timeline: a swipe past either end brings in the page that is
  // already on screen, so the strip still shows content instead of a blank.
  const peekPhaseIndex = peekDirection === 'next'
    ? Math.min(phases.length, phaseIndex + 1)
    : peekDirection === 'back'
      ? Math.max(0, phaseIndex - 1)
      : null;
  const showPeek = peekDirection !== null;
  const peekExercise = showPeek && peekPhaseIndex !== null
    ? phases[peekPhaseIndex]?.exercise ?? null
    : null;

  const peekPreviousLoader = useCallback(async () => {
    if (!peekExercise) {
      return null;
    }
    return database.getPreviousPerformance(peekExercise.exerciseId, {
      excludeSessionId: Number(sessionId),
    });
  }, [database, peekExercise, sessionId]);
  const { data: peekPrevious } = useAsyncData<PreviousPerformance | null>(peekPreviousLoader);

  const view = useMemo(
    () => buildSessionPhaseView({
      phases,
      phaseIndex,
      exercises,
      sets,
      session,
      now,
      system,
      previous,
      input,
    }),
    [exercises, input, now, phaseIndex, phases, previous, session, sets, system]
  );

  const peekView = useMemo(
    () => (showPeek && peekPhaseIndex !== null
      ? buildSessionPhaseView({
          phases,
          phaseIndex: peekPhaseIndex,
          exercises,
          sets,
          session,
          now,
          system,
          previous: peekPrevious,
          input: null,
          preview: true,
        })
      : null),
    [exercises, now, peekPhaseIndex, peekPrevious, phases, session, sets, showPeek, system]
  );

  // The rest is not cut short: once it is over the countdown goes negative and
  // blinks until the user moves on.
  const blink = useBlink(view.restOverdue);

  const phase = view.phase;

  const setsForCurrent = useMemo(
    () =>
      currentExercise
        ? sets.filter((set) => set.exerciseId === currentExercise.exerciseId && set.isCompleted)
        : [],
    [currentExercise, sets]
  );

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

  // The values shown in the fields are already the user's; typing only has to
  // remember the other field for the same set.
  const handleWeightChange = (weight: string) => {
    setInput({ key: view.inputKey, weight, reps: view.repsValue });
  };

  const handleRepsChange = (reps: string) => {
    setInput({ key: view.inputKey, weight: view.weightValue, reps });
  };

  /**
   * Leaves the current phase.
   *
   * Returns whether the timeline actually moved, so the swipe can slide back if
   * the set was rejected.
   */
  const handleNext = useCallback(async (): Promise<boolean> => {
    if (!session || phaseIndex >= phases.length) {
      return false;
    }
    setSaving(true);
    setInputError(null);
    try {
      const enteredWeight = view.weightValue.trim() === '' ? null : Number(view.weightValue.replace(',', '.'));
      const weightKg = enteredWeight === null ? null : system === 'imperial' ? lbToKg(enteredWeight) : enteredWeight;
      const repsNumber = view.repsValue.trim() === '' ? null : Number.parseInt(view.repsValue, 10);
      if (view.subjectSetKind === 'amrap' && repsNumber === null) {
        setInputError('Enter the reps you completed for this AMRAP set.');
        return false;
      }
      const nextIndex = await advancePhase(database, session.id, phases, phaseIndex, {
        weightKg,
        reps: repsNumber,
        rpe: null,
      });
      reload();
      return nextIndex !== phaseIndex;
    } finally {
      setSaving(false);
    }
  }, [database, phaseIndex, phases, reload, session, system, view.repsValue, view.subjectSetKind, view.weightValue]);

  const handleBack = useCallback(async (): Promise<boolean> => {
    if (!session || phaseIndex === 0) {
      return false;
    }
    setSaving(true);
    try {
      await goBackPhase(database, session.id, phases, phaseIndex);
      reload();
      return true;
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
      await switchSessionPhase(database.raw, session.id, {
        kind: 'work',
        restSeconds: 0,
        phaseIndex: nextIndex,
        stop: true,
      });
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

    const enteredWeight = view.weightValue.trim() === '' ? null : Number(view.weightValue.replace(',', '.'));
    const weightKg = enteredWeight === null ? null : system === 'imperial' ? lbToKg(enteredWeight) : enteredWeight;
    const repsNumber = view.repsValue.trim() === '' ? null : Number.parseInt(view.repsValue, 10);
    setSaving(true);
    try {
      await logSetAt(database, session.id, phase.exercise.exerciseId, phase.setNumber, {
        weightKg, reps: repsNumber, rpe: null,
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
        await switchSessionPhase(database.raw, session.id, {
          kind: 'work',
          restSeconds: 0,
          phaseIndex: phases.length,
          stop: true,
        });
      }
      reload();
    } catch {
      setInputError('The current set could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [database, phase, phaseIndex, phases, reload, session, system, view.repsValue, view.weightValue]);

  // The swipe is the way through the workout: left starts the rest, right goes
  // back to the work. The adjacent phase is drawn beside the current one while
  // the finger moves, so the slide always shows real content.
  const {
    gestureHandlers,
    translateX: swipeTranslateX,
    finishSwipe,
  } = useSwipeNavigation({
    onNext: handleNext,
    onBack: handleBack,
    enabled: !confirmingFinish && !workoutEditorOpen && !pickerOpen && !menuOpen,
    canNext: phaseIndex < phases.length,
    animated: true,
    onPeek: setPeekDirection,
  });

  // A completed swipe leaves the arriving page on screen. Once the timeline has
  // actually moved it is the real page, so the strip is put back at rest and the
  // preview is dropped: because both show the same phase, nothing appears to
  // move.
  const lastPhaseIndex = useRef(phaseIndex);
  useLayoutEffect(() => {
    if (lastPhaseIndex.current === phaseIndex) {
      return;
    }
    lastPhaseIndex.current = phaseIndex;
    swipeTranslateX.setValue(0);
    setPeekDirection(null);
    finishSwipe();
  }, [finishSwipe, phaseIndex, swipeTranslateX]);

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
        const candidate = updatedPhases[i];
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
      const swappedAt = Date.now();
      await database.raw.runAsync(
        `UPDATE workout_sessions
            SET current_exercise_id = ?, exercise_elapsed_seconds = 0, exercise_started_at = ?, updated_at = ?
          WHERE id = ?`,
        exercise.id,
        swappedAt,
        swappedAt,
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

  const [stillBlink] = useState(() => new Animated.Value(1));

  if (status === 'loading') {
    return <LoadingScreen label="Loading your profile" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  if (!session) {
    return <LoadingScreen label="Opening the workout" />;
  }

  const toggleMenu = () => {
    haptics.press();
    setMenuOpen((open) => !open);
  };

  // The first phase of an exercise is where the movement begins: the edge of
  // the screen glows green.
  const newExerciseTrigger = phase?.kind === 'work' && phase.setNumber === 1
    ? `${phase.exercise.id}:${phase.setNumber}`
    : null;

  return (
    <View style={styles.screen}>
      <View style={styles.stage} testID="session-screen" {...gestureHandlers}>
        <Animated.View
          style={[styles.strip, { transform: [{ translateX: swipeTranslateX }] }]}>
          {/*
            The neighbouring phase, already drawn, sits exactly one page away on
            the side the swipe is coming from.
          */}
          {peekView && peekDirection ? (
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.peek,
                { left: peekDirection === 'next' ? width : -width, width },
              ]}>
              <SessionPhasePage
                view={peekView}
                blink={stillBlink}
                topInset={insets.top}
                menuOpen={false}
                dotsRotate={dotsRotate}
                onToggleMenu={noop}
                onOpenPicker={noop}
                onWeightChange={noop}
                onRepsChange={noop}
                onAddSet={noop}
                onRemoveSet={noop}
                onSkipSupersetMember={noop}
                onSkipWarmup={noop}
                onSkipRemainingDrops={noop}
                inputError={null}
                saving={false}
                confirmingFinish={false}
                onCancelFinish={noop}
                onShowFinish={noop}
                onFinish={noop}
              />
            </View>
          ) : null}

          <View style={styles.page}>
            <SessionPhasePage
              view={view}
              blink={blink}
              topInset={insets.top}
              menuOpen={menuOpen}
              dotsRotate={dotsRotate}
              onToggleMenu={toggleMenu}
              onOpenPicker={() => setPickerOpen(true)}
              onWeightChange={handleWeightChange}
              onRepsChange={handleRepsChange}
              onAddSet={() => void handleAddSet()}
              onRemoveSet={() => void handleRemoveSet()}
              onSkipSupersetMember={() => void handleSkipSupersetMember()}
              onSkipWarmup={() => void handleSkipWarmup()}
              onSkipRemainingDrops={() => void handleSkipRemainingDrops()}
              inputError={inputError}
              saving={saving}
              confirmingFinish={confirmingFinish}
              onCancelFinish={() => setConfirmingFinish(false)}
              onShowFinish={() => setConfirmingFinish(true)}
              onFinish={() => void handleFinish()}
            />
          </View>
        </Animated.View>
      </View>

      <NewExerciseGlow trigger={newExerciseTrigger} />

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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  stage: {
    flex: 1,
    overflow: 'hidden',
  },
  strip: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  peek: {
    position: 'absolute',
    top: 0,
    bottom: 0,
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
});
